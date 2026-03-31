/**
 * SetupWizard — first-run 3-step onboarding modal
 *
 * Step 1: theme mode (Dark/Light) + swatch picker
 * Step 2: font size adjustment (A- / value / A+)
 * Step 3: workspace folder selection
 *
 * Shown when hasCompletedSetup === false. Calls completeSetup() on finish.
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  Modal, Platform, View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput,
} from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as DocumentPicker from 'expo-document-picker';
import useSettingsStore from '../stores/useSettingsStore';
import { THEMES, DARK_THEME_IDS, LIGHT_THEME_IDS, ThemeId, useTheme } from '../theme/tokens';

interface SetupWizardProps {
  visible: boolean;
}

type Mode = 'dark' | 'light';

export default function SetupWizard({ visible }: SetupWizardProps) {
  const [step, setStep] = useState(1);
  const [selectedMode, setSelectedMode] = useState<Mode>('dark');

  const t = useTheme();
  const theme = useSettingsStore((s) => s.theme);
  const fontSize = useSettingsStore((s) => s.fontSize);
  const workspacePath = useSettingsStore((s) => s.workspacePath);
  const setTheme = useSettingsStore((s) => s.setTheme);
  const setFontSize = useSettingsStore((s) => s.setFontSize);
  const setWorkspacePath = useSettingsStore((s) => s.setWorkspacePath);
  const completeSetup = useSettingsStore((s) => s.completeSetup);

  const swatchIds = useMemo(
    () => (selectedMode === 'dark' ? DARK_THEME_IDS : LIGHT_THEME_IDS),
    [selectedMode],
  );

  const handleModePress = useCallback((mode: Mode) => {
    setSelectedMode(mode);
    const defaultId: ThemeId = mode === 'dark' ? 'nomad-dark' : 'nomad-light';
    setTheme(defaultId);
  }, [setTheme]);

  const handleBrowse = useCallback(async () => {
    try {
      if (Platform.OS === 'android') {
        // Android SAF directory picker — DocumentPicker doesn't support
        // folder selection on Android (public.folder is an iOS-only UTI).
        const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
        if (!permissions.granted) return;
        setWorkspacePath(permissions.directoryUri);
      } else {
        const result = await DocumentPicker.getDocumentAsync({
          type: 'public.folder',
          copyToCacheDirectory: false,
        });
        if (!result.canceled && result.assets?.[0]?.uri) {
          setWorkspacePath(result.assets[0].uri);
        }
      }
    } catch (e) {
      if (__DEV__) console.warn('[SetupWizard] browse error:', e);
    }
  }, [setWorkspacePath]);

  const handleGetStarted = useCallback(() => {
    setWorkspacePath(workspacePath || FileSystem.documentDirectory || '');
    completeSetup();
  }, [workspacePath, setWorkspacePath, completeSetup]);

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide">
      <View testID="setup-wizard" style={[styles.container, { backgroundColor: t.bg }]}>
        {/* Progress */}
        <Text style={[styles.progress, { color: t.textMuted }]}>{step} / 3</Text>

        {/* ── Step 1: Theme ─────────────────────────────────────────────── */}
        {step === 1 && (
          <ScrollView style={styles.scrollFlex} contentContainerStyle={styles.scrollContent}>
            <Text style={[styles.title, { color: t.text }]}>Choose your theme</Text>
            <View style={styles.modeRow}>
              <TouchableOpacity
                testID="mode-dark"
                style={[styles.modeBtn, { backgroundColor: t.bgElevated }, selectedMode === 'dark' && [styles.modeBtnActive, { borderColor: t.accent }]]}
                onPress={() => handleModePress('dark')}
              >
                <Text style={[styles.modeBtnText, { color: t.text }]}>Dark</Text>
              </TouchableOpacity>
              <TouchableOpacity
                testID="mode-light"
                style={[styles.modeBtn, { backgroundColor: t.bgElevated }, selectedMode === 'light' && [styles.modeBtnActive, { borderColor: t.accent }]]}
                onPress={() => handleModePress('light')}
              >
                <Text style={[styles.modeBtnText, { color: t.text }]}>Light</Text>
              </TouchableOpacity>
            </View>
            {swatchIds.map((id) => {
              const st = THEMES[id];
              return (
                <TouchableOpacity
                  key={id}
                  testID={`swatch-${id}`}
                  style={[
                    styles.swatch,
                    { backgroundColor: st.bg },
                    theme === id && [styles.swatchActive, { borderColor: t.accent }],
                  ]}
                  onPress={() => setTheme(id)}
                >
                  <Text style={[styles.swatchName, { color: st.text }]}>{st.name}</Text>
                  <View style={styles.chipRow}>
                    {[st.bg, st.text, st.accent, st.keyword].map((c) => (
                      <View key={c} style={[styles.chip, { backgroundColor: c }]} />
                    ))}
                  </View>
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity testID="btn-next" style={[styles.btn, { backgroundColor: t.accent }]} onPress={() => setStep(2)}>
              <Text style={styles.btnText}>Next</Text>
            </TouchableOpacity>
          </ScrollView>
        )}

        {/* ── Step 2: Font Size ─────────────────────────────────────────── */}
        {step === 2 && (
          <ScrollView style={styles.scrollFlex} contentContainerStyle={styles.scrollContent}>
            <Text style={[styles.title, { color: t.text }]}>Choose font size</Text>
            <Text style={[styles.preview, { fontSize, color: t.text }]}>{'const hello = "world";'}</Text>
            <View style={styles.fontRow}>
              <TouchableOpacity testID="btn-font-dec" onPress={() => setFontSize(fontSize - 1)}>
                <Text style={[styles.fontBtn, { color: t.text }]}>A-</Text>
              </TouchableOpacity>
              <Text style={[styles.fontValue, { color: t.text }]}>{fontSize}</Text>
              <TouchableOpacity testID="btn-font-inc" onPress={() => setFontSize(fontSize + 1)}>
                <Text style={[styles.fontBtn, { color: t.text }]}>A+</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity testID="btn-font-reset" onPress={() => setFontSize(14)}>
              <Text style={[styles.resetLink, { color: t.textMuted }]}>Reset to default</Text>
            </TouchableOpacity>
            <View style={styles.navRow}>
              <TouchableOpacity testID="btn-back" onPress={() => setStep(1)}>
                <Text style={[styles.backBtn, { color: t.textMuted }]}>Back</Text>
              </TouchableOpacity>
              <TouchableOpacity testID="btn-next" style={[styles.btn, { backgroundColor: t.accent }]} onPress={() => setStep(3)}>
                <Text style={styles.btnText}>Next</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        )}

        {/* ── Step 3: Workspace ─────────────────────────────────────────── */}
        {step === 3 && (
          <ScrollView style={styles.scrollFlex} contentContainerStyle={styles.scrollContent}>
            <Text style={[styles.title, { color: t.text }]}>Set workspace folder</Text>
            <Text style={[styles.hint, { color: t.textMuted }]}>You can change this later in Settings.</Text>
            <TextInput
              testID="workspace-input"
              style={[styles.workspaceInput, { backgroundColor: t.bgElevated, color: t.text, borderColor: t.border }]}
              value={workspacePath || FileSystem.documentDirectory || ''}
              onChangeText={setWorkspacePath}
              placeholder="Workspace path"
              placeholderTextColor={t.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity
              testID="btn-browse"
              style={[styles.btn, { backgroundColor: t.accent }]}
              onPress={handleBrowse}
            >
              <Text style={styles.btnText}>Browse</Text>
            </TouchableOpacity>
            <View style={styles.navRow}>
              <TouchableOpacity testID="btn-back" onPress={() => setStep(2)}>
                <Text style={[styles.backBtn, { color: t.textMuted }]}>Back</Text>
              </TouchableOpacity>
              <TouchableOpacity testID="btn-skip" onPress={handleGetStarted}>
                <Text style={[styles.skipBtn, { color: t.textMuted }]}>Skip for now</Text>
              </TouchableOpacity>
              <TouchableOpacity testID="btn-get-started" style={[styles.btn, { backgroundColor: t.accent }]} onPress={handleGetStarted}>
                <Text style={styles.btnText}>Get Started</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, padding: 24, backgroundColor: '#0F172A' },
  // flex: 1 constrains the ScrollView to the available space so it scrolls
  // rather than overflowing. contentContainerStyle adds bottom clearance so
  // the last button is never clipped on small or unusual-aspect screens.
  scrollFlex:    { flex: 1 },
  scrollContent: { paddingBottom: 24 },
  progress:     { color: '#64748B', fontSize: 13, textAlign: 'right', marginBottom: 8 },
  title:        { color: '#E2E8F0', fontSize: 22, fontWeight: '700', marginBottom: 16 },
  modeRow:      { flexDirection: 'row', gap: 12, marginBottom: 16 },
  modeBtn:      { flex: 1, padding: 14, borderRadius: 8, backgroundColor: '#1E293B', alignItems: 'center' },
  modeBtnActive: { borderWidth: 2, borderColor: '#2563EB' },
  modeBtnText:  { color: '#E2E8F0', fontWeight: '600' },
  swatch:       { borderRadius: 8, padding: 12, marginBottom: 8 },
  swatchActive: { borderWidth: 2, borderColor: '#2563EB' },
  swatchName:   { fontWeight: '600', marginBottom: 6 },
  chipRow:      { flexDirection: 'row', gap: 6 },
  chip:         { width: 16, height: 16, borderRadius: 4 },
  btn:          { backgroundColor: '#2563EB', padding: 14, borderRadius: 8, alignItems: 'center', marginTop: 16 },
  btnText:      { color: '#FFFFFF', fontWeight: '700' },
  preview:      { color: '#E2E8F0', fontFamily: 'monospace', marginVertical: 16 },
  fontRow:      { flexDirection: 'row', alignItems: 'center', gap: 24, justifyContent: 'center' },
  fontBtn:      { color: '#E2E8F0', fontSize: 20, fontWeight: '700', padding: 8 },
  fontValue:    { color: '#E2E8F0', fontSize: 18, minWidth: 30, textAlign: 'center' },
  resetLink:    { color: '#64748B', textAlign: 'center', marginTop: 12 },
  navRow:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 },
  backBtn:      { color: '#64748B', fontSize: 16 },
  skipBtn:      { color: '#64748B', fontSize: 16 },
  hint:         { color: '#64748B', marginBottom: 16 },
  workspaceInput: {
    backgroundColor: '#1E293B',
    color: '#E2E8F0',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    marginBottom: 10,
  },
});
