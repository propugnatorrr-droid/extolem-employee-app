import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  TextInput, ActivityIndicator, Alert, Keyboard, KeyboardAvoidingView, Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { colors, fonts, radius, shadow } from '../theme';
import { getMessages, markReplied, suggestReply, askAI } from '../api';

function formatTime(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function ThreadScreen({ route, navigation }) {
  const { thread } = route.params;
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [question, setQuestion] = useState('');
  const [aiAnswer, setAiAnswer] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const flatListRef = useRef(null);

  useEffect(() => {
    navigation.setOptions({ title: thread.client_name || 'Conversation' });
    loadMessages();
    const interval = setInterval(loadMessages, 10000);
    return () => clearInterval(interval);
  }, []);

  async function loadMessages() {
    try {
      const data = await getMessages(thread.instagram_thread_id);
      setMessages(data);
    } catch (e) {}
    finally { setLoading(false); }
  }

  async function handleSuggestLatest() {
    const clientMsgs = messages.filter(m => m.sender === 'client');
    if (!clientMsgs.length) return Alert.alert('No client messages to suggest a reply for');
    const last = clientMsgs[clientMsgs.length - 1];
    setSuggestLoading(true);
    try {
      const { suggestion } = await suggestReply(last.text, thread.instagram_thread_id);
      setAiAnswer(suggestion);
    } catch (e) {
      Alert.alert('Error', 'Could not generate suggestion');
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
      Alert.alert('Error', 'AI request failed');
    } finally { setAiLoading(false); }
  }

  async function copyToClipboard(text) {
    await Clipboard.setStringAsync(text);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert('Copied!', 'Reply copied to clipboard. Paste it in Instagram.');
  }

  async function handleMarkReplied() {
    await markReplied(thread.instagram_thread_id);
    loadMessages();
    Alert.alert('Done', 'Marked as replied.');
  }

  const renderMessage = ({ item }) => {
    const isClient = item.sender === 'client';
    return (
      <View style={[styles.msgWrapper, isClient ? styles.msgLeft : styles.msgRight]}>
        <View style={[styles.bubble, isClient ? styles.bubbleClient : styles.bubbleEmployee]}>
          <Text style={[styles.bubbleText, !isClient && styles.bubbleTextEmployee]}>{item.text}</Text>
          <Text style={styles.msgTime}>{formatTime(item.timestamp)}</Text>
        </View>
        {/* AI suggestion attached to client message */}
        {isClient && item.ai_suggestion && (
          <TouchableOpacity style={styles.suggestionPill} onPress={() => setAiAnswer(item.ai_suggestion)}>
            <Ionicons name="sparkles" size={12} color={colors.accent} />
            <Text style={styles.suggestionPillText} numberOfLines={1}>{item.ai_suggestion}</Text>
            <Ionicons name="chevron-forward" size={12} color={colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {/* Top Actions */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.topBtn} onPress={handleSuggestLatest} disabled={suggestLoading}>
          {suggestLoading
            ? <ActivityIndicator color={colors.accent} size="small" />
            : <><Ionicons name="sparkles" size={14} color={colors.accent} /><Text style={styles.topBtnText}>Suggest Reply</Text></>
          }
        </TouchableOpacity>
        <TouchableOpacity style={[styles.topBtn, styles.topBtnSuccess]} onPress={handleMarkReplied}>
          <Ionicons name="checkmark-done" size={14} color={colors.success} />
          <Text style={[styles.topBtnText, { color: colors.success }]}>Mark Replied</Text>
        </TouchableOpacity>
      </View>

      {/* Messages */}
      {loading
        ? <ActivityIndicator color={colors.accent} style={{ flex: 1 }} />
        : (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={item => String(item.id)}
            contentContainerStyle={{ padding: 16, paddingBottom: 8 }}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
            renderItem={renderMessage}
          />
        )
      }

      {/* AI Panel */}
      <View style={styles.aiPanel}>
        {aiAnswer ? (
          <View style={styles.aiAnswer}>
            <View style={styles.aiAnswerHeader}>
              <Ionicons name="sparkles" size={14} color={colors.accent} />
              <Text style={styles.aiAnswerLabel}>AI Suggested Reply</Text>
            </View>
            <Text style={styles.aiAnswerText}>{aiAnswer}</Text>
            <View style={styles.aiAnswerActions}>
              <TouchableOpacity style={styles.copyBtn} onPress={() => copyToClipboard(aiAnswer)}>
                <Ionicons name="copy-outline" size={14} color={colors.white} />
                <Text style={styles.copyBtnText}>Copy to Clipboard</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setAiAnswer('')} style={styles.dismissBtn}>
                <Ionicons name="close" size={16} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            placeholder="Ask AI anything about this client..."
            placeholderTextColor={colors.textMuted}
            value={question}
            onChangeText={setQuestion}
            multiline
            onSubmitEditing={handleAsk}
          />
          <TouchableOpacity style={styles.sendBtn} onPress={handleAsk} disabled={aiLoading}>
            {aiLoading
              ? <ActivityIndicator color={colors.white} size="small" />
              : <Ionicons name="send" size={18} color={colors.white} />
            }
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  topBar: {
    flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  topBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: radius.full, backgroundColor: colors.accentGlow, borderWidth: 1, borderColor: colors.accent + '40',
  },
  topBtnSuccess: { backgroundColor: colors.successBg, borderColor: colors.success + '40' },
  topBtnText: { ...fonts.medium, fontSize: 12, color: colors.accent },
  msgWrapper: { marginBottom: 12 },
  msgLeft: { alignItems: 'flex-start' },
  msgRight: { alignItems: 'flex-end' },
  bubble: { maxWidth: '80%', borderRadius: radius.lg, padding: 12, paddingBottom: 8 },
  bubbleClient: { backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border },
  bubbleEmployee: { backgroundColor: colors.accent },
  bubbleText: { ...fonts.regular, fontSize: 14, color: colors.textPrimary, lineHeight: 20 },
  bubbleTextEmployee: { color: colors.white },
  msgTime: { ...fonts.regular, fontSize: 10, color: colors.textMuted, marginTop: 4, textAlign: 'right' },
  suggestionPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4,
    backgroundColor: colors.accentGlow, borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 4,
    borderWidth: 1, borderColor: colors.accent + '30', maxWidth: '90%',
  },
  suggestionPillText: { ...fonts.regular, fontSize: 11, color: colors.textSecondary, flex: 1 },
  aiPanel: {
    backgroundColor: colors.bgCard, borderTopWidth: 1, borderTopColor: colors.border,
    padding: 12, paddingBottom: 20,
  },
  aiAnswer: {
    backgroundColor: colors.accentGlow, borderRadius: radius.md, padding: 12, marginBottom: 10,
    borderWidth: 1, borderColor: colors.accent + '30',
  },
  aiAnswerHeader: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 6 },
  aiAnswerLabel: { ...fonts.semibold, fontSize: 12, color: colors.accent },
  aiAnswerText: { ...fonts.regular, fontSize: 13, color: colors.textPrimary, lineHeight: 19 },
  aiAnswerActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 },
  copyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: colors.accent,
    borderRadius: radius.full, paddingHorizontal: 14, paddingVertical: 7,
  },
  copyBtnText: { ...fonts.semibold, fontSize: 12, color: colors.white },
  dismissBtn: { padding: 4 },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  input: {
    flex: 1, backgroundColor: colors.bgInput, borderRadius: radius.md, borderWidth: 1,
    borderColor: colors.border, padding: 12, color: colors.textPrimary, ...fonts.regular,
    fontSize: 13, maxHeight: 100,
  },
  sendBtn: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: colors.accent,
    alignItems: 'center', justifyContent: 'center',
  },
});
