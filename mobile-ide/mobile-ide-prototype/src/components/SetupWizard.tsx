/**
 * SetupWizard — first-run 3-step onboarding modal
 *
 * Step 1: theme mode (Dark/Light) + swatch picker
 * Step 2: font size adjustment (A- / value / A+)
 * Step 3: workspace folder selection
 *
 * Shown when hasCompletedSetup === false. Calls completeSetup() on finish.
 */

import React, { useState } from 'react';
import {
  Modal, View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput,
} from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as DocumentPicker from 'expo-document-picker';
import useSettingsStore from '../stores/useSettingsStore';
import { THEMES, DARK_THEME_IDS, LIGHT_THEME_IDS, ThemeId } from '../theme/tokens';

interface SetupWizardProps {
  visible: boolean;
}

type Mode = 'dark' | 'light';

export default function SetupWizard({ visible }: SetupWizardProps) {
  const [step, setStep] = useState(1);
  const [selectedMode, setSelectedMode] = useState<Mode>('dark');

  const theme = useSettingsStore((s) => s.theme);
  const fontSize = useSettingsStore((s) => s.fontSize);
  const workspacePath = useSettingsStore((s) => s.workspacePath);
  const setTheme = useSettingsStore((s) => s.setTheme);
  const setFontSize = useSettingsStore((s) => s.setFontSize);
  const setWorkspacePath = useSettingsStore((s) => s.setWorkspacePath);
  const completeSetup = useSettingsStore((s) => s.completeSetup);

  if (!visible) return null;

  const handleBrowse = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'public.folder',
        copyToCacheDirectory: false,
      });
      if (!result.canceled && result.assets?.[0]?.uri) {
        setWorkspacePath(result.assets[0].uri);
      }
    } catch (_) {
      // ignore picker errors
    }
  };

  const swatchIds = selectedMode === 'dark' ? DARK_THEME_IDS : LIGHT_THEME_IDS;

  function handleModePress(mode: Mode) {
    setSelectedMode(mode);
    const defaultId: ThemeId = mode === 'dark' ? 'nomad-dark' : 'nomad-light';
    setTheme(defaultId);
  }

  function handleGetStarted() {
    setWorkspacePath(workspacePath || FileSystem.documentDirectory || '');
    completeSetup();
  }

  return (
    <Modal visible={visible} animationType="slide">
      <View testID="setup-wizard" style={styles.container}>
        {/* Progress */}
        <Text style={styles.progress}>{step} / 3</Text>

        {/* ── Step 1: Theme ─────────────────────────────────────────────── */}
        {step === 1 && (
          <ScrollView>
            <Text style={styles.title}>Choose your theme</Text>
            <View style={styles.modeRow}>
              <TouchableOpacity
                testID="mode-dark"
                style={[styles.modeBtn, selectedMode === 'dark' && styles.modeBtnActive]}
                onPress={() => handleModePress('dark')}
              >
                <Text style={styles.modeBtnText}>Dark</Text>
              </TouchableOpacity>
              <TouchableOpacity
                testID="mode-light"
                style={[styles.modeBtn, selectedMode === 'light' && styles.modeBtnActive]}
                onPress={() => handleModePress('light')}
              >
                <Text style={styles.modeBtnText}>Light</Text>
              </TouchableOpacity>
            </View>
            {swatchIds.map((id) => {
              const t = THEMES[id];
              return (
                <TouchableOpacity
                  key={id}
                  testID={`swatch-${id}`}
                  style={[
                    styles.swatch,
                    { backgroundColor: t.bg },
                    theme === id && styles.swatchActive,
                  ]}
                  onPress={() => setTheme(id)}
                >
                  <Text style={[styles.swatchName, { color: t.text }]}>{t.name}</Text>
                  <View style={styles.chipRow}>
                    {([t.bg, t.text, t.accent, t.keyword] as string[]).map((c, i) => (
                      <View key={i} style={[styles.chip, { backgroundColor: c }]} />
                    ))}
                  </View>
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity testID="btn-next" style={styles.btn} onPress={() => setStep(2)}>
              <Text style={styles.btnText}>Next</Text>
            </TouchableOpacity>
          </ScrollView>
        )}

        {/* ── Step 2: Font Size ─────────────────────────────────────────── */}
        {step === 2 && (
          <View>
            <Text style={styles.title}>Choose font size</Text>
            <Text style={[styles.preview, { fontSize }]}>{'const hello = "world";'}</Text>
            <View style={styles.fontRow}>
              <TouchableOpacity testID="btn-font-dec" onPress={() => setFontSize(fontSize - 1)}>
                <Text style={styles.fontBtn}>A-</Text>
              </TouchableOpacity>
              <Text style={styles.fontValue}>{fontSize}</Text>
              <TouchableOpacity testID="btn-font-inc" onPress={() => setFontSize(fontSize + 1)}>
                <Text style={styles.fontBtn}>A+</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity testID="btn-font-reset" onPress={() => setFontSize(14)}>
              <Text style={styles.resetLink}>Reset to default</Text>
            </TouchableOpacity>
            <View style={styles.navRow}>
              <TouchableOpacity testID="btn-back" onPress={() => setStep(1)}>
                <Text style={styles.backBtn}>Back</Text>
              </TouchableOpacity>
              <TouchableOpacity testID="btn-next" style={styles.btn} onPress={() => setStep(3)}>
                <Text style={styles.btnText}>Next</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ── Step 3: Workspace ─────────────────────────────────────────── */}
        {step === 3 && (
          <View>
            <Text style={styles.title}>Set workspace folder</Text>
            <Text style={styles.hint}>You can change this later in Settings.</Text>
            <TextInput
              testID="workspace-input"
              style={styles.workspaceInput}
              value={workspacePath || FileSystem.documentDirectory || ''}
              onChangeText={setWorkspacePath}
              placeholder="Workspace path"
              placeholderTextColor="#64748B"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity
              testID="btn-browse"
              style={styles.btn}
              onPress={handleBrowse}
            >
              <Text style={styles.btnText}>Browse</Text>
            </TouchableOpacity>
            <View style={styles.navRow}>
              <TouchableOpacity testID="btn-back" onPress={() => setStep(2)}>
                <Text style={styles.backBtn}>Back</Text>
              </TouchableOpacity>
              <TouchableOpacity testID="btn-skip" onPress={handleGetStarted}>
                <Text style={styles.skipBtn}>Skip for now</Text>
              </TouchableOpacity>
              <TouchableOpacity testID="btn-get-started" style={styles.btn} onPress={handleGetStarted}>
                <Text style={styles.btnText}>Get Started</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, padding: 24, backgroundColor: '#0F172A' },
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
