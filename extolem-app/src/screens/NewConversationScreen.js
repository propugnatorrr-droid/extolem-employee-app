import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, ScrollView, KeyboardAvoidingView, Platform
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { colors, fonts, radius } from '../theme';
import { addManualConversation } from '../api';

export default function NewConversationScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [clientName, setClientName] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  async function handleSubmit() {
    if (!clientName.trim() || !message.trim()) {
      return Alert.alert('Required', 'Enter client name and their message.');
    }
    setLoading(true);
    try {
      const data = await addManualConversation(clientName.trim(), message.trim());
      setResult(data);
    } catch (e) {
      Alert.alert('Error', 'Could not generate suggestion.');
    } finally { setLoading(false); }
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="chevron-back" size={26} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>New Message</Text>
        <View style={{ width: 26 }} />
      </View>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.sub}>Paste a client message to get an instant on-brand AI reply.</Text>

        <Text style={styles.label}>Client Name / Username</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. John Smith or @johnsmith"
          placeholderTextColor={colors.textMuted}
          value={clientName}
          onChangeText={setClientName}
        />

        <Text style={styles.label}>Their Message</Text>
        <TextInput
          style={[styles.input, styles.textarea]}
          placeholder="Paste their DM or message here..."
          placeholderTextColor={colors.textMuted}
          value={message}
          onChangeText={setMessage}
          multiline
          numberOfLines={5}
        />

        <TouchableOpacity
          style={[styles.btn, loading && styles.btnDisabled]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color={colors.white} />
            : <><Ionicons name="sparkles" size={16} color={colors.white} /><Text style={styles.btnText}>Generate AI Reply</Text></>
          }
        </TouchableOpacity>

        {result && (
          <View style={styles.resultCard}>
            <View style={styles.resultHeader}>
              <Ionicons name="sparkles" size={14} color={colors.accent} />
              <Text style={styles.resultLabel}>Suggested Reply</Text>
            </View>
            <Text style={styles.resultText}>{result.suggestion}</Text>
            <TouchableOpacity
              style={styles.copyBtn}
              onPress={async () => {
                await Clipboard.setStringAsync(result.suggestion);
                Alert.alert('Copied!', 'Paste this reply in Instagram or wherever needed.');
              }}
            >
              <Ionicons name="copy-outline" size={14} color={colors.white} />
              <Text style={styles.copyBtnText}>Copy Reply</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 12,
    backgroundColor: colors.bgElevated, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  headerTitle: { fontSize: 17, fontWeight: '700', color: colors.textPrimary },
  scroll: { padding: 20, paddingTop: 24, paddingBottom: 60 },
  sub: { ...fonts.regular, fontSize: 14, color: colors.textSecondary, marginBottom: 28, lineHeight: 20 },
  label: { ...fonts.semibold, fontSize: 13, color: colors.textSecondary, marginBottom: 8 },
  input: {
    backgroundColor: colors.bgCard, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
    padding: 14, color: colors.textPrimary, ...fonts.regular, fontSize: 14, marginBottom: 20,
  },
  textarea: { height: 120, textAlignVertical: 'top' },
  btn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: colors.accent, borderRadius: radius.lg, paddingVertical: 16, marginBottom: 24,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { ...fonts.bold, fontSize: 15, color: colors.white },
  resultCard: {
    backgroundColor: colors.bgCard, borderRadius: radius.lg, borderWidth: 1,
    borderColor: colors.accent + '40', padding: 16,
  },
  resultHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  resultLabel: { ...fonts.semibold, fontSize: 13, color: colors.accent },
  resultText: { ...fonts.regular, fontSize: 14, color: colors.textPrimary, lineHeight: 21, marginBottom: 14 },
  copyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.accent,
    borderRadius: radius.full, paddingHorizontal: 16, paddingVertical: 9, alignSelf: 'flex-start',
  },
  copyBtnText: { ...fonts.semibold, fontSize: 13, color: colors.white },
});
