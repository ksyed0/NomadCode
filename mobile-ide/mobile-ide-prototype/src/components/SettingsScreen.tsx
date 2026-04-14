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

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { activateExtension, deactivateExtension } from '../extensions/sandbox';
import type { ExtensionManifest } from '../extensions/sandbox';
import { requestWorkspacePermission } from '../utils/FileSystemBridge';

// Required once per file by expo-auth-session to complete any pending auth sessions.
WebBrowser.maybeCompleteAuthSession();
import useSettingsStore from '../stores/useSettingsStore';
import useAuthStore from '../stores/useAuthStore';
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
  const workspaceDisplayName = useSettingsStore((s) => s.workspaceDisplayName);
  const workspaceUri = useSettingsStore((s) => s.workspaceUri);
  const setWorkspaceRoot = useSettingsStore((s) => s.setWorkspaceRoot);
  const setTheme = useSettingsStore((s) => s.setTheme);
  const setFontSize = useSettingsStore((s) => s.setFontSize);
  const installedExtensions = useSettingsStore((s) => s.installedExtensions);
  const addExtension = useSettingsStore((s) => s.addExtension);
  const removeExtension = useSettingsStore((s) => s.removeExtension);

  // Auth store selectors
  const authToken = useAuthStore((s) => s.token);
  const authUsername = useAuthStore((s) => s.username);
  const authError = useAuthStore((s) => s.error);
  const authLoading = useAuthStore((s) => s.isLoading);
  const signInWithToken = useAuthStore((s) => s.signInWithToken);
  const signOut = useAuthStore((s) => s.signOut);
  const setError = useAuthStore((s) => s.setError);

  // OAuth hooks (expo-auth-session)
  // GitHub OAuth 2.0 is not OIDC-compliant and has no discovery document at
  // /.well-known/openid-configuration. useAutoDiscovery would always return null,
  // making useAuthRequest unable to build a request. Use manual endpoints instead.
  const discovery: AuthSession.DiscoveryDocument = {
    authorizationEndpoint: 'https://github.com/login/oauth/authorize',
    tokenEndpoint: 'https://github.com/login/oauth/access_token',
  };
  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: process.env.EXPO_PUBLIC_GITHUB_CLIENT_ID ?? '',
      scopes: ['repo', 'read:user'],
      redirectUri: AuthSession.makeRedirectUri({ scheme: 'nomadcode' }),
    },
    discovery,
  );

  // Handle OAuth response — exchange authorization code for access token
  useEffect(() => {
    if (response?.type === 'success' && response.params.code) {
      const exchangeCode = async () => {
        try {
          // NOTE: client_secret is read from EXPO_PUBLIC_GITHUB_CLIENT_SECRET, which is
          // bundled into the app binary at build time. Acceptable for development only.
          // Replace with a server-side proxy endpoint before any production release.
          const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
            method: 'POST',
            headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
            body: JSON.stringify({
              client_id: process.env.EXPO_PUBLIC_GITHUB_CLIENT_ID ?? '',
              client_secret: process.env.EXPO_PUBLIC_GITHUB_CLIENT_SECRET ?? '',
              code: response.params.code,
            }),
          });
          const data: unknown = await tokenRes.json();
          if (
            typeof data === 'object' &&
            data !== null &&
            'access_token' in data &&
            typeof (data as { access_token: unknown }).access_token === 'string'
          ) {
            await signInWithToken((data as { access_token: string }).access_token);
          } else {
            setError('GitHub did not return an access token. Check your OAuth app configuration.');
          }
        } catch {
          setError('Could not reach GitHub. Check your connection.');
        }
      };
      exchangeCode();
    }
  }, [response, signInWithToken, setError]);

  // Initialize selectedMode from the active theme (fix I-1: desync with active theme)
  const [selectedMode, setSelectedMode] = useState<Mode>(() => THEMES[theme].mode);

  const [extName, setExtName] = useState('');
  const [extSource, setExtSource] = useState('');
  const [showPat, setShowPat] = useState(false);
  const [patValue, setPatValue] = useState('');
  const [workspacePicking, setWorkspacePicking] = useState(false);

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

  const handlePatConnect = useCallback(() => {
    if (patValue.trim()) signInWithToken(patValue.trim());
  }, [patValue, signInWithToken]);

  const handleBrowse = useCallback(async () => {
    setWorkspacePicking(true);
    try {
      const root = await requestWorkspacePermission();
      if (root) setWorkspaceRoot(root);
    } finally {
      setWorkspacePicking(false);
    }
  }, [setWorkspaceRoot]);

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

          {/* ── Section: GitHub Account ──────────────────────────────────── */}
          <Text style={[styles.sectionLabel, dynamicSectionLabel]}>GITHUB ACCOUNT</Text>

          {authToken ? (
            /* Signed-in view */
            <View style={[styles.editorRow, { backgroundColor: tokens.bgElevated, borderColor: tokens.border }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.editorRowLabel, { color: tokens.text }]}>@{authUsername ?? 'GitHub User'}</Text>
                <Text style={{ color: tokens.textMuted, fontSize: 12 }}>Connected</Text>
              </View>
              <TouchableOpacity
                testID="btn-sign-out"
                onPress={signOut}
                style={styles.fontButton}
                accessibilityLabel="Sign out of GitHub"
                accessibilityRole="button"
              >
                <Text style={{ color: tokens.error, fontSize: 14, fontWeight: '600' }}>Sign out</Text>
              </TouchableOpacity>
            </View>
          ) : (
            /* Signed-out view */
            <View>
              <TouchableOpacity
                testID="btn-oauth-signin"
                style={[styles.extInstallBtn, { backgroundColor: tokens.accent, borderColor: tokens.accent }]}
                accessibilityRole="button"
                accessibilityLabel="Sign in with GitHub"
                onPress={() => { if (request) promptAsync(); }}
                disabled={authLoading}
                accessibilityState={{ disabled: authLoading }}
              >
                <Text style={{ color: '#FFFFFF', fontWeight: '600', fontSize: 15 }}>
                  {authLoading ? 'Connecting…' : 'Sign in with GitHub'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                testID="btn-pat-toggle"
                onPress={() => setShowPat((v) => !v)}
                accessibilityRole="button"
                accessibilityLabel="Toggle Personal Access Token input"
                style={{ marginBottom: 8, alignItems: 'center' }}
              >
                <Text style={{ color: tokens.textMuted, fontSize: 13 }}>
                  {showPat ? 'Hide token input' : 'Use a Personal Access Token instead'}
                </Text>
              </TouchableOpacity>

              {showPat && (
                <View>
                  <TextInput
                    testID="pat-input"
                    placeholder="ghp_xxxxxxxxxxxx"
                    placeholderTextColor={tokens.textMuted}
                    value={patValue}
                    onChangeText={setPatValue}
                    onSubmitEditing={() => { if (patValue.trim() && !authLoading) handlePatConnect(); }}
                    blurOnSubmit={false}
                    returnKeyType="go"
                    secureTextEntry
                    autoCapitalize="none"
                    autoCorrect={false}
                    style={[styles.extInput, { color: tokens.text, borderColor: tokens.border, backgroundColor: tokens.bgElevated }]}
                  />
                  <TouchableOpacity
                    testID="btn-pat-connect"
                    onPress={handlePatConnect}
                    disabled={!patValue.trim() || authLoading}
                    accessibilityRole="button"
                    accessibilityState={{ disabled: !patValue.trim() || authLoading }}
                    style={[styles.extInstallBtn, { backgroundColor: tokens.bgElevated, borderColor: tokens.border }]}
                  >
                    <Text style={{ color: tokens.text, fontWeight: '600', fontSize: 15 }}>Connect</Text>
                  </TouchableOpacity>
                </View>
              )}

              {authError ? (
                <Text style={{ color: tokens.error, fontSize: 13, marginBottom: 8 }}>{authError}</Text>
              ) : null}
            </View>
          )}

          {/* ── Section: Workspace ──────────────────────────────────────── */}
          <Text style={[styles.sectionLabel, dynamicSectionLabel]}>WORKSPACE</Text>

          <View style={[styles.editorRow, { backgroundColor: tokens.bgElevated, borderColor: tokens.border }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.editorRowLabel, { color: tokens.text }]}>Location</Text>
              <Text
                testID="workspace-display-name"
                numberOfLines={1}
                style={{ color: tokens.textMuted, fontSize: 12 }}
              >
                {workspaceDisplayName || (workspaceUri ? workspaceUri : 'No workspace selected')}
              </Text>
            </View>
            <TouchableOpacity
              testID="btn-browse-workspace"
              onPress={handleBrowse}
              disabled={workspacePicking}
              accessibilityLabel="Browse for workspace folder"
              accessibilityRole="button"
              accessibilityState={{ disabled: workspacePicking }}
              style={styles.fontButton}
            >
              {workspacePicking
                ? <ActivityIndicator size="small" color={tokens.accent} />
                : <Text style={[styles.fontBtnText, { color: tokens.accent }]}>Browse</Text>
              }
            </TouchableOpacity>
          </View>

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
    minHeight: 44,
  },
  extVersion: {
    fontSize: 12,
  },
  removeText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
