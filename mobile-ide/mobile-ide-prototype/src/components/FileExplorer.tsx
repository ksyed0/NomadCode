import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Modal,
  Alert,
  Dimensions,
  InteractionManager,
  Platform,
} from 'react-native';
import { FileSystemBridge, FileEntry } from '../utils/FileSystemBridge';
import { useTheme } from '../theme/tokens';

interface FileExplorerProps {
  rootPath: string;
  onFileSelect: (filePath: string) => void;
  onFileCreate?: (filePath: string) => void;
  onFileDelete?: (filePath: string) => void;
  onFileRename?: (oldPath: string, newPath: string) => void;
  onFileMove?: (from: string, to: string) => void;
  /** Set true externally to open the new-file modal (e.g. from command palette). Reset via onNewFileDismissed. */
  triggerNewFile?: boolean;
  onNewFileDismissed?: () => void;
}

interface TreeNode extends FileEntry {
  depth: number;
  expanded?: boolean;
  children?: TreeNode[];
}

type NameModalMode = 'create-file' | 'create-dir' | 'rename';

interface NameModalState {
  visible: boolean;
  mode: NameModalMode;
  initialValue: string;
  targetNode: TreeNode | null;
}

interface MovePickerState {
  visible: boolean;
  sourceNode: TreeNode;
}

// iOS Modal dismiss animation ≈ 250 ms; we wait 320 ms so the second Modal
// opens after the first has fully finished — UIKit silently drops a Modal that
// opens while another is still animating out. Android needs only a micro-deferral.
const MODAL_SWITCH_DELAY = Platform.OS === 'ios' ? 320 : 50;

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

function parentDir(path: string): string {
  return path.substring(0, path.lastIndexOf('/'));
}

function resolveParentPath(node: TreeNode): string {
  return node.isDirectory ? node.path : parentDir(node.path);
}

function isDescendantOrSelf(src: string, dest: string): boolean {
  return dest === src || dest.startsWith(src + '/');
}

function showErrorAlert(err: unknown): void {
  const message = err instanceof Error ? err.message : 'Unexpected error';
  Alert.alert('Operation Failed', message);
}

/**
 * FileExplorer — displays a hierarchical directory tree with tap-to-open
 * and long-press context menu for file operations.
 */
