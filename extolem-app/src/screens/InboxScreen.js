import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  RefreshControl, TextInput, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, shadow, avatarColor, initials } from '../theme';
import { getConversations } from '../api';

function parseDate(dateStr) {
  if (!dateStr) return null;
  const normalized = dateStr.includes('T') ? dateStr : dateStr.replace(' ', 'T');
  const withZone = normalized.match(/[zZ]|[+-]\d\d:?\d\d$/) ? normalized : normalized + 'Z';
  const d = new Date(withZone);
  return isNaN(d.getTime()) ? null : d;
}

function timeAgo(dateStr) {
  const d = parseDate(dateStr);
  if (!d) return '';
  const m = Math.floor((Date.now() - d.getTime()) / 60000);
  if (m < 1) return 'now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const days = Math.floor(h / 24);
  return days < 7 ? `${days}d` : `${Math.floor(days / 7)}w`;
}

function Avatar({ name, size = 54 }) {
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

  const filtered = conversations.filter((c) =>
    (c.client_name || c.client_username || '').toLowerCase().includes(search.toLowerCase())
  );
  const totalUnread = conversations.reduce((a, c) => a + (c.unread_count || 0), 0);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.brand}>EXTOLEM</Text>
          <View style={styles.titleRow}>
            <Text style={styles.title}>Messages</Text>
            {totalUnread > 0 && (
              <View style={styles.unreadPill}>
                <Text style={styles.unreadPillText}>{totalUnread}</Text>
              </View>
            )}
          </View>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={() => navigation.navigate('NewConversation')} activeOpacity={0.85}>
          <Ionicons name="create-outline" size={21} color="#fff" />
        </TouchableOpacity>
      </View>

      <View style={styles.searchWrap}>
        <Ionicons name="search" size={18} color={colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search clients"
          placeholderTextColor={colors.textMuted}
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close-circle" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.accent} size="large" /></View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => String(item.instagram_thread_id)}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.accent} />}
          contentContainerStyle={{ paddingBottom: 24, flexGrow: 1 }}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <View style={styles.emptyIcon}>
                <Ionicons name="chatbubbles-outline" size={36} color={colors.accent} />
              </View>
              <Text style={styles.emptyTitle}>No conversations yet</Text>
              <Text style={styles.emptySub}>Instagram DMs sync here automatically. Pull down to refresh.</Text>
              <TouchableOpacity style={styles.emptyBtn} onPress={() => navigation.navigate('NewConversation')} activeOpacity={0.85}>
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
                activeOpacity={0.6}
              >
                <View>
                  <Avatar name={name} />
                  {unread && <View style={styles.dot} />}
                </View>
                <View style={styles.cardBody}>
                  <View style={styles.cardTop}>
                    <Text style={[styles.name, unread && styles.nameBold]} numberOfLines={1}>{name}</Text>
                    <Text style={[styles.time, unread && { color: colors.accent }]}>{timeAgo(item.last_message_time)}</Text>
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
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 14, paddingBottom: 14 },
  brand: { fontSize: 10, fontWeight: '800', color: colors.accent, letterSpacing: 2.5, marginBottom: 4 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { fontSize: 30, fontWeight: '800', color: colors.textPrimary, letterSpacing: -0.5 },
  unreadPill: { backgroundColor: colors.accent, borderRadius: radius.full, minWidth: 24, paddingHorizontal: 8, paddingVertical: 2, alignItems: 'center' },
  unreadPillText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  addBtn: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', ...shadow.subtle, shadowColor: colors.accent },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.bgCard,
    borderRadius: radius.full, marginHorizontal: 20, marginBottom: 8,
    paddingHorizontal: 16, paddingVertical: 12,
  },
  searchInput: { flex: 1, color: colors.textPrimary, fontSize: 15 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingVertical: 12 },
  separator: { height: 1, backgroundColor: colors.borderSoft, marginLeft: 88 },
  avatar: { alignItems: 'center', justifyContent: 'center' },
  dot: { position: 'absolute', top: -1, right: -1, width: 15, height: 15, borderRadius: 8, backgroundColor: colors.accent, borderWidth: 3, borderColor: colors.bg },
  cardBody: { flex: 1 },
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
  emptyIcon: { width: 88, height: 88, borderRadius: 44, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 22 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: colors.textPrimary, marginBottom: 8 },
  emptySub: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: 26, maxWidth: 280 },
  emptyBtn: { flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: colors.accent, paddingHorizontal: 20, paddingVertical: 13, borderRadius: radius.full },
  emptyBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
});
