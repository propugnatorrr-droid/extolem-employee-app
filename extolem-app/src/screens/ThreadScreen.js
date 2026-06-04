import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  TextInput, ActivityIndicator, Alert, Keyboard, KeyboardAvoidingView, Platform,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { colors, radius, shadow, avatarColor, initials } from '../theme';
import { getMessages, markReplied, suggestReply, askAI } from '../api';

// ─── Emotion visual config ────────────────────────────────────
const EMOTION_MAP = {
  EXCITED:       { color: '#22C55E', bg: 'rgba(34,197,94,0.10)',  icon: 'trending-up',  label: 'Excited' },
  CURIOUS:       { color: '#60A5FA', bg: 'rgba(96,165,250,0.10)',  icon: 'help-circle', label: 'Curious' },
  SKEPTICAL:     { color: '#F59E0B', bg: 'rgba(245,158,11,0.10)',  icon: 'shield',      label: 'Skeptical' },
  'PRICE-OBJECTING': { color: '#F97316', bg: 'rgba(249,115,22,0.10)', icon: 'cash',    label: 'Price Focus' },
  PRICE_OBJECTING:{ color: '#F97316', bg: 'rgba(249,115,22,0.10)', icon: 'cash',        label: 'Price Focus' },
  COLD:          { color: '#94A3B8', bg: 'rgba(148,163,184,0.10)', icon: 'snow',        label: 'Cold' },
  HOT:           { color: '#EF4444', bg: 'rgba(239,68,68,0.10)',   icon: 'flame',       label: 'Hot Lead' },
  GHOSTING_RISK: { color: '#A78BFA', bg: 'rgba(167,139,250,0.10)', icon: 'eye-off',     label: 'Ghost Risk' },
  'GHOSTING-RISK':{ color: '#A78BFA', bg: 'rgba(167,139,250,0.10)', icon: 'eye-off',    label: 'Ghost Risk' },
  GRATEFUL:      { color: '#14B8A6', bg: 'rgba(20,184,166,0.10)',  icon: 'heart',       label: 'Grateful' },
  DISTRESSED:    { color: '#EC4899', bg: 'rgba(236,72,153,0.10)',  icon: 'pulse',       label: 'Distressed' },
};

// ─── Frontend parser (extracts structured fields from raw AI text) ──
function parseAISuggestion(raw) {
  if (!raw) return null;
  const emotion = (raw.match(/🎯\s*EMOTION:\s*(.+)/i) || [])[1]?.trim();
  const intentMatch = (raw.match(/📊\s*INTENT:\s*(\d)/i) || [])[1];
  const intent = intentMatch ? parseInt(intentMatch, 10) : null;
  const business = (raw.match(/BUSINESS:\s*(.+)/i) || [])[1]?.trim();
  const strategy = (raw.match(/⚡\s*STRATEGY:\s*(.+)/i) || [])[1]?.trim();
  const replyMatch = raw.match(/💬\s*SUGGESTED\s*REPLY:\s*\n?\s*[""]?\s*([\s\S]*?)\s*[""]?\s*(?:\n📌|\n$|$)/i);
  const suggestion = (replyMatch ? replyMatch[1].trim() : '').replace(/^[""]|[""]$/g, '').trim();
  const nextMove = (raw.match(/📌\s*NEXT\s*MOVE:\s*(.+)/i) || [])[1]?.trim();
  return { emotion, intent, business, strategy, suggestion: suggestion || raw, nextMove };
}

function getEmotionCfg(emotionStr) {
  if (!emotionStr) return null;
  const norm = emotionStr.toUpperCase().replace(/[\s-]+/g, '_');
  return EMOTION_MAP[norm] || EMOTION_MAP[emotionStr.toUpperCase()] || null;
}

function formatTime(dateStr) {
  if (!dateStr) return '';
  const d = new Date((dateStr || '').replace(' ', 'T') + (dateStr.includes('Z') ? '' : 'Z'));
  if (isNaN(d.getTime())) return '';
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// ─── Pulse dot component ──────────────────────────────────────
function PulseDot({ color, size = 6 }) {
  const anim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 0.4, duration: 1200, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 1, duration: 1200, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, []);
  return (
    <Animated.View style={{
      width: size, height: size, borderRadius: size / 2,
      backgroundColor: color, opacity: anim,
      shadowColor: color, shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.6, shadowRadius: 4, elevation: 3,
    }} />
  );
}

