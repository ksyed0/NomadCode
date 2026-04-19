/**
 * US-0028: Inline diff view — HEAD vs working tree (UTF-8 text).
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { GitBridge } from '../utils/FileSystemBridge';
import { useTheme } from '../theme/tokens';

export interface GitDiffModalProps {
  visible: boolean;
  onClose: () => void;
  rootPath: string;
  filepath: string | null;
  /** When set, show the diff introduced by this commit instead of HEAD vs working tree. */
  commitHash?: string | null;
}

function simpleLineDiff(a: string, b: string): { line: number; type: 'add' | 'del' | 'ctx'; text: string }[] {
  const al = a.split('\n');
  const bl = b.split('\n');
  const out: { line: number; type: 'add' | 'del' | 'ctx'; text: string }[] = [];
  const max = Math.max(al.length, bl.length);
  for (let i = 0; i < max; i++) {
    const left = al[i];
    const right = bl[i];
    if (left === right) {
      out.push({ line: i + 1, type: 'ctx', text: left ?? '' });
    } else {
      if (left !== undefined && left !== right) {
        out.push({ line: i + 1, type: 'del', text: left });
      }
      if (right !== undefined && left !== right) {
        out.push({ line: i + 1, type: 'add', text: right });
      }
    }
  }
  return out;
}

export default function GitDiffModal({
  visible,
  onClose,
  rootPath,
  filepath,
  commitHash,
}: GitDiffModalProps): React.ReactElement {
  const t = useTheme();
  const [loading, setLoading] = useState(false);
  const [beforeText, setBeforeText] = useState('');
  const [afterText, setAfterText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!filepath) return;
    setLoading(true);
    setError(null);
    try {
      if (commitHash) {
        const result = await GitBridge.getCommitDiff(rootPath, commitHash, filepath);
        setBeforeText(result.beforeText);
        setAfterText(result.afterText);
      } else {
        const { headText, workText } = await GitBridge.getWorkingDiff(rootPath, filepath);
        setBeforeText(headText);
        setAfterText(workText);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [rootPath, filepath, commitHash]);

  useEffect(() => {
    if (visible && filepath) void load();
  }, [visible, filepath, commitHash, load]);

  const lines = simpleLineDiff(beforeText, afterText);

  const title = commitHash ? `Commit ${commitHash}: ${filepath ?? ''}` : `Diff: ${filepath ?? ''}`;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.sheet, { backgroundColor: t.bgElevated, borderColor: t.border }]}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: t.text }]} numberOfLines={2}>
              {title}
            </Text>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeBtn}
              accessibilityLabel="Close diff"
              accessibilityRole="button"
            >
              <Text style={[styles.closeText, { color: t.textMuted }]}>✕</Text>
            </TouchableOpacity>
          </View>
          {loading ? (
            <ActivityIndicator color={t.accent} style={styles.loader} />
          ) : error ? (
            <Text style={{ color: t.error }}>{error}</Text>
          ) : (
            <ScrollView style={styles.scroll}>
              {lines.map((row, i) => (
                <Text
                  key={`${row.line}-${i}-${row.type}`}
                  style={[
                    styles.line,
                    row.type === 'add' && { backgroundColor: 'rgba(34,197,94,0.2)', color: t.success },
                    row.type === 'del' && { backgroundColor: 'rgba(239,68,68,0.2)', color: t.error },
                    row.type === 'ctx' && { color: t.textMuted },
                  ]}
                >
                  {row.type === 'add' ? '+ ' : row.type === 'del' ? '- ' : '  '}
                  {row.text}
                </Text>
              ))}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 16,
  },
  sheet: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    maxHeight: '85%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  title: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
  },
  closeBtn: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    fontSize: 18,
  },
  loader: {
    marginVertical: 24,
  },
  scroll: {
    maxHeight: 480,
  },
  line: {
    fontFamily: 'Menlo',
    fontSize: 11,
    paddingVertical: 2,
    paddingHorizontal: 4,
  },
});
