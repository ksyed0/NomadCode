import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { GitBridge } from '../../utils/FileSystemBridge';
import useGitStore from '../../stores/useGitStore';
import { useTheme } from '../../theme/tokens';

export interface BranchesTabProps {
  rootPath: string;
  authToken: string | null;
}

export default function BranchesTab({ rootPath }: BranchesTabProps): React.ReactElement {
  const t = useTheme();
  const currentBranch = useGitStore((s) => s.branch);
  const ahead = useGitStore((s) => s.ahead);
  const behind = useGitStore((s) => s.behind);
  const setBranchInfo = useGitStore((s) => s.setBranchInfo);

  const [branches, setBranches] = useState<string[]>([]);
  const [newName, setNewName] = useState('');
  const [loading, setLoading] = useState(false);

  const loadBranches = useCallback(async () => {
    try {
      const list = await GitBridge.branches(rootPath);
      setBranches(list);
    } catch { /* silent */ }
  }, [rootPath]);

  useEffect(() => { void loadBranches(); }, [loadBranches]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setLoading(true);
    try {
      await GitBridge.createBranch(rootPath, newName.trim(), true);
      setBranchInfo(newName.trim(), 0, 0);
      setNewName('');
      await loadBranches();
    } catch (e) {
      Alert.alert('Create failed', String(e));
    } finally {
      setLoading(false);
    }
  };

  const handleSwitch = async (branch: string) => {
    setLoading(true);
    try {
      await GitBridge.checkout(rootPath, branch);
      setBranchInfo(branch, 0, 0);
      await loadBranches();
    } catch (e) {
      Alert.alert('Switch failed', String(e));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = (branch: string) => {
    Alert.alert('Delete branch', `Delete "${branch}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try {
            await GitBridge.deleteBranch(rootPath, branch);
            await loadBranches();
          } catch (e) {
            Alert.alert('Delete failed', String(e));
          }
        },
      },
    ]);
  };

  const s = styles(t);
  const localBranches = branches.filter((b) => !b.startsWith('remotes/'));
  const remoteBranches = branches.filter((b) => b.startsWith('remotes/'));

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      {/* Create new branch */}
      <View style={s.createRow}>
        <TextInput
          testID="new-branch-input"
          style={s.input}
          value={newName}
          onChangeText={setNewName}
          placeholder="new-branch-name"
          placeholderTextColor={t.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <TouchableOpacity
          testID="create-branch-btn"
          onPress={handleCreate}
          style={[s.createBtn, !newName.trim() && s.createBtnDisabled]}
          disabled={!newName.trim() || loading}
          accessibilityLabel="Create branch"
          accessibilityState={{ disabled: !newName.trim() || loading }}
        >
          {loading ? <ActivityIndicator size="small" color="#fff" /> : <Text style={s.createBtnText}>+ Create</Text>}
        </TouchableOpacity>
      </View>

      {/* Local branches */}
      <Text style={s.sectionLabel}>LOCAL BRANCHES</Text>
      {localBranches.map((branch) => {
        const isCurrent = branch === currentBranch;
        return (
          <View key={branch} style={[s.branchRow, isCurrent && s.branchRowCurrent]}>
            <View style={s.branchInfo}>
              <Text style={[s.branchName, isCurrent && s.branchNameCurrent]}>
                ⎇ {branch}
              </Text>
              {isCurrent && (
                <View style={s.currentBadge} testID="current-branch-badge">
                  <Text style={s.currentBadgeText}>current</Text>
                </View>
              )}
              {isCurrent && (ahead > 0 || behind > 0) && (
                <Text style={s.aheadBehind}>↑{ahead} ↓{behind}</Text>
              )}
            </View>
            {!isCurrent && (
              <View style={s.actions}>
                <TouchableOpacity
                  onPress={() => handleSwitch(branch)}
                  style={s.actionBtn}
                  accessibilityLabel={`Switch to ${branch}`}
                >
                  <Text style={s.actionBtnText}>Switch</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => handleDelete(branch)}
                  style={[s.actionBtn, s.deleteBtn]}
                  accessibilityLabel={`Delete ${branch}`}
                >
                  <Text style={s.deleteBtnText}>Delete</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        );
      })}

      {/* Remote branches */}
      {remoteBranches.length > 0 && (
        <>
          <Text style={s.sectionLabel}>REMOTE BRANCHES</Text>
          {remoteBranches.map((branch) => (
            <View key={branch} style={s.branchRow}>
              <Text style={s.branchNameRemote}>{branch.replace('remotes/', '')}</Text>
              <TouchableOpacity
                onPress={() => handleSwitch(branch)}
                style={s.actionBtn}
                accessibilityLabel={`Checkout ${branch}`}
              >
                <Text style={s.actionBtnText}>Checkout</Text>
              </TouchableOpacity>
            </View>
          ))}
        </>
      )}
    </ScrollView>
  );
}

const styles = (t: ReturnType<typeof import('../../theme/tokens').useTheme>) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: t.bg },
    content: { padding: 16, gap: 6 },
    createRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
    input: {
      flex: 1, backgroundColor: '#1e293b', borderWidth: 1, borderColor: t.border,
      borderRadius: 6, paddingHorizontal: 10, paddingVertical: 8,
      color: t.text, fontSize: 14,
    },
    createBtn: {
      backgroundColor: t.accent, borderRadius: 6,
      paddingHorizontal: 14, paddingVertical: 8, justifyContent: 'center',
    },
    createBtnDisabled: { opacity: 0.4 },
    createBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
    sectionLabel: {
      color: t.textMuted, fontSize: 11, fontWeight: '600',
      letterSpacing: 0.5, marginTop: 8, marginBottom: 4,
    },
    branchRow: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      backgroundColor: '#1e293b', borderRadius: 6, padding: 10, marginBottom: 4,
    },
    branchRowCurrent: { borderLeftWidth: 3, borderLeftColor: t.accent },
    branchInfo: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
    branchName: { color: t.text, fontSize: 13 },
    branchNameCurrent: { color: t.accent },
    branchNameRemote: { color: t.textMuted, fontSize: 13, flex: 1 },
    currentBadge: {
      backgroundColor: t.accent, borderRadius: 10,
      paddingHorizontal: 6, paddingVertical: 2,
    },
    currentBadgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
    aheadBehind: { color: t.textMuted, fontSize: 11 },
    actions: { flexDirection: 'row', gap: 6 },
    actionBtn: {
      backgroundColor: '#374151', borderRadius: 4,
      paddingHorizontal: 10, paddingVertical: 5,
    },
    actionBtnText: { color: t.text, fontSize: 12 },
    deleteBtn: { backgroundColor: '#7f1d1d' },
    deleteBtnText: { color: '#f87171', fontSize: 12 },
  });
