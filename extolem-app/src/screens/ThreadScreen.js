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

// ─── Emotion → visual mapping ─────────────────────────────────
const EMOTION_CONFIG = {
  EXCITED:       { color: '#22C55E', bg: 'rgba(34,197,94,0.10)',  icon: 'trending-up',  label: 'Excited' },
  CURIOUS:       { color: '#60A5FA', bg: 'rgba(96,165,250,0.10)',  icon: 'help-circle', label: 'Curious' },
  SKEPTICAL:     { color: '#F59E0B', bg: 'rgba(245,158,11,0.10)',  icon: 'warning',     label: 'Skeptical' },
  PRICE_OBJECTING:{ color: '#F97316', bg: 'rgba(249,115,22,0.10)', icon: 'cash',        label: 'Price-Sensitive' },
  COLD:          { color: '#94A3B8', bg: 'rgba(148,163,184,0.10)', icon: 'snow',        label: 'Cold' },
  HOT:           { color: '#EF4444', bg: 'rgba(239,68,68,0.10)',   icon: 'flame',       label: 'Hot Lead' },
  GHOSTING_RISK: { color: '#A78BFA', bg: 'rgba(167,139,250,0.10)', icon: 'eye-off',     label: 'Ghosting Risk' },
  GRATEFUL:      { color: '#14B8A6', bg: 'rgba(20,184,166,0.10)',  icon: 'heart',       label: 'Grateful' },
  DISTRESSED:    { color: '#EC4899', bg: 'rgba(236,72,153,0.10)',  icon: 'pulse',       label: 'Distressed' },
};

function getEmotionCfg(emotionStr) {
  if (!emotionStr) return null;
  const key = emotionStr.toUpperCase().replace(/[-\s]/g, '_');
  return EMOTION_CONFIG[key] || null;
}

