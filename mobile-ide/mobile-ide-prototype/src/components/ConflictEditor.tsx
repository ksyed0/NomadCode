import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import { useTheme } from '../theme/tokens';
import { FileSystemBridge } from '../utils/FileSystemBridge';
import { GitBridge } from '../git/gitBridge';
import { parseConflicts, applyResolution, ConflictFile, ConflictHunk } from '../git/conflictParser';

interface ConflictEditorProps {
  filePath: string;
  repoDir: string;
  onResolved: () => void;
  onClose: () => void;
}

export default function ConflictEditor({ filePath, repoDir, onResolved, onClose }: ConflictEditorProps) {
  const t = useTheme();
  const [file, setFile] = useState<ConflictFile | null>(null);
  const [loading, setLoading] = useState(true);
  const [staging, setStaging] = useState(false);

  // Relative path for staging (strip repoDir prefix)
  const relPath = filePath.startsWith(repoDir + '/')
    ? filePath.slice(repoDir.length + 1)
    : filePath;

  useEffect(() => {
    FileSystemBridge.readFile(filePath)
      .then((content: string) => setFile(parseConflicts(content)))
      .catch(() => Alert.alert('Error', 'Could not read file'))
      .finally(() => setLoading(false));
  }, [filePath]);

  const setChoice = useCallback((idx: number, choice: ConflictHunk['choice']) => {
    setFile(prev => {
      if (!prev) return prev;
      const hunks = prev.hunks.map((h, i) => i === idx ? { ...h, choice } : h);
      return { ...prev, hunks };
    });
  }, []);

  const allResolved = file ? file.hunks.every(h => h.choice !== null) : false;

  const doStage = useCallback(async () => {
    if (!file) return;
    setStaging(true);
    try {
      const resolved = applyResolution(file);
      await FileSystemBridge.writeFile(filePath, resolved);
      await GitBridge.add(repoDir, relPath);
      onResolved();
    } catch (e) {
      Alert.alert('Stage failed', e instanceof Error ? e.message : String(e));
    } finally {
      setStaging(false);
    }
  }, [file, filePath, repoDir, relPath, onResolved]);

  if (loading) return <ActivityIndicator style={{ flex: 1 }} color={t.accent} />;
  if (!file) return null;

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      {/* Header */}
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: t.border,
      }}>
        <Text style={{ fontSize: 14, fontWeight: '600', flex: 1, color: t.text }} numberOfLines={1}>
          {relPath} — {file.hunks.filter(h => h.choice === null).length} unresolved
        </Text>
        <TouchableOpacity
          onPress={onClose}
          accessibilityLabel="Close conflict editor"
          style={{ padding: 4, minWidth: 44, minHeight: 44, justifyContent: 'center', alignItems: 'center' }}
        >
          <Text style={{ color: t.textMuted, fontSize: 18 }}>✕</Text>
        </TouchableOpacity>
      </View>

      <ScrollView>
        {file.hunks.map((hunk, idx) => (
          <View key={idx}>
            {/* Pre-hunk context lines */}
            {hunk.pre.map((line, li) => (
              <Text key={`pre-${li}`} style={{ fontSize: 12, fontFamily: 'monospace', paddingHorizontal: 16, paddingVertical: 1, color: t.text }}>
                {line}
              </Text>
            ))}

            {hunk.choice !== null ? (
              <Text style={{ color: t.success, fontSize: 11, paddingHorizontal: 16, paddingVertical: 4 }}>
                ✓ Resolved ({hunk.choice})
              </Text>
            ) : (
              <>
                {/* OURS block */}
                <View style={{
                  backgroundColor: '#0D948822',
                  borderLeftWidth: 3,
                  borderLeftColor: '#0D9488',
                  marginHorizontal: 8,
                  borderRadius: 4,
                  paddingVertical: 4,
                  marginVertical: 2,
                }}>
                  <Text style={{ color: '#0D9488', fontSize: 10, fontWeight: '600', paddingHorizontal: 8, marginBottom: 2 }}>▶ OURS</Text>
                  {hunk.ours.map((l, li) => (
                    <Text key={li} style={{ fontSize: 12, fontFamily: 'monospace', paddingHorizontal: 8, color: t.text }}>{l}</Text>
                  ))}
                </View>

                {/* THEIRS block */}
                <View style={{
                  backgroundColor: '#D9770622',
                  borderLeftWidth: 3,
                  borderLeftColor: '#D97706',
                  marginHorizontal: 8,
                  borderRadius: 4,
                  paddingVertical: 4,
                  marginVertical: 2,
                }}>
                  <Text style={{ color: '#D97706', fontSize: 10, fontWeight: '600', paddingHorizontal: 8, marginBottom: 2 }}>▶ THEIRS</Text>
                  {hunk.theirs.map((l, li) => (
                    <Text key={li} style={{ fontSize: 12, fontFamily: 'monospace', paddingHorizontal: 8, color: t.text }}>{l}</Text>
                  ))}
                </View>

                {/* Accept buttons */}
                <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 8, paddingVertical: 6 }}>
                  {(['ours', 'theirs', 'both'] as const).map(choice => (
                    <TouchableOpacity
                      key={choice}
                      style={{
                        flex: 1,
                        borderRadius: 6,
                        paddingVertical: 6,
                        alignItems: 'center',
                        minHeight: 36,
                        justifyContent: 'center',
                        backgroundColor: choice === 'ours' ? '#0D948833'
                          : choice === 'theirs' ? '#D9770633' : '#2563EB33',
                      }}
                      onPress={() => setChoice(idx, choice)}
                      accessibilityLabel={`Accept ${choice}`}
                    >
                      <Text style={{
                        color: choice === 'ours' ? '#0D9488' : choice === 'theirs' ? '#D97706' : t.accent,
                        fontSize: 12,
                        fontWeight: '600',
                      }}>
                        {choice.charAt(0).toUpperCase() + choice.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}
          </View>
        ))}

        {/* Trailing lines */}
        {file.trailing.map((line, li) => (
          <Text key={`trail-${li}`} style={{ fontSize: 12, fontFamily: 'monospace', paddingHorizontal: 16, paddingVertical: 1, color: t.text }}>
            {line}
          </Text>
        ))}
      </ScrollView>

      {/* Stage button — only visible when all resolved */}
      {allResolved && (
        <View style={{ padding: 16, borderTopWidth: 1, borderTopColor: t.border }}>
          <TouchableOpacity
            style={{ backgroundColor: t.success, borderRadius: 8, paddingVertical: 12, alignItems: 'center' }}
            onPress={doStage}
            disabled={staging}
          >
            <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>Mark Resolved & Stage</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}
