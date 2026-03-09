import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Keyboard,
} from 'react-native';

export interface Command {
  id: string;
  label: string;
  description?: string;
  action: () => void;
  shortcut?: string;
}

interface CommandPaletteProps {
  commands: Command[];
  onSelect: (command: Command) => void;
  placeholder?: string;
}

/**
 * CommandPalette — fuzzy-searchable overlay for commands, files, and symbols.
 * Triggered by swipe gesture or keyboard shortcut (Cmd+P / Ctrl+P).
 */
export function CommandPalette({
  commands,
  onSelect,
  placeholder = 'Search commands…',
}: CommandPaletteProps) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    if (!query) return commands;
    const q = query.toLowerCase();
    return commands.filter(
      (cmd) =>
        cmd.label.toLowerCase().includes(q) ||
        cmd.description?.toLowerCase().includes(q),
    );
  }, [query, commands]);

  const handleSelect = useCallback(
    (cmd: Command) => {
      Keyboard.dismiss();
      onSelect(cmd);
    },
    [onSelect],
  );

  const renderItem = ({ item, index }: { item: Command; index: number }) => (
    <TouchableOpacity
      style={[styles.item, index === 0 && styles.itemFirst]}
      onPress={() => handleSelect(item)}
      activeOpacity={0.7}
    >
      <View style={styles.itemContent}>
        <Text style={styles.itemLabel}>{item.label}</Text>
        {item.description && (
          <Text style={styles.itemDescription} numberOfLines={1}>
            {item.description}
          </Text>
        )}
      </View>
      {item.shortcut && (
        <View style={styles.shortcutBadge}>
          <Text style={styles.shortcutText}>{item.shortcut}</Text>
        </View>
      )}
    </TouchableOpacity>
  );

  return (
    <Modal transparent animationType="fade" onRequestClose={() => onSelect(commands[0])}>
      <TouchableOpacity
        style={styles.backdrop}
        activeOpacity={1}
        onPress={() => Keyboard.dismiss()}
      >
        <View style={styles.panel}>
          <View style={styles.searchRow}>
            <Text style={styles.searchIcon}>⌘</Text>
            <TextInput
              style={styles.searchInput}
              value={query}
              onChangeText={setQuery}
              placeholder={placeholder}
              placeholderTextColor="#475569"
              autoFocus
              autoCorrect={false}
              autoCapitalize="none"
              returnKeyType="done"
              onSubmitEditing={() => filtered[0] && handleSelect(filtered[0])}
            />
          </View>
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            keyboardShouldPersistTaps="always"
            style={styles.list}
            ListEmptyComponent={
              <Text style={styles.empty}>No commands found</Text>
            }
          />
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: '#00000088',
    alignItems: 'center',
    paddingTop: 80,
  },
  panel: {
    width: '90%',
    maxWidth: 600,
    backgroundColor: '#1E293B',
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#334155',
    maxHeight: 400,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  searchIcon: {
    color: '#475569',
    fontSize: 16,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: '#E2E8F0',
    fontSize: 15,
  },
  list: {
    flexGrow: 0,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#0F172A',
  },
  itemFirst: {
    borderTopWidth: 0,
  },
  itemContent: {
    flex: 1,
  },
  itemLabel: {
    color: '#E2E8F0',
    fontSize: 14,
  },
  itemDescription: {
    color: '#64748B',
    fontSize: 12,
    marginTop: 2,
  },
  shortcutBadge: {
    backgroundColor: '#0F172A',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 8,
  },
  shortcutText: {
    color: '#64748B',
    fontSize: 11,
    fontFamily: 'monospace',
  },
  empty: {
    color: '#475569',
    textAlign: 'center',
    padding: 20,
    fontSize: 14,
  },
});
