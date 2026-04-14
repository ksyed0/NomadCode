/**
 * SandboxDirectoryPicker — in-app directory browser for selecting a workspace
 * subfolder inside the app's sandboxed documentDirectory.
 *
 * iOS's react-native-document-picker does not support true folder selection
 * (pickDirectory throws "not supported on iOS"), and the system
 * UIDocumentPickerViewController requires a custom native module with
 * security-scoped URL bookmarks. Until that lands (EPIC-0019), this picker
 * lets users navigate and select subfolders within their writable sandbox.
 *
 * Features:
 *   - Navigate into subdirectories by tapping
 *   - Go up one level (stops at documentDirectory — cannot escape sandbox)
 *   - Create a new subfolder in place
 *   - "Select This Folder" confirms the current directory
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  FlatList,
  TextInput,
  StyleSheet,
  Alert,
} from 'react-native';
import { FileSystemBridge, FileEntry } from '../utils/FileSystemBridge';
import type { WorkspaceRoot } from '../types/workspace';
import { useTheme } from '../theme/tokens';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSelect: (root: WorkspaceRoot) => void;
  /** The app's documentDirectory — the picker cannot navigate above this. */
  sandboxRoot: string;
}

function ensureTrailingSlash(p: string): string {
  return p.endsWith('/') ? p : `${p}/`;
}

function stripTrailingSlash(p: string): string {
  return p.replace(/\/+$/, '');
}

function parentOf(p: string): string {
  const stripped = stripTrailingSlash(p);
  const idx = stripped.lastIndexOf('/');
  if (idx <= 0) return stripped;
  return stripped.slice(0, idx);
}

function basename(p: string): string {
  const stripped = stripTrailingSlash(p);
  const idx = stripped.lastIndexOf('/');
  return idx >= 0 ? stripped.slice(idx + 1) : stripped;
}

