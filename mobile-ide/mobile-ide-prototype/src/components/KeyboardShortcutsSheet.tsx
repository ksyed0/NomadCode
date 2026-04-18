import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  useWindowDimensions,
  Dimensions,
} from 'react-native';
import { useTheme } from '../theme/tokens';
import type { ShortcutDefinition } from '../hooks/useKeyboardShortcuts';

interface Props {
  visible: boolean;
  shortcuts: ShortcutDefinition[];
  onClose: () => void;
}

function formatShortcut(s: ShortcutDefinition): string {
  const modMap: Record<string, string> = { cmd: '⌘', shift: '⇧', alt: '⌥', ctrl: '⌃' };
  return s.modifiers.map((m) => modMap[m]!).join('') + s.key.toUpperCase();
}

export function KeyboardShortcutsSheet({ visible, shortcuts, onClose }: Props) {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;

  if (!visible) return null;

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
      <View style={[styles.backdrop, { justifyContent: isTablet ? 'center' : 'flex-end' }]}>
        <View
          style={[
            styles.sheet,
            isTablet ? styles.centered : styles.bottom,
            { backgroundColor: theme.bgElevated, borderColor: theme.border },
          ]}
        >
          <View style={styles.header}>
            <Text style={[styles.title, { color: theme.text }]}>Keyboard Shortcuts</Text>
            <TouchableOpacity
              onPress={onClose}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityLabel="Close keyboard shortcuts"
            >
              <Text style={{ color: theme.textMuted, fontSize: 16 }}>✕</Text>
            </TouchableOpacity>
          </View>
          <FlatList
            data={shortcuts}
            keyExtractor={(s) => `${s.key}-${s.modifiers.join('-')}-${s.label}`}
            renderItem={({ item }) => (
              <View style={styles.row}>
                <Text style={[styles.label, { color: theme.text }]}>{item.label}</Text>
                <Text style={[styles.combo, { color: theme.accent }]}>{formatShortcut(item)}</Text>
              </View>
            )}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    borderRadius: 12,
    borderWidth: 1,
    maxHeight: Dimensions.get('window').height * 0.7,
    paddingBottom: 24,
  },
  centered: {
    alignSelf: 'center',
    width: 480,
    marginBottom: 0,
  },
  bottom: {
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  label: {
    fontSize: 14,
  },
  combo: {
    fontSize: 14,
    fontFamily: 'monospace',
    fontWeight: '600',
  },
});