const INTENT_LABELS = ['', 'Browsing', 'Curious', 'Considering', 'Ready', 'Sold'];

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
  const [aiEmotion, setAiEmotion] = useState(null);
  const [aiIntent, setAiIntent] = useState(null);
  const [aiStrategy, setAiStrategy] = useState('');
  const [aiNextMove, setAiNextMove] = useState('');
  const [aiBusiness, setAiBusiness] = useState('');
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
    setAiEmotion(null);
    setAiIntent(null);
    setAiStrategy('');
    setAiNextMove('');
    setAiBusiness('');
    try {
      const data = await suggestReply(last.text, thread.instagram_thread_id);
      setAiAnswer(data.suggestion || '');
      setAiEmotion(data.emotion || null);
      setAiIntent(data.intent || null);
      setAiStrategy(data.strategy || '');
      setAiNextMove(data.nextMove || '');
      setAiBusiness(data.business || '');
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
    setAiEmotion(null);
    setAiIntent(null);
    setAiStrategy('');
    setAiNextMove('');
    setAiBusiness('');
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
    const aiSug = item.ai_suggestion || '';

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
        {isClient && aiSug ? (
          <TouchableOpacity
            style={styles.sugPill}
            onPress={() => {
              setAiAnswer(aiSug);
              setAiEmotion(null);
              setAiIntent(null);
              setAiStrategy('');
              setAiNextMove('');
              setAiBusiness('');
            }}
            activeOpacity={0.8}
          >
            <Ionicons name="sparkles" size={12} color={colors.accentLight} />
            <Text style={styles.sugPillText} numberOfLines={1}>{aiSug}</Text>
            <Ionicons name="chevron-forward" size={13} color={colors.textMuted} />
          </TouchableOpacity>
        ) : null}
      </View>
    );
  };

  const emotionCfg = getEmotionCfg(aiEmotion);

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

      {/* ── AI Suggestion Card (redesigned) ── */}
      {aiAnswer ? (
        <View style={[styles.aiCard, emotionCfg && { borderColor: emotionCfg.color + '30' }]}>
          {/* Header row */}
          <View style={styles.aiHead}>
            <Ionicons name="sparkles" size={14} color={emotionCfg ? emotionCfg.color : colors.accentLight} />
            <Text style={[styles.aiHeadText, emotionCfg && { color: emotionCfg.color }]}>AI Reply</Text>

            {/* Emotion + Intent chips */}
            <View style={styles.aiChips}>
              {emotionCfg && (
                <View style={[styles.emotionChip, { backgroundColor: emotionCfg.bg, borderColor: emotionCfg.color + '30' }]}>
                  <Ionicons name={emotionCfg.icon} size={11} color={emotionCfg.color} />
                  <Text style={[styles.emotionChipText, { color: emotionCfg.color }]}>{emotionCfg.label}</Text>
                </View>
              )}
              {aiIntent != null && aiIntent > 0 && (
                <View style={[styles.emotionChip, { backgroundColor: colors.warningBg, borderColor: colors.warning + '30' }]}>
                  <Text style={[styles.emotionChipText, { color: colors.warning }]}>Intent {aiIntent}/5</Text>
                </View>
              )}
              {aiBusiness ? (
                <View style={[styles.emotionChip, { backgroundColor: 'rgba(59,130,246,0.08)', borderColor: colors.accent + '30' }]}>
                  <Text style={[styles.emotionChipText, { color: colors.accentLight }]}>{aiBusiness}</Text>
                </View>
              ) : null}
            </View>

            <TouchableOpacity onPress={() => { setAiAnswer(''); setAiEmotion(null); setAiIntent(null); }} style={{ marginLeft: 'auto' }}>
              <Ionicons name="close" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Strategy hint (one-liner) */}
          {aiStrategy ? (
            <View style={styles.strategyRow}>
              <Ionicons name="flash" size={11} color={colors.textMuted} />
              <Text style={styles.strategyText} numberOfLines={1}>{aiStrategy}</Text>
            </View>
          ) : null}

          {/* The suggested reply — clean, prominent */}
          <Text style={[styles.aiText, emotionCfg && { borderLeftColor: emotionCfg.color + '50' }]}>{aiAnswer}</Text>

          {/* Next move hint */}
          {aiNextMove ? (
            <View style={styles.nextMoveRow}>
              <Ionicons name="arrow-forward-circle" size={12} color={colors.textMuted} />
              <Text style={styles.nextMoveText} numberOfLines={2}>{aiNextMove}</Text>
            </View>
          ) : null}

          {/* Copy button — copies ONLY the suggested reply */}
          <TouchableOpacity
            style={[styles.copyBtn, emotionCfg && { backgroundColor: emotionCfg.color }]}
            onPress={() => copyText(aiAnswer)}
            activeOpacity={0.85}
          >
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

  // ── Redesigned AI Card ──
  aiCard: {
    backgroundColor: colors.bgCard, marginHorizontal: 12, borderRadius: radius.lg, padding: 14,
    borderWidth: 1, borderColor: colors.accent + '40', marginBottom: 6,
  },
  aiHead: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6,
    flexWrap: 'wrap',
  },
  aiHeadText: { fontSize: 13, fontWeight: '700', color: colors.accentLight },
  aiChips: {
    flexDirection: 'row', gap: 5, flexWrap: 'wrap', flex: 1,
  },
  emotionChip: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 3,
    borderWidth: 1,
  },
  emotionChipText: { fontSize: 10, fontWeight: '600' },

  strategyRow: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    marginBottom: 6, paddingHorizontal: 2,
  },
  strategyText: { fontSize: 11, color: colors.textMuted, flex: 1, fontStyle: 'italic' },

  aiText: {
    fontSize: 15, color: colors.textPrimary, lineHeight: 22, marginBottom: 8,
    paddingLeft: 10, borderLeftWidth: 2, borderLeftColor: colors.accent + '40',
  },

  nextMoveRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 5,
    marginBottom: 10, paddingHorizontal: 2,
  },
  nextMoveText: { fontSize: 11, color: colors.textMuted, flex: 1 },

  copyBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    backgroundColor: colors.accent, borderRadius: radius.md, paddingVertical: 12,
  },
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
