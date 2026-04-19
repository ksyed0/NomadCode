import React, { useCallback, useEffect, useState } from 'react';
import {
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
import type { StashEntry } from '../../types/git';

export interface StashTabProps { rootPath: string; }

function relativeTime(ms: number): string {
  const diff = Date.now() - ms;
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)} min ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} hr ago`;
  return `${Math.floor(diff / 86400000)} day${Math.floor(diff / 86400000) > 1 ? 's' : ''} ago`;
}

export default function StashTab({ rootPath }: StashTabProps): React.ReactElement {
  const t = useTheme();
  const stashes = useGitStore((s) => s.stashes);
  const setStashes = useGitStore((s) => s.setStashes);

  const [message, setMessage] = useState('');

  const loadStashes = useCallback(async () => {
    try {
      const list = await GitBridge.listStashes(rootPath);
      setStashes(list);
    } catch { /* silent */ }
  }, [rootPath, setStashes]);

  useEffect(() => { void loadStashes(); }, [loadStashes]);

  const handleStash = async () => {
    try {
      await GitBridge.stash(rootPath, message || undefined);
      setMessage('');
      await loadStashes();
    } catch (e) {
      Alert.alert('Stash failed', String(e));
    }
  };

  const handlePop = async (entry: StashEntry) => {
    try {
      await GitBridge.applyStash(rootPath, entry.index, true);
      await loadStashes();
    } catch (e) {
      Alert.alert('Pop failed', String(e));
    }
  };

  const handleApply = async (entry: StashEntry) => {
    try {
      await GitBridge.applyStash(rootPath, entry.index, false);
      await loadStashes();
    } catch (e) {
      Alert.alert('Apply failed', String(e));
    }
  };

  const handleDrop = (entry: StashEntry) => {
    Alert.alert('Drop stash', `Drop stash@{${entry.index}}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Drop', style: 'destructive',
        onPress: async () => {
          try {
            await GitBridge.dropStash(rootPath, entry.index);
            await loadStashes();
          } catch (e) {
            Alert.alert('Drop failed', String(e));
          }
        },
      },
    ]);
  };

  const s = styles(t);

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      {/* Stash new changes */}
      <View style={s.createRow}>
        <TextInput
          testID="stash-message-input"
          style={s.input}
          value={message}
          onChangeText={setMessage}
          placeholder="Stash message (optional)"
          placeholderTextColor={t.textMuted}
        />
        <TouchableOpacity
          testID="stash-btn"
          onPress={handleStash}
          style={s.stashBtn}
          accessibilityLabel="Stash changes"
        >
          <Text style={s.stashBtnText}>Stash</Text>
        </TouchableOpacity>
      </View>

      {/* Stash list */}
      <Text style={s.sectionLabel}>STASH LIST</Text>
      {stashes.length === 0 && (
        <View style={s.empty} testID="no-stashes">
          <Text style={s.emptyText}>No stashes — use Stash to save work in progress</Text>
        </View>
      )}
      {stashes.map((entry) => (
        <View key={entry.index} style={s.stashRow}>
          <View style={s.stashHeader}>
            <Text style={s.stashIndex}>stash@{'{' + entry.index + '}'}</Text>
            <Text style={s.stashTime}>{relativeTime(entry.timestamp)}</Text>
          </View>
          <Text style={s.stashMessage}>{entry.message}</Text>
          <Text style={s.fileCount}>{entry.fileCount} file{entry.fileCount !== 1 ? 's' : ''} changed</Text>
          <View style={s.actions}>
            <TouchableOpacity
              onPress={() => handlePop(entry)}
              style={[s.actionBtn, s.popBtn]}
              accessibilityLabel={`Pop stash@{${entry.index}}`}
            >
              <Text style={s.popBtnText}>Pop</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => handleApply(entry)}
              style={s.actionBtn}
              accessibilityLabel={`Apply stash@{${entry.index}}`}
            >
              <Text style={s.actionBtnText}>Apply</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => handleDrop(entry)}
              style={[s.actionBtn, s.dropBtn]}
              accessibilityLabel={`Drop stash@{${entry.index}}`}
            >
              <Text style={s.dropBtnText}>Drop</Text>
            </TouchableOpacity>
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = (t: ReturnType<typeof import('../../theme/tokens').useTheme>) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: t.bg },
    content: { padding: 16, gap: 8 },
    createRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
    input: {
      flex: 1, backgroundColor: '#1e293b', borderWidth: 1, borderColor: t.border,
      borderRadius: 6, paddingHorizontal: 10, paddingVertical: 8,
      color: t.text, fontSize: 14,
    },
    stashBtn: {
      backgroundColor: '#0d9488', borderRadius: 6,
      paddingHorizontal: 14, paddingVertical: 8, justifyContent: 'center',
    },
    stashBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
    sectionLabel: {
      color: t.textMuted, fontSize: 11, fontWeight: '600',
      letterSpacing: 0.5, marginBottom: 4,
    },
    empty: { padding: 20, alignItems: 'center' },
    emptyText: { color: t.textMuted, fontSize: 13, textAlign: 'center' },
    stashRow: {
      backgroundColor: '#1e293b', borderWidth: 1, borderColor: t.border,
      borderRadius: 6, padding: 10, marginBottom: 8,
    },
    stashHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
    stashIndex: { color: t.text, fontSize: 13, fontWeight: '600' },
    stashTime: { color: t.textMuted, fontSize: 11 },
    stashMessage: { color: t.textMuted, fontSize: 12, marginBottom: 4 },
    fileCount: { color: t.textMuted, fontSize: 11, marginBottom: 8 },
    actions: { flexDirection: 'row', gap: 6 },
    actionBtn: {
      flex: 1, backgroundColor: '#374151', padding: 7,
      borderRadius: 4, alignItems: 'center',
    },
    actionBtnText: { color: t.text, fontSize: 12 },
    popBtn: { backgroundColor: '#2563eb' },
    popBtnText: { color: '#fff', fontSize: 12, fontWeight: '600' },
    dropBtn: { backgroundColor: '#7f1d1d' },
    dropBtnText: { color: '#f87171', fontSize: 12 },
  });