export default function SandboxDirectoryPicker({
  visible,
  onClose,
  onSelect,
  sandboxRoot,
}: Props): React.ReactElement | null {
  const t = useTheme();
  const normalizedRoot = ensureTrailingSlash(sandboxRoot);
  const [currentPath, setCurrentPath] = useState<string>(normalizedRoot);
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [showNewFolderInput, setShowNewFolderInput] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [loading, setLoading] = useState(false);

  const loadEntries = useCallback(async (path: string) => {
    setLoading(true);
    try {
      const all = await FileSystemBridge.listDirectory(path);
      // Directories only; sort alphabetically
      const dirs = all
        .filter((e) => e.isDirectory)
        .sort((a, b) => a.name.localeCompare(b.name));
      setEntries(dirs);
    } catch (e) {
      if (__DEV__) console.warn('[SandboxPicker] listDirectory failed:', e);
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (visible) {
      setCurrentPath(normalizedRoot);
      loadEntries(normalizedRoot);
    }
  }, [visible, normalizedRoot, loadEntries]);

  const navigateTo = useCallback(
    (path: string) => {
      const next = ensureTrailingSlash(path);
      setCurrentPath(next);
      loadEntries(next);
    },
    [loadEntries],
  );

  const canGoUp = stripTrailingSlash(currentPath) !== stripTrailingSlash(normalizedRoot);

  const goUp = useCallback(() => {
    if (!canGoUp) return;
    navigateTo(parentOf(currentPath));
  }, [canGoUp, currentPath, navigateTo]);

  const handleCreateFolder = useCallback(async () => {
    const name = newFolderName.trim();
    if (!name) return;
    if (!/^[a-zA-Z0-9._ -]+$/.test(name)) {
      Alert.alert('Invalid name', 'Use letters, numbers, dots, spaces, hyphens, or underscores.');
      return;
    }
    try {
      const parent = stripTrailingSlash(currentPath);
      const newPath = `${parent}/${name}`;
      await FileSystemBridge.createDirectory(newPath);
      setNewFolderName('');
      setShowNewFolderInput(false);
      await loadEntries(currentPath);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      Alert.alert('Could not create folder', msg);
    }
  }, [newFolderName, currentPath, loadEntries]);

  const handleSelectCurrent = useCallback(() => {
    const uri = ensureTrailingSlash(currentPath);
    const displayName = basename(uri) || 'Documents';
    onSelect({ uri, uriType: 'file', displayName });
    onClose();
  }, [currentPath, onSelect, onClose]);

  const relativeBreadcrumb = currentPath.startsWith(normalizedRoot)
    ? stripTrailingSlash(currentPath.slice(normalizedRoot.length)) || '/'
    : currentPath;

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.sheet, { backgroundColor: t.bgElevated, borderColor: t.border }]}>
          <Text style={[styles.title, { color: t.text }]}>Choose workspace folder</Text>
          <Text style={[styles.hint, { color: t.textMuted }]}>
            Navigate inside your app's sandbox. Only subfolders are writable.
          </Text>
          <Text
            testID="sandbox-picker-breadcrumb"
            style={[styles.breadcrumb, { color: t.textMuted, borderColor: t.border }]}
          >
            Documents/{relativeBreadcrumb === '/' ? '' : relativeBreadcrumb}
          </Text>

          <View style={styles.navRow}>
            <TouchableOpacity
              testID="sandbox-picker-up"
              style={[styles.navBtn, { borderColor: t.border, opacity: canGoUp ? 1 : 0.4 }]}
              onPress={goUp}
              disabled={!canGoUp}
              accessibilityRole="button"
              accessibilityLabel="Go up"
            >
              <Text style={[styles.navBtnText, { color: t.text }]}>↑ Up</Text>
            </TouchableOpacity>
            <TouchableOpacity
              testID="sandbox-picker-new-folder"
              style={[styles.navBtn, { borderColor: t.border }]}
              onPress={() => setShowNewFolderInput((v) => !v)}
              accessibilityRole="button"
              accessibilityLabel="New folder"
            >
              <Text style={[styles.navBtnText, { color: t.text }]}>+ New Folder</Text>
            </TouchableOpacity>
          </View>

          {showNewFolderInput && (
            <View style={styles.newFolderRow}>
              <TextInput
                testID="sandbox-picker-new-folder-input"
                style={[styles.input, { color: t.text, borderColor: t.border, flex: 1 }]}
                placeholder="Folder name"
                placeholderTextColor={t.textMuted}
                value={newFolderName}
                onChangeText={setNewFolderName}
                onSubmitEditing={handleCreateFolder}
                returnKeyType="done"
                autoFocus
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity
                testID="sandbox-picker-create-folder-btn"
                style={[styles.navBtn, { backgroundColor: t.accent }]}
                onPress={handleCreateFolder}
                accessibilityRole="button"
                accessibilityLabel="Create folder"
              >
                <Text style={[styles.navBtnText, { color: '#FFFFFF' }]}>Create</Text>
              </TouchableOpacity>
            </View>
          )}

          <FlatList
            testID="sandbox-picker-list"
            data={entries}
            keyExtractor={(item) => item.path}
            style={styles.list}
            renderItem={({ item }) => (
              <TouchableOpacity
                testID={`sandbox-picker-item-${item.name}`}
                style={[styles.listItem, { borderColor: t.border }]}
                onPress={() => navigateTo(item.path)}
                accessibilityRole="button"
                accessibilityLabel={`Open ${item.name}`}
              >
                <Text style={[styles.listItemText, { color: t.text }]}>📁 {item.name}</Text>
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <Text style={[styles.emptyText, { color: t.textMuted }]}>
                {loading ? 'Loading…' : 'No subfolders here yet. Use "+ New Folder" to create one.'}
              </Text>
            }
          />

          <View style={styles.actions}>
            <TouchableOpacity
              testID="sandbox-picker-cancel"
              style={[styles.btn, { backgroundColor: t.border }]}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Cancel"
            >
              <Text style={[styles.btnText, { color: t.text }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              testID="sandbox-picker-select"
              style={[styles.btn, { backgroundColor: t.accent }]}
              onPress={handleSelectCurrent}
              accessibilityRole="button"
              accessibilityLabel="Select this folder"
            >
              <Text style={[styles.btnText, { color: '#FFFFFF' }]}>Select This Folder</Text>
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
    maxHeight: '85%',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 6,
  },
  hint: {
    fontSize: 12,
    marginBottom: 10,
  },
  breadcrumb: {
    fontSize: 12,
    fontFamily: 'Menlo',
    borderWidth: 1,
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 10,
  },
  navRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  navBtn: {
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navBtnText: {
    fontSize: 14,
    fontWeight: '500',
  },
  newFolderRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
    alignItems: 'center',
  },
  input: {
    borderWidth: 1,
    borderRadius: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    fontSize: 14,
    minHeight: 44,
  },
  list: {
    flexGrow: 1,
    marginBottom: 10,
  },
  listItem: {
    minHeight: 44,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
  },
  listItemText: {
    fontSize: 15,
  },
  emptyText: {
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: 24,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 4,
  },
  btn: {
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: {
    fontSize: 14,
    fontWeight: '500',
  },
});
