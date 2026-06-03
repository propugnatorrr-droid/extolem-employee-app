import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  RefreshControl, TextInput, ActivityIndicator, SafeAreaView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, radius } from '../theme';
import { getConversations } from '../api';

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

function Avatar({ name, size = 48 }) {
  const initials = (name || '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  const colors_list = ['#6366F1', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#3B82F6'];
  const idx = (name || '').split('').reduce((a, c) => a + c.charCodeAt(0), 0) % colors_list.length;
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2, backgroundColor: colors_list[idx] }]}>
      <Text style={{ color: '#fff', fontSize: size * 0.38, fontWeight: '700' }}>{initials}</Text>
    </View>
  );
}

export default function InboxScreen({ navigation }) {
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const data = await getConversations();
      setConversations(data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(() => load(), 15000);
    return () => clearInterval(interval);
  }, [load]);

  const filtered = conversations.filter(c =>
    (c.client_name || '').toLowerCase().includes(search.toLowerCase())
  );
  const totalUnread = conversations.reduce((a, c) => a + (c.unread_count || 0), 0);

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.brand}>EXTOLEM</Text>
          <Text style={styles.headerTitle}>
            Messages {totalUnread > 0 && <Text style={styles.unreadCount}>({totalUnread} new)</Text>}
          </Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={() => navigation.navigate('NewConversation')}>
          <Ionicons name="create-outline" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={styles.searchWrap}>
        <Ionicons name="search-outline" size={16} color={colors.textMuted} style={{ marginRight: 8 }} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search clients..."
          placeholderTextColor={colors.textMuted}
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={16} color={colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} size="large" />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.instagram_thread_id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.accent} />}
          contentContainerStyle={{ paddingBottom: 24, flexGrow: 1 }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <View style={styles.emptyIcon}>
                <Ionicons name="chatbubbles-outline" size={40} color={colors.accent} />
              </View>
              <Text style={styles.emptyTitle}>No conversations yet</Text>
              <Text style={styles.emptySub}>Instagram DMs will appear here{'\n'}automatically every 15 seconds</Text>
              <TouchableOpacity style={styles.newBtn} onPress={() => navigation.navigate('NewConversation')}>
                <Ionicons name="add" size={16} color="#fff" style={{ marginRight: 6 }} />
                <Text style={styles.newBtnText}>Add Manual Message</Text>
              </TouchableOpacity>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.card, item.unread_count > 0 && styles.cardActive]}
              onPress={() => navigation.navigate('Thread', { thread: item })}
              activeOpacity={0.75}
            >
              <View style={styles.avatarWrap}>
                <Avatar name={item.client_name} />
                {item.unread_count > 0 && <View style={styles.onlineDot} />}
              </View>
              <View style={styles.cardContent}>
                <View style={styles.cardTop}>
                  <Text style={styles.clientName} numberOfLines={1}>{item.client_name || 'Instagram User'}</Text>
                  <Text style={styles.timeText}>{timeAgo(item.last_message_time)}</Text>
                </View>
                <View style={styles.cardBottom}>
                  <Text style={[styles.lastMsg, item.unread_count > 0 && styles.lastMsgBold]} numberOfLines={1}>
                    {item.last_message || 'Tap to view conversation'}
                  </Text>
                  {item.unread_count > 0 && (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{item.unread_count}</Text>
                    </View>
                  )}
                </View>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: 20,
  },
  brand: { fontSize: 11, fontWeight: '800', color: colors.accent, letterSpacing: 3, marginBottom: 2 },
  headerTitle: { fontSize: 26, fontWeight: '800', color: colors.textPrimary },
  unreadCount: { color: colors.accent, fontSize: 18 },
  addBtn: {
    width: 42, height: 42, borderRadius: 21, backgroundColor: colors.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bgCard,
    borderRadius: radius.lg, marginHorizontal: 20, marginBottom: 16,
    paddingHorizontal: 14, paddingVertical: 12,
    borderWidth: 1, borderColor: colors.border,
  },
  searchInput: { flex: 1, color: colors.textPrimary, fontSize: 14 },
  card: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  cardActive: { backgroundColor: 'rgba(37,99,235,0.06)' },
  avatarWrap: { position: 'relative', marginRight: 14 },
  avatar: { alignItems: 'center', justifyContent: 'center' },
  onlineDot: {
    position: 'absolute', bottom: 1, right: 1,
    width: 13, height: 13, borderRadius: 7,
    backgroundColor: colors.success, borderWidth: 2, borderColor: colors.bg,
  },
  cardContent: { flex: 1 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  clientName: { fontSize: 15, fontWeight: '600', color: colors.textPrimary, flex: 1, marginRight: 8 },
  timeText: { fontSize: 12, color: colors.textMuted },
  cardBottom: { flexDirection: 'row', alignItems: 'center' },
  lastMsg: { flex: 1, fontSize: 13, color: colors.textSecondary },
  lastMsgBold: { color: colors.textPrimary, fontWeight: '500' },
  badge: {
    backgroundColor: colors.accent, borderRadius: 10, minWidth: 20, height: 20,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5, marginLeft: 8,
  },
  badgeText: { fontSize: 11, fontWeight: '700', color: '#fff' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, marginTop: 60 },
  emptyIcon: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(37,99,235,0.1)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 20,
  },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: colors.textPrimary, marginBottom: 8 },
  emptySub: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: 28 },
  newBtn: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.accent,
    paddingHorizontal: 20, paddingVertical: 12, borderRadius: radius.lg,
  },
  newBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
});
