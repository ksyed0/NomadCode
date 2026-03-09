import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { FileSystemBridge, FileEntry } from '../utils/FileSystemBridge';

interface FileExplorerProps {
  rootPath: string;
  onFileSelect: (filePath: string) => void;
  onFileCreate?: (filePath: string) => void;
  onFileDelete?: (filePath: string) => void;
}

interface TreeNode extends FileEntry {
  depth: number;
  expanded?: boolean;
  children?: TreeNode[];
}

/**
 * FileExplorer — displays a hierarchical directory tree with tap-to-open
 * and long-press context menu for file operations.
 */
export default function FileExplorer({
  rootPath,
  onFileSelect,
  onFileDelete,
}: FileExplorerProps) {
  const [nodes, setNodes] = useState<TreeNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);

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

  const renderNode = ({ item }: { item: TreeNode }) => (
    <TouchableOpacity
      style={[
        styles.row,
        { paddingLeft: 12 + item.depth * 16 },
        item.path === selectedPath && styles.selectedRow,
      ]}
      onPress={() => handlePress(item)}
      onLongPress={() => onFileDelete?.(item.path)}
      activeOpacity={0.7}
    >
      <Text style={styles.icon}>
        {item.isDirectory ? (item.expanded ? '▾' : '▸') : '·'}
      </Text>
      <Text style={[styles.name, item.isDirectory && styles.directoryName]} numberOfLines={1}>
        {item.name}
      </Text>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#2563EB" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerText}>EXPLORER</Text>
      </View>
      <FlatList
        data={nodes}
        keyExtractor={(item) => item.path}
        renderItem={renderNode}
        removeClippedSubviews
        initialNumToRender={30}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1E293B',
  },
  header: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  headerText: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingRight: 12,
  },
  selectedRow: {
    backgroundColor: '#2563EB22',
  },
  icon: {
    color: '#64748B',
    width: 16,
    fontSize: 12,
    textAlign: 'center',
  },
  name: {
    color: '#CBD5E1',
    fontSize: 13,
    marginLeft: 4,
    flex: 1,
  },
  directoryName: {
    color: '#E2E8F0',
    fontWeight: '500',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1E293B',
  },
});