export default function FileExplorer({
  rootPath,
  onFileSelect,
  onFileDelete,
  onFileCreate,
  onFileRename,
  onFileMove,
  triggerNewFile,
  onNewFileDismissed,
}: FileExplorerProps) {
  const t = useTheme();
  const [nodes, setNodes] = useState<TreeNode[]>([]);
  const [loading, setLoading] = useState(true);

  // EPIC-0002 state
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [contextTarget, setContextTarget] = useState<TreeNode | null>(null);
  const [nameModal, setNameModal] = useState<NameModalState | null>(null);
  const [nameInputValue, setNameInputValue] = useState('');
  const [movePicker, setMovePicker] = useState<MovePickerState | null>(null);
  const [pickerNodes, setPickerNodes] = useState<TreeNode[]>([]);
  const [pickerSelectedPath, setPickerSelectedPath] = useState<string | null>(null);

  // Holds the name modal to open after the context menu modal fully dismisses (iOS).
  const pendingNameModalRef = useRef<NameModalState | null>(null);

  const loadDirectory = useCallback(async (path: string, depth: number): Promise<TreeNode[]> => {
    const entries = await FileSystemBridge.listDirectory(path);
    return entries
      .sort((a, b) => {
        if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
        return a.name.localeCompare(b.name);
      })
      .map((entry) => ({ ...entry, depth, expanded: false }));
  }, []);

  useEffect(() => {
    loadDirectory(rootPath, 0)
      .then(setNodes)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [rootPath, loadDirectory]);

  // ---------------------------------------------------------------------------
  // Refresh helpers
  // ---------------------------------------------------------------------------

  const refreshTree = useCallback(async () => {
    try {
      const fresh = await loadDirectory(rootPath, 0);
      setNodes(fresh);
    } catch (err) {
      console.error(err);
    }
  }, [rootPath, loadDirectory]);

  const refreshContainingDir = useCallback(
    async (_node: TreeNode) => {
      const fresh = await loadDirectory(rootPath, 0);
      setNodes(fresh);
    },
    [rootPath, loadDirectory],
  );

  // ---------------------------------------------------------------------------
  // Move picker loader (dirs-only traversal)
  // ---------------------------------------------------------------------------

  const loadPickerTree = useCallback(
    async (dirPath: string, depth: number): Promise<TreeNode[]> => {
      const entries = await FileSystemBridge.listDirectory(dirPath);
      return entries
        .filter((e) => e.isDirectory)
        .map((d) => ({ ...d, depth, expanded: false }));
    },
    [],
  );

  // ---------------------------------------------------------------------------
  // Tree interaction
  // ---------------------------------------------------------------------------

  const handlePress = useCallback(
    async (node: TreeNode) => {
      if (node.isDirectory) {
        if (!node.expanded) {
          const children = await loadDirectory(node.path, node.depth + 1);
          setNodes((prev) =>
            prev.flatMap((n) =>
              n.path === node.path
                ? [{ ...n, expanded: true }, ...children]
                : [n],
            ),
          );
        } else {
          // Collapse: remove children
          setNodes((prev) => {
            const collapseDepth = node.depth + 1;
            let removing = false;
            return prev.flatMap((n) => {
              if (n.path === node.path) {
                removing = true;
                return [{ ...n, expanded: false }];
              }
              if (removing && n.depth >= collapseDepth) return [];
              removing = false;
              return [n];
            });
          });
        }
      } else {
        setSelectedPath(node.path);
        onFileSelect(node.path);
      }
    },
    [loadDirectory, onFileSelect],
  );

  // ---------------------------------------------------------------------------
  // Context menu actions
  // ---------------------------------------------------------------------------

  /**
   * Queues a name modal to open after the context-menu modal fully dismisses.
   *
   * On iOS the native Modal fade-out animation takes ~250 ms; opening a second
   * Modal before the first has finished its dismiss animation causes the second
   * one to be silently dropped by UIKit.  We defer by 320 ms — safely past the
   * animation — using a plain setTimeout whose callback fires before waitFor's
   * 1 000 ms test timeout, keeping unit tests green.
   *
   * On Android (and other platforms) a 50 ms deferral is enough.
   */
  const openNameModalAfterContextDismiss = useCallback((pending: NameModalState) => {
    pendingNameModalRef.current = pending;
    setContextTarget(null);
    setTimeout(() => {
      const p = pendingNameModalRef.current;
      if (p) { setNameInputValue(p.initialValue); setNameModal(p); pendingNameModalRef.current = null; }
    }, MODAL_SWITCH_DELAY);
  }, []);

  const handleContextNewFile = useCallback(() => {
    openNameModalAfterContextDismiss({ visible: true, mode: 'create-file', initialValue: '', targetNode: contextTarget });
  }, [contextTarget, openNameModalAfterContextDismiss]);

  const handleContextNewFolder = useCallback(() => {
    openNameModalAfterContextDismiss({ visible: true, mode: 'create-dir', initialValue: '', targetNode: contextTarget });
  }, [contextTarget, openNameModalAfterContextDismiss]);

  const handleContextRename = useCallback(() => {
    const initial = contextTarget?.name ?? '';
    openNameModalAfterContextDismiss({ visible: true, mode: 'rename', initialValue: initial, targetNode: contextTarget });
  }, [contextTarget, openNameModalAfterContextDismiss]);

  const handleContextDelete = useCallback(() => {
    const target = contextTarget!;
    setContextTarget(null);

    const isDir = target.isDirectory;
    const title = isDir ? 'Delete Folder' : 'Delete File';
    const msg = `Are you sure you want to delete "${target.name}"?`;

    Alert.alert(title, msg, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await FileSystemBridge.deleteEntry(target.path);
            onFileDelete?.(target.path);
            await refreshContainingDir(target);
          } catch (err) {
            showErrorAlert(err);
          }
        },
      },
    ]);
  }, [contextTarget, onFileDelete, refreshContainingDir]);

  const handleHeaderNewFile = useCallback(() => {
    setNameInputValue('');
    setNameModal({ visible: true, mode: 'create-file', initialValue: '', targetNode: null });
  }, []);

  const handleHeaderNewFolder = useCallback(() => {
    setNameInputValue('');
    setNameModal({ visible: true, mode: 'create-dir', initialValue: '', targetNode: null });
  }, []);

  useEffect(() => {
    if (triggerNewFile) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      handleHeaderNewFile();
      onNewFileDismissed?.();
    }
  }, [triggerNewFile, handleHeaderNewFile, onNewFileDismissed]);

  const handleContextMove = useCallback(async () => {
    const target = contextTarget!;
    setContextTarget(null);

    const dirs = await loadPickerTree(rootPath, 0);
    setPickerNodes(dirs);
    setPickerSelectedPath(null);
    setMovePicker({ visible: true, sourceNode: target });
  }, [contextTarget, loadPickerTree, rootPath]);

  // ---------------------------------------------------------------------------
  // Name modal confirm
  // ---------------------------------------------------------------------------

  const handleNameConfirm = useCallback(async () => {
    if (!nameModal) return;
    const { mode, targetNode } = nameModal;
    const trimmed = nameInputValue.trim();
    if (!trimmed) return;

    const parentPath = targetNode ? resolveParentPath(targetNode) : rootPath;
    const newPath = `${parentPath}/${trimmed}`;

    setNameModal(null);
    setNameInputValue('');

    try {
      if (mode === 'create-file') {
        await FileSystemBridge.createFile(newPath);
        onFileCreate?.(newPath);
        if (targetNode) await refreshContainingDir(targetNode); else await refreshTree();
      } else if (mode === 'create-dir') {
        await FileSystemBridge.createDirectory(newPath);
        if (targetNode) await refreshContainingDir(targetNode); else await refreshTree();
      } else if (mode === 'rename') {
        const oldPath = targetNode!.path;
        await FileSystemBridge.moveEntry(oldPath, newPath);
        onFileRename?.(oldPath, newPath);
        await refreshContainingDir(targetNode!);
      }
    } catch (err) {
      showErrorAlert(err);
    }
  }, [nameModal, nameInputValue, onFileCreate, onFileRename, refreshContainingDir, refreshTree, rootPath]);

  const handleNameCancel = useCallback(() => {
    setNameModal(null);
    setNameInputValue('');
  }, []);

  // ---------------------------------------------------------------------------
  // Move picker confirm
  // ---------------------------------------------------------------------------

  const handleMoveConfirm = useCallback(async () => {
    if (!movePicker || !pickerSelectedPath) return;
    const { sourceNode } = movePicker;
    const destPath = `${pickerSelectedPath}/${sourceNode.name}`;

    setMovePicker(null);
    setPickerSelectedPath(null);

    try {
      await FileSystemBridge.moveEntry(sourceNode.path, destPath);
      onFileMove?.(sourceNode.path, destPath);
      await refreshTree();
    } catch (err) {
      showErrorAlert(err);
    }
  }, [movePicker, pickerSelectedPath, onFileMove, refreshTree]);

  const handleMoveCancel = useCallback(() => {
    setMovePicker(null);
    setPickerSelectedPath(null);
  }, []);

  // ---------------------------------------------------------------------------
  // Renderers
  // ---------------------------------------------------------------------------

  const renderNode = ({ item }: { item: TreeNode }) => (
    <TouchableOpacity
      style={[
        styles.row,
        { paddingLeft: 12 + item.depth * 16 },
        item.path === selectedPath && [styles.selectedRow, { backgroundColor: t.accent + '22' }],
      ]}
      onPress={() => handlePress(item)}
      onLongPress={() => setContextTarget(item)}
      activeOpacity={0.7}
    >
      <Text style={[styles.icon, { color: t.textMuted }]}>
        {item.isDirectory ? (item.expanded ? '▾' : '▸') : '·'}
      </Text>
      <Text style={[styles.name, { color: t.text }, item.isDirectory && { color: t.text, fontWeight: '500' }]} numberOfLines={1}>
        {item.name}
      </Text>
    </TouchableOpacity>
  );

  const renderPickerNode = ({ item }: { item: TreeNode }) => {
    const isSource = movePicker ? isDescendantOrSelf(movePicker.sourceNode.path, item.path) || item.path === movePicker.sourceNode.path : false;
    const isSelected = item.path === pickerSelectedPath;
    return (
      <TouchableOpacity
        testID={`picker-row-${item.path}`}
        style={[
          styles.pickerRow,
          { paddingLeft: 12 + item.depth * 16 },
          isSelected && [styles.pickerRowSelected, { backgroundColor: t.accent + '22' }],
          isSource && styles.pickerRowDisabled,
        ]}
        onPress={() => {
          if (!isSource) setPickerSelectedPath(item.path);
        }}
        disabled={isSource}
        accessibilityState={{ disabled: isSource }}
        activeOpacity={0.7}
      >
        <Text style={[styles.icon, { color: t.textMuted }]}>▸</Text>
        <Text style={[styles.name, { color: t.text, fontWeight: '500' }]} numberOfLines={1}>
          {item.name}
        </Text>
      </TouchableOpacity>
    );
  };

  // ---------------------------------------------------------------------------
  // Loading / render
  // ---------------------------------------------------------------------------

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: t.bgElevated }]}>
        <ActivityIndicator testID="activity-indicator" color={t.accent} />
      </View>
    );
  }

  const nameConfirmDisabled = nameInputValue.trim() === '';
  const moveConfirmDisabled = pickerSelectedPath === null;

  return (
    <View style={[styles.container, { backgroundColor: t.bgElevated }]}>
      <View style={[styles.header, { borderBottomColor: t.border }]}>
        <Text style={[styles.headerText, { color: t.textMuted }]}>EXPLORER</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            testID="header-new-file"
            onPress={handleHeaderNewFile}
            style={styles.headerBtn}
            accessibilityLabel="New file"
          >
            <Text style={[styles.headerBtnText, { color: t.textMuted }]}>+</Text>
          </TouchableOpacity>
          <TouchableOpacity
            testID="header-new-folder"
            onPress={handleHeaderNewFolder}
            style={styles.headerBtn}
            accessibilityLabel="New folder"
          >
            <Text style={[styles.headerBtnText, { color: t.textMuted }]}>⊞</Text>
          </TouchableOpacity>
        </View>
      </View>
      <FlatList
        data={nodes}
        keyExtractor={(item) => item.path}
        renderItem={renderNode}
        removeClippedSubviews
        initialNumToRender={30}
      />

      {/* ------------------------------------------------------------------ */}
      {/* Context menu modal                                                   */}
      {/* ------------------------------------------------------------------ */}
      <Modal
        visible={contextTarget !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setContextTarget(null)}
        onDismiss={() => {
          // iOS-only: fires after the native dismiss animation completes.
          const p = pendingNameModalRef.current;
          if (p) { setNameInputValue(p.initialValue); setNameModal(p); pendingNameModalRef.current = null; }
        }}
      >
        <TouchableOpacity
          testID="context-menu-backdrop"
          style={styles.backdrop}
          activeOpacity={1}
          onPress={() => setContextTarget(null)}
        >
          <View testID="context-menu" style={[styles.contextMenuPanel, { backgroundColor: t.bgElevated, borderTopColor: t.border }]}>
            <Text testID="context-menu-title" style={[styles.contextMenuTitle, { color: t.textMuted, borderBottomColor: t.border }]}>
              {contextTarget?.name ?? ''}
            </Text>

            <TouchableOpacity testID="ctx-new-file" style={styles.contextMenuItem} onPress={handleContextNewFile}>
              <Text style={[styles.contextMenuItemText, { color: t.text }]}>New File</Text>
            </TouchableOpacity>

            <TouchableOpacity testID="ctx-new-folder" style={styles.contextMenuItem} onPress={handleContextNewFolder}>
              <Text style={[styles.contextMenuItemText, { color: t.text }]}>New Folder</Text>
            </TouchableOpacity>

            <View style={[styles.separator, { backgroundColor: t.border }]} />

            <TouchableOpacity testID="ctx-rename" style={styles.contextMenuItem} onPress={handleContextRename}>
              <Text style={[styles.contextMenuItemText, { color: t.text }]}>Rename</Text>
            </TouchableOpacity>

            <TouchableOpacity testID="ctx-move" style={styles.contextMenuItem} onPress={handleContextMove}>
              <Text style={[styles.contextMenuItemText, { color: t.text }]}>Move to...</Text>
            </TouchableOpacity>

            <View style={[styles.separator, { backgroundColor: t.border }]} />

            <TouchableOpacity testID="ctx-delete" style={styles.contextMenuItem} onPress={handleContextDelete}>
              <Text style={[styles.contextMenuItemText, { color: t.error }]}>Delete</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ------------------------------------------------------------------ */}
      {/* Name input modal (create-file / create-dir / rename)                */}
      {/* ------------------------------------------------------------------ */}
      <Modal
        visible={nameModal?.visible === true}
        transparent
        animationType="fade"
        onRequestClose={handleNameCancel}
      >
        <View testID="name-input-modal" style={styles.nameModalBackdrop}>
          <View style={[styles.nameModalPanel, { backgroundColor: t.bgElevated, borderColor: t.border }]}>
            <Text style={[styles.nameModalTitle, { color: t.text }]}>
              {nameModal?.mode === 'create-file'
                ? 'New File'
                : nameModal?.mode === 'create-dir'
                ? 'New Folder'
                : 'Rename'}
            </Text>
            <TextInput
              testID="name-input"
              style={[styles.nameInput, { color: t.text, backgroundColor: t.bg, borderColor: t.border }]}
              value={nameInputValue}
              onChangeText={setNameInputValue}
              autoFocus
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="Enter name…"
              placeholderTextColor={t.textMuted}
            />
            <View style={styles.nameModalButtons}>
              <TouchableOpacity
                testID="name-cancel-btn"
                style={[styles.btn, styles.btnSecondary, { borderColor: t.border }]}
                onPress={handleNameCancel}
              >
                <Text style={[styles.btnSecondaryText, { color: t.textMuted }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                testID="name-confirm-btn"
                style={[styles.btn, styles.btnPrimary, { backgroundColor: t.accent }, nameConfirmDisabled && styles.btnDisabled]}
                onPress={handleNameConfirm}
                disabled={nameConfirmDisabled}
                accessibilityState={{ disabled: nameConfirmDisabled }}
              >
                <Text style={styles.btnPrimaryText}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ------------------------------------------------------------------ */}
      {/* Move picker modal                                                    */}
      {/* ------------------------------------------------------------------ */}
      <Modal
        visible={movePicker?.visible === true}
        transparent
        animationType="slide"
        onRequestClose={handleMoveCancel}
      >
        <View testID="move-picker-modal" style={styles.movePickerBackdrop}>
          <View style={[styles.movePickerPanel, { backgroundColor: t.bgElevated, borderTopColor: t.border }]}>
            <Text style={[styles.nameModalTitle, { color: t.text }]}>Move to…</Text>
            <FlatList
              data={pickerNodes}
              keyExtractor={(item) => item.path}
              renderItem={renderPickerNode}
              style={styles.pickerList}
            />
            <View style={styles.nameModalButtons}>
              <TouchableOpacity
                testID="move-picker-cancel-btn"
                style={[styles.btn, styles.btnSecondary, { borderColor: t.border }]}
                onPress={handleMoveCancel}
              >
                <Text style={[styles.btnSecondaryText, { color: t.textMuted }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                testID="move-here-btn"
                style={[styles.btn, styles.btnPrimary, { backgroundColor: t.accent }, moveConfirmDisabled && styles.btnDisabled]}
                onPress={handleMoveConfirm}
                disabled={moveConfirmDisabled}
                accessibilityState={{ disabled: moveConfirmDisabled }}
              >
                <Text style={styles.btnPrimaryText}>Move Here</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  headerText: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerBtn: {
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  headerBtnText: {
    fontSize: 16,
    fontWeight: '600',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingRight: 12,
  },
  selectedRow: {},
  icon: {
    width: 16,
    fontSize: 12,
    textAlign: 'center',
  },
  name: {
    fontSize: 13,
    marginLeft: 4,
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Context menu
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.53)',
    justifyContent: 'flex-end',
  },
  contextMenuPanel: {
    borderTopWidth: 1,
    paddingBottom: 32,
  },
  contextMenuTitle: {
    fontSize: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  contextMenuItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  contextMenuItemText: {
    fontSize: 14,
  },
  separator: {
    height: 1,
    marginVertical: 4,
  },

  // Name input modal
  nameModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.53)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nameModalPanel: {
    width: '85%',
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
  },
  nameModalTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 12,
  },
  nameInput: {
    borderRadius: 6,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
    marginBottom: 12,
  },
  nameModalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  btn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  btnPrimary: {},
  btnPrimaryText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '500',
  },
  btnSecondary: {
    borderWidth: 1,
  },
  btnSecondaryText: {
    fontSize: 14,
  },
  btnDisabled: {
    opacity: 0.4,
  },

  // Move picker
  movePickerBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.53)',
    justifyContent: 'flex-end',
  },
  movePickerPanel: {
    borderTopWidth: 1,
    maxHeight: SCREEN_HEIGHT * 0.6,
    paddingBottom: 32,
  },
  pickerList: {
    flex: 1,
  },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingRight: 12,
  },
  pickerRowSelected: {},
  pickerRowDisabled: {
    opacity: 0.4,
  },
});
