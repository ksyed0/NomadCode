/**
 * US-0025: Clone a GitHub repository into the workspace.
 */

import React, { useState, useCallback } from 'react';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { GitBridge } from '../utils/FileSystemBridge';
import useGitStore from '../stores/useGitStore';
import { useTheme } from '../theme/tokens';

export interface GitCloneModalProps {
  visible: boolean;
  onClose: () => void;
  rootPath: string;
  authToken: string | null;
  onOpenSettings: () => void;
}

function repoNameFromCloneUrl(url: string): string {
  const cleaned = url.trim().replace(/\.git$/i, '');
  const parts = cleaned.split(/[/:]/).filter(Boolean);
  return parts.length > 0 ? (parts[parts.length - 1] ?? 'repo') : 'repo';
}

export default function GitCloneModal({
  visible,
  onClose,
  rootPath,
  authToken,
  onOpenSettings,
}: GitCloneModalProps): React.ReactElement {
  const t = useTheme();
  const setCloneProgress = useGitStore((s) => s.setCloneProgress);
  const setLastError = useGitStore((s) => s.setLastError);
  const bumpFileTree = useGitStore((s) => s.bumpFileTree);
  const [url, setUrl] = useState('');
  const [subfolder, setSubfolder] = useState('');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState<string>('');
  const [errorText, setErrorText] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [logLines, setLogLines] = useState<string[]>([]);

  const appendLog = useCallback((line: string) => {
    setLogLines((prev) => [...prev.slice(-199), line.trimEnd()]);
  }, []);

  const onClone = useCallback(async () => {
    const u = url.trim();
    if (!u) {
      setErrorText('Enter a repository URL.');
      setLastError('Enter a repository URL.');
      return;
    }
    const name = subfolder.trim() || repoNameFromCloneUrl(u);
    const safeName = name.replace(/[^a-zA-Z0-9._-]/g, '_') || 'repo';
    const dest = `${rootPath.endsWith('/') ? rootPath.slice(0, -1) : rootPath}/${safeName}`;
    setBusy(true);
    setErrorText(null);
    setLastError(null);
    setProgress(0);
    setCloneProgress(0);
    setPhase('connecting');
    setLogLines([`→ clone ${u}`, `→ destination ${dest}`]);
    try {
      let isGitHubHost = false;
      try {
        const parsed = new URL(u);
        const host = parsed.hostname.toLowerCase();
        isGitHubHost = host === 'github.com' || host.endsWith('.github.com');
      } catch {
        isGitHubHost = false;
      }

      if (!authToken && isGitHubHost) {
        // Public may still work; private will fail with mapped error
      }
      await GitBridge.clone(u, dest, authToken ?? undefined, {
        onProgress: (p) => {
          const t0 = p.total > 0 ? p.loaded / p.total : 0;
          setProgress(t0);
          setCloneProgress(t0);
          if (p.phase && p.phase !== phase) {
            setPhase(p.phase);
            appendLog(`→ ${p.phase}`);
          }
        },
        onMessage: (message: string) => {
          appendLog(message);
        },
      });
      appendLog('✓ clone complete');
      bumpFileTree();
      setUrl('');
      setSubfolder('');
      onClose();
    } catch (e) {
      console.error('[GitClone] clone failed:', e);
      let msg = e instanceof Error ? e.message : String(e);
      appendLog(`✗ ${msg}`);
      setShowDetails(true); // auto-open details on failure
      if (
        msg.includes('Authentication failed') ||
        msg.includes('401') ||
        msg.includes('Sign in')
      ) {
        msg = 'Sign in with GitHub in Settings to access private repositories.';
      }
      setErrorText(msg);
      setLastError(msg);
    } finally {
      setBusy(false);
      setCloneProgress(null);
      setProgress(0);
      setPhase('');
    }
  }, [url, subfolder, rootPath, authToken, phase, bumpFileTree, onClose, setCloneProgress, setLastError, appendLog]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.sheet, { backgroundColor: t.bgElevated, borderColor: t.border }]}>
          <Text style={[styles.title, { color: t.text }]}>Clone repository</Text>
          <Text style={[styles.hint, { color: t.textMuted }]}>
            HTTPS GitHub URL. Destination: workspace folder + name below.
          </Text>
          <TextInput
            style={[styles.input, { color: t.text, borderColor: t.border }]}
            placeholder="https://github.com/owner/repo.git"
            placeholderTextColor={t.textMuted}
            value={url}
            onChangeText={setUrl}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            accessibilityLabel="Git clone repository URL"
          />
          <TextInput
            style={[styles.input, { color: t.text, borderColor: t.border }]}
            placeholder="Folder name (optional)"
            placeholderTextColor={t.textMuted}
            value={subfolder}
            onChangeText={setSubfolder}
            autoCapitalize="none"
            accessibilityLabel="Clone destination folder name"
          />
          {!authToken && (
            <TouchableOpacity
              onPress={onOpenSettings}
              style={styles.settingsLink}
              accessibilityLabel="Open settings to sign in with GitHub"
              accessibilityRole="button"
            >
              <Text style={[styles.settingsLinkText, { color: t.accent }]}>
                Sign in with GitHub (Settings) for private repos
              </Text>
            </TouchableOpacity>
          )}
          {errorText && (
            <Text style={styles.errorText}>{errorText}</Text>
          )}
          {busy && (
            <View style={styles.progressRow}>
              <ActivityIndicator color={t.accent} />
              <Text style={[styles.progressText, { color: t.textMuted }]}>
                {Math.round(progress * 100)}%{phase ? ` · ${phase}` : ''}
              </Text>
            </View>
          )}
          {(busy || logLines.length > 0) && (
            <>
              <TouchableOpacity
                testID="clone-toggle-details"
                onPress={() => setShowDetails((v) => !v)}
                style={styles.detailsToggle}
                accessibilityRole="button"
                accessibilityLabel={showDetails ? 'Hide details' : 'Show details'}
              >
                <Text style={[styles.detailsToggleText, { color: t.textMuted }]}>
                  {showDetails ? '▼ Hide details' : '▶ Show details'}
                </Text>
              </TouchableOpacity>
              {showDetails && (
                <ScrollView
                  testID="clone-log"
                  style={[styles.logBox, { borderColor: t.border, backgroundColor: t.bg }]}
                  contentContainerStyle={styles.logContent}
                >
                  {logLines.map((line, i) => (
                    <Text
                      key={i}
                      style={[
                        styles.logLine,
                        { color: line.startsWith('✗') ? '#EF4444' : line.startsWith('✓') ? '#22C55E' : t.text },
                      ]}
                    >
                      {line}
                    </Text>
                  ))}
                </ScrollView>
              )}
            </>
          )}
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.btn, { backgroundColor: t.border }]}
              onPress={onClose}
              accessibilityLabel="Cancel clone"
              accessibilityRole="button"
            >
              <Text style={[styles.btnText, { color: t.text }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btn, styles.btnPrimary, { backgroundColor: t.accent, opacity: busy ? 0.6 : 1 }]}
              onPress={onClone}
              disabled={busy}
              accessibilityLabel="Clone repository"
              accessibilityRole="button"
            >
              <Text style={[styles.btnText, { color: '#FFFFFF' }]}>Clone</Text>
            </TouchableOpacity>
          </View>
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
    padding: 24,
  },
  sheet: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 20,
    maxHeight: '90%',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  hint: {
    fontSize: 12,
    marginBottom: 12,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    marginBottom: 12,
    minHeight: 44,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 13,
    marginBottom: 12,
  },
  settingsLink: {
    marginBottom: 12,
    minHeight: 44,
    justifyContent: 'center',
  },
  settingsLinkText: {
    fontSize: 14,
    textDecorationLine: 'underline',
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  progressText: {
    fontSize: 13,
  },
  detailsToggle: {
    minHeight: 32,
    justifyContent: 'center',
    marginBottom: 6,
  },
  detailsToggleText: {
    fontSize: 12,
  },
  logBox: {
    borderWidth: 1,
    borderRadius: 6,
    maxHeight: 180,
    marginBottom: 12,
  },
  logContent: {
    padding: 8,
  },
  logLine: {
    fontFamily: 'Menlo',
    fontSize: 11,
    lineHeight: 15,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 8,
  },
  btn: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    minWidth: 88,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimary: {},
  btnText: {
    fontSize: 15,
    fontWeight: '600',
  },
});