export default function ThreadScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const { thread } = route.params;
  const name = thread.client_name || thread.client_username || 'Instagram User';

  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [question, setQuestion] = useState('');
  const [aiData, setAiData] = useState(null); // { suggestion, emotion, intent, business, strategy, nextMove }
  const [aiLoading, setAiLoading] = useState(false);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const listRef = useRef(null);
  const prevCount = useRef(0);


  useEffect(() => {
    loadMessages();
    const interval = setInterval(loadMessages, 10000);
    return () => clearInterval(interval);
  }, []);

  async function loadMessages() {
    try {
      const data = await getMessages(thread.instagram_thread_id);
      const arr = Array.isArray(data) ? data : [];
      setMessages(arr);
      if (arr.length > prevCount.current) {
        setTimeout(() => listRef.current?.scrollToEnd({ animated: prevCount.current !== 0 }), 60);
      }
      prevCount.current = arr.length;
    } catch (e) { /* keep */ }
    finally { setLoading(false); }
  }

  function showAICard(data) {
    setAiData(data);
    setShowDetail(false);
    cardOpacity.setValue(0);
    Animated.spring(cardOpacity, {
      toValue: 1,
      tension: 80,
      friction: 10,
      useNativeDriver: true,
    }).start();
  }

  function dismissAICard() {
    Animated.timing(cardOpacity, {
      toValue: 0, duration: 180, useNativeDriver: true,
    }).start(() => setAiData(null));
  }

  async function handleSuggest() {
    const clientMsgs = messages.filter(m => m.sender === 'client');
    if (!clientMsgs.length) return Alert.alert('Nothing to reply to', 'No client messages in this conversation yet.');
    const last = clientMsgs[clientMsgs.length - 1];
    setSuggestLoading(true);
    try {
      const data = await suggestReply(last.text, thread.instagram_thread_id);
      showAICard(data);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch (e) {
      Alert.alert('Error', 'Could not generate a suggestion. Try again.');
    } finally { setSuggestLoading(false); }
  }

  async function handleAsk() {
    if (!question.trim()) return;
    Keyboard.dismiss();
    setAiLoading(true);
    try {
      const { answer } = await askAI(question, thread.instagram_thread_id);
      showAICard({ suggestion: answer, emotion: null, intent: null, business: null, strategy: null, nextMove: null });
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

  // ─── Render a single message ────────────────────────────────
  const renderMessage = ({ item }) => {
    const isClient = item.sender === 'client';
    const aiSugRaw = item.ai_suggestion || '';
    const parsed = aiSugRaw ? parseAISuggestion(aiSugRaw) : null;
    const emotionCfg = parsed?.emotion ? getEmotionCfg(parsed.emotion) : null;

    return (
      <View style={[styles.row, isClient ? styles.rowLeft : styles.rowRight]}>
        <TouchableOpacity
          activeOpacity={0.85}
          onLongPress={() => copyText(item.text)}
          style={[styles.bubble, isClient ? styles.bubbleClient : styles.bubbleMe]}
        >
          <Text style={[styles.bubbleText, !isClient && { color: '#03060B', fontWeight: '500' }]}>{item.text}</Text>
          <Text style={[styles.bubbleTime, !isClient && { color: 'rgba(3,6,11,0.55)' }]}>{formatTime(item.timestamp)}</Text>
        </TouchableOpacity>

        {/* AI suggestion pill — shows emotion color + clean preview */}
        {isClient && parsed?.suggestion ? (
          <TouchableOpacity
            style={[
              styles.sugPill,
              emotionCfg && { borderColor: emotionCfg.color + '50', backgroundColor: emotionCfg.bg },
            ]}
            onPress={() => showAICard(parsed)}
            activeOpacity={0.75}
          >
            {emotionCfg ? (
              <PulseDot color={emotionCfg.color} size={7} />
            ) : (
              <Ionicons name="sparkles" size={12} color={colors.accentLight} />
            )}
            <Text
              style={[styles.sugPillText, emotionCfg && { color: emotionCfg.color }]}
              numberOfLines={1}
            >
              {parsed.suggestion}
            </Text>
            <Ionicons name="chevron-forward" size={13} color={emotionCfg ? emotionCfg.color + '80' : colors.textMuted} />
          </TouchableOpacity>
        ) : null}
      </View>
    );
  };

  const emotionCfg = aiData?.emotion ? getEmotionCfg(aiData.emotion) : null;
  const accentColor = emotionCfg?.color || colors.accent;
  const accentBg = emotionCfg?.bg || colors.accentGlow;

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
          renderItem={renderMessage}
          showsVerticalScrollIndicator={false}
        />

      )}

      {/* ── AI SUGGESTION CARD (stunning redesign) ── */}
      {aiData ? (
        <Animated.View style={[styles.aiCardWrapper, { opacity: cardOpacity }]}>
          {/* Top accent bar */}
          <View style={[styles.aiAccentBar, { backgroundColor: accentColor }]} />

          <View style={[styles.aiCardInner, { borderColor: accentColor + '30' }]}>
            {/* Header row */}
            <View style={styles.aiHead}>
              <View style={styles.aiHeadLeft}>
                <Ionicons name="sparkles" size={16} color={accentColor} />
                <Text style={[styles.aiHeadText, { color: accentColor }]}>Suggested reply</Text>
              </View>
              <TouchableOpacity onPress={dismissAICard} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close" size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            {/* Emotion + Intent + Business chips */}
            {(emotionCfg || aiData?.intent || aiData?.business) ? (
              <View style={styles.chipRow}>
                {emotionCfg && (
                  <View style={[styles.emotionChip, { backgroundColor: emotionCfg.bg, borderColor: emotionCfg.color + '40' }]}>
                    <PulseDot color={emotionCfg.color} size={6} />
                    <Ionicons name={emotionCfg.icon} size={12} color={emotionCfg.color} />
                    <Text style={[styles.emotionChipText, { color: emotionCfg.color }]}>{emotionCfg.label}</Text>
                  </View>
                )}
                {aiData?.intent ? (
                  <View style={[styles.intentBar, { backgroundColor: colors.warningBg, borderColor: colors.warning + '30' }]}>
                    <Text style={[styles.intentLabel, { color: colors.warning }]}>Intent</Text>
                    <View style={styles.intentDots}>
                      {[1, 2, 3, 4, 5].map(i => (
                        <View
                          key={i}
                          style={[
                            styles.intentDot,
                            { backgroundColor: i <= aiData.intent ? colors.warning : colors.border },
                            i <= aiData.intent && { shadowColor: colors.warning, shadowOpacity: 0.4, shadowRadius: 3, elevation: 2 },
                          ]}
                        />
                      ))}
                    </View>
                  </View>
                ) : null}
                {aiData?.business && aiData.business !== 'Unknown' ? (
                  <View style={[styles.emotionChip, { backgroundColor: 'rgba(59,130,246,0.08)', borderColor: colors.accent + '30' }]}>
                    <Ionicons name="business" size={11} color={colors.accentLight} />
                    <Text style={[styles.emotionChipText, { color: colors.accentLight }]}>{aiData.business}</Text>
                  </View>
                ) : null}
              </View>
            ) : null}

            {/* Strategy — subtle, expandable */}
            {aiData?.strategy ? (
              <TouchableOpacity
                style={styles.strategyRow}
                onPress={() => setShowDetail(!showDetail)}
                activeOpacity={0.7}
              >
                <Ionicons name="flash" size={12} color={colors.textMuted} />
                <Text style={styles.strategyText} numberOfLines={showDetail ? undefined : 1}>{aiData.strategy}</Text>
                <Ionicons name={showDetail ? 'chevron-up' : 'chevron-down'} size={12} color={colors.textMuted} />
              </TouchableOpacity>
            ) : null}

            {/* The suggested reply — the star of the show */}
            <View style={[styles.replyBox, { borderLeftColor: accentColor, backgroundColor: accentBg }]}>
              <Text style={styles.replyQuote}>"</Text>
              <Text style={styles.replyText}>{aiData.suggestion}</Text>
            </View>

            {/* Next move — expandable */}
            {(showDetail && aiData?.nextMove) ? (
              <View style={styles.nextMoveRow}>
                <Ionicons name="arrow-forward-circle" size={13} color={colors.textMuted} />
                <Text style={styles.nextMoveText}>{aiData.nextMove}</Text>
              </View>
            ) : null}

            {/* Copy button — copies ONLY the suggestion */}
            <TouchableOpacity
              style={[styles.copyBtn, { backgroundColor: accentColor }]}
              onPress={() => copyText(aiData.suggestion)}
              activeOpacity={0.85}
            >
              <Ionicons name="copy-outline" size={16} color="#03060B" />
              <Text style={styles.copyBtnText}>Copy Reply</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
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
            {aiLoading ? <ActivityIndicator color="#03060B" size="small" /> : <Ionicons name="arrow-up" size={20} color="#03060B" />}
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
  bubble: { borderRadius: radius.lg, paddingHorizontal: 14, paddingVertical: 10 },
  bubbleClient: { backgroundColor: colors.bgCard, borderBottomLeftRadius: 6 },
  bubbleMe: { backgroundColor: colors.accent, borderBottomRightRadius: 6 },
  bubbleText: { fontSize: 15, color: colors.textPrimary, lineHeight: 21 },
  bubbleTime: { fontSize: 10, color: colors.textMuted, marginTop: 4, alignSelf: 'flex-end' },
  sugPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6,
    backgroundColor: colors.accentGlow, borderRadius: radius.full, paddingHorizontal: 12, paddingVertical: 7,
    borderWidth: 1, borderColor: colors.accent + '40', maxWidth: '95%',
  },
  sugPillText: { fontSize: 12, color: colors.textSecondary, flex: 1 },

  emptyMsgs: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 8 },
  emptyMsgsText: { fontSize: 16, fontWeight: '600', color: colors.textSecondary, marginTop: 8 },
  emptyMsgsSub: { fontSize: 13, color: colors.textMuted, textAlign: 'center' },

  // ── STUNNING AI Card ──
  aiCardWrapper: {
    marginHorizontal: 12, marginBottom: 6,
    borderRadius: radius.lg + 4,
    ...shadow.card,
  },

  aiAccentBar: {
    height: 3,
    borderTopLeftRadius: radius.lg + 4,
    borderTopRightRadius: radius.lg + 4,
  },
  aiCardInner: {
    backgroundColor: colors.bgCard,
    borderBottomLeftRadius: radius.lg + 4,
    borderBottomRightRadius: radius.lg + 4,
    borderWidth: 1,
    borderTopWidth: 0,
    padding: 16,
  },
  aiHead: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 10,
  },
  aiHeadLeft: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
  },
  aiHeadText: { fontSize: 13, fontWeight: '700', letterSpacing: 0, textTransform: 'none' },

  chipRow: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 6,
    marginBottom: 10,
  },
  emotionChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 5,
    borderWidth: 1,
  },
  emotionChipText: { fontSize: 11, fontWeight: '700' },

  intentBar: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 5,
    borderWidth: 1,
  },
  intentLabel: { fontSize: 10, fontWeight: '700', marginRight: 2 },
  intentDots: { flexDirection: 'row', gap: 3 },
  intentDot: {
    width: 7, height: 7, borderRadius: 3.5,
  },

  strategyRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 6,
    marginBottom: 8, paddingHorizontal: 4,
  },
  strategyText: { fontSize: 12, color: colors.textMuted, flex: 1, fontStyle: 'italic', lineHeight: 17 },

  replyBox: {
    borderLeftWidth: 3,
    paddingLeft: 14, paddingVertical: 10, paddingRight: 10,
    borderRadius: radius.md,
    marginBottom: 10,
  },
  replyQuote: {
    fontSize: 28, lineHeight: 28, color: colors.accentLight + '40',
    fontWeight: '300', marginBottom: -6, marginLeft: -2,
  },
  replyText: {
    fontSize: 15, color: colors.textPrimary, lineHeight: 23,
    fontWeight: '400',
  },

  nextMoveRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 6,
    marginBottom: 12, paddingHorizontal: 4,
  },
  nextMoveText: { fontSize: 12, color: colors.textMuted, flex: 1, lineHeight: 17 },

  copyBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderRadius: radius.md, paddingVertical: 13,
  },
  copyBtnText: { color: '#03060B', fontWeight: '700', fontSize: 15, letterSpacing: 0, textTransform: 'none' },

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
