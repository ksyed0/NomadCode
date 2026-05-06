import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Keyboard,
  Platform,
} from 'react-native';

import { useTheme } from '../theme/tokens';
import type { SymbolEntry } from '../codeNav/symbolIndexer';

export interface Command {
  id: string;
  label: string;
  description?: string;
  action: () => void;
  shortcut?: string;
}

interface CommandPaletteProps {
  /** Whether the palette is visible */
  visible?: boolean;
  /** Alias for visible — use isOpen or visible (both supported) */
  isOpen?: boolean;
  commands: Command[];
  /** Dismiss without selecting (back button, backdrop tap) */
  onClose: () => void;
  /** Select a command — parent is responsible for also calling onClose */
  onSelect: (command: Command) => void;
  placeholder?: string;
  /** Mode: 'commands' (default) or 'symbolSearch' */
  mode?: 'commands' | 'symbolSearch';
  /** Symbol index for symbolSearch mode */
  symbolIndex?: SymbolEntry[];
  /** Called when a symbol is selected; parent should also call onClose */
  onNavigateSymbol?: (filePath: string, line: number) => void;
}

export function CommandPalette(props: CommandPaletteProps) {
  const {
    visible,
    isOpen,
    commands,
    onClose,
    onSelect,
    placeholder,
    mode = 'commands',
    symbolIndex = [],
    onNavigateSymbol,
  } = props;
  const isVisible = visible ?? isOpen ?? false;
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

  // Clamp selectedIndex at render time to avoid out-of-bounds access when the list shrinks
  const clampedIndex = Math.min(selectedIndex, Math.max(filtered.length - 1, 0));

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
    if (filtered[clampedIndex]) {
      handleSelect(filtered[clampedIndex]);
    }
  }, [filtered, clampedIndex, handleSelect]);

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

  const filteredSymbols = useMemo(() => {
    if (mode !== 'symbolSearch') return symbolIndex;
    if (!query) return symbolIndex;
    const q = query.toLowerCase();
    return symbolIndex
      .filter(s => s.word.toLowerCase().includes(q))
      .sort((a, b) => {
        const aw = a.word.toLowerCase();
        const bw = b.word.toLowerCase();
        const aScore = aw === q ? 2 : aw.startsWith(q) ? 1 : 0;
        const bScore = bw === q ? 2 : bw.startsWith(q) ? 1 : 0;
        return bScore - aScore;
      })
      .slice(0, 50);
  }, [mode, query, symbolIndex]);

  const KIND_ABBR: Record<SymbolEntry['kind'], string> = {
    function:  'fn',
    class:     'cls',
    const:     'const',
    interface: 'iface',
    type:      'type',
  };

  const styles = useMemo(() => StyleSheet.create({
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
    modeLabel: { fontSize: 11, paddingHorizontal: 16, paddingBottom: 4, fontStyle: 'italic' },
    kindBadge: {
      fontSize: 10,
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
      width: 42,
      marginRight: 8,
    },
    label: { fontSize: 14 },
    desc:  { fontSize: 12, marginTop: 2 },
  }), [t]);

  const renderItem = useCallback(({ item, index }: { item: Command; index: number }) => {
    const isSelected = index === clampedIndex;
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
  }, [clampedIndex, handleSelect, styles]);

  return (
    <Modal
      transparent
      animationType="fade"
      visible={isVisible}
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
              placeholder={mode === 'symbolSearch' ? 'Type a symbol name…' : (placeholder ?? 'Search commands…')}
              placeholderTextColor={t.textMuted}
              autoFocus
              autoCorrect={false}
              autoCapitalize="none"
              returnKeyType="done"
              onSubmitEditing={handleSubmit}
              onKeyPress={handleKeyPress}
            />
          </View>
          {mode === 'symbolSearch' && (
            <Text style={[styles.modeLabel, { color: t.textMuted }]}>Go to Symbol in Workspace</Text>
          )}
          {mode === 'symbolSearch' ? (
            <FlatList
              data={filteredSymbols}
              keyExtractor={(item, i) => `${item.filePath}:${item.line}:${i}`}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.item}
                  onPress={() => { onNavigateSymbol?.(item.filePath, item.line); onClose(); }}
                  accessibilityRole="button"
                >
                  <Text style={[styles.kindBadge, { color: t.accent }]}>
                    {KIND_ABBR[item.kind]}
                  </Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.label, { color: t.text }]}>{item.word}</Text>
                    <Text style={[styles.desc, { color: t.textMuted }]} numberOfLines={1}>
                      {item.filePath.split('/').slice(-2).join('/')} :{item.line}
                    </Text>
                  </View>
                </TouchableOpacity>
              )}
              keyboardShouldPersistTaps="always"
              style={styles.list}
              ListEmptyComponent={
                <Text style={styles.empty}>No symbols found</Text>
              }
            />
          ) : (
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
          )}
        </TouchableOpacity>
      </View>
    </Modal>
  );
}
