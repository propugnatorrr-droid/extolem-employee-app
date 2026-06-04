import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Keyboard, KeyboardAvoidingView, Platform, Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { colors, fonts, radius } from '../theme';
import { askAI } from '../api';

const QUICK_PROMPTS = [
  'What services do we offer?',
  'How should I respond to a pricing question?',
  'Client already has a website. What do I say?',
  'What industries do we serve?',
  'How do I book someone for the free audit?',
  'Interested but not ready. Next steps?',
];

const WELCOME = "Hi! I'm your Extolem assistant. Ask me anything about our services, how to handle client questions, or what to say to a prospect.";

function TypingDots() {
  const dots = [useRef(new Animated.Value(0.3)).current, useRef(new Animated.Value(0.3)).current, useRef(new Animated.Value(0.3)).current];
  React.useEffect(() => {
    const loops = dots.map((d, i) =>
      Animated.loop(Animated.sequence([
        Animated.delay(i * 160),
        Animated.timing(d, { toValue: 1, duration: 380, useNativeDriver: true }),
        Animated.timing(d, { toValue: 0.3, duration: 380, useNativeDriver: true }),
      ]))
    );
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, []);
  return (
    <View style={{ flexDirection: 'row', gap: 5, paddingVertical: 4 }}>
      {dots.map((d, i) => (
        <Animated.View key={i} style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: colors.accent, opacity: d }} />
      ))}
    </View>
  );
}

export default function AIAssistantScreen() {
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState([{ role: 'assistant', content: WELCOME }]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);

  async function send(text) {
    const q = (text || input).trim();
    if (!q || loading) return;
    Keyboard.dismiss();
    setInput('');

    const next = [...messages, { role: 'user', content: q }];
    setMessages(next);
    setLoading(true);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);

    try {
      // Pass recent history so the assistant has memory (was previously dropped).
      const history = next.slice(-10).map((m) => ({ role: m.role, content: m.content }));
      const { answer } = await askAI(q, undefined, history);
      setMessages((prev) => [...prev, { role: 'assistant', content: answer }]);
    } catch (e) {
      setMessages((prev) => [...prev, { role: 'assistant', content: 'Something went wrong on my end. Mind trying that again?' }]);
    } finally {
      setLoading(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
    }
  }

  async function copy(text) {
    await Clipboard.setStringAsync(text);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View style={styles.headerIcon}>
          <Ionicons name="sparkles" size={20} color={colors.accent} />
        </View>
        <View>
          <Text style={styles.headerTitle}>Assistant</Text>
          <Text style={styles.headerSub}>Your in-house sales coach</Text>
        </View>
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.chat}
        contentContainerStyle={{ padding: 16, paddingBottom: 8 }}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
        keyboardShouldPersistTaps="handled"
      >
        {messages.map((msg, i) => (
          <View key={i} style={[styles.msgRow, msg.role === 'user' && styles.msgRowUser]}>
            {msg.role === 'assistant' && (
              <View style={styles.aiAvatar}>
                <Ionicons name="sparkles" size={13} color={colors.accent} />
              </View>
            )}
            <TouchableOpacity
              style={[styles.bubble, msg.role === 'user' ? styles.bubbleUser : styles.bubbleAI]}
              onLongPress={() => copy(msg.content)}
              activeOpacity={0.85}
            >
              <Text style={[styles.bubbleText, msg.role === 'user' && styles.bubbleTextUser]}>{msg.content}</Text>
            </TouchableOpacity>
          </View>
        ))}
        {loading && (
          <View style={styles.msgRow}>
            <View style={styles.aiAvatar}>
              <Ionicons name="sparkles" size={13} color={colors.accent} />
            </View>
            <View style={[styles.bubble, styles.bubbleAI, styles.typingBubble]}>
              <TypingDots />
            </View>
          </View>
        )}
      </ScrollView>

      {messages.length <= 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.quickRow} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
          {QUICK_PROMPTS.map((p, i) => (
            <TouchableOpacity key={i} style={styles.quickChip} onPress={() => send(p)} activeOpacity={0.7}>
              <Text style={styles.quickChipText}>{p}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      <View style={[styles.inputArea, { paddingBottom: Math.max(insets.bottom, 14) }]}>
        <TextInput
          style={styles.input}
          placeholder="Ask anything"
          placeholderTextColor={colors.textMuted}
          value={input}
          onChangeText={setInput}
          multiline
          maxLength={500}
        />
        <TouchableOpacity
          style={[styles.sendBtn, (!input.trim() || loading) && styles.sendBtnDisabled]}
          onPress={() => send()}
          disabled={!input.trim() || loading}
          activeOpacity={0.85}
        >
          <Ionicons name="arrow-up" size={20} color="#03060B" />
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
    backgroundColor: colors.bgElevated, borderBottomWidth: 1, borderBottomColor: colors.borderSoft,
  },
  headerIcon: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: colors.accentSoft,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { ...fonts.bold, fontSize: 19, color: colors.textPrimary, letterSpacing: -0.3 },
  headerSub: { ...fonts.regular, fontSize: 12.5, color: colors.textMuted, marginTop: 1 },
  chat: { flex: 1 },
  msgRow: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 14, gap: 8 },
  msgRowUser: { justifyContent: 'flex-end' },
  aiAvatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  bubble: { maxWidth: '82%', borderRadius: radius.lg, paddingHorizontal: 14, paddingVertical: 11 },
  bubbleAI: { backgroundColor: colors.bgCard, borderBottomLeftRadius: 6 },
  bubbleUser: { backgroundColor: colors.accent, borderBottomRightRadius: 6 },
  bubbleText: { ...fonts.regular, fontSize: 15, color: colors.textPrimary, lineHeight: 22 },
  bubbleTextUser: { color: '#03060B', fontWeight: '500' },
  typingBubble: { paddingVertical: 12, paddingHorizontal: 16 },
  quickRow: { maxHeight: 46, marginBottom: 6 },
  quickChip: { backgroundColor: colors.bgCard, borderRadius: radius.full, paddingHorizontal: 14, paddingVertical: 9 },
  quickChipText: { ...fonts.medium, fontSize: 12.5, color: colors.textSecondary },
  inputArea: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 10, padding: 12,
    backgroundColor: colors.bgElevated, borderTopWidth: 1, borderTopColor: colors.borderSoft,
  },
  input: {
    flex: 1, backgroundColor: colors.bgCard, borderRadius: radius.xl,
    paddingHorizontal: 16, paddingVertical: 12, color: colors.textPrimary, ...fonts.regular,
    fontSize: 15, maxHeight: 110,
  },
  sendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  sendBtnDisabled: { backgroundColor: colors.border },
});
