import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Keyboard, KeyboardAvoidingView, Platform
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { colors, fonts, radius } from '../theme';
import { askAI } from '../api';

const QUICK_PROMPTS = [
  'What services do we offer?',
  'How should I respond to a pricing question?',
  'Client says they already have a website — what do I say?',
  'What industries do we serve?',
  'How do I book someone for the free audit?',
  'Client seems interested but not ready — next steps?',
];

export default function AIAssistantScreen() {
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: "Hi! I'm your Extolem AI assistant. Ask me anything about our services, how to handle client questions, or what to say to a prospect. I know everything about Extolem."
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);

  async function send(text) {
    const q = (text || input).trim();
    if (!q) return;
    Keyboard.dismiss();
    setInput('');

    const newMessages = [...messages, { role: 'user', content: q }];
    setMessages(newMessages);
    setLoading(true);

    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);

    try {
      const history = newMessages.slice(-10).map(m => ({ role: m.role, content: m.content }));
      const { answer } = await askAI(q);
      setMessages(prev => [...prev, { role: 'assistant', content: answer }]);
    } catch (e) {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, something went wrong. Please try again.' }]);
    } finally {
      setLoading(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View style={styles.headerIcon}>
          <Ionicons name="sparkles" size={20} color={colors.accent} />
        </View>
        <View>
          <Text style={styles.headerTitle}>AI Assistant</Text>
          <Text style={styles.headerSub}>Powered by Extolem AI · knows Extolem A–Z</Text>
        </View>
      </View>

      {/* Chat */}
      <ScrollView
        ref={scrollRef}
        style={styles.chat}
        contentContainerStyle={{ padding: 16, paddingBottom: 8 }}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
      >
        {messages.map((msg, i) => (
          <View key={i} style={[styles.msgRow, msg.role === 'user' && styles.msgRowUser]}>
            {msg.role === 'assistant' && (
              <View style={styles.aiAvatar}>
                <Ionicons name="sparkles" size={14} color={colors.accent} />
              </View>
            )}
            <TouchableOpacity
              style={[styles.bubble, msg.role === 'user' ? styles.bubbleUser : styles.bubbleAI]}
              onLongPress={() => Clipboard.setStringAsync(msg.content)}
              activeOpacity={0.8}
            >
              <Text style={[styles.bubbleText, msg.role === 'user' && styles.bubbleTextUser]}>
                {msg.content}
              </Text>
            </TouchableOpacity>
          </View>
        ))}
        {loading && (
          <View style={styles.msgRow}>
            <View style={styles.aiAvatar}>
              <Ionicons name="sparkles" size={14} color={colors.accent} />
            </View>
            <View style={[styles.bubble, styles.bubbleAI, styles.typingBubble]}>
              <ActivityIndicator color={colors.accent} size="small" />
            </View>
          </View>
        )}
      </ScrollView>

      {/* Quick prompts */}
      {messages.length <= 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.quickRow} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
          {QUICK_PROMPTS.map((p, i) => (
            <TouchableOpacity key={i} style={styles.quickChip} onPress={() => send(p)}>
              <Text style={styles.quickChipText}>{p}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Input */}
      <View style={styles.inputArea}>
        <TextInput
          style={styles.input}
          placeholder="Ask anything..."
          placeholderTextColor={colors.textMuted}
          value={input}
          onChangeText={setInput}
          multiline
          maxLength={500}
        />
        <TouchableOpacity style={[styles.sendBtn, !input.trim() && styles.sendBtnDisabled]} onPress={() => send()} disabled={!input.trim() || loading}>
          <Ionicons name="send" size={18} color={colors.white} />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 20, paddingBottom: 16,
    backgroundColor: colors.bgElevated,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  headerIcon: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: colors.accentGlow,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.accent + '40',
  },
  headerTitle: { ...fonts.bold, fontSize: 18, color: colors.textPrimary },
  headerSub: { ...fonts.regular, fontSize: 12, color: colors.textMuted, marginTop: 1 },
  chat: { flex: 1 },
  msgRow: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 12, gap: 8 },
  msgRowUser: { justifyContent: 'flex-end' },
  aiAvatar: {
    width: 28, height: 28, borderRadius: 14, backgroundColor: colors.accentGlow,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.accent + '40',
  },
  bubble: { maxWidth: '80%', borderRadius: radius.lg, padding: 12 },
  bubbleAI: { backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border },
  bubbleUser: { backgroundColor: colors.accent },
  bubbleText: { ...fonts.regular, fontSize: 14, color: colors.textPrimary, lineHeight: 20 },
  bubbleTextUser: { color: colors.white },
  typingBubble: { paddingVertical: 14, paddingHorizontal: 20 },
  quickRow: { maxHeight: 44, marginBottom: 8 },
  quickChip: {
    backgroundColor: colors.bgCard, borderRadius: radius.full, paddingHorizontal: 14, paddingVertical: 8,
    borderWidth: 1, borderColor: colors.border,
  },
  quickChipText: { ...fonts.regular, fontSize: 12, color: colors.textSecondary },
  inputArea: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 8, padding: 12, paddingBottom: 24,
    backgroundColor: colors.bgCard, borderTopWidth: 1, borderTopColor: colors.border,
  },
  input: {
    flex: 1, backgroundColor: colors.bgInput, borderRadius: radius.md, borderWidth: 1,
    borderColor: colors.border, padding: 12, color: colors.textPrimary, ...fonts.regular,
    fontSize: 14, maxHeight: 100,
  },
  sendBtn: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: colors.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  sendBtnDisabled: { backgroundColor: colors.textMuted },
});
