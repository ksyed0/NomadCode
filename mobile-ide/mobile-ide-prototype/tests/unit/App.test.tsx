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
      workspaceUri: '',
      workspaceUriType: 'file',
      workspaceDisplayName: '',
      hasCompletedSetup: true,
      setTheme: jest.fn(),
      setFontSize: jest.fn(),
      setWorkspacePath: jest.fn(),
      setWorkspaceRoot: jest.fn(),
      completeSetup: jest.fn(),
      installedExtensions: [],
      addExtension: jest.fn(),
      removeExtension: jest.fn(),
    })
  ),
}));

// Mock react-native-document-picker (not available in Jest)
jest.mock('react-native-document-picker', () => ({
  pickDirectory: jest.fn(),
  isCancel: jest.fn((err) => err && err.code === 'DOCUMENT_PICKER_CANCELED'),
  default: {
    pickDirectory: jest.fn(),
    isCancel: jest.fn((err) => err && err.code === 'DOCUMENT_PICKER_CANCELED'),
  },
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

// Mock useWindowDimensions to simulate tablet width so TabletResponsive renders the sidebar
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  default: () => ({ width: 1024, height: 768, scale: 1, fontScale: 1 }),
}));

// Mock GlobalSearch so it renders a simple placeholder input without needing real theme tokens
jest.mock('../../src/components/GlobalSearch', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require('react');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { TextInput } = require('react-native');
  return {
    GlobalSearch: () => <TextInput placeholder="Search" testID="global-search-input" />,
  };
});

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
    // The title now renders as "NomadCode v0.x.x" with a nested <Text> for the version;
    // use exact:false to match the outer text node.
    expect(screen.getByText('NomadCode', { exact: false })).toBeTruthy();
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
        workspaceUri: '',
        workspaceUriType: 'file',
        workspaceDisplayName: '',
        hasCompletedSetup: false,
        setTheme: jest.fn(),
        setFontSize: jest.fn(),
        setWorkspacePath: jest.fn(),
        setWorkspaceRoot: jest.fn(),
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
    // App renders the status bar title (now includes version as nested <Text>)
    expect(screen.getByText('NomadCode', { exact: false })).toBeTruthy();
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

// ---------------------------------------------------------------------------
// Cloud Sync workspace integration (EPIC-0012)
// ---------------------------------------------------------------------------

describe('App — EPIC-0012 workspace & conflict modal', () => {
  it('conflict modal is not visible on initial mount (no conflict)', () => {
    render(<App />);
    expect(screen.queryByTestId('conflict-modal')).toBeNull();
  });

  it('TerminalWebView receives rootPath falling back to documentDirectory when workspaceUri is empty', () => {
    render(<App />);
    const props = mockTerminalWebViewProps[0];
    expect(props.workingDirectory).toBe('file:///mock-docs/');
  });

  it('TerminalWebView uses workspaceUri when set', () => {
    (useSettingsStore as unknown as jest.Mock).mockImplementation((sel: (s: object) => unknown) =>
      sel({
        theme: 'nomad-dark',
        fontSize: 14,
        workspacePath: 'file:///var/mobile/Documents/Projects/',
        workspaceUri: 'file:///var/mobile/Documents/Projects/',
        workspaceUriType: 'file',
        workspaceDisplayName: 'Projects',
        hasCompletedSetup: true,
        setTheme: jest.fn(),
        setFontSize: jest.fn(),
        setWorkspacePath: jest.fn(),
        setWorkspaceRoot: jest.fn(),
        completeSetup: jest.fn(),
        installedExtensions: [],
        addExtension: jest.fn(),
        removeExtension: jest.fn(),
      })
    );
    render(<App />);
    const props = mockTerminalWebViewProps[0];
    expect(props.workingDirectory).toBe('file:///var/mobile/Documents/Projects/');
    // Restore the default mock for subsequent tests
    (useSettingsStore as unknown as jest.Mock).mockImplementation((sel: (s: object) => unknown) =>
      sel({
        theme: 'nomad-dark', fontSize: 14, workspacePath: '', workspaceUri: '',
        workspaceUriType: 'file', workspaceDisplayName: '', hasCompletedSetup: true,
        setTheme: jest.fn(), setFontSize: jest.fn(), setWorkspacePath: jest.fn(),
        setWorkspaceRoot: jest.fn(), completeSetup: jest.fn(),
        installedExtensions: [], addExtension: jest.fn(), removeExtension: jest.fn(),
      })
    );
  });
});

// ---------------------------------------------------------------------------
// Global search wiring (EPIC-0014)
// ---------------------------------------------------------------------------

describe('global search wiring', () => {
  it('renders Files and Search tabs in sidebar', () => {
    const { getByText } = render(<App />);
    expect(getByText('Files')).toBeTruthy();
    expect(getByText('Search')).toBeTruthy();
  });

  it('"Search: Find in Files" palette command switches to Search tab', async () => {
    const { getByText, getByPlaceholderText } = render(<App />);
    // Open command palette
    fireEvent.press(getByText('⌘'));
    await waitFor(() => getByPlaceholderText(/command/i));
    // Filter and select the search command
    fireEvent.changeText(getByPlaceholderText(/command/i), 'Find in Files');
    fireEvent(getByPlaceholderText(/command/i), 'submitEditing');
    // Search panel should now be visible
    await waitFor(() => expect(getByPlaceholderText('Search')).toBeTruthy());
  });
});
