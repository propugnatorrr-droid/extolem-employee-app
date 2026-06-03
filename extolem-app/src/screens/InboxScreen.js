import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  RefreshControl, TextInput, ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, radius } from '../theme';
import { getConversations } from '../api';

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function Avatar({ name, size = 44 }) {
  const initials = (name || '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  const hue = (name || '').split('').reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2, backgroundColor: `hsl(${hue}, 50%, 30%)` }]}>
      <Text style={[fonts.bold, { color: colors.white, fontSize: size * 0.38 }]}>{initials}</Text>
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
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(() => load(), 15000); // poll every 15s
    return () => clearInterval(interval);
  }, [load]);

  const filtered = conversations.filter(c =>
    (c.client_name || '').toLowerCase().includes(search.toLowerCase())
  );

  const totalUnread = conversations.reduce((a, c) => a + (c.unread_count || 0), 0);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Inbox</Text>
          {totalUnread > 0 && (
            <Text style={styles.headerSub}>{totalUnread} unread message{totalUnread !== 1 ? 's' : ''}</Text>
          )}
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={() => navigation.navigate('NewConversation')}>
          <Ionicons name="add" size={22} color={colors.white} />
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={styles.searchRow}>
        <Ionicons name="search" size={16} color={colors.textMuted} style={{ marginRight: 8 }} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search conversations..."
          placeholderTextColor={colors.textMuted}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {/* List */}
      <FlatList
        data={filtered}
        keyExtractor={item => item.instagram_thread_id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.accent} />}
        contentContainerStyle={{ paddingBottom: 20 }}
        ListEmptyComponent={
          <View style={styles.center}>
            <Ionicons name="chatbubbles-outline" size={48} color={colors.textMuted} />
            <Text style={styles.emptyText}>No conversations yet</Text>
            <Text style={styles.emptySubText}>Instagram DMs will appear here automatically</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.card, item.unread_count > 0 && styles.cardUnread]}
            onPress={() => navigation.navigate('Thread', { thread: item })}
            activeOpacity={0.7}
          >
            <Avatar name={item.client_name} />
            <View style={styles.cardBody}>
              <View style={styles.cardRow}>
                <Text style={styles.clientName} numberOfLines={1}>{item.client_name || 'Unknown'}</Text>
                <Text style={styles.timeText}>{timeAgo(item.last_message_time)}</Text>
              </View>
              <View style={styles.cardRow}>
                <Text style={styles.lastMessage} numberOfLines={1}>
                  {item.last_message || 'No messages yet'}
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 60, paddingBottom: 16,
  },
  headerTitle: { ...fonts.extrabold, fontSize: 28, color: colors.textPrimary },
  headerSub: { ...fonts.regular, fontSize: 13, color: colors.accent, marginTop: 2 },
  addBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: colors.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  searchRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bgCard,
    borderRadius: radius.md, marginHorizontal: 20, marginBottom: 12,
    paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: colors.border,
  },
  searchInput: { flex: 1, ...fonts.regular, color: colors.textPrimary, fontSize: 14 },
  card: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  cardUnread: { backgroundColor: colors.accentGlow2 },
  avatar: { alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  cardBody: { flex: 1 },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 },
  clientName: { ...fonts.semibold, fontSize: 15, color: colors.textPrimary, flex: 1 },
  timeText: { ...fonts.regular, fontSize: 12, color: colors.textMuted, marginLeft: 8 },
  lastMessage: { ...fonts.regular, fontSize: 13, color: colors.textSecondary, flex: 1 },
  badge: {
    backgroundColor: colors.accent, borderRadius: 10, minWidth: 20, height: 20,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5, marginLeft: 8,
  },
  badgeText: { ...fonts.bold, fontSize: 11, color: colors.white },
  emptyText: { ...fonts.semibold, fontSize: 16, color: colors.textSecondary, marginTop: 16 },
  emptySubText: { ...fonts.regular, fontSize: 13, color: colors.textMuted, marginTop: 6, textAlign: 'center' },
});
