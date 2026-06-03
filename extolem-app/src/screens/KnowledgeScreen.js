import React, { useState, useEffect } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  TextInput, Alert, ActivityIndicator, Modal, ScrollView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, radius } from '../theme';
import { getKnowledge, updateKnowledge } from '../api';

export default function KnowledgeScreen() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editCategory, setEditCategory] = useState('');
  const [editContent, setEditContent] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    try { setItems(await getKnowledge()); }
    catch (e) {}
    finally { setLoading(false); }
  }

  function openEdit(item) {
    setEditCategory(item ? item.category : '');
    setEditContent(item ? item.content : '');
    setModal(true);
  }

  async function save() {
    if (!editCategory.trim() || !editContent.trim()) {
      return Alert.alert('Required', 'Both category and content are needed.');
    }
    setSaving(true);
    try {
      await updateKnowledge(editCategory.trim(), editContent.trim());
      setModal(false);
      load();
    } catch (e) {
      Alert.alert('Error', 'Could not save.');
    } finally { setSaving(false); }
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Knowledge Base</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => openEdit(null)}>
          <Ionicons name="add" size={20} color={colors.white} />
        </TouchableOpacity>
      </View>
      <Text style={styles.sub}>The AI learns from everything here. Edit or add to update what it knows.</Text>

      {loading ? <ActivityIndicator color={colors.accent} style={{ marginTop: 40 }} /> : (
        <FlatList
          data={items}
          keyExtractor={item => String(item.id)}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.card} onPress={() => openEdit(item)}>
              <View style={styles.cardTop}>
                <View style={styles.tag}><Text style={styles.tagText}>{item.category}</Text></View>
                <Ionicons name="create-outline" size={16} color={colors.textMuted} />
              </View>
              <Text style={styles.cardContent} numberOfLines={3}>{item.content}</Text>
            </TouchableOpacity>
          )}
        />
      )}

      <Modal visible={modal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editContent ? 'Edit Entry' : 'New Entry'}</Text>
              <TouchableOpacity onPress={() => setModal(false)}>
                <Ionicons name="close" size={22} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
            <Text style={styles.label}>Category (no spaces, e.g. "pricing")</Text>
            <TextInput
              style={styles.input}
              value={editCategory}
              onChangeText={setEditCategory}
              placeholder="e.g. pricing, services, tone"
              placeholderTextColor={colors.textMuted}
            />
            <Text style={styles.label}>Content</Text>
            <TextInput
              style={[styles.input, styles.textarea]}
              value={editContent}
              onChangeText={setEditContent}
              placeholder="What should the AI know?"
              placeholderTextColor={colors.textMuted}
              multiline
            />
            <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={save} disabled={saving}>
              {saving ? <ActivityIndicator color={colors.white} /> : <Text style={styles.saveBtnText}>Save</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 60, paddingBottom: 8 },
  title: { ...fonts.extrabold, fontSize: 26, color: colors.textPrimary },
  sub: { ...fonts.regular, fontSize: 13, color: colors.textMuted, paddingHorizontal: 20, marginBottom: 8 },
  addBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  card: { backgroundColor: colors.bgCard, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: 14, marginBottom: 10 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  tag: { backgroundColor: colors.accentGlow, borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 3 },
  tagText: { ...fonts.medium, fontSize: 11, color: colors.accent },
  cardContent: { ...fonts.regular, fontSize: 13, color: colors.textSecondary, lineHeight: 18 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: colors.bgCard, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 40 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { ...fonts.bold, fontSize: 18, color: colors.textPrimary },
  label: { ...fonts.semibold, fontSize: 12, color: colors.textSecondary, marginBottom: 6 },
  input: { backgroundColor: colors.bgInput, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: 12, color: colors.textPrimary, ...fonts.regular, fontSize: 13, marginBottom: 14 },
  textarea: { height: 100, textAlignVertical: 'top' },
  saveBtn: { backgroundColor: colors.accent, borderRadius: radius.lg, paddingVertical: 14, alignItems: 'center' },
  saveBtnText: { ...fonts.bold, fontSize: 15, color: colors.white },
});
