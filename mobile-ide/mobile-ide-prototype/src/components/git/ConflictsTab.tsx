import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { GitBridge } from '../../utils/FileSystemBridge';
import useGitStore from '../../stores/useGitStore';
import { useTheme } from '../../theme/tokens';

export interface ConflictsTabProps { rootPath: string; }

export default function ConflictsTab({ rootPath }: ConflictsTabProps): React.ReactElement {
  const t = useTheme();
  const conflicts = useGitStore((s) => s.conflicts);
  const setConflicts = useGitStore((s) => s.setConflicts);
  const bumpFileTree = useGitStore((s) => s.bumpFileTree);

  // Store only the selected path; derive the full ConflictFile object so we
  // never need to call setState inside an effect to keep selection in sync.
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);
  const selectedFile =
    conflicts.find((f) => f.path === selectedFilePath) ?? conflicts[0] ?? null;
  const [resolvedHunks, setResolvedHunks] = useState<Set<number>>(new Set());
  const [stagedFiles, setStagedFiles] = useState<Set<string>>(new Set());

  const loadConflicts = useCallback(async () => {
    try {
      const files = await GitBridge.getConflicts(rootPath);
      setConflicts(files);
    } catch { /* silent */ }
  }, [rootPath, setConflicts]);

  useEffect(() => { void loadConflicts(); }, [loadConflicts]);

  const handleAccept = async (hunkIndex: number, choice: 'ours' | 'theirs' | 'both') => {
    if (!selectedFile) return;
    try {
      await GitBridge.resolveHunk(rootPath, selectedFile.path, hunkIndex, choice);
      setResolvedHunks((prev) => new Set([...prev, hunkIndex]));
    } catch (e) {
      Alert.alert('Resolve failed', String(e));
    }
  };

  const handleStageFile = async () => {
    if (!selectedFile) return;
    try {
      await GitBridge.add(rootPath, selectedFile.path);
      setStagedFiles((prev) => new Set([...prev, selectedFile.path]));
      setResolvedHunks(new Set());
      setSelectedFilePath(null);
      bumpFileTree();
      await loadConflicts();
    } catch (e) {
      Alert.alert('Stage failed', String(e));
    }
  };

  const s = styles(t);

  if (conflicts.length === 0) {
    return (
      <View style={s.empty} testID="no-conflicts">
        <Text style={s.emptyText}>No merge conflicts</Text>
      </View>
    );
  }

  const allHunksResolved = selectedFile
    ? selectedFile.hunks.every((h) => resolvedHunks.has(h.index))
    : false;
  const isStaged = selectedFile ? stagedFiles.has(selectedFile.path) : false;

  return (
    <ScrollView style={s.container}>
      {/* Warning banner */}
      <View style={s.banner} testID="conflict-banner">
        <Text style={s.bannerIcon}>!</Text>
        <View>
          <Text style={s.bannerTitle}>{conflicts.length} file{conflicts.length > 1 ? 's' : ''} with conflicts</Text>
          <Text style={s.bannerSub}>Resolve all conflicts before committing</Text>
        </View>
      </View>

      {/* File list */}
      {conflicts.map((file) => (
        <TouchableOpacity
          key={file.path}
          onPress={() => { setSelectedFilePath(file.path); setResolvedHunks(new Set()); }}
          style={[s.fileRow, selectedFile?.path === file.path && s.fileRowActive]}
          accessibilityLabel={file.path}
        >
          <Text style={s.fileName}>{file.path}</Text>
          <Text style={s.hunkCount}>{file.hunks.length} hunk{file.hunks.length !== 1 ? 's' : ''}</Text>
          {stagedFiles.has(file.path) && <Text style={s.stagedBadge}>Staged</Text>}
        </TouchableOpacity>
      ))}

      {/* 2-panel diff for selected file */}
      {selectedFile && selectedFile.hunks.map((hunk) => (
        <View key={hunk.index} style={s.hunkContainer}>
          <Text style={s.hunkLabel}>Hunk {hunk.index + 1} of {selectedFile.hunks.length}</Text>
          <View style={s.panels}>
            <View style={s.panelOurs} testID="panel-ours">
              <Text style={s.panelHeader}>OURS</Text>
              {hunk.ours.map((line, i) => (
                <Text key={i} style={s.codeLine}>{line}</Text>
              ))}
            </View>
            <View style={s.panelTheirs} testID="panel-theirs">
              <Text style={s.panelHeaderTheirs}>THEIRS</Text>
              {hunk.theirs.map((line, i) => (
                <Text key={i} style={s.codeLineTheirs}>{line}</Text>
              ))}
            </View>
          </View>
          {!resolvedHunks.has(hunk.index) && (
            <View style={s.actions}>
              <TouchableOpacity
                testID={`accept-ours-${hunk.index}`}
                onPress={() => handleAccept(hunk.index, 'ours')}
                style={[s.actionBtn, s.oursBtn]}
                accessibilityLabel="Accept Ours"
              >
                <Text style={s.oursBtnText}>Accept Ours</Text>
              </TouchableOpacity>
              <TouchableOpacity
                testID={`accept-theirs-${hunk.index}`}
                onPress={() => handleAccept(hunk.index, 'theirs')}
                style={[s.actionBtn, s.theirsBtn]}
                accessibilityLabel="Accept Theirs"
              >
                <Text style={s.theirsBtnText}>Accept Theirs</Text>
              </TouchableOpacity>
              <TouchableOpacity
                testID={`accept-both-${hunk.index}`}
                onPress={() => handleAccept(hunk.index, 'both')}
                style={[s.actionBtn, s.bothBtn]}
                accessibilityLabel="Accept Both"
              >
                <Text style={s.bothBtnText}>Both</Text>
              </TouchableOpacity>
            </View>
          )}
          {resolvedHunks.has(hunk.index) && (
            <Text style={s.resolvedLabel}>Resolved</Text>
          )}
        </View>
      ))}

      {/* Stage button after all hunks resolved */}
      {allHunksResolved && !isStaged && (
        <TouchableOpacity
          testID="stage-file-btn"
          onPress={handleStageFile}
          style={s.stageBtn}
          accessibilityLabel="Stage resolved file"
        >
          <Text style={s.stageBtnText}>Stage File</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const styles = (t: ReturnType<typeof import('../../theme/tokens').useTheme>) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: t.bg },
    empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
    emptyText: { color: t.textMuted, fontSize: 15 },
    banner: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      backgroundColor: '#3b1f2b', margin: 12, padding: 10, borderRadius: 6,
    },
    bannerIcon: { color: '#f87171', fontSize: 20 },
    bannerTitle: { color: '#f87171', fontWeight: '600', fontSize: 13 },
    bannerSub: { color: t.textMuted, fontSize: 11 },
    fileRow: {
      flexDirection: 'row', alignItems: 'center', gap: 8,
      padding: 10, marginHorizontal: 12, marginBottom: 4,
      backgroundColor: '#1e293b', borderRadius: 6,
    },
    fileRowActive: { borderLeftWidth: 3, borderLeftColor: t.accent },
    fileName: { color: t.text, fontSize: 13, flex: 1 },
    hunkCount: { color: '#f87171', fontSize: 11 },
    stagedBadge: { color: '#22c55e', fontSize: 11, fontWeight: '600' },
    hunkContainer: { margin: 12, marginTop: 0 },
    hunkLabel: { color: t.textMuted, fontSize: 11, marginBottom: 6 },
    panels: { flexDirection: 'row', gap: 4 },
    panelOurs: { flex: 1, backgroundColor: '#0f172a', borderWidth: 1, borderColor: '#1e3a5f', borderRadius: 4, padding: 6 },
    panelTheirs: { flex: 1, backgroundColor: '#0f172a', borderWidth: 1, borderColor: '#7f1d1d', borderRadius: 4, padding: 6 },
    panelHeader: { color: '#60a5fa', fontSize: 9, fontWeight: '700', marginBottom: 4 },
    panelHeaderTheirs: { color: '#f87171', fontSize: 9, fontWeight: '700', marginBottom: 4 },
    codeLine: { color: '#22c55e', fontSize: 11, fontFamily: 'monospace' },
    codeLineTheirs: { color: '#f87171', fontSize: 11, fontFamily: 'monospace' },
    actions: { flexDirection: 'row', gap: 4, marginTop: 6 },
    actionBtn: { flex: 1, padding: 7, borderRadius: 4, alignItems: 'center' },
    oursBtn: { backgroundColor: '#1e3a5f' },
    oursBtnText: { color: '#60a5fa', fontSize: 11, fontWeight: '600' },
    theirsBtn: { backgroundColor: '#7f1d1d' },
    theirsBtnText: { color: '#f87171', fontSize: 11, fontWeight: '600' },
    bothBtn: { backgroundColor: '#374151' },
    bothBtnText: { color: t.text, fontSize: 11, fontWeight: '600' },
    resolvedLabel: { color: '#22c55e', fontSize: 12, marginTop: 6 },
    stageBtn: {
      backgroundColor: '#22c55e', margin: 12, padding: 12,
      borderRadius: 6, alignItems: 'center',
    },
    stageBtnText: { color: '#0f172a', fontWeight: '700', fontSize: 14 },
  });
