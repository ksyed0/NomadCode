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

import React, { useCallback, useState } from 'react';
import {
  Alert,
  Platform,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import Editor, { EditorTab, getLanguageForFile } from './src/components/Editor';
import FileExplorer from './src/components/FileExplorer';
import { Terminal } from './src/components/Terminal';
import { Command, CommandPalette } from './src/components/CommandPalette';
import TabletResponsive from './src/layout/TabletResponsive';
import { FileSystemBridge, GitBridge } from './src/utils/FileSystemBridge';

// ---------------------------------------------------------------------------
// Root document directory — all local project files live here
// ---------------------------------------------------------------------------
const ROOT_PATH = FileSystemBridge.documentDirectory;

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------

export default function App() {
  // ── Editor state ──────────────────────────────────────────────────────────
  const [tabs, setTabs] = useState<EditorTab[]>([]);
  const [activeTabPath, setActiveTabPath] = useState<string | null>(null);

  // ── Panel visibility ──────────────────────────────────────────────────────
  const [showTerminal, setShowTerminal] = useState(false);
  const [showPalette, setShowPalette] = useState(false);
  const [terminalHeight, setTerminalHeight] = useState(220);

  // ── Git status (updated after Git operations) ─────────────────────────────
  const [gitBranch, setGitBranch] = useState('main');

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
      const tab: EditorTab = {
        path,
        name,
        content,
        language: getLanguageForFile(name),
        isDirty: false,
      };
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
      // CLOUD_HOOK: after local save, enqueue cloud sync:
      //   await CloudSync.enqueueUpload(path, content);
    } catch (err) {
      Alert.alert('Save failed', String(err));
    }
  }, []);

  const saveActiveFile = useCallback(() => {
    const tab = tabs.find((t) => t.path === activeTabPath);
    if (tab) saveFile(tab.path, tab.content);
  }, [tabs, activeTabPath, saveFile]);

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
      const status = await GitBridge.status(ROOT_PATH);
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
            await GitBridge.commit(ROOT_PATH, 'feat: update from NomadCode', {
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
  // Command palette commands
  // ---------------------------------------------------------------------------

  const paletteCommands: Command[] = [
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
  ];

  const handlePaletteSelect = useCallback((cmd: Command) => {
    setShowPalette(false);
    cmd.action();
  }, []);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#0F172A" />

      {/* ── Status bar (top) ─────────────────────────────────────────────── */}
      <View style={styles.statusBar}>
        <TouchableOpacity onPress={gitStatus} style={styles.statusItem}>
          <Text style={styles.statusText}>⎇ {gitBranch}</Text>
        </TouchableOpacity>
        <Text style={styles.statusTitle}>NomadCode</Text>
        <View style={styles.statusRight}>
          {tabs.find((t) => t.path === activeTabPath)?.isDirty && (
            <TouchableOpacity onPress={saveActiveFile}>
              <Text style={styles.statusDirty}>● Save</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* ── Three-pane layout ────────────────────────────────────────────── */}
      <TabletResponsive
        sidebar={
          <FileExplorer
            rootPath={ROOT_PATH}
            onFileSelect={openFile}
            onFileDelete={deleteFile}
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
        terminal={<Terminal workingDirectory={ROOT_PATH} onCommand={console.log} visible={showTerminal} />}
        terminalHeight={terminalHeight}
        onTerminalHeightChange={setTerminalHeight}
        onOpenPalette={() => setShowPalette(true)}
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
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0F172A',
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
  statusRight: {
    minWidth: 60,
    alignItems: 'flex-end',
  },
  statusDirty: {
    color: '#FBBF24',
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
