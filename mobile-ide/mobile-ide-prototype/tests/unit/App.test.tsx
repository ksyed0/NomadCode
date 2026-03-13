/**
 * Unit tests — App root component (EPIC-0004 integration)
 *
 * Smoke tests for the root App component, focused on the command palette
 * integration wired in EPIC-0004.
 */

import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import App from '../../App';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

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
    })
  ),
}));

// Mock useTheme so all components that use it work without a real store
jest.mock('../../src/theme/tokens', () => ({
  useTheme: () => ({
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
  }),
  getMonacoTheme: () => 'vs-dark',
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
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const React = require('react');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
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

// Mock MonacoAssetManager so it resolves immediately without network
jest.mock('../../src/utils/MonacoAssetManager', () => ({
  MonacoAssetManager: {
    resolve: jest.fn().mockResolvedValue({ baseUrl: 'https://cdn.test', isOffline: false }),
  },
  buildMonacoHtml: jest.fn().mockReturnValue('<html>monaco</html>'),
}));

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
