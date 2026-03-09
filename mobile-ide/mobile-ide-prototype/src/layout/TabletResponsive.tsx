import React, { useCallback } from 'react';
import {
  View,
  StyleSheet,
  useWindowDimensions,
  TouchableOpacity,
  Text,
} from 'react-native';

const TABLET_BREAKPOINT = 768;

interface TabletResponsiveProps {
  fileExplorer: React.ReactNode;
  editor: React.ReactNode;
  terminal: React.ReactNode;
  onCommandPaletteOpen?: () => void;
}

/**
 * TabletResponsive layout:
 * - Tablet (≥768px wide): three-column split — File Explorer | Editor | Terminal
 * - Phone (<768px wide): single-column with collapsible bottom sheet for terminal
 */
export default function TabletResponsive({
  fileExplorer,
  editor,
  terminal,
  onCommandPaletteOpen,
}: TabletResponsiveProps) {
  const { width } = useWindowDimensions();
  const isTablet = width >= TABLET_BREAKPOINT;

  const renderToolbar = useCallback(
    () => (
      <View style={styles.toolbar}>
        <Text style={styles.toolbarBrand}>NomadCode</Text>
        <TouchableOpacity style={styles.toolbarBtn} onPress={onCommandPaletteOpen}>
          <Text style={styles.toolbarBtnText}>⌘ Commands</Text>
        </TouchableOpacity>
      </View>
    ),
    [onCommandPaletteOpen],
  );

  if (isTablet) {
    return (
      <View style={styles.container}>
        {renderToolbar()}
        <View style={styles.tabletLayout}>
          <View style={styles.sidebarPane}>{fileExplorer}</View>
          <View style={styles.editorPane}>{editor}</View>
          <View style={styles.terminalPane}>{terminal}</View>
        </View>
      </View>
    );
  }

  // Phone: editor fills screen, terminal below
  return (
    <View style={styles.container}>
      {renderToolbar()}
      <View style={styles.phoneLayout}>
        <View style={styles.phoneEditorPane}>{editor}</View>
        <View style={styles.phoneTerminalPane}>{terminal}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  toolbar: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    backgroundColor: '#1E293B',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  toolbarBrand: {
    color: '#E2E8F0',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  toolbarBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: '#0F172A',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#334155',
  },
  toolbarBtnText: {
    color: '#94A3B8',
    fontSize: 12,
  },

  // Tablet layout
  tabletLayout: {
    flex: 1,
    flexDirection: 'row',
  },
  sidebarPane: {
    width: 220,
    borderRightWidth: 1,
    borderRightColor: '#334155',
  },
  editorPane: {
    flex: 1,
    borderRightWidth: 1,
    borderRightColor: '#334155',
  },
  terminalPane: {
    width: 320,
  },

  // Phone layout
  phoneLayout: {
    flex: 1,
    flexDirection: 'column',
  },
  phoneEditorPane: {
    flex: 2,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  phoneTerminalPane: {
    flex: 1,
  },
});
