/**
 * US-0025: Clone a GitHub repository into the workspace.
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
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
import { GitBridge, FileSystemBridge } from '../utils/FileSystemBridge';
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
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  // Ref for phase dedupe — setState is async and can't be read reliably
  // inside the onProgress callback that fires many times per tick.
  const lastPhaseRef = useRef<string>('');
  // Most recent onMessage line from the git server, shown as the live
  // status so the user sees activity during pack download + parse (which
  // emit no isomorphic-git progress events).
  const [lastActivity, setLastActivity] = useState<string>('');
  const [elapsedSec, setElapsedSec] = useState(0);
  const startedAtRef = useRef<number | null>(null);

  // Tick a seconds counter while a clone is busy.
  useEffect(() => {
    if (!busy) { setElapsedSec(0); startedAtRef.current = null; return; }
    startedAtRef.current = Date.now();
    const id = setInterval(() => {
      if (startedAtRef.current) {
        setElapsedSec(Math.floor((Date.now() - startedAtRef.current) / 1000));
      }
    }, 1000);
    return () => clearInterval(id);
  }, [busy]);

  // Number of leading lines pinned at the top of the log (the "→ clone …"
  // and "→ destination …" setup lines). Subsequent server messages roll
  // through a 200-line buffer below them so the pinned context is never
  // truncated when the stream of "Counting objects: N%" lines fills up.
  const PINNED_LINES = 2;
  const appendLog = useCallback((line: string) => {
    setLogLines((prev) => {
      if (prev.length < PINNED_LINES) return [...prev, line.trimEnd()];
      const pinned = prev.slice(0, PINNED_LINES);
      const tail = prev.slice(PINNED_LINES, PINNED_LINES + 199);
      return [...pinned, ...tail, line.trimEnd()];
    });
  }, []);

  const onClone = useCallback(async () => {
    const raw = url.trim();
    if (!raw) {
      setErrorText('Enter a repository URL.');
      setLastError('Enter a repository URL.');
      return;
    }
    // Normalise the URL — accept scheme-less and shorthand forms:
    //   github.com/owner/repo[.git]   → https://github.com/owner/repo.git
    //   owner/repo                    → https://github.com/owner/repo.git
    //   git@github.com:owner/repo.git → kept as-is (SSH won't work anyway,
    //                                  but we surface a clearer error later)
    let u: string;
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(raw) || raw.startsWith('git@')) {
      u = raw;
    } else if (/^[\w.-]+\/[\w.-]+$/.test(raw)) {
      u = `https://github.com/${raw}.git`;
    } else {
      u = `https://${raw}`;
    }
    if (/^https?:\/\//i.test(u) && !/\.git$/i.test(u)) {
      u = `${u}.git`;
    }
    const name = subfolder.trim() || repoNameFromCloneUrl(u);
    const safeName = name.replace(/[^a-zA-Z0-9._-]/g, '_') || 'repo';
    const dest = `${rootPath.endsWith('/') ? rootPath.slice(0, -1) : rootPath}/${safeName}`;
    setBusy(true);
    setErrorText(null);
    setSuccessMessage(null);
    setLastError(null);
    setProgress(0);
    setCloneProgress(0);
    setPhase('connecting');
    setLastActivity('');
    lastPhaseRef.current = '';
    setLogLines([`→ clone ${u}`, `→ destination ${dest}`]);
    // Pre-flight: destination must not already exist. isomorphic-git hangs
    // silently on an initialised/non-empty target folder.
    try {
      const exists = await FileSystemBridge.exists(dest);
      if (exists) {
        const msg = `Destination already exists: ${safeName}/ — pick a different folder name or delete the existing one first.`;
        appendLog(`✗ ${msg}`);
        setShowDetails(true);
        setErrorText(msg);
        setLastError(msg);
        setBusy(false);
        setCloneProgress(null);
        setProgress(0);
        setPhase('');
        return;
      }
    } catch {
      // If the check itself fails, fall through and let clone surface the error.
    }
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
          // Dedupe phase transitions via ref (state is stale across fast
          // back-to-back onProgress calls).
          if (p.phase && p.phase !== lastPhaseRef.current) {
            lastPhaseRef.current = p.phase;
            setPhase(p.phase);
            appendLog(`→ ${p.phase}`);
          }
        },
        onMessage: (message: string) => {
          appendLog(message);
          const trimmed = message.trim();
          if (trimmed) setLastActivity(trimmed);
        },
      });
      appendLog('✓ clone complete');
      bumpFileTree();
      setSuccessMessage(`Clone completed successfully into ${safeName}/`);
      // Do not auto-close — user taps Done to dismiss and review log.
    } catch (e) {
      console.error('[GitClone] clone failed:', e);
      // Clean up any partial destination directory left behind by the
      // failed clone (isomorphic-git may have written .git/HEAD, .git/refs,
      // etc. before the network error). This lets the user retry without
      // hitting our "destination already exists" pre-flight guard.
      try {
        await FileSystemBridge.deleteEntry(dest);
        appendLog(`→ cleaned up partial destination ${safeName}/`);
      } catch {
        // Ignore: nothing to clean or already removed.
      }
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
  }, [url, subfolder, rootPath, authToken, bumpFileTree, onClose, setCloneProgress, setLastError, appendLog]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.sheet, { backgroundColor: t.bgElevated, borderColor: t.border }]}>
          <Text style={[styles.title, { color: t.text }]}>Clone repository</Text>
          <Text style={[styles.hint, { color: t.textMuted }]}>
            URL, github.com/owner/repo, or owner/repo. Destination: workspace folder + name below.
          </Text>
          <TextInput
            style={[styles.input, { color: t.text, borderColor: t.border }]}
            placeholder="https://github.com/owner/repo.git"
            placeholderTextColor={t.textMuted}
            value={url}
            onChangeText={setUrl}
            onSubmitEditing={() => { if (!busy) onClone(); }}
            blurOnSubmit={false}
            returnKeyType="go"
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
            onSubmitEditing={() => { if (!busy) onClone(); }}
            blurOnSubmit={false}
            returnKeyType="go"
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
          {successMessage && (
            <Text testID="clone-success" style={styles.successText}>✓ {successMessage}</Text>
          )}
          {busy && (() => {
            const elapsedStr = elapsedSec >= 60
              ? `${Math.floor(elapsedSec / 60)}m ${elapsedSec % 60}s`
              : `${elapsedSec}s`;
            // Prefer the last git server message (more granular) over the
            // coarse isomorphic-git phase label. Fall back to phase, then
            // to a generic "working…" once the connection is established.
            const statusLabel = lastActivity || phase || 'working…';
            return (
              <View style={styles.progressRow}>
                <ActivityIndicator color={t.accent} />
                <Text
                  style={[styles.progressText, { color: t.textMuted }]}
                  numberOfLines={1}
                >
                  {elapsedStr} · {statusLabel}
                </Text>
              </View>
            );
          })()}
          {(busy || logLines.length > 0) && (
            <View>
              <TouchableOpacity
                testID="clone-toggle-details"
                onPress={() => setShowDetails((v) => !v)}
                style={styles.detailsToggle}
                hitSlop={{ top: 8, bottom: 8, left: 16, right: 16 }}
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
            </View>
          )}
          <View style={styles.actions}>
            {successMessage ? (
              <TouchableOpacity
                testID="clone-done-btn"
                style={[styles.btn, styles.btnPrimary, { backgroundColor: t.accent }]}
                onPress={() => {
                  setUrl('');
                  setSubfolder('');
                  setSuccessMessage(null);
                  setLogLines([]);
                  onClose();
                }}
                accessibilityLabel="Done"
                accessibilityRole="button"
              >
                <Text style={[styles.btnText, { color: '#FFFFFF' }]}>Done</Text>
              </TouchableOpacity>
            ) : (
              <>
                <TouchableOpacity
                  style={[styles.btn, { backgroundColor: t.border }]}
                  onPress={onClose}
                  accessibilityLabel="Cancel clone"
                  accessibilityRole="button"
                >
                  <Text style={[styles.btnText, { color: t.text }]}>
                    {errorText ? 'Close' : 'Cancel'}
                  </Text>
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
              </>
            )}
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
  successText: {
    color: '#22C55E',
    fontSize: 13,
    fontWeight: '500',
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
