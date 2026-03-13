/**
 * SettingsScreen — full-screen modal for in-app settings
 *
 * Sections:
 *   Appearance : mode segmented control (Dark / Light) + theme swatch grid
 *   Editor     : font-size row (A- / value / A+)
 *
 * Changes apply immediately via the Zustand settings store.
 * No Save button required — live preview.
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import useSettingsStore from '../stores/useSettingsStore';
import { THEMES, DARK_THEME_IDS, LIGHT_THEME_IDS, useTheme } from '../theme/tokens';
import type { ThemeId } from '../theme/tokens';

export interface SettingsScreenProps {
  visible: boolean;
  onClose: () => void;
}

type Mode = 'dark' | 'light';

export default function SettingsScreen({ visible, onClose }: SettingsScreenProps) {
  const [selectedMode, setSelectedMode] = useState<Mode>('dark');

  // Individual Zustand selectors — no full-store selector
  const theme = useSettingsStore((s) => s.theme);
  const fontSize = useSettingsStore((s) => s.fontSize);
  const setTheme = useSettingsStore((s) => s.setTheme);
  const setFontSize = useSettingsStore((s) => s.setFontSize);

  // Active theme tokens for theming the UI
  const tokens = useTheme();

  // Derived swatch list based on selected mode
  const swatchIds = useMemo<ThemeId[]>(
    () => (selectedMode === 'dark' ? DARK_THEME_IDS : LIGHT_THEME_IDS),
    [selectedMode],
  );

  // Handlers — all in useCallback per quality standards
  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  const handleModeDark = useCallback(() => {
    setSelectedMode('dark');
  }, []);

  const handleModeLight = useCallback(() => {
    setSelectedMode('light');
  }, []);

  const handleSwatchPress = useCallback(
    (id: ThemeId) => {
      setTheme(id);
    },
    [setTheme],
  );

  const handleFontInc = useCallback(() => {
    setFontSize(fontSize + 1);
  }, [setFontSize, fontSize]);

  const handleFontDec = useCallback(() => {
    setFontSize(fontSize - 1);
  }, [setFontSize, fontSize]);

  // Dynamic styles derived from theme tokens
  const dynamicContainer = useMemo(
    () => ({ backgroundColor: tokens.bg }),
    [tokens.bg],
  );

  const dynamicHeader = useMemo(
    () => ({ borderBottomColor: tokens.border }),
    [tokens.border],
  );

  const dynamicTitle = useMemo(
    () => ({ color: tokens.text }),
    [tokens.text],
  );

  const dynamicSectionLabel = useMemo(
    () => ({ color: tokens.textMuted }),
    [tokens.textMuted],
  );

  const dynamicFontValue = useMemo(
    () => ({ color: tokens.text }),
    [tokens.text],
  );

  const dynamicFontBtn = useMemo(
    () => ({ color: tokens.accent }),
    [tokens.accent],
  );

  const darkModeActive = selectedMode === 'dark';
  const lightModeActive = selectedMode === 'light';

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent={false}>
      <View testID="settings-screen" style={[styles.container, dynamicContainer]}>

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <View style={[styles.header, dynamicHeader]}>
          <Text style={[styles.headerTitle, dynamicTitle]}>Settings</Text>
          <TouchableOpacity testID="btn-close" onPress={handleClose} style={styles.closeBtn}>
            <Text style={[styles.closeBtnText, { color: tokens.textMuted }]}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent}>

          {/* ── Section: Appearance ─────────────────────────────────────── */}
          <Text style={[styles.sectionLabel, dynamicSectionLabel]}>APPEARANCE</Text>

          {/* Mode toggle */}
          <View style={styles.modeRow}>
            <TouchableOpacity
              testID="settings-mode-dark"
              style={[
                styles.modeBtn,
                { backgroundColor: tokens.bgElevated, borderColor: tokens.border },
                darkModeActive && { borderColor: tokens.accent },
              ]}
              onPress={handleModeDark}
            >
              <Text style={[styles.modeBtnText, { color: darkModeActive ? tokens.accent : tokens.textMuted }]}>
                Dark
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              testID="settings-mode-light"
              style={[
                styles.modeBtn,
                { backgroundColor: tokens.bgElevated, borderColor: tokens.border },
                lightModeActive && { borderColor: tokens.accent },
              ]}
              onPress={handleModeLight}
            >
              <Text style={[styles.modeBtnText, { color: lightModeActive ? tokens.accent : tokens.textMuted }]}>
                Light
              </Text>
            </TouchableOpacity>
          </View>

          {/* Theme swatches */}
          {swatchIds.map((id) => {
            const t = THEMES[id];
            const isActive = theme === id;
            return (
              <TouchableOpacity
                key={id}
                testID={`settings-swatch-${id}`}
                style={[
                  styles.swatch,
                  { backgroundColor: t.bg, borderColor: t.border },
                  isActive && { borderColor: t.accent, borderWidth: 2 },
                ]}
                onPress={() => handleSwatchPress(id)}
              >
                <Text style={[styles.swatchName, { color: t.text }]}>{t.name}</Text>
                <View style={styles.chipRow}>
                  {[t.bg, t.text, t.accent, t.keyword].map((c, i) => (
                    <View key={`${id}-chip-${i}`} style={[styles.chip, { backgroundColor: c }]} />
                  ))}
                </View>
              </TouchableOpacity>
            );
          })}

          {/* ── Section: Editor ─────────────────────────────────────────── */}
          <Text style={[styles.sectionLabel, dynamicSectionLabel]}>EDITOR</Text>

          <View style={[styles.editorRow, { backgroundColor: tokens.bgElevated, borderColor: tokens.border }]}>
            <Text style={[styles.editorRowLabel, { color: tokens.text }]}>Font Size</Text>
            <View style={styles.fontControls}>
              <TouchableOpacity testID="settings-font-dec" onPress={handleFontDec} style={styles.fontButton}>
                <Text style={[styles.fontBtnText, dynamicFontBtn]}>A-</Text>
              </TouchableOpacity>
              <Text style={[styles.fontValue, dynamicFontValue]}>{fontSize}</Text>
              <TouchableOpacity testID="settings-font-inc" onPress={handleFontInc} style={styles.fontButton}>
                <Text style={[styles.fontBtnText, dynamicFontBtn]}>A+</Text>
              </TouchableOpacity>
            </View>
          </View>

        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  closeBtn: {
    padding: 8,
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    fontSize: 18,
    fontWeight: '600',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    marginTop: 24,
    marginBottom: 12,
  },
  modeRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  modeBtn: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  modeBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  swatch: {
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
  },
  swatchName: {
    fontWeight: '600',
    fontSize: 14,
    marginBottom: 6,
  },
  chipRow: {
    flexDirection: 'row',
    gap: 6,
  },
  chip: {
    width: 16,
    height: 16,
    borderRadius: 4,
  },
  editorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 8,
  },
  editorRowLabel: {
    fontSize: 15,
    fontWeight: '500',
  },
  fontControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  fontButton: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fontBtnText: {
    fontSize: 16,
    fontWeight: '700',
  },
  fontValue: {
    fontSize: 16,
    fontWeight: '600',
    minWidth: 30,
    textAlign: 'center',
  },
});
