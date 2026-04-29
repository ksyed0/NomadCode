import React, { useState, useEffect, useCallback } from 'react';
import {
  Modal, View, Text, TextInput, TouchableOpacity,
  SectionList, StyleSheet, ActivityIndicator, Alert, useWindowDimensions,
} from 'react-native';
import { useTheme } from '../theme/tokens';
import { GitBridge } from '../git/gitBridge';

interface BranchPickerSheetProps {
  visible: boolean;
  onClose: () => void;
  currentBranch: string;
  repoDir: string;
  onBranchSelected: (branch: string) => void;
}

export default function BranchPickerSheet({
  visible, onClose, currentBranch, repoDir, onBranchSelected,
}: BranchPickerSheetProps) {
  const t = useTheme();
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;

  const [branches, setBranches] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [newBranchExpanded, setNewBranchExpanded] = useState(false);
  const [newBranchName, setNewBranchName] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setLoading(true);
    setQuery('');
    setNewBranchExpanded(false);
    setNewBranchName('');
    GitBridge.branches(repoDir)
      .then(setBranches)
      .catch(() => setBranches([]))
      .finally(() => setLoading(false));
  }, [visible, repoDir]);

  const localBranches = branches.filter(b => !b.startsWith('origin/'));
  const remoteBranches = branches.filter(b => b.startsWith('origin/'));

  const filtered = useCallback((list: string[]) =>
    query ? list.filter(b => b.toLowerCase().includes(query.toLowerCase())) : list,
  [query]);

  const sections = [
    { title: 'LOCAL', data: filtered(localBranches) },
    { title: 'REMOTE', data: filtered(remoteBranches) },
  ].filter(s => s.data.length > 0);

  const doCheckout = useCallback(async (branch: string) => {
    setBusy(true);
    try {
      await GitBridge.checkout(repoDir, branch);
      onBranchSelected(branch);
      onClose();
    } catch (e) {
      Alert.alert('Checkout failed', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [repoDir, onBranchSelected, onClose]);

  const doCreateBranch = useCallback(async () => {
    const name = newBranchName.trim();
    if (!name) return;
    setBusy(true);
    try {
      await GitBridge.createBranch(repoDir, name, true);
      onBranchSelected(name);
      onClose();
    } catch (e) {
      Alert.alert('Create branch failed', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [repoDir, newBranchName, onBranchSelected, onClose]);

  const s = StyleSheet.create({
    overlay:        { flex: 1, backgroundColor: '#00000066', justifyContent: isTablet ? 'center' : 'flex-end', alignItems: isTablet ? 'center' : 'stretch' },
    sheet:          { backgroundColor: t.bgElevated, borderRadius: isTablet ? 12 : undefined, borderTopLeftRadius: 12, borderTopRightRadius: 12, maxHeight: '70%', width: isTablet ? 480 : undefined, paddingBottom: 16 },
    handle:         { width: 40, height: 4, backgroundColor: t.border, borderRadius: 2, alignSelf: 'center', marginTop: 10, marginBottom: 12 },
    title:          { color: t.text, fontSize: 16, fontWeight: '600', paddingHorizontal: 16, marginBottom: 8 },
    search:         { backgroundColor: t.bg, color: t.text, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, marginHorizontal: 16, marginBottom: 8, fontSize: 14 },
    sectionHeader:  { color: t.textMuted, fontSize: 11, fontWeight: '600', letterSpacing: 1, paddingHorizontal: 16, paddingVertical: 4, textTransform: 'uppercase' },
    row:            { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, minHeight: 44 },
    rowText:        { color: t.text, fontSize: 14, flex: 1 },
    newBranchBtn:   { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, minHeight: 44 },
    newBranchText:  { color: t.accent, fontSize: 14 },
    newBranchRow:   { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 8, marginTop: 4 },
    newBranchInput: { flex: 1, backgroundColor: t.bg, color: t.text, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, fontSize: 14 },
    createBtn:      { backgroundColor: t.accent, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 8, minHeight: 44, justifyContent: 'center' },
    createBtnText:  { color: '#fff', fontSize: 14, fontWeight: '600' },
  });

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} onPress={() => {}}>
          <View style={s.sheet}>
            <View style={s.handle} />
            <Text style={s.title}>Switch Branch</Text>
            <TextInput
              style={s.search}
              placeholder="Search branches..."
              placeholderTextColor={t.textMuted}
              value={query}
              onChangeText={setQuery}
              autoCorrect={false}
            />
            {loading ? (
              <ActivityIndicator color={t.accent} style={{ margin: 20 }} />
            ) : (
              <SectionList
                sections={sections}
                keyExtractor={item => item}
                renderSectionHeader={({ section }) => (
                  <Text style={s.sectionHeader}>{section.title}</Text>
                )}
                renderItem={({ item }) => {
                  const isActive = item === currentBranch;
                  return (
                    <TouchableOpacity
                      style={[s.row, isActive && { backgroundColor: t.bgHighlight }]}
                      onPress={() => doCheckout(item)}
                      disabled={busy || isActive}
                      accessibilityLabel={`Checkout branch ${item}`}
                    >
                      <Text style={s.rowText}>
                        {isActive ? `✓ ${item}` : `  ${item}`}
                      </Text>
                    </TouchableOpacity>
                  );
                }}
              />
            )}
            {newBranchExpanded ? (
              <View style={s.newBranchRow}>
                <TextInput
                  style={s.newBranchInput}
                  placeholder="Enter branch name"
                  placeholderTextColor={t.textMuted}
                  value={newBranchName}
                  onChangeText={setNewBranchName}
                  autoCorrect={false}
                  autoCapitalize="none"
                  onSubmitEditing={doCreateBranch}
                  accessibilityLabel="Branch name"
                />
                <TouchableOpacity
                  style={s.createBtn}
                  onPress={doCreateBranch}
                  disabled={busy || !newBranchName.trim()}
                >
                  <Text style={s.createBtnText}>Create</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity style={s.newBranchBtn} onPress={() => setNewBranchExpanded(true)}>
                <Text style={s.newBranchText}>+ New branch</Text>
              </TouchableOpacity>
            )}
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}
