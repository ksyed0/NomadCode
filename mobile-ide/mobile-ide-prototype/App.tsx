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
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import Editor, { EditorHandle, EditorTab, getLanguageForFile, detectLanguageFromContent } from './src/components/Editor';
import { parseDiffToGutter } from './src/utils/gitGutter';
import type { GutterDiff, BlameLine } from './src/types/git';
import FileExplorer from './src/components/FileExplorer';
import { TerminalWebView } from './src/components/TerminalWebView';
import { Command, CommandPalette } from './src/components/CommandPalette';
import SetupWizard from './src/components/SetupWizard';
import SettingsScreen from './src/components/SettingsScreen';
import WorkspaceConflictModal from './src/components/WorkspaceConflictModal';
import ExtensionHost from './src/components/ExtensionHost';
import GitCloneModal from './src/components/GitCloneModal';
import GitDiffModal from './src/components/GitDiffModal';
import GitPanel from './src/components/GitPanel';
import GitScreen from './src/components/GitScreen';
import BlameDetailSheet from './src/components/git/BlameDetailSheet';
import TabletResponsive from './src/layout/TabletResponsive';
import { FileSystemBridge, GitBridge } from './src/utils/FileSystemBridge';
import { simpleHash } from './src/utils/hash';
import useSettingsStore from './src/stores/useSettingsStore';
import useAuthStore from './src/stores/useAuthStore';
import useGitStore from './src/stores/useGitStore';
import { useTheme } from './src/theme/tokens';
import type { OpenTabMeta, ConflictInfo, ConflictResolution } from './src/types/workspace';
import splashImage from './assets/splash.png';
import { useKeyboardShortcuts } from './src/hooks/useKeyboardShortcuts';
import type { ShortcutDefinition } from './src/hooks/useKeyboardShortcuts';
import { KeyboardShortcutsSheet } from './src/components/KeyboardShortcutsSheet';

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
  const setWorkspaceRoot = useSettingsStore((s) => s.setWorkspaceRoot);
  const editorFontSize = useSettingsStore((s) => s.fontSize);
  const formatOnSave = useSettingsStore((s) => s.formatOnSave);

  // Scale chrome text (status bar, etc.) proportionally to the user's
  // editor font size. Default editor size is 14 → scale factor 1.0.
  const chromeScale = editorFontSize / 14;
  const statusBarStyles = useMemo(() => ({
    bar: { height: Math.max(28, 22 * chromeScale + 6) },
    branch: { fontSize: 11 * chromeScale },
    title: { fontSize: 12 * chromeScale },
    version: { fontSize: 10 * chromeScale },
    infoIcon: { fontSize: 16 * chromeScale },
  }), [chromeScale]);
  // Fall back to the app's sandboxed document directory when no workspace has been picked yet
  const rootPath = workspaceUri || FileSystemBridge.documentDirectory;

  // Startup check: if the stored workspace points to a non-writable
  // location (e.g. File Provider Storage from a legacy Browse on iOS),
  // silently reset it to the app's writable Documents/ sandbox. This
  // avoids confusing "not writable" errors on every git / file op.
  useEffect(() => {
    if (!workspaceUri) return;
    (async () => {
      try {
        const sentinelName = `.__nomad_writable_check_${Date.now()}`;
        const testUri = workspaceUri.endsWith('/')
          ? `${workspaceUri}${sentinelName}`
          : `${workspaceUri}/${sentinelName}`;
        await FileSystemBridge.writeFile(testUri, 'ok');
        await FileSystemBridge.deleteEntry(testUri);
        // Workspace is writable — nothing to do.
      } catch {
        const fallback = FileSystemBridge.documentDirectory;
        if (fallback && fallback !== workspaceUri) {
          console.warn('[App] workspace not writable, falling back to', fallback);
          setWorkspaceRoot({ uri: fallback, uriType: 'file', displayName: 'Documents' });
        }
      }
    })();
    // Run once per workspaceUri change.
  }, [workspaceUri, setWorkspaceRoot]);

  // ── Auth store ────────────────────────────────────────────────────────────
  const hydrateAuth = useAuthStore((s) => s.hydrate);
  const authToken = useAuthStore((s) => s.token);

  // ── Git store (branch + file tree revision) ───────────────────────────────
  const gitBranch = useGitStore((s) => s.branch);
  const fileTreeRevision = useGitStore((s) => s.fileTreeRevision);
  const setBranchInfo = useGitStore((s) => s.setBranchInfo);
  const setIsGitScreenOpen = useGitStore((s) => s.setIsGitScreenOpen);
  const setActiveGitTab = useGitStore((s) => s.setActiveGitTab);
  const setGutterDecorations = useGitStore((s) => s.setGutterDecorations);
  const blameData = useGitStore((s) => s.blameData);
  const setBlameData = useGitStore((s) => s.setBlameData);

  // Restore auth session from keychain on mount
  useEffect(() => {
    hydrateAuth();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Refresh branch label when workspace or tree changes (e.g. after clone).
  // Uses the fast branch-only lookup (reads HEAD, no statusMatrix scan)
  // so the 100ms job doesn't block the JS thread for ~30s on a large repo.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const { branch } = await GitBridge.currentBranch(rootPath);
        if (!cancelled) setBranchInfo(branch, 0, 0);
      } catch {
        if (!cancelled) setBranchInfo('main', 0, 0);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [rootPath, fileTreeRevision, setBranchInfo]);

  // ── Editor ref (imperative handle for fold/view-state) ───────────────────
  const editorRef = useRef<EditorHandle | null>(null);

  // ── Prettier config resolution — reads .prettierrc* from root ─────────────
  useEffect(() => {
    if (!rootPath) return;
    const CONFIG_FILES = ['.prettierrc', '.prettierrc.json', 'prettier.config.json'];
    (async () => {
      for (const name of CONFIG_FILES) {
        try {
          const content = await FileSystemBridge.readFile(`${rootPath}/${name}`);
          const config = JSON.parse(content);
          editorRef.current?.sendPrettierConfig(config);
          return;
        } catch { /* not found or invalid JSON */ }
      }
      editorRef.current?.sendPrettierConfig({});
    })();
  }, [rootPath]);

  // ── Editor state ──────────────────────────────────────────────────────────
  const [tabs, setTabs] = useState<EditorTab[]>([]);
  const [activeTabPath, setActiveTabPath] = useState<string | null>(null);

  // ── Sidebar tab ───────────────────────────────────────────────────────────
  const [sidebarTab, setSidebarTab] = useState<'files' | 'search'>('files');

  // ── Panel visibility ──────────────────────────────────────────────────────
  const [showTerminal, setShowTerminal] = useState(false);
  const [showPalette, setShowPalette] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [terminalHeight, setTerminalHeight] = useState(220);
  const [triggerNewFile, setTriggerNewFile] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [showGitPanel, setShowGitPanel] = useState(false);
  const [showCloneModal, setShowCloneModal] = useState(false);
  const [diffFilepath, setDiffFilepath] = useState<string | null>(null);
  const [showShortcutsSheet, setShowShortcutsSheet] = useState(false);
  const [blameSheetVisible, setBlameSheetVisible] = useState(false);
  const [blameSheetLine, setBlameSheetLine] = useState<BlameLine | null>(null);

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

    // Reject known binary/asset extensions early — readAsStringAsync (UTF-8)
    // will fail on these with a "not readable" error. Image preview is
    // tracked as a future enhancement.
    const name = path.split('/').pop() ?? path;
    const ext = name.includes('.') ? name.slice(name.lastIndexOf('.') + 1).toLowerCase() : '';
    const BINARY_EXTS = new Set([
      'png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'ico', 'tiff', 'svg',
      'mp3', 'wav', 'ogg', 'flac', 'm4a', 'aac',
      'mp4', 'mov', 'avi', 'mkv', 'webm', 'm4v',
      'pdf', 'zip', 'tar', 'gz', 'bz2', '7z', 'rar', 'jar', 'war',
      'woff', 'woff2', 'ttf', 'otf', 'eot',
      'class', 'pyc', 'so', 'dll', 'dylib', 'a', 'o', 'exe',
      'sqlite', 'db', 'wasm',
    ]);
    if (BINARY_EXTS.has(ext)) {
      Alert.alert(
        'Cannot preview file',
        `${name} is a ${ext.toUpperCase()} file. Binary file preview is not yet supported.`,
      );
      return;
    }

    try {
      const content = await FileSystemBridge.readFile(path);
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
      // Fire-and-forget: update git gutter decorations after save
      void (async () => {
        try {
          const relativePath = path.replace(rootPath + '/', '').replace(rootPath.replace('file://', '') + '/', '');
          const { headText, workText } = await GitBridge.getWorkingDiff(rootPath, relativePath);
          const diff: GutterDiff = parseDiffToGutter(headText, workText);
          setGutterDecorations(diff);
          editorRef.current?.sendGutterDecorations(diff);
        } catch { /* no repo open or not a git file */ }
      })();
    } catch (err) {
      Alert.alert('Save failed', String(err));
    }
  }, [rootPath, setGutterDecorations]);

  const saveActiveFile = useCallback(() => {
    const tab = tabs.find((t) => t.path === activeTabPath);
    if (tab) saveFile(tab.path, tab.content);
  }, [tabs, activeTabPath, saveFile]);

  const getEditorContent = useCallback((): string => {
    return tabs.find((t) => t.path === activeTabPath)?.content ?? '';
  }, [tabs, activeTabPath]);

  const handleToggleBlame = useCallback(async () => {
    if (blameData !== null) {
      setBlameData(null);
      editorRef.current?.sendBlameData([]);
      return;
    }
    if (!activeTabPath) return;
    try {
      const relativePath = activeTabPath
        .replace(rootPath + '/', '')
        .replace(rootPath.replace('file://', '') + '/', '');
      const lines = await GitBridge.getBlame(rootPath, relativePath);
      setBlameData(lines);
      editorRef.current?.sendBlameData(lines);
    } catch { /* no blame available */ }
  }, [blameData, activeTabPath, rootPath, setBlameData]);

  const handleBlameTap = useCallback((commitHash: string) => {
    const currentBlameData = useGitStore.getState().blameData;
    const line = currentBlameData?.find((b) => b.commitHash === commitHash) ?? null;
    setBlameSheetLine(line);
    setBlameSheetVisible(true);
  }, []);

  const handleSearchNavigate = useCallback(async (
    filePath: string, line: number, matchStart: number, matchEnd: number,
  ) => {
    const existing = tabs.find((t) => t.path === filePath);
    if (existing) {
      setActiveTabPath(filePath);
      setTabs((prev) => prev.map((t) =>
        t.path === filePath ? { ...t, scrollTo: { line, matchStart, matchEnd } } : t,
      ));
    } else {
      try {
        const content = await FileSystemBridge.readFile(filePath);
        const language = getLanguageForFile(filePath);
        setTabs((prev) => [...prev, {
          path: filePath,
          name: filePath.split('/').pop() ?? filePath,
          content,
          language,
          isDirty: false,
          scrollTo: { line, matchStart, matchEnd },
        }]);
        setActiveTabPath(filePath);
      } catch {
        // file unreadable — ignore
      }
    }
  }, [tabs]);

  const handleTabScrollConsumed = useCallback((path: string) => {
    setTabs((prev) => prev.map((t) => t.path === path ? { ...t, scrollTo: null } : t));
  }, []);

  const handleTabViewStateChange = useCallback((path: string, viewState: string) => {
    setTabs((prev) =>
      prev.map((t) => t.path === path ? { ...t, viewState } : t)
    );
  }, []);

  const handleTabChange = useCallback((path: string) => {
    editorRef.current?.requestViewStateSave?.(activeTabPath ?? '');
    setActiveTabPath(path);
  }, [activeTabPath]);

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
  }, [conflict, openFile]);

  // FileExplorer already shows the confirm dialog and performs the delete.
  // This hook fires AFTER deletion to close any open editor tab for the
  // deleted path. Do not re-prompt or re-delete here.
  const deleteFile = useCallback((path: string) => {
    closeTab(path);
  }, [closeTab]);

  // ---------------------------------------------------------------------------
  // Git — panel + clone (GitBridge in src/git/gitBridge.ts)
  // ---------------------------------------------------------------------------

  const gitStatus = useCallback(() => {
    setShowGitPanel(true);
  }, []);

  const gitCommit = useCallback(() => {
    const tab = tabs.find((x) => x.path === activeTabPath);
    if (tab?.isDirty) {
      Alert.alert('Unsaved changes', 'Save the current file before committing?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Save', onPress: saveActiveFile },
      ]);
      return;
    }
    setShowGitPanel(true);
  }, [tabs, activeTabPath, saveActiveFile]);

  // ---------------------------------------------------------------------------
  // Terminal callbacks
  // ---------------------------------------------------------------------------

  const handleCommandComplete = useCallback((exitCode: number): void => {
    if (__DEV__) console.log('[Terminal] exited', exitCode);
  }, []);

  // ---------------------------------------------------------------------------
  // Keyboard shortcuts (hardware keyboard via useKeyboardShortcuts)
  // ---------------------------------------------------------------------------

  const shortcuts: ShortcutDefinition[] = useMemo(() => [
    { key: 's', modifiers: ['cmd'], label: 'Save File', action: saveActiveFile },
    { key: 's', modifiers: ['cmd', 'shift'], label: 'Save All', action: () => {
      tabs.forEach((tab) => { if (tab.isDirty) saveFile(tab.path, tab.content); });
    }},
    { key: '`', modifiers: ['cmd'], label: 'Toggle Terminal', action: () => setShowTerminal((v: boolean) => !v) },
    { key: 'n', modifiers: ['cmd'], label: 'New File', action: () => setTriggerNewFile(true) },
    { key: 'p', modifiers: ['cmd'], label: 'Command Palette', action: () => setShowPalette(true) },
    { key: '/', modifiers: ['cmd'], label: 'Keyboard Shortcuts', action: () => setShowShortcutsSheet(true) },
  ], [saveActiveFile, saveFile, tabs, setShowTerminal, setTriggerNewFile, setShowPalette]);

  useKeyboardShortcuts(shortcuts);

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
      description: 'Open git panel to commit staged changes',
      action: gitCommit,
    },
    {
      id: 'git-clone',
      label: 'Git: Clone repository',
      description: 'Clone a GitHub repository into the workspace',
      action: () => { setShowPalette(false); setShowCloneModal(true); },
    },
    {
      id: 'editor-fold-all',
      label: 'Editor: Fold All',
      description: 'Fold all code regions',
      action: () => { editorRef.current?.sendFoldAll(); },
    },
    {
      id: 'editor-unfold-all',
      label: 'Editor: Unfold All',
      description: 'Unfold all code regions',
      action: () => { editorRef.current?.sendUnfoldAll(); },
    },
    {
      id: 'format-document',
      label: 'Format Document',
      description: 'Run Prettier on current file',
      action: () => { editorRef.current?.sendFormat(); },
    },
    {
      id: 'search-global',
      label: 'Search: Find in Files',
      description: 'Open global search panel',
      action: () => setSidebarTab('search'),
    },
    {
      id: 'keyboard-shortcuts',
      label: 'Keyboard Shortcuts',
      description: '⌘/',
      action: () => setShowShortcutsSheet(true),
    },
    // AI_HOOK: Add AI commands here, e.g.:
    //   { id: 'ai-explain', label: 'AI: Explain Selection', action: () => AiService.explain(selection) }
    //   { id: 'ai-fix',     label: 'AI: Fix Error',        action: () => AiService.fix(activeTab) }
  ], [saveActiveFile, closeTab, gitStatus, gitCommit, activeTabPath, setTriggerNewFile, setShowPalette, setShowShortcutsSheet]);

  const handlePaletteSelect = useCallback((cmd: Command) => {
    setShowPalette(false);
    cmd.action();
  }, []);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <SafeAreaProvider>
    <SafeAreaView
      style={[styles.root, { backgroundColor: t.bg }]}
      edges={['top', 'bottom', 'left', 'right']}
    >
      <StatusBar
        barStyle={t.mode === 'dark' ? 'light-content' : 'dark-content'}
        backgroundColor={t.bg}
      />

      {/* ── Status bar (top) ─────────────────────────────────────────────── */}
      <View style={[styles.statusBar, statusBarStyles.bar, { backgroundColor: t.bgElevated, borderBottomColor: t.border }]}>
        {/* Branch pill — tapping opens GitScreen */}
        <TouchableOpacity
          onPress={() => { setActiveGitTab('branches'); setIsGitScreenOpen(true); }}
          style={[styles.statusBranchPill, { backgroundColor: t.bgHighlight, borderColor: t.border }]}
          accessibilityLabel={`Git branch ${gitBranch}, open git panel`}
        >
          <Text style={[styles.statusText, statusBarStyles.branch, { color: t.accent }]}>⎇ {gitBranch}</Text>
        </TouchableOpacity>
        <Text style={[styles.statusTitle, statusBarStyles.title, { color: t.text }]}>
          NomadCode
        </Text>
        <View style={styles.statusRight}>
          {tabs.find((tab) => tab.path === activeTabPath)?.isDirty && (
            <TouchableOpacity onPress={saveActiveFile} style={styles.savePill} accessibilityLabel="Save file">
              <Text style={[styles.statusDirty, statusBarStyles.branch, { color: '#D97706' }]}>● Save</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={() => setShowAbout(true)} style={styles.aboutBtn} accessibilityLabel="About NomadCode">
            <Text style={[styles.aboutBtnText, statusBarStyles.infoIcon, { color: t.textMuted }]}>ⓘ</Text>
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
            refreshKey={fileTreeRevision}
            onFileSelect={openFile}
            onFileCreate={openFile}
            onFileDelete={deleteFile}
            triggerNewFile={triggerNewFile}
            onNewFileDismissed={() => setTriggerNewFile(false)}
            sidebarTab={sidebarTab}
            onSidebarTabChange={setSidebarTab}
            onSearchNavigate={handleSearchNavigate}
          />
        }
        main={
          <Editor
            ref={editorRef}
            tabs={tabs}
            activeTabPath={activeTabPath}
            onTabChange={handleTabChange}
            onTabClose={closeTab}
            onContentChange={updateContent}
            onSave={saveFile}
            onTabScrollConsumed={handleTabScrollConsumed}
            onTabViewStateChange={handleTabViewStateChange}
            formatOnSave={formatOnSave}
            onToggleBlame={handleToggleBlame}
            onBlameTap={handleBlameTap}
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
        {/* Command palette — ≡ is universally recognised as "menu/commands" */}
        <TouchableOpacity
          style={[styles.fabBtn, styles.fabPalette]}
          onPress={() => setShowPalette(true)}
          activeOpacity={0.85}
          accessibilityLabel="Open command palette"
        >
          <Text style={styles.fabIcon}>≡</Text>
        </TouchableOpacity>

        {/* Terminal toggle — >_ is the universal terminal symbol */}
        <TouchableOpacity
          style={[styles.fabBtn, showTerminal ? styles.fabTerminalActive : styles.fabTerminal]}
          onPress={() => setShowTerminal((v) => !v)}
          activeOpacity={0.85}
          accessibilityLabel="Toggle terminal"
        >
          <Text style={[styles.fabIcon, showTerminal && styles.fabIconActive]}>{'>_'}</Text>
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

      <GitPanel
        visible={showGitPanel}
        onClose={() => setShowGitPanel(false)}
        rootPath={rootPath}
        authToken={authToken}
        onOpenSettings={() => {
          setShowGitPanel(false);
          setShowSettings(true);
        }}
        onOpenDiff={(fp) => {
          setDiffFilepath(fp);
          setShowGitPanel(false);
        }}
      />

      <GitCloneModal
        visible={showCloneModal}
        onClose={() => setShowCloneModal(false)}
        rootPath={rootPath}
        authToken={authToken}
        onOpenSettings={() => {
          setShowCloneModal(false);
          setShowSettings(true);
        }}
      />

      <GitDiffModal
        visible={diffFilepath !== null}
        onClose={() => setDiffFilepath(null)}
        rootPath={rootPath}
        filepath={diffFilepath}
      />

      <GitScreen rootPath={rootPath} authToken={authToken} />

      {/* ── Blame detail sheet ────────────────────────────────────────────── */}
      <BlameDetailSheet
        visible={blameSheetVisible}
        blame={blameSheetLine}
        onClose={() => setBlameSheetVisible(false)}
        onViewDiff={(hash) => {
          setBlameSheetVisible(false);
          console.log('View diff for commit:', hash);
        }}
      />

      {/* ── Cloud-sync conflict resolution modal ─────────────────────────── */}
      <WorkspaceConflictModal conflict={conflict} onResolve={handleConflictResolve} />

      {/* ── Keyboard shortcuts reference sheet ───────────────────────────── */}
      <KeyboardShortcutsSheet
        visible={showShortcutsSheet}
        shortcuts={shortcuts}
        onClose={() => setShowShortcutsSheet(false)}
      />

      {/* ── Extension host (hidden, always mounted) ──────────────────────── */}
      <ExtensionHost
        manifests={installedExtensions}
        onGetEditorContent={getEditorContent}
        onReplaceEditorContent={replaceEditorContent}
        onShowMessage={(text) => Alert.alert('Extension', text)}
        onShowError={(text) => Alert.alert('Extension Error', text, [{ text: 'OK', style: 'destructive' }])}
      />
    </SafeAreaView>
    </SafeAreaProvider>
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
    height: 34,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 6,
  },
  statusBranchPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 5,
    borderWidth: StyleSheet.hairlineWidth,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  statusTitle: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  statusVersion: {
    fontSize: 10,
    fontWeight: '400',
  },
  statusRight: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
    minWidth: 60,
  },
  savePill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statusDirty: {
    fontSize: 11,
    fontWeight: '600',
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
    // color applied inline from theme tokens
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
    bottom: Platform.OS === 'ios' ? 32 : 20,
    right: 16,
    gap: 10,
    alignItems: 'center',
  },
  fabBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
  },
  fabPalette: {
    backgroundColor: '#2563EB',
    borderColor: '#3B82F6',
    // Slightly larger — the primary action
    width: 52,
    height: 52,
    borderRadius: 26,
  },
  fabTerminal: {
    backgroundColor: '#1E293B',
    borderColor: '#334155',
  },
  fabTerminalActive: {
    backgroundColor: '#0D9488',
    borderColor: '#0D9488',
  },
  fabIcon: {
    color: '#E2E8F0',
    fontSize: 17,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  fabIconActive: {
    color: '#FFFFFF',
  },
});
