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
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { activateExtension, deactivateExtension } from '../extensions/sandbox';
import type { ExtensionManifest } from '../extensions/sandbox';
import useSettingsStore from '../stores/useSettingsStore';
import { THEMES, DARK_THEME_IDS, LIGHT_THEME_IDS, useTheme } from '../theme/tokens';
import type { ThemeId } from '../theme/tokens';

export interface SettingsScreenProps {
  visible: boolean;
  onClose: () => void;
}

type Mode = 'dark' | 'light';

export default function SettingsScreen({ visible, onClose }: SettingsScreenProps) {
  // Individual Zustand selectors — no full-store selector
  const theme = useSettingsStore((s) => s.theme);
  const fontSize = useSettingsStore((s) => s.fontSize);
  const setTheme = useSettingsStore((s) => s.setTheme);
  const setFontSize = useSettingsStore((s) => s.setFontSize);
  const installedExtensions = useSettingsStore((s) => s.installedExtensions);
  const addExtension = useSettingsStore((s) => s.addExtension);
  const removeExtension = useSettingsStore((s) => s.removeExtension);

  // Initialize selectedMode from the active theme (fix I-1: desync with active theme)
  const [selectedMode, setSelectedMode] = useState<Mode>(() => THEMES[theme].mode);

  const [extName, setExtName] = useState('');
  const [extSource, setExtSource] = useState('');

  // Active theme tokens for theming the UI
  const tokens = useTheme();

  // Derived swatch list based on selected mode
  const swatchIds = useMemo<ThemeId[]>(
    () => (selectedMode === 'dark' ? DARK_THEME_IDS : LIGHT_THEME_IDS),
    [selectedMode],
  );

  // Handlers
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

  const handleInstall = useCallback(() => {
    if (!extName.trim() || !extSource.trim()) return;
    const manifest: ExtensionManifest = {
      id: `user.${extName.toLowerCase().replace(/\s+/g, '-')}.${Date.now()}`,
      name: extName.trim(),
      version: '1.0.0',
      source: extSource.trim(),
    };
    activateExtension(manifest);
    addExtension(manifest);
    setExtName('');
    setExtSource('');
  }, [extName, extSource, addExtension]);

  const handleDeactivate = useCallback((id: string) => {
    deactivateExtension(id);
    removeExtension(id);
  }, [removeExtension]);

  const installEnabled = extName.trim().length > 0 && extSource.trim().length > 0;

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

  const dynamicExtVersion = useMemo(
    () => ({ color: tokens.textMuted }),
    [tokens.textMuted],
  );

  // Memoize derived booleans (fix M-3)
  const darkModeActive = useMemo(() => selectedMode === 'dark', [selectedMode]);
  const lightModeActive = useMemo(() => selectedMode === 'light', [selectedMode]);

  if (!visible) return null;

  return (
    <Modal visible={true} animationType="slide" transparent={false} onRequestClose={onClose}>
      <View testID="settings-screen" style={[styles.container, dynamicContainer]}>

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <View style={[styles.header, dynamicHeader]}>
          <Text style={[styles.headerTitle, dynamicTitle]}>Settings</Text>
          <TouchableOpacity
            testID="btn-close"
            onPress={onClose}
            style={styles.closeBtn}
            accessibilityLabel="Close settings"
            accessibilityRole="button"
          >
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
              <TouchableOpacity
                testID="settings-font-dec"
                onPress={handleFontDec}
                style={styles.fontButton}
                accessibilityLabel="Decrease font size"
                accessibilityRole="button"
              >
                <Text style={[styles.fontBtnText, dynamicFontBtn]}>A-</Text>
              </TouchableOpacity>
              <Text style={[styles.fontValue, dynamicFontValue]}>{fontSize}</Text>
              <TouchableOpacity
                testID="settings-font-inc"
                onPress={handleFontInc}
                style={styles.fontButton}
                accessibilityLabel="Increase font size"
                accessibilityRole="button"
              >
                <Text style={[styles.fontBtnText, dynamicFontBtn]}>A+</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* ── Section: Extensions ─────────────────────────────────────── */}
          <Text style={[styles.sectionLabel, dynamicSectionLabel]}>EXTENSIONS</Text>

          {installedExtensions.map((ext) => (
            <View
              key={ext.id}
              style={[styles.editorRow, { backgroundColor: tokens.bgElevated, borderColor: tokens.border }]}
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.editorRowLabel, { color: tokens.text }]}>{ext.name}</Text>
                <Text style={[styles.extVersion, dynamicExtVersion]}>v{ext.version}</Text>
              </View>
              <TouchableOpacity
                testID={`ext-deactivate-${ext.id}`}
                onPress={() => handleDeactivate(ext.id)}
                style={styles.fontButton}
                accessibilityLabel={`Deactivate ${ext.name}`}
                accessibilityRole="button"
              >
                <Text style={[styles.removeText, { color: tokens.error }]}>
                  Remove
                </Text>
              </TouchableOpacity>
            </View>
          ))}

          <TextInput
            testID="ext-name-input"
            placeholder="Extension name"
            placeholderTextColor={tokens.textMuted}
            value={extName}
            onChangeText={setExtName}
            style={[styles.extInput, { color: tokens.text, borderColor: tokens.border, backgroundColor: tokens.bgElevated }]}
          />
          <TextInput
            testID="ext-source-input"
            placeholder="Paste extension source (JavaScript)"
            placeholderTextColor={tokens.textMuted}
            value={extSource}
            onChangeText={setExtSource}
            multiline
            numberOfLines={4}
            style={[styles.extInput, styles.extSourceInput, { color: tokens.text, borderColor: tokens.border, backgroundColor: tokens.bgElevated }]}
          />
          <TouchableOpacity
            testID="ext-install-btn"
            onPress={handleInstall}
            disabled={!installEnabled}
            accessibilityState={{ disabled: !installEnabled }}
            accessibilityRole="button"
            style={[
              styles.extInstallBtn,
              { backgroundColor: installEnabled ? tokens.accent : tokens.bgElevated, borderColor: tokens.border },
            ]}
          >
            <Text style={{ color: installEnabled ? '#FFFFFF' : tokens.textMuted, fontWeight: '600', fontSize: 15 }}>
              Install
            </Text>
          </TouchableOpacity>

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
  extInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    marginBottom: 8,
  },
  extSourceInput: {
    height: 100,
    textAlignVertical: 'top',
    fontFamily: 'monospace',
  },
  extInstallBtn: {
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 8,
  },
  extVersion: {
    fontSize: 12,
  },
  removeText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
