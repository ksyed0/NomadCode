/**
 * NomadCode — Mobile IDE
 *
 * Root component. Owns all IDE state and wires together:
 *   FileExplorer ↔ Editor (open tabs) ↔ Terminal ↔ CommandPalette
 *
 * State is kept here (no Zustand store needed for this prototype).
 * For a production app, extract to a zustand store at src/store/ideStore.ts.
 *
 * Future AI integration points are marked with: // AI_HOOK
 * Future cloud/sync integration points are marked with: // CLOUD_HOOK
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  AppState,
  Image,
  Modal,
  Platform,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import Editor, { EditorTab, getLanguageForFile, detectLanguageFromContent } from './src/components/Editor';
import FileExplorer from './src/components/FileExplorer';
import { TerminalWebView } from './src/components/TerminalWebView';
import { Command, CommandPalette } from './src/components/CommandPalette';
import SetupWizard from './src/components/SetupWizard';
import SettingsScreen from './src/components/SettingsScreen';
import WorkspaceConflictModal from './src/components/WorkspaceConflictModal';
import ExtensionHost from './src/components/ExtensionHost';
import TabletResponsive from './src/layout/TabletResponsive';
import { FileSystemBridge, GitBridge } from './src/utils/FileSystemBridge';
import { simpleHash } from './src/utils/hash';
import useSettingsStore from './src/stores/useSettingsStore';
import useAuthStore from './src/stores/useAuthStore';
import { useTheme } from './src/theme/tokens';
import type { OpenTabMeta, ConflictInfo, ConflictResolution } from './src/types/workspace';
import splashImage from './assets/splash.png';

const APP_VERSION = '0.1.0';


// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------

export default function App() {
  // ── Theme tokens ──────────────────────────────────────────────────────────
  const t = useTheme();

  // ── Settings store ────────────────────────────────────────────────────────
  const hasCompletedSetup = useSettingsStore((s) => s.hasCompletedSetup);
  const installedExtensions = useSettingsStore((s) => s.installedExtensions);
  const workspaceUri = useSettingsStore((s) => s.workspaceUri);
  // Fall back to the app's sandboxed document directory when no workspace has been picked yet
  const rootPath = workspaceUri || FileSystemBridge.documentDirectory;

  // ── Auth store ────────────────────────────────────────────────────────────
  const hydrateAuth = useAuthStore((s) => s.hydrate);

  // Restore auth session from keychain on mount
  useEffect(() => {
    hydrateAuth();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Editor state ──────────────────────────────────────────────────────────
  const [tabs, setTabs] = useState<EditorTab[]>([]);
  const [activeTabPath, setActiveTabPath] = useState<string | null>(null);

  // ── Panel visibility ──────────────────────────────────────────────────────
  const [showTerminal, setShowTerminal] = useState(false);
  const [showPalette, setShowPalette] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [terminalHeight, setTerminalHeight] = useState(220);
  const [triggerNewFile, setTriggerNewFile] = useState(false);
  const [showAbout, setShowAbout] = useState(false);

  // ── Git status (updated after Git operations) ─────────────────────────────
  const [gitBranch, setGitBranch] = useState('main');

  // ── Cloud-sync conflict detection ─────────────────────────────────────────
  // tabMetaRef holds a snapshot of each open tab's content hash at load/save
  // time, so we can detect background cloud sync changes on app foreground.
  const tabMetaRef = useRef<Map<string, OpenTabMeta>>(new Map());
  const [conflict, setConflict] = useState<ConflictInfo | null>(null);
  // tabsRef is kept in sync on every render so the AppState callback (registered
  // once) always sees current tab state without a stale closure.
  const tabsRef = useRef(tabs);
  useEffect(() => { tabsRef.current = tabs; }, [tabs]);

  // ---------------------------------------------------------------------------
  // File operations
  // ---------------------------------------------------------------------------

  const openFile = useCallback(async (path: string) => {
    // If already open, just switch to it
    const existing = tabs.find((t) => t.path === path);
    if (existing) {
      setActiveTabPath(path);
      return;
    }

    try {
      const content = await FileSystemBridge.readFile(path);
      const name = path.split('/').pop() ?? path;
      const detectedLang = getLanguageForFile(name);
      const language = detectedLang === 'plaintext'
        ? detectLanguageFromContent(content)
        : detectedLang;
      const tab: EditorTab = {
        path,
        name,
        content,
        language,
        isDirty: false,
      };
      tabMetaRef.current.set(path, {
        path,
        loadedAt: Date.now(),
        contentHash: simpleHash(content),
      });
      setTabs((prev) => [...prev, tab]);
      setActiveTabPath(path);

      // AI_HOOK: After opening, request AI analysis:
      //   const diagnostics = await AiService.analyzeFile(path, content);
      //   setDiagnostics(path, diagnostics);
    } catch (err) {
      Alert.alert('Cannot open file', String(err));
    }
  }, [tabs]);

  const closeTab = useCallback((path: string) => {
    tabMetaRef.current.delete(path);
    setTabs((prev) => {
      const idx = prev.findIndex((t) => t.path === path);
      const next = prev.filter((t) => t.path !== path);
      setActiveTabPath((current) => {
        if (current !== path) return current;
        return next[Math.min(idx, next.length - 1)]?.path ?? null;
      });
      return next;
    });
  }, []);

  const updateContent = useCallback((path: string, content: string) => {
    setTabs((prev) =>
      prev.map((t) => (t.path === path ? { ...t, content, isDirty: true } : t)),
    );
  }, []);

  const saveFile = useCallback(async (path: string, content: string) => {
    try {
      await FileSystemBridge.writeFile(path, content);
      setTabs((prev) =>
        prev.map((t) => (t.path === path ? { ...t, isDirty: false } : t)),
      );
      // Refresh meta so the next foreground check won't flag this save as a conflict
      tabMetaRef.current.set(path, { path, loadedAt: Date.now(), contentHash: simpleHash(content) });
    } catch (err) {
      Alert.alert('Save failed', String(err));
    }
  }, []);

  const saveActiveFile = useCallback(() => {
    const tab = tabs.find((t) => t.path === activeTabPath);
    if (tab) saveFile(tab.path, tab.content);
  }, [tabs, activeTabPath, saveFile]);

  const getEditorContent = useCallback((): string => {
    return tabs.find((t) => t.path === activeTabPath)?.content ?? '';
  }, [tabs, activeTabPath]);

  const replaceEditorContent = useCallback((text: string) => {
    if (!activeTabPath) return;
    updateContent(activeTabPath, text);
  }, [activeTabPath, updateContent]);

  // ── AppState conflict detection ────────────────────────────────────────────
  // When the app returns to the foreground, compare each open tab's stored
  // content hash against the current on-disk file. If they differ the OS cloud
  // provider has synced a new version while we were backgrounded.
  // Registered once (empty dep array) — reads tabsRef.current instead of the
  // captured closure so it always sees the latest tab state even if the async
  // file reads resolve after subsequent tab mutations.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', async (nextState) => {
      if (nextState !== 'active') return;
      for (const [path, meta] of tabMetaRef.current) {
        try {
          const diskContent = await FileSystemBridge.readFile(path);
          if (simpleHash(diskContent) === meta.contentHash) continue;
          const openTab = tabsRef.current.find((tab) => tab.path === path);
          if (!openTab) continue;
          const fileName = path.split('%2F').pop()?.split('/').pop() ?? path;
          setConflict({
            tabPath: path,
            fileName: decodeURIComponent(fileName),
            localContent: openTab.content,
            cloudContent: diskContent,
          });
          return; // surface one conflict at a time
        } catch {
          // File may have been deleted by the cloud provider — skip silently
        }
      }
    });
    return () => subscription.remove();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleConflictResolve = useCallback(async (resolution: ConflictResolution) => {
    if (!conflict) return;
    const { tabPath, localContent, cloudContent } = conflict;

    if (resolution === 'keep-mine') {
      // Write editor content back to disk; without this the on-disk file still
      // holds cloudContent so the next foreground check re-fires the same conflict.
      await FileSystemBridge.writeFile(tabPath, localContent);
      tabMetaRef.current.set(tabPath, { path: tabPath, loadedAt: Date.now(), contentHash: simpleHash(localContent) });
    } else if (resolution === 'use-cloud') {
      setTabs((prev) => prev.map((tab) => tab.path === tabPath ? { ...tab, content: cloudContent, isDirty: false } : tab));
      tabMetaRef.current.set(tabPath, { path: tabPath, loadedAt: Date.now(), contentHash: simpleHash(cloudContent) });
    } else {
      // keep-both: save editor version to a .conflict file, then load cloud version
      const dotIdx = tabPath.lastIndexOf('.');
      const conflictPath = dotIdx >= 0
        ? `${tabPath.slice(0, dotIdx)}.conflict${tabPath.slice(dotIdx)}`
        : `${tabPath}.conflict`;
      await FileSystemBridge.writeFile(conflictPath, localContent);
      // Open the .conflict file in a new tab so the user can immediately compare
      setTabs((prev) => prev.map((tab) => tab.path === tabPath ? { ...tab, content: cloudContent, isDirty: false } : tab));
      tabMetaRef.current.set(tabPath, { path: tabPath, loadedAt: Date.now(), contentHash: simpleHash(cloudContent) });
      openFile(conflictPath);
    }

    setConflict(null);
  }, [conflict]);

  const deleteFile = useCallback(async (path: string) => {
    Alert.alert('Delete file', `Delete "${path.split('/').pop()}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await FileSystemBridge.deleteEntry(path);
            closeTab(path);
          } catch (err) {
            Alert.alert('Delete failed', String(err));
          }
        },
      },
    ]);
  }, [closeTab]);

  // ---------------------------------------------------------------------------
  // Git operations (stub — integrate isomorphic-git to make these real)
  // ---------------------------------------------------------------------------

  const gitStatus = useCallback(async () => {
    try {
      const status = await GitBridge.status(rootPath);
      setGitBranch(status.branch);
      Alert.alert(
        `Git — ${status.branch}`,
        `Modified: ${status.modified.length}\nStaged: ${status.staged.length}\nUntracked: ${status.untracked.length}`,
      );
    } catch (err) {
      Alert.alert('Git status', String(err));
    }
  }, []);

  const gitCommit = useCallback(async () => {
    const tab = tabs.find((t) => t.path === activeTabPath);
    if (tab?.isDirty) {
      Alert.alert('Unsaved changes', 'Save the current file before committing?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Save & Commit', onPress: saveActiveFile },
      ]);
      return;
    }
    Alert.alert('Git Commit', 'Commit all staged changes?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Commit',
        onPress: async () => {
          try {
            await GitBridge.commit(rootPath, 'feat: update from NomadCode', {
              name: 'NomadCode User',
              email: 'user@nomadcode.app',
            });
          } catch (err) {
            Alert.alert('Commit failed', String(err));
          }
        },
      },
    ]);
  }, [tabs, activeTabPath, saveActiveFile]);

  // ---------------------------------------------------------------------------
  // Terminal callbacks
  // ---------------------------------------------------------------------------

  const handleCommandComplete = useCallback((exitCode: number): void => {
    if (__DEV__) console.log('[Terminal] exited', exitCode);
  }, []);

  // ---------------------------------------------------------------------------
  // Command palette commands
  // ---------------------------------------------------------------------------

  const paletteCommands = useMemo<Command[]>(() => [
    {
      id: 'file-new',
      label: 'File: New File',
      description: 'Create a new file in the workspace',
      shortcut: '⌘N',
      action: () => { setShowPalette(false); setTriggerNewFile(true); },
    },
    {
      id: 'file-save',
      label: 'File: Save',
      description: 'Save the active file to disk',
      shortcut: '⌘S',
      action: saveActiveFile,
    },
    {
      id: 'file-close',
      label: 'File: Close Tab',
      description: 'Close the active editor tab',
      action: () => { if (activeTabPath) closeTab(activeTabPath); },
    },
    {
      id: 'view-terminal',
      label: 'View: Toggle Terminal',
      description: 'Show or hide the integrated terminal',
      shortcut: '⌘`',
      action: () => setShowTerminal((v) => !v),
    },
    {
      id: 'git-status',
      label: 'Git: Show Status',
      description: 'Display working-tree status',
      action: gitStatus,
    },
    {
      id: 'git-commit',
      label: 'Git: Commit',
      description: 'Stage all changes and create a commit',
      action: gitCommit,
    },
    // AI_HOOK: Add AI commands here, e.g.:
    //   { id: 'ai-explain', label: 'AI: Explain Selection', action: () => AiService.explain(selection) }
    //   { id: 'ai-fix',     label: 'AI: Fix Error',        action: () => AiService.fix(activeTab) }
  ], [saveActiveFile, closeTab, gitStatus, gitCommit, activeTabPath, setTriggerNewFile]);

  const handlePaletteSelect = useCallback((cmd: Command) => {
    setShowPalette(false);
    cmd.action();
  }, []);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: t.bg }]}>
      <StatusBar barStyle="light-content" backgroundColor={t.bg} />

      {/* ── Status bar (top) ─────────────────────────────────────────────── */}
      <View style={styles.statusBar}>
        <TouchableOpacity onPress={gitStatus} style={styles.statusItem}>
          <Text style={styles.statusText}>⎇ {gitBranch}</Text>
        </TouchableOpacity>
        <Text style={styles.statusTitle}>NomadCode <Text style={styles.statusVersion}>v{APP_VERSION}</Text></Text>
        <View style={styles.statusRight}>
          {tabs.find((t) => t.path === activeTabPath)?.isDirty && (
            <TouchableOpacity onPress={saveActiveFile}>
              <Text style={styles.statusDirty}>● Save</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={() => setShowAbout(true)} style={styles.aboutBtn} accessibilityLabel="About NomadCode">
            <Text style={styles.aboutBtnText}>ⓘ</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── About / Splash overlay ───────────────────────────────────────── */}
      <Modal visible={showAbout} animationType="fade" transparent statusBarTranslucent>
        <View style={styles.aboutOverlay}>
          <Image
            source={splashImage}
            style={styles.aboutSplash}
            resizeMode="contain"
          />
          <TouchableOpacity onPress={() => setShowAbout(false)} style={styles.aboutClose} accessibilityLabel="Close">
            <Text style={styles.aboutCloseText}>✕</Text>
          </TouchableOpacity>
          <View style={styles.aboutFooter}>
            <Text style={styles.aboutVersion}>NomadCode v{APP_VERSION}</Text>
            <Text style={styles.aboutCopy}>Created by Kamal Syed · FableSoft 2026</Text>
          </View>
        </View>
      </Modal>

      {/* ── Three-pane layout ────────────────────────────────────────────── */}
      <TabletResponsive
        sidebar={
          <FileExplorer
            rootPath={rootPath}
            onFileSelect={openFile}
            onFileCreate={openFile}
            onFileDelete={deleteFile}
            triggerNewFile={triggerNewFile}
            onNewFileDismissed={() => setTriggerNewFile(false)}
          />
        }
        main={
          <Editor
            tabs={tabs}
            activeTabPath={activeTabPath}
            onTabChange={setActiveTabPath}
            onTabClose={closeTab}
            onContentChange={updateContent}
            onSave={saveFile}
          />
        }
        terminal={<TerminalWebView workingDirectory={rootPath} onCommand={handleCommandComplete} visible={showTerminal} />}
        terminalHeight={terminalHeight}
        onTerminalHeightChange={setTerminalHeight}
        onOpenPalette={() => setShowPalette(true)}
        onOpenSettings={() => setShowSettings(true)}
      />

      {/* ── Floating action buttons (bottom-right) ───────────────────────── */}
      <View style={styles.fab}>
        {/* Command palette */}
        <TouchableOpacity
          style={[styles.fabBtn, styles.fabPalette]}
          onPress={() => setShowPalette(true)}
          activeOpacity={0.85}
          accessibilityLabel="Open command palette"
        >
          <Text style={styles.fabIcon}>⌘</Text>
        </TouchableOpacity>

        {/* Terminal toggle */}
        <TouchableOpacity
          style={[styles.fabBtn, showTerminal && styles.fabActive]}
          onPress={() => setShowTerminal((v) => !v)}
          activeOpacity={0.85}
          accessibilityLabel="Toggle terminal"
        >
          <Text style={styles.fabIcon}>{'>'}_</Text>
        </TouchableOpacity>
      </View>

      {/* ── Command palette modal ─────────────────────────────────────────── */}
      <CommandPalette
        visible={showPalette}
        commands={paletteCommands}
        onClose={() => setShowPalette(false)}
        onSelect={handlePaletteSelect}
      />

      {/* ── First-run setup wizard ────────────────────────────────────────── */}
      <SetupWizard visible={!hasCompletedSetup} />

      {/* ── Settings screen ───────────────────────────────────────────────── */}
      <SettingsScreen visible={showSettings} onClose={() => setShowSettings(false)} />

      {/* ── Cloud-sync conflict resolution modal ─────────────────────────── */}
      <WorkspaceConflictModal conflict={conflict} onResolve={handleConflictResolve} />

      {/* ── Extension host (hidden, always mounted) ──────────────────────── */}
      <ExtensionHost
        manifests={installedExtensions}
        onGetEditorContent={getEditorContent}
        onReplaceEditorContent={replaceEditorContent}
        onShowMessage={(text) => Alert.alert('Extension', text)}
        onShowError={(text) => Alert.alert('Extension Error', text, [{ text: 'OK', style: 'destructive' }])}
      />
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  statusBar: {
    height: 28,
    backgroundColor: '#1E3A5F',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  statusItem: {
    marginRight: 12,
  },
  statusText: {
    color: '#94A3B8',
    fontSize: 11,
  },
  statusTitle: {
    flex: 1,
    color: '#CBD5E1',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  statusVersion: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: '400',
  },
  statusRight: {
    minWidth: 60,
    alignItems: 'flex-end',
  },
  statusDirty: {
    color: '#FBBF24',
    fontSize: 11,
  },
  aboutBtn: {
    marginLeft: 10,
    paddingHorizontal: 4,
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  aboutBtnText: {
    color: '#94A3B8',
    fontSize: 14,
  },
  aboutOverlay: {
    flex: 1,
    backgroundColor: '#0F172A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  aboutSplash: {
    width: '70%',
    height: '70%',
  },
  aboutClose: {
    position: 'absolute',
    top: 48,
    right: 24,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  aboutCloseText: {
    color: '#E2E8F0',
    fontSize: 16,
    fontWeight: '600',
  },
  aboutFooter: {
    position: 'absolute',
    bottom: 48,
    alignItems: 'center',
    gap: 4,
  },
  aboutVersion: {
    color: '#64748B',
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  aboutCopy: {
    color: '#475569',
    fontSize: 11,
  },
  fab: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 28 : 16,
    right: 16,
    gap: 10,
    alignItems: 'center',
  },
  fabBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
  },
  fabPalette: {
    backgroundColor: '#2563EB',
    borderColor: '#3B82F6',
  },
  fabActive: {
    borderColor: '#22C55E',
  },
  fabIcon: {
    color: '#E2E8F0',
    fontSize: 16,
    fontWeight: '600',
  },
});
