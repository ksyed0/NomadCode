/**
 * Unit tests — App root component (EPIC-0004 integration)
 *
 * Smoke tests for the root App component, focused on the command palette
 * integration wired in EPIC-0004.
 */

import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import App from '../../App';
import useSettingsStore from '../../src/stores/useSettingsStore';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockHydrate = jest.fn().mockResolvedValue(undefined);
jest.mock('../../src/stores/useAuthStore', () => ({
  __esModule: true,
  default: jest.fn((sel: (s: unknown) => unknown) =>
    sel({
      token: null, username: null, avatarUrl: null,
      isLoading: false, error: null,
      signInWithToken: jest.fn(),
      signOut: jest.fn(),
      hydrate: mockHydrate,
    })
  ),
}));

// Mock useSettingsStore so AsyncStorage native module is never loaded
jest.mock('../../src/stores/useSettingsStore', () => ({
  __esModule: true,
  default: jest.fn((sel: (s: object) => unknown) =>
    sel({
      theme: 'nomad-dark',
      fontSize: 14,
      workspacePath: '',
      hasCompletedSetup: true,
      setTheme: jest.fn(),
      setFontSize: jest.fn(),
      setWorkspacePath: jest.fn(),
      completeSetup: jest.fn(),
      installedExtensions: [],
      addExtension: jest.fn(),
      removeExtension: jest.fn(),
    })
  ),
}));

// Mock ExtensionHost — renders null, no WebView needed in unit tests
jest.mock('../../src/components/ExtensionHost', () => ({
  __esModule: true,
  default: () => null,
}));

// Mock useTheme and THEMES so all components that use tokens work without a real store
jest.mock('../../src/theme/tokens', () => {
  const nomadDark = {
    id: 'nomad-dark',
    mode: 'dark',
    name: 'Nomad Dark',
    bg: '#0F172A',
    bgElevated: '#1E293B',
    bgHighlight: '#1D3461',
    text: '#E2E8F0',
    textMuted: '#64748B',
    border: '#334155',
    accent: '#2563EB',
    keyword: '#7C3AED',
    string: '#0D9488',
    error: '#EF4444',
    success: '#22C55E',
  };
  const nomadLight = {
    id: 'nomad-light',
    mode: 'light',
    name: 'Nomad Light',
    bg: '#F9FAFB',
    bgElevated: '#F1F5F9',
    bgHighlight: '#DBEAFE',
    text: '#111827',
    textMuted: '#6B7280',
    border: '#E5E7EB',
    accent: '#2563EB',
    keyword: '#7C3AED',
    string: '#0D9488',
    error: '#EF4444',
    success: '#22C55E',
  };
  return {
    useTheme: () => nomadDark,
    getMonacoTheme: () => 'vs-dark',
    DARK_THEME_IDS: ['nomad-dark'],
    LIGHT_THEME_IDS: ['nomad-light'],
    THEMES: {
      'nomad-dark': nomadDark,
      'nomad-light': nomadLight,
    },
  };
});

// Mock expo-document-picker (not available in Jest environment)
jest.mock('expo-document-picker', () => ({
  getDocumentAsync: jest.fn().mockResolvedValue({ canceled: true }),
}));

// Mock expo-file-system (not available in Jest environment)
jest.mock('expo-file-system', () => ({
  documentDirectory: 'file:///mock-docs/',
  readAsStringAsync: jest.fn().mockResolvedValue(''),
  writeAsStringAsync: jest.fn().mockResolvedValue(undefined),
  deleteAsync: jest.fn().mockResolvedValue(undefined),
  getInfoAsync: jest.fn().mockResolvedValue({ exists: true, isDirectory: false }),
  makeDirectoryAsync: jest.fn().mockResolvedValue(undefined),
  readDirectoryAsync: jest.fn().mockResolvedValue([]),
}));

// Mock Alert to prevent "not implemented" warnings
jest.mock('react-native/Libraries/Alert/Alert', () => ({
  alert: jest.fn(),
}));

// Mock react-native-webview (TurboModule not available in Jest)
jest.mock('react-native-webview', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require('react');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View } = require('react-native');
  const WebView = React.forwardRef(
    (props: { onMessage?: (e: object) => void }, ref: unknown) => {
      React.useImperativeHandle(ref, () => ({ injectJavaScript: jest.fn() }));
      React.useEffect(() => {
        props.onMessage?.({ nativeEvent: { data: JSON.stringify({ type: 'ready' }) } });
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, []);
      return <View testID="webview" />;
    },
  );
  WebView.displayName = 'WebView';
  return { WebView };
});

// Spy-able TerminalWebView mock — renders a testID so we can assert it mounted,
// and captures the props passed to it so TC-0346 can inspect onCommand.
const mockTerminalWebViewProps: Record<string, unknown>[] = [];
jest.mock('../../src/components/TerminalWebView', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require('react');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View } = require('react-native');
  return {
    TerminalWebView: (props: Record<string, unknown>) => {
      mockTerminalWebViewProps.push(props);
      return <View testID="terminal-webview-mock" />;
    },
  };
});

