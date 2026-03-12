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
  /** Whether the palette is visible */
  visible: boolean;
  commands: Command[];
  /** Dismiss without selecting (back button, backdrop tap) */
  onClose: () => void;
  /** Select a command — parent is responsible for also calling onClose */
  onSelect: (command: Command) => void;
  placeholder?: string;
}

export function CommandPalette({
  visible,
  commands,
  onClose,
  onSelect,
  placeholder = 'Search commands…',
}: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  const filtered = useMemo(() => {
    if (!query) return commands;
    const q = query.toLowerCase();
    return commands.filter(
      (cmd) =>
        cmd.label.toLowerCase().includes(q) ||
        cmd.description?.toLowerCase().includes(q),
    );
  }, [query, commands]);

  const handleQueryChange = useCallback((text: string) => {
    setQuery(text);
    setSelectedIndex(0);
  }, []);

  const handleSelect = useCallback(
    (cmd: Command) => {
      Keyboard.dismiss();
      onSelect(cmd);
    },
    [onSelect],
  );

  const handleSubmit = useCallback(() => {
    if (filtered[selectedIndex]) {
      handleSelect(filtered[selectedIndex]);
    }
  }, [filtered, selectedIndex, handleSelect]);

  const handleKeyPress = useCallback(
    (e: { nativeEvent: { key: string } }) => {
      const { key } = e.nativeEvent;
      if (key === 'ArrowDown') {
        setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
      } else if (key === 'ArrowUp') {
        setSelectedIndex((i) => Math.max(i - 1, 0));
      }
    },
    [filtered.length],
  );

  const handleBackdropPress = useCallback(() => {
    Keyboard.dismiss();
    onClose();
  }, [onClose]);

  const renderItem = ({ item, index }: { item: Command; index: number }) => {
    const isSelected = index === selectedIndex;
    return (
      <TouchableOpacity
        onPress={() => handleSelect(item)}
        activeOpacity={0.7}
      >
        <View
          testID={`item-${index}`}
          style={[
            styles.item,
            index === 0 && styles.itemFirst,
            isSelected && styles.itemSelected,
          ]}
        >
          <View style={styles.itemContent}>
            <Text style={[styles.itemLabel, isSelected && styles.itemLabelSelected]}>
              {item.label}
            </Text>
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
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <Modal
      transparent
      animationType="fade"
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Backdrop — absolutely positioned behind the panel */}
        <TouchableOpacity
          testID="palette-backdrop"
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={handleBackdropPress}
        />
        {/* Panel — rendered on top of backdrop; touches here do not bubble */}
        <View style={styles.panel}>
          <View style={styles.searchRow}>
            <Text style={styles.searchIcon}>⌘</Text>
            <TextInput
              style={styles.searchInput}
              value={query}
              onChangeText={handleQueryChange}
              placeholder={placeholder}
              placeholderTextColor="#475569"
              autoFocus
              autoCorrect={false}
              autoCapitalize="none"
              returnKeyType="done"
              onSubmitEditing={handleSubmit}
              onKeyPress={handleKeyPress}
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
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
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
  itemSelected: {
    backgroundColor: '#2563EB',
  },
  itemContent: {
    flex: 1,
  },
  itemLabel: {
    color: '#E2E8F0',
    fontSize: 14,
  },
  itemLabelSelected: {
    color: '#FFFFFF',
    fontWeight: '600',
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
