import React, { useCallback, useEffect, useMemo, useState } from 'react';
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

import { useTheme } from '../theme/tokens';

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
  const t = useTheme();
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

  // Clamp selectedIndex when the filtered list shrinks (e.g., commands prop changes)
  useEffect(() => {
    setSelectedIndex((i) => Math.min(i, Math.max(filtered.length - 1, 0)));
  }, [filtered.length]);

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

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.6)',
      alignItems: 'center',
      paddingTop: 80,
    },
    panel: {
      width: '90%',
      maxWidth: 600,
      backgroundColor: t.bgElevated,
      borderRadius: 8,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: t.border,
      maxHeight: 400,
    },
    searchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: t.border,
    },
    searchIcon: {
      color: t.textMuted,
      fontSize: 16,
      marginRight: 8,
    },
    searchInput: {
      flex: 1,
      color: t.text,
      fontSize: 15,
    },
    list: { flexGrow: 0 },
    item: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderTopWidth: 1,
      borderTopColor: t.bg,
    },
    itemFirst: { borderTopWidth: 0 },
    itemSelected: { backgroundColor: t.accent },
    itemContent: { flex: 1 },
    itemLabel: { color: t.text, fontSize: 14 },
    itemLabelSelected: { color: '#FFFFFF', fontWeight: '600' },
    itemDescription: { color: t.textMuted, fontSize: 12, marginTop: 2 },
    shortcutBadge: {
      backgroundColor: t.bg,
      borderRadius: 4,
      paddingHorizontal: 6,
      paddingVertical: 2,
      marginLeft: 8,
    },
    shortcutText: { color: t.textMuted, fontSize: 11, fontFamily: 'JetBrains Mono' },
    empty: { color: t.textMuted, textAlign: 'center', padding: 20, fontSize: 14 },
  });

  const renderItem = useCallback(({ item, index }: { item: Command; index: number }) => {
    const isSelected = index === selectedIndex;
    return (
      <TouchableOpacity
        onPress={() => handleSelect(item)}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={`${item.label}${item.shortcut ? ', shortcut ' + item.shortcut : ''}`}
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
  }, [selectedIndex, handleSelect, styles]);

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
          accessibilityLabel="Close command palette"
          accessibilityRole="button"
        />
        {/* Panel — TouchableOpacity absorbs panel touches so they do not reach the backdrop */}
        <TouchableOpacity
          style={styles.panel}
          activeOpacity={1}
          onPress={() => {}}
          accessible={false}
        >
          <View style={styles.searchRow}>
            <Text style={styles.searchIcon}>⌘</Text>
            <TextInput
              style={styles.searchInput}
              value={query}
              onChangeText={handleQueryChange}
              placeholder={placeholder}
              placeholderTextColor={t.textMuted}
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
        </TouchableOpacity>
      </View>
    </Modal>
  );
}
