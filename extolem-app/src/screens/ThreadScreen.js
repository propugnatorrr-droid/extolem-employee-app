import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  TextInput, ActivityIndicator, Alert, Keyboard, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { colors, radius, avatarColor, initials } from '../theme';
import { getMessages, markReplied, suggestReply, askAI } from '../api';

function formatTime(dateStr) {
  if (!dateStr) return '';
  const d = new Date((dateStr || '').replace(' ', 'T') + (dateStr.includes('Z') ? '' : 'Z'));
  if (isNaN(d.getTime())) return '';
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function ThreadScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const { thread } = route.params;
  const name = thread.client_name || thread.client_username || 'Instagram User';

  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [question, setQuestion] = useState('');
  const [aiAnswer, setAiAnswer] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const listRef = useRef(null);

  useEffect(() => {
    loadMessages();
    const interval = setInterval(loadMessages, 10000);
    return () => clearInterval(interval);
  }, []);

  async function loadMessages() {
    try {
      const data = await getMessages(thread.instagram_thread_id);
      setMessages(Array.isArray(data) ? data : []);
    } catch (e) { /* keep */ }
    finally { setLoading(false); }
  }

  async function handleSuggest() {
    const clientMsgs = messages.filter(m => m.sender === 'client');
    if (!clientMsgs.length) return Alert.alert('Nothing to reply to', 'No client messages in this conversation yet.');
    const last = clientMsgs[clientMsgs.length - 1];
    setSuggestLoading(true);
    setAiAnswer('');
    try {
      const { suggestion } = await suggestReply(last.text, thread.instagram_thread_id);
      setAiAnswer(suggestion);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch (e) {
      Alert.alert('Error', 'Could not generate a suggestion. Try again.');
    } finally { setSuggestLoading(false); }
  }

  async function handleAsk() {
    if (!question.trim()) return;
    Keyboard.dismiss();
    setAiLoading(true);
    setAiAnswer('');
    try {
      const { answer } = await askAI(question, thread.instagram_thread_id);
      setAiAnswer(answer);
    } catch (e) {
      Alert.alert('Error', 'AI request failed. Try again.');
    } finally { setAiLoading(false); }
  }

  async function copyText(text) {
    await Clipboard.setStringAsync(text);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    Alert.alert('Copied', 'Reply copied — paste it into Instagram.');
  }

  async function handleMarkReplied() {
    try { await markReplied(thread.instagram_thread_id); loadMessages(); } catch (e) {}
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  }

  const renderMessage = ({ item }) => {
    const isClient = item.sender === 'client';
    return (
      <View style={[styles.row, isClient ? styles.rowLeft : styles.rowRight]}>
        <TouchableOpacity
          activeOpacity={0.85}
          onLongPress={() => copyText(item.text)}
          style={[styles.bubble, isClient ? styles.bubbleClient : styles.bubbleMe]}
        >
          <Text style={[styles.bubbleText, !isClient && { color: '#fff' }]}>{item.text}</Text>
          <Text style={[styles.bubbleTime, !isClient && { color: 'rgba(255,255,255,0.6)' }]}>{formatTime(item.timestamp)}</Text>
        </TouchableOpacity>
        {isClient && item.ai_suggestion ? (
          <TouchableOpacity style={styles.sugPill} onPress={() => setAiAnswer(item.ai_suggestion)} activeOpacity={0.8}>
            <Ionicons name="sparkles" size={12} color={colors.accentLight} />
            <Text style={styles.sugPillText} numberOfLines={1}>{item.ai_suggestion}</Text>
            <Ionicons name="chevron-forward" size={13} color={colors.textMuted} />
          </TouchableOpacity>
        ) : null}
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="chevron-back" size={26} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={[styles.hAvatar, { backgroundColor: avatarColor(name) }]}>
          <Text style={styles.hAvatarText}>{initials(name)}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.hName} numberOfLines={1}>{name}</Text>
          <Text style={styles.hSub}>Instagram · @{thread.client_username || 'user'}</Text>
        </View>
        <TouchableOpacity style={styles.hCheck} onPress={handleMarkReplied} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="checkmark-done" size={22} color={colors.success} />
        </TouchableOpacity>
      </View>

      {/* Messages */}
      {loading ? (
        <ActivityIndicator color={colors.accent} style={{ flex: 1 }} />
      ) : messages.length === 0 ? (
        <View style={styles.emptyMsgs}>
          <Ionicons name="time-outline" size={32} color={colors.textMuted} />
          <Text style={styles.emptyMsgsText}>Messages are syncing…</Text>
          <Text style={styles.emptyMsgsSub}>This conversation will populate within a few seconds.</Text>
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={item => String(item.id || item.instagram_message_id)}
          contentContainerStyle={{ padding: 16, paddingBottom: 12 }}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          renderItem={renderMessage}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* AI suggestion card */}
      {aiAnswer ? (
        <View style={styles.aiCard}>
          <View style={styles.aiHead}>
            <Ionicons name="sparkles" size={14} color={colors.accentLight} />
            <Text style={styles.aiHeadText}>AI Suggested Reply</Text>
            <TouchableOpacity onPress={() => setAiAnswer('')} style={{ marginLeft: 'auto' }}>
              <Ionicons name="close" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
          <Text style={styles.aiText}>{aiAnswer}</Text>
          <TouchableOpacity style={styles.copyBtn} onPress={() => copyText(aiAnswer)}>
            <Ionicons name="copy-outline" size={15} color="#fff" />
            <Text style={styles.copyBtnText}>Copy Reply</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* Bottom bar */}
      <View style={[styles.bottom, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <TouchableOpacity style={styles.suggestBtn} onPress={handleSuggest} disabled={suggestLoading} activeOpacity={0.85}>
          {suggestLoading
            ? <ActivityIndicator color={colors.accentLight} size="small" />
            : <><Ionicons name="sparkles" size={16} color={colors.accentLight} /><Text style={styles.suggestBtnText}>Suggest Reply</Text></>}
        </TouchableOpacity>
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            placeholder="Ask AI about this client…"
            placeholderTextColor={colors.textMuted}
            value={question}
            onChangeText={setQuestion}
            multiline
          />
          <TouchableOpacity style={[styles.send, !question.trim() && { opacity: 0.5 }]} onPress={handleAsk} disabled={aiLoading || !question.trim()}>
            {aiLoading ? <ActivityIndicator color="#fff" size="small" /> : <Ionicons name="arrow-up" size={20} color="#fff" />}
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 12, paddingBottom: 12,
    backgroundColor: colors.bgElevated, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  backBtn: { padding: 2 },
  hAvatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  hAvatarText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  hName: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  hSub: { fontSize: 12, color: colors.textMuted, marginTop: 1 },
  hCheck: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.successBg },

  row: { marginBottom: 14, maxWidth: '85%' },
  rowLeft: { alignSelf: 'flex-start', alignItems: 'flex-start' },
  rowRight: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  bubble: { borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10 },
  bubbleClient: { backgroundColor: colors.bgCard, borderTopLeftRadius: 5, borderWidth: 1, borderColor: colors.border },
  bubbleMe: { backgroundColor: colors.accent, borderTopRightRadius: 5 },
  bubbleText: { fontSize: 15, color: colors.textPrimary, lineHeight: 21 },
  bubbleTime: { fontSize: 10, color: colors.textMuted, marginTop: 4, alignSelf: 'flex-end' },
  sugPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6,
    backgroundColor: colors.accentGlow, borderRadius: radius.full, paddingHorizontal: 12, paddingVertical: 6,
    borderWidth: 1, borderColor: colors.accent + '40', maxWidth: '100%',
  },
  sugPillText: { fontSize: 12, color: colors.textSecondary, flex: 1 },

  emptyMsgs: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 8 },
  emptyMsgsText: { fontSize: 16, fontWeight: '600', color: colors.textSecondary, marginTop: 8 },
  emptyMsgsSub: { fontSize: 13, color: colors.textMuted, textAlign: 'center' },

  aiCard: { backgroundColor: colors.bgCard, marginHorizontal: 12, borderRadius: radius.lg, padding: 14, borderWidth: 1, borderColor: colors.accent + '40', marginBottom: 6 },
  aiHead: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  aiHeadText: { fontSize: 13, fontWeight: '700', color: colors.accentLight },
  aiText: { fontSize: 15, color: colors.textPrimary, lineHeight: 22, marginBottom: 12 },
  copyBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, backgroundColor: colors.accent, borderRadius: radius.md, paddingVertical: 12 },
  copyBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  bottom: { backgroundColor: colors.bgElevated, borderTopWidth: 1, borderTopColor: colors.border, paddingHorizontal: 12, paddingTop: 10, gap: 10 },
  suggestBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    backgroundColor: colors.accentGlow, borderRadius: radius.md, paddingVertical: 11,
    borderWidth: 1, borderColor: colors.accent + '40',
  },
  suggestBtnText: { color: colors.accentLight, fontWeight: '700', fontSize: 14 },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  input: {
    flex: 1, backgroundColor: colors.bgInput, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: 14, paddingVertical: 12, color: colors.textPrimary, fontSize: 15, maxHeight: 100,
  },
  send: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
});
