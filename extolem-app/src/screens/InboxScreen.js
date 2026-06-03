import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  RefreshControl, TextInput, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, avatarColor, initials } from '../theme';
import { getConversations } from '../api';

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const d = new Date((dateStr || '').replace(' ', 'T') + (dateStr.includes('Z') ? '' : 'Z'));
  const diff = Date.now() - d.getTime();
  if (isNaN(diff)) return '';
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

function Avatar({ name, size = 52 }) {
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2, backgroundColor: avatarColor(name) }]}>
      <Text style={{ color: '#fff', fontSize: size * 0.36, fontWeight: '700' }}>{initials(name)}</Text>
    </View>
  );
}

export default function InboxScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const data = await getConversations();
      setConversations(Array.isArray(data) ? data : []);
    } catch (e) { /* keep last good state */ }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(() => load(), 12000);
    return () => clearInterval(interval);
  }, [load]);

  const filtered = conversations.filter(c =>
    (c.client_name || c.client_username || '').toLowerCase().includes(search.toLowerCase())
  );
  const totalUnread = conversations.reduce((a, c) => a + (c.unread_count || 0), 0);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.brand}>EXTOLEM</Text>
          <View style={styles.titleRow}>
            <Text style={styles.title}>Messages</Text>
            {totalUnread > 0 && (
              <View style={styles.unreadPill}>
                <Text style={styles.unreadPillText}>{totalUnread} new</Text>
              </View>
            )}
          </View>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={() => navigation.navigate('NewConversation')} activeOpacity={0.8}>
          <Ionicons name="create-outline" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={styles.searchWrap}>
        <Ionicons name="search-outline" size={17} color={colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search clients..."
          placeholderTextColor={colors.textMuted}
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.accent} size="large" /></View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.instagram_thread_id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.accent} />}
          contentContainerStyle={{ paddingBottom: 24, flexGrow: 1 }}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.empty}>
              <View style={styles.emptyIcon}>
                <Ionicons name="chatbubbles-outline" size={38} color={colors.accent} />
              </View>
              <Text style={styles.emptyTitle}>No conversations yet</Text>
              <Text style={styles.emptySub}>Instagram DMs sync here automatically.{'\n'}Pull down to refresh.</Text>
              <TouchableOpacity style={styles.emptyBtn} onPress={() => navigation.navigate('NewConversation')}>
                <Ionicons name="add" size={16} color="#fff" />
                <Text style={styles.emptyBtnText}>Add a message manually</Text>
              </TouchableOpacity>
            </View>
          }
          renderItem={({ item }) => {
            const name = item.client_name || item.client_username || 'Instagram User';
            const unread = item.unread_count > 0;
            return (
              <TouchableOpacity
                style={styles.card}
                onPress={() => navigation.navigate('Thread', { thread: item })}
                activeOpacity={0.7}
              >
                <View>
                  <Avatar name={name} />
                  {unread && <View style={styles.dot} />}
                </View>
                <View style={styles.cardBody}>
                  <View style={styles.cardTop}>
                    <Text style={[styles.name, unread && styles.nameBold]} numberOfLines={1}>{name}</Text>
                    <Text style={styles.time}>{timeAgo(item.last_message_time)}</Text>
                  </View>
                  <View style={styles.cardBottom}>
                    <Text style={[styles.preview, unread && styles.previewUnread]} numberOfLines={1}>
                      {item.last_message || 'Tap to open conversation'}
                    </Text>
                    {unread && (
                      <View style={styles.badge}><Text style={styles.badgeText}>{item.unread_count}</Text></View>
                    )}
                  </View>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16 },
  brand: { fontSize: 11, fontWeight: '800', color: colors.accent, letterSpacing: 3, marginBottom: 3 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { fontSize: 28, fontWeight: '800', color: colors.textPrimary },
  unreadPill: { backgroundColor: colors.accentGlow, borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 3 },
  unreadPillText: { color: colors.accentLight, fontSize: 12, fontWeight: '700' },
  addBtn: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: colors.accent,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: colors.accent, shadowOpacity: 0.4, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 5,
  },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.bgCard,
    borderRadius: radius.lg, marginHorizontal: 20, marginBottom: 14,
    paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: colors.border,
  },
  searchInput: { flex: 1, color: colors.textPrimary, fontSize: 15 },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingHorizontal: 20, paddingVertical: 13,
  },
  avatar: { alignItems: 'center', justifyContent: 'center' },
  dot: {
    position: 'absolute', top: 0, right: 0, width: 14, height: 14, borderRadius: 7,
    backgroundColor: colors.accent, borderWidth: 2.5, borderColor: colors.bg,
  },
  cardBody: { flex: 1, borderBottomWidth: 1, borderBottomColor: colors.border, paddingBottom: 13 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  name: { fontSize: 16, fontWeight: '600', color: colors.textPrimary, flex: 1, marginRight: 8 },
  nameBold: { fontWeight: '700' },
  time: { fontSize: 12, color: colors.textMuted, fontWeight: '500' },
  cardBottom: { flexDirection: 'row', alignItems: 'center' },
  preview: { flex: 1, fontSize: 14, color: colors.textSecondary, marginRight: 8 },
  previewUnread: { color: colors.textPrimary, fontWeight: '500' },
  badge: { backgroundColor: colors.accent, borderRadius: 11, minWidth: 22, height: 22, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  badgeText: { fontSize: 12, fontWeight: '700', color: '#fff' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyIcon: { width: 84, height: 84, borderRadius: 42, backgroundColor: colors.accentGlow, alignItems: 'center', justifyContent: 'center', marginBottom: 22 },
  emptyTitle: { fontSize: 19, fontWeight: '700', color: colors.textPrimary, marginBottom: 8 },
  emptySub: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: 26 },
  emptyBtn: { flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: colors.accent, paddingHorizontal: 20, paddingVertical: 13, borderRadius: radius.lg },
  emptyBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
});
