/**
 * US-0026 / US-0027 / US-0029: Git status, stage, commit, push, pull, branches.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Alert,
} from 'react-native';
import { GitBridge, type GitStatus } from '../utils/FileSystemBridge';
import { fsProgress } from '../git/expoGitFs';
import useGitStore from '../stores/useGitStore';
import { useTheme } from '../theme/tokens';

export interface GitPanelProps {
  visible: boolean;
  onClose: () => void;
  rootPath: string;
  authToken: string | null;
  onOpenSettings: () => void;
  onOpenDiff: (filepath: string) => void;
}

export default function GitPanel({
  visible,
  onClose,
  rootPath,
  authToken,
  onOpenSettings,
  onOpenDiff,
}: GitPanelProps): React.ReactElement {
  const t = useTheme();
  const setBranchInfo = useGitStore((s) => s.setBranchInfo);
  const setLastError = useGitStore((s) => s.setLastError);
  const bumpFileTree = useGitStore((s) => s.bumpFileTree);
  const [status, setStatus] = useState<GitStatus | null>(null);
  const [commitMsg, setCommitMsg] = useState('');
  const [branches, setBranches] = useState<string[]>([]);
  const [newBranch, setNewBranch] = useState('');
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [scanProgress, setScanProgress] = useState<{ reads: number; bytes: number; elapsed: number } | null>(null);
  const scanStartRef = useRef<number>(0);

  const refresh = useCallback(async () => {
    setLoading(true);
    setLastError(null);
    // Start live progress polling — the statusMatrix scan can take a minute
    // or more on a cold cache for a large repo. Without feedback the spinner
    // looks frozen.
    fsProgress.reset();
    scanStartRef.current = Date.now();
    setScanProgress({ reads: 0, bytes: 0, elapsed: 0 });
    const progressTimer = setInterval(() => {
      setScanProgress({
        reads: fsProgress.reads,
        bytes: fsProgress.bytes,
        elapsed: Math.floor((Date.now() - scanStartRef.current) / 1000),
      });
    }, 250);
    try {
      const s = await GitBridge.status(rootPath);
      setStatus(s);
      setBranchInfo(s.branch, s.ahead, s.behind);
      if (s.noRepo) {
        setBranches([]);
        return;
      }
      const b = await GitBridge.branches(s.repoDir);
      setBranches(b);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setLastError(msg);
      setStatus(null);
    } finally {
      clearInterval(progressTimer);
      setScanProgress(null);
      setLoading(false);
    }
  }, [rootPath, setBranchInfo, setLastError]);

  useEffect(() => {
    if (visible) void refresh();
  }, [visible, refresh]);

  // Effective repo path — use the auto-detected repoDir from the last
  // status refresh, falling back to the raw workspace rootPath if not yet
  // known (before first refresh).
  const repoPath = status?.repoDir ?? rootPath;

  const toggleStage = async (filepath: string, currentlyStaged: boolean) => {
    try {
      if (currentlyStaged) {
        await GitBridge.remove(repoPath, filepath);
      } else {
        await GitBridge.add(repoPath, filepath);
      }
      await refresh();
      bumpFileTree();
    } catch (e) {
      Alert.alert('Git', e instanceof Error ? e.message : String(e));
    }
  };

  const doCommit = async () => {
    const msg = commitMsg.trim() || 'chore: commit from NomadCode';
    setBusy(true);
    try {
      await GitBridge.commit(repoPath, msg, {
        name: 'NomadCode User',
        email: 'user@nomadcode.app',
      });
      setCommitMsg('');
      await refresh();
      bumpFileTree();
    } catch (e) {
      Alert.alert('Commit failed', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const doPush = async () => {
    if (!authToken) {
      Alert.alert('Sign in required', 'Open Settings to sign in with GitHub.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Settings', onPress: onOpenSettings },
      ]);
      return;
    }
    setBusy(true);
    try {
      await GitBridge.push(repoPath, authToken);
      await refresh();
    } catch (e) {
      Alert.alert('Push failed', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const doPull = async () => {
    setBusy(true);
    try {
      await GitBridge.pull(
        repoPath,
        authToken ?? undefined,
        { name: 'NomadCode User', email: 'user@nomadcode.app' },
      );
      await refresh();
      bumpFileTree();
    } catch (e) {
      Alert.alert('Pull failed', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const doCheckout = async (name: string) => {
    setBusy(true);
    try {
      await GitBridge.checkout(repoPath, name);
      await refresh();
      bumpFileTree();
    } catch (e) {
      Alert.alert('Checkout failed', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const doCreateBranch = async () => {
    const name = newBranch.trim();
    if (!name) return;
    setBusy(true);
    try {
      await GitBridge.createBranch(repoPath, name, true);
      setNewBranch('');
      await refresh();
      bumpFileTree();
    } catch (e) {
      Alert.alert('Branch failed', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const uniquePaths = status
    ? [...new Set([...status.staged, ...status.modified, ...status.untracked])]
    : [];

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.sheet, { backgroundColor: t.bgElevated, borderColor: t.border }]}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: t.text }]}>Git</Text>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeBtn}
              accessibilityLabel="Close git panel"
              accessibilityRole="button"
            >
              <Text style={{ color: t.textMuted, fontSize: 18 }}>✕</Text>
            </TouchableOpacity>
          </View>
          {loading ? (
            <View style={{ alignItems: 'center', paddingVertical: 24, gap: 12 }}>
              <ActivityIndicator color={t.accent} size="large" />
              {scanProgress && (
                <>
                  <Text style={{ color: t.text, fontSize: 13, fontFamily: 'Menlo' }}>
                    {scanProgress.elapsed}s · {scanProgress.reads} reads · {(scanProgress.bytes / 1024).toFixed(0)} KB
                  </Text>
                  <Text style={{ color: t.textMuted, fontSize: 12, textAlign: 'center', paddingHorizontal: 16 }}>
                    First scan can take a minute on large repos.{'\n'}
                    Subsequent opens use a cache and are near-instant.
                  </Text>
                </>
              )}
            </View>
          ) : status?.noRepo ? (
            <ScrollView>
              <Text style={[styles.section, { color: t.textMuted, marginTop: 8 }]}>
                No git repository
              </Text>
              <Text style={{ color: t.textMuted, fontSize: 13, marginBottom: 16 }}>
                The workspace at this path isn&apos;t a git repo. Clone a repository into your workspace
                or change your workspace to point to an existing repo folder.
              </Text>
            </ScrollView>
          ) : (
            <ScrollView>
              <Text style={[styles.section, { color: t.textMuted }]}>
                Branch: {status?.branch ?? '—'}{status?.repoDir && rootPath !== status.repoDir
                  ? ` · ${status.repoDir.split('/').filter(Boolean).pop() ?? ''}/`
                  : ''}
              </Text>
              {!authToken && (
                <TouchableOpacity onPress={onOpenSettings} style={styles.signIn}>
                  <Text style={{ color: t.accent, fontSize: 13 }}>Sign in for Push / private repos</Text>
                </TouchableOpacity>
              )}
              <View style={styles.row}>
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: t.accent, opacity: busy ? 0.6 : 1 }]}
                  onPress={doPull}
                  disabled={busy}
                  accessibilityLabel="Pull from remote"
                >
                  <Text style={styles.actionBtnText}>Pull</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: t.success, opacity: busy ? 0.6 : 1 }]}
                  onPress={doPush}
                  disabled={busy}
                  accessibilityLabel="Push to remote"
                >
                  <Text style={styles.actionBtnText}>Push</Text>
                </TouchableOpacity>
              </View>
              <Text style={[styles.section, { color: t.text }]}>Files</Text>
              {uniquePaths.length === 0 ? (
                <Text style={{ color: t.textMuted, marginBottom: 12 }}>Working tree clean</Text>
              ) : (
                uniquePaths.map((f) => {
                  const isStaged = status?.staged.includes(f) ?? false;
                  const isUntracked = status?.untracked.includes(f) ?? false;
                  const label = isUntracked ? 'untracked' : isStaged ? 'staged' : 'modified';
                  const showDiff = !isUntracked || isStaged;
                  return (
                    <View key={f} style={styles.fileRow}>
                      <TouchableOpacity
                        style={styles.checkbox}
                        onPress={() => void toggleStage(f, isStaged)}
                        accessibilityLabel={`Toggle stage ${f}`}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: isStaged }}
                      >
                        <Text style={{ color: t.text }}>{isStaged ? '☑' : '☐'}</Text>
                      </TouchableOpacity>
                      <Text style={[styles.filePath, { color: t.text }]} numberOfLines={2}>
                        [{label}] {f}
                      </Text>
                      {showDiff && (
                        <TouchableOpacity onPress={() => onOpenDiff(f)} accessibilityLabel={`Diff ${f}`}>
                          <Text style={{ color: t.accent, fontSize: 12 }}>Diff</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  );
                })
              )}
              <Text style={[styles.section, { color: t.text }]}>Commit</Text>
              <TextInput
                style={[styles.input, { color: t.text, borderColor: t.border }]}
                placeholder="Commit message"
                placeholderTextColor={t.textMuted}
                value={commitMsg}
                onChangeText={setCommitMsg}
                onSubmitEditing={() => { if (!busy) doCommit(); }}
                blurOnSubmit={false}
                returnKeyType="send"
                accessibilityLabel="Commit message"
              />
              <TouchableOpacity
                style={[styles.fullBtn, { backgroundColor: t.border }]}
                onPress={doCommit}
                disabled={busy}
                accessibilityLabel="Create commit"
              >
                <Text style={{ color: t.text, fontWeight: '600' }}>Commit</Text>
              </TouchableOpacity>
              <Text style={[styles.section, { color: t.text }]}>Branches</Text>
              <View style={styles.branchCreate}>
                <TextInput
                  style={[styles.input, { flex: 1, color: t.text, borderColor: t.border }]}
                  placeholder="new-branch-name"
                  placeholderTextColor={t.textMuted}
                  value={newBranch}
                  onChangeText={setNewBranch}
                  onSubmitEditing={() => { if (!busy) doCreateBranch(); }}
                  blurOnSubmit={false}
                  returnKeyType="go"
                  autoCapitalize="none"
                  accessibilityLabel="New branch name"
                />
                <TouchableOpacity
                  style={[styles.smallBtn, { backgroundColor: t.accent }]}
                  onPress={doCreateBranch}
                  disabled={busy}
                  accessibilityLabel="Create and checkout branch"
                >
                  <Text style={{ color: '#fff' }}>Create</Text>
                </TouchableOpacity>
              </View>
              {branches.map((b) => (
                <TouchableOpacity
                  key={b}
                  style={styles.branchRow}
                  onPress={() => void doCheckout(b)}
                  accessibilityLabel={`Checkout branch ${b}`}
                >
                  <Text style={{ color: t.text }}>{b === status?.branch ? `* ${b}` : `  ${b}`}</Text>
                </TouchableOpacity>
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
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderWidth: 1,
    maxHeight: '88%',
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
  },
  closeBtn: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  section: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 12,
    marginBottom: 6,
  },
  signIn: {
    marginBottom: 8,
    minHeight: 44,
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  actionBtnText: {
    color: '#fff',
    fontWeight: '600',
  },
  fileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  checkbox: {
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filePath: {
    flex: 1,
    fontSize: 12,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
    minHeight: 44,
  },
  fullBtn: {
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 8,
    minHeight: 44,
    justifyContent: 'center',
  },
  branchCreate: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    marginBottom: 8,
  },
  smallBtn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    minHeight: 44,
    justifyContent: 'center',
  },
  branchRow: {
    paddingVertical: 10,
    minHeight: 44,
    justifyContent: 'center',
  },
});