// Mock expo-auth-session (used by SettingsScreen OAuth flow)
jest.mock('expo-auth-session', () => ({
  useAutoDiscovery: jest.fn(() => null),
  useAuthRequest: jest.fn(() => [null, null, jest.fn()]),
  makeRedirectUri: jest.fn(() => 'nomadcode://auth'),
}));

// Mock expo-web-browser (used by SettingsScreen OAuth flow)
jest.mock('expo-web-browser', () => ({
  maybeCompleteAuthSession: jest.fn(),
}));

// Mock MonacoAssetManager so it resolves immediately without network
jest.mock('../../src/utils/MonacoAssetManager', () => ({
  MonacoAssetManager: {
    resolve: jest.fn().mockResolvedValue({ baseUrl: 'https://cdn.test', isOffline: false }),
  },
  buildMonacoHtml: jest.fn().mockReturnValue('<html>monaco</html>'),
}));

// ---------------------------------------------------------------------------
// Test lifecycle
// ---------------------------------------------------------------------------

beforeEach(() => {
  mockHydrate.mockClear();
  mockTerminalWebViewProps.length = 0;
});

// ---------------------------------------------------------------------------
// Smoke tests
// ---------------------------------------------------------------------------

describe('App — smoke tests', () => {
  it('renders without crashing', () => {
    expect(() => render(<App />)).not.toThrow();
  });

  it('renders the NomadCode status bar title', () => {
    render(<App />);
    expect(screen.getByText('NomadCode')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// SetupWizard integration (EPIC-0005)
// ---------------------------------------------------------------------------

describe('App — SetupWizard integration', () => {
  it('shows setup wizard when setup not completed', () => {
    // Override the mock for this test to return hasCompletedSetup: false
    (useSettingsStore as unknown as jest.Mock).mockImplementation((sel: (s: object) => unknown) =>
      sel({
        theme: 'nomad-dark',
        fontSize: 14,
        workspacePath: '',
        hasCompletedSetup: false,
        setTheme: jest.fn(),
        setFontSize: jest.fn(),
        setWorkspacePath: jest.fn(),
        completeSetup: jest.fn(),
        installedExtensions: [],
        addExtension: jest.fn(),
        removeExtension: jest.fn(),
      })
    );
    render(<App />);
    expect(screen.getByTestId('setup-wizard')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Command palette integration (EPIC-0004)
// ---------------------------------------------------------------------------

describe('App — command palette integration', () => {
  it('CommandPalette is always in the component tree (visible=false by default)', () => {
    render(<App />);
    // The palette input is not shown when visible=false
    expect(screen.queryByPlaceholderText(/Search commands/i)).toBeNull();
  });

  it('FAB palette button opens the command palette', () => {
    render(<App />);
    fireEvent.press(screen.getByLabelText('Open command palette'));
    expect(screen.getByPlaceholderText(/Search commands/i)).toBeTruthy();
  });

  it('command palette shows the expected commands', () => {
    render(<App />);
    fireEvent.press(screen.getByLabelText('Open command palette'));
    expect(screen.getByText('File: Save')).toBeTruthy();
    expect(screen.getByText('View: Toggle Terminal')).toBeTruthy();
    expect(screen.getByText('Git: Show Status')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// ExtensionHost integration (US-0020)
// ---------------------------------------------------------------------------

describe('App — ExtensionHost integration', () => {
  it('mounts without crashing when installedExtensions is empty', () => {
    // ExtensionHost renders null for empty list — verifies App renders cleanly
    render(<App />);
    // App renders the status bar title
    expect(screen.getByText('NomadCode')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Auth hydration (EPIC-0007)
// ---------------------------------------------------------------------------

describe('App — auth hydration', () => {
  it('calls useAuthStore hydrate on mount', async () => {
    render(<App />);
    await waitFor(() => {
      expect(mockHydrate).toHaveBeenCalledTimes(1);
    });
  });
});

// ---------------------------------------------------------------------------
// TerminalWebView wiring (EPIC-0003)
// TC-0345: App renders TerminalWebView (not a stub) when showTerminal=true
// TC-0346: TerminalWebView receives an onCommand prop that is a function
// ---------------------------------------------------------------------------

describe('App — TerminalWebView wiring (EPIC-0003)', () => {
  it('TC-0345: renders TerminalWebView in the component tree on initial mount', () => {
    // TerminalWebView is always mounted (visible prop controls display:none).
    // The mock renders testID="terminal-webview-mock" unconditionally.
    render(<App />);
    expect(screen.getByTestId('terminal-webview-mock')).toBeTruthy();
  });

  it('TC-0346: TerminalWebView receives an onCommand prop that is a function', () => {
    render(<App />);
    // The mock captured all prop objects passed to TerminalWebView.
    expect(mockTerminalWebViewProps.length).toBeGreaterThan(0);
    const props = mockTerminalWebViewProps[0];
    expect(typeof props.onCommand).toBe('function');
  });
});
