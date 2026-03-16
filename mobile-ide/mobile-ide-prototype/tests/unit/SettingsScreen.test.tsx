/**
 * Unit tests — SettingsScreen
 *
 * useSettingsStore, expo-file-system, and tokens (useTheme) are mocked.
 * Coverage: visibility, close button, mode toggle, theme swatches, font size.
 */

import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

// Mock settings store
const mockSetTheme = jest.fn();
const mockSetFontSize = jest.fn();
const mockAddExtension = jest.fn();
const mockRemoveExtension = jest.fn();
let mockTheme = 'nomad-dark';
let mockFontSize = 14;
let mockInstalledExtensions: Array<{ id: string; name: string; version: string; source: string }> = [];

jest.mock('../../src/stores/useSettingsStore', () => ({
  __esModule: true,
  default: jest.fn((sel: (s: unknown) => unknown) =>
    sel({
      theme: mockTheme,
      fontSize: mockFontSize,
      installedExtensions: mockInstalledExtensions,
      setTheme: mockSetTheme,
      setFontSize: mockSetFontSize,
      addExtension: mockAddExtension,
      removeExtension: mockRemoveExtension,
    })
  ),
}));

jest.mock('expo-file-system', () => ({
  documentDirectory: 'file:///mock-docs/',
}));

const mockActivateExtension = jest.fn();
const mockDeactivateExtension = jest.fn();
jest.mock('../../src/extensions/sandbox', () => ({
  activateExtension: (...args: unknown[]) => mockActivateExtension(...args),
  deactivateExtension: (...args: unknown[]) => mockDeactivateExtension(...args),
}));

jest.mock('../../src/theme/tokens', () => {
  const actual = jest.requireActual('../../src/theme/tokens');
  return {
    ...actual,
    useTheme: () => actual.THEMES['nomad-dark'],
  };
});

const mockSignInWithToken = jest.fn();
const mockSignOut = jest.fn();
const mockSetError = jest.fn();
let mockAuthToken: string | null = null;
let mockAuthUsername: string | null = null;
let mockAuthError: string | null = null;
let mockAuthLoading = false;

jest.mock('../../src/stores/useAuthStore', () => ({
  __esModule: true,
  default: jest.fn((sel: (s: unknown) => unknown) =>
    sel({
      token: mockAuthToken,
      username: mockAuthUsername,
      avatarUrl: null,
      isLoading: mockAuthLoading,
      error: mockAuthError,
      signInWithToken: mockSignInWithToken,
      signOut: mockSignOut,
      setError: mockSetError,
    })
  ),
}));

jest.mock('expo-auth-session', () => ({
  useAutoDiscovery: jest.fn(() => null),
  useAuthRequest: jest.fn(() => [null, null, jest.fn()]),
  makeRedirectUri: jest.fn(() => 'nomadcode://auth'),
}));

jest.mock('expo-web-browser', () => ({
  maybeCompleteAuthSession: jest.fn(),
}));

import SettingsScreen from '../../src/components/SettingsScreen';

beforeEach(() => {
  jest.clearAllMocks();
  mockActivateExtension.mockClear();
  mockDeactivateExtension.mockClear();
  mockTheme = 'nomad-dark';
  mockFontSize = 14;
  mockInstalledExtensions = [];
  mockAuthToken = null;
  mockAuthUsername = null;
  mockAuthError = null;
  mockAuthLoading = false;
  mockSignInWithToken.mockReset();
  mockSignOut.mockReset();
  mockSetError.mockReset();
});

describe('SettingsScreen', () => {
  it('renders when visible', () => {
    render(<SettingsScreen visible={true} onClose={jest.fn()} />);
    expect(screen.getByTestId('settings-screen')).toBeTruthy();
  });

  it('does not render when not visible', () => {
    render(<SettingsScreen visible={false} onClose={jest.fn()} />);
    expect(screen.queryByTestId('settings-screen')).toBeNull();
  });

  it('close button calls onClose', () => {
    const onClose = jest.fn();
    render(<SettingsScreen visible={true} onClose={onClose} />);
    fireEvent.press(screen.getByTestId('btn-close'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('Dark mode button press shows dark theme swatches', () => {
    render(<SettingsScreen visible={true} onClose={jest.fn()} />);
    fireEvent.press(screen.getByTestId('settings-mode-dark'));
    expect(screen.getByTestId('settings-swatch-nomad-dark')).toBeTruthy();
  });

  it('Light mode button press shows light theme swatches', () => {
    render(<SettingsScreen visible={true} onClose={jest.fn()} />);
    fireEvent.press(screen.getByTestId('settings-mode-light'));
    expect(screen.getByTestId('settings-swatch-nomad-light')).toBeTruthy();
  });

  it('pressing a theme swatch calls setTheme', () => {
    render(<SettingsScreen visible={true} onClose={jest.fn()} />);
    fireEvent.press(screen.getByTestId('settings-mode-dark'));
    fireEvent.press(screen.getByTestId('settings-swatch-nord'));
    expect(mockSetTheme).toHaveBeenCalledWith('nord');
  });

  it('A+ button calls setFontSize with fontSize + 1', () => {
    render(<SettingsScreen visible={true} onClose={jest.fn()} />);
    fireEvent.press(screen.getByTestId('settings-font-inc'));
    expect(mockSetFontSize).toHaveBeenCalledWith(15);
  });

  it('A- button calls setFontSize with fontSize - 1', () => {
    render(<SettingsScreen visible={true} onClose={jest.fn()} />);
    fireEvent.press(screen.getByTestId('settings-font-dec'));
    expect(mockSetFontSize).toHaveBeenCalledWith(13);
  });
});

describe('SettingsScreen — Extensions section', () => {
  it('renders EXTENSIONS section label', () => {
    render(<SettingsScreen visible={true} onClose={jest.fn()} />);
    expect(screen.getByText('EXTENSIONS')).toBeTruthy();
  });

  it('renders install form with name input, source input, and install button', () => {
    render(<SettingsScreen visible={true} onClose={jest.fn()} />);
    expect(screen.getByTestId('ext-name-input')).toBeTruthy();
    expect(screen.getByTestId('ext-source-input')).toBeTruthy();
    expect(screen.getByTestId('ext-install-btn')).toBeTruthy();
  });

  it('install button is disabled when name is empty', () => {
    render(<SettingsScreen visible={true} onClose={jest.fn()} />);
    const btn = screen.getByTestId('ext-install-btn');
    expect(btn.props.accessibilityState?.disabled).toBe(true);
  });

  it('install button is enabled when name and source are both filled', () => {
    render(<SettingsScreen visible={true} onClose={jest.fn()} />);
    fireEvent.changeText(screen.getByTestId('ext-name-input'), 'My Ext');
    fireEvent.changeText(screen.getByTestId('ext-source-input'), 'void 0;');
    const btn = screen.getByTestId('ext-install-btn');
    expect(btn.props.accessibilityState?.disabled).toBe(false);
  });

  it('tapping Install calls addExtension and clears the form', () => {
    render(<SettingsScreen visible={true} onClose={jest.fn()} />);
    fireEvent.changeText(screen.getByTestId('ext-name-input'), 'My Ext');
    fireEvent.changeText(screen.getByTestId('ext-source-input'), 'void 0;');
    fireEvent.press(screen.getByTestId('ext-install-btn'));
    expect(mockAddExtension).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'My Ext', source: 'void 0;' })
    );
    expect(mockActivateExtension).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'My Ext', source: 'void 0;' })
    );
    expect(screen.getByTestId('ext-name-input').props.value).toBe('');
    expect(screen.getByTestId('ext-source-input').props.value).toBe('');
  });

  it('renders installed extension cards', () => {
    mockInstalledExtensions = [
      { id: 'test.a', name: 'Word Count', version: '1.0.0', source: 'void 0;' },
    ];
    render(<SettingsScreen visible={true} onClose={jest.fn()} />);
    expect(screen.getByText('Word Count')).toBeTruthy();
    expect(screen.getByTestId('ext-deactivate-test.a')).toBeTruthy();
  });

  it('tapping Deactivate calls removeExtension with the extension id', () => {
    mockInstalledExtensions = [
      { id: 'test.a', name: 'Word Count', version: '1.0.0', source: 'void 0;' },
    ];
    render(<SettingsScreen visible={true} onClose={jest.fn()} />);
    fireEvent.press(screen.getByTestId('ext-deactivate-test.a'));
    expect(mockRemoveExtension).toHaveBeenCalledWith('test.a');
    expect(mockDeactivateExtension).toHaveBeenCalledWith('test.a');
  });
});

describe('SettingsScreen — GitHub Account section (signed out)', () => {
  it('renders GITHUB ACCOUNT section label', () => {
    render(<SettingsScreen visible={true} onClose={jest.fn()} />);
    expect(screen.getByText('GITHUB ACCOUNT')).toBeTruthy();
  });

  it('shows Sign in with GitHub button when signed out', () => {
    render(<SettingsScreen visible={true} onClose={jest.fn()} />);
    expect(screen.getByTestId('btn-oauth-signin')).toBeTruthy();
  });

  it('shows PAT toggle link when signed out', () => {
    render(<SettingsScreen visible={true} onClose={jest.fn()} />);
    expect(screen.getByTestId('btn-pat-toggle')).toBeTruthy();
  });

  it('reveals PAT input after tapping toggle', () => {
    render(<SettingsScreen visible={true} onClose={jest.fn()} />);
    fireEvent.press(screen.getByTestId('btn-pat-toggle'));
    expect(screen.getByTestId('pat-input')).toBeTruthy();
    expect(screen.getByTestId('btn-pat-connect')).toBeTruthy();
  });

  it('calls signInWithToken with entered PAT on Connect', () => {
    render(<SettingsScreen visible={true} onClose={jest.fn()} />);
    fireEvent.press(screen.getByTestId('btn-pat-toggle'));
    fireEvent.changeText(screen.getByTestId('pat-input'), 'ghp_mytoken');
    fireEvent.press(screen.getByTestId('btn-pat-connect'));
    expect(mockSignInWithToken).toHaveBeenCalledWith('ghp_mytoken');
  });

  it('shows error message when auth error is set', () => {
    mockAuthError = 'Token is invalid or lacks required permissions.';
    render(<SettingsScreen visible={true} onClose={jest.fn()} />);
    expect(screen.getByText('Token is invalid or lacks required permissions.')).toBeTruthy();
  });

  it('does not call signInWithToken when Connect is pressed with empty PAT', () => {
    render(<SettingsScreen visible={true} onClose={jest.fn()} />);
    fireEvent.press(screen.getByTestId('btn-pat-toggle'));
    // PAT input is visible but empty
    fireEvent.press(screen.getByTestId('btn-pat-connect'));
    expect(mockSignInWithToken).not.toHaveBeenCalled();
  });

  it('calls promptOAuth when Sign in with GitHub is pressed and request is ready', () => {
    const mockPrompt = jest.fn().mockResolvedValue(undefined);
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const AuthSession = require('expo-auth-session');
    AuthSession.useAuthRequest.mockReturnValueOnce([{ url: 'https://github.com' }, null, mockPrompt]);
    render(<SettingsScreen visible={true} onClose={jest.fn()} />);
    fireEvent.press(screen.getByTestId('btn-oauth-signin'));
    expect(mockPrompt).toHaveBeenCalled();
  });

  it('does not call promptOAuth when request is not ready', () => {
    const mockPrompt = jest.fn();
    // useAuthRequest returns null request (not ready)
    render(<SettingsScreen visible={true} onClose={jest.fn()} />);
    fireEvent.press(screen.getByTestId('btn-oauth-signin'));
    expect(mockPrompt).not.toHaveBeenCalled();
  });

  it('calls setError when OAuth code exchange fetch throws a network error', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const AuthSession = require('expo-auth-session');
    AuthSession.useAuthRequest.mockReturnValueOnce([
      { url: 'https://github.com' },
      { type: 'success', params: { code: 'abc123' } },
      jest.fn(),
    ]);
    jest.spyOn(global, 'fetch').mockRejectedValueOnce(new Error('Network error'));
    render(<SettingsScreen visible={true} onClose={jest.fn()} />);
    await waitFor(() => {
      expect(mockSetError).toHaveBeenCalledWith('Could not reach GitHub. Check your connection.');
    });
    (global.fetch as jest.Mock).mockRestore?.();
  });

  it('calls setError when OAuth token exchange returns no access_token', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const AuthSession = require('expo-auth-session');
    AuthSession.useAuthRequest.mockReturnValueOnce([
      { url: 'https://github.com' },
      { type: 'success', params: { code: 'abc123' } },
      jest.fn(),
    ]);
    jest.spyOn(global, 'fetch').mockResolvedValueOnce({
      json: async () => ({ error: 'bad_verification_code' }),
    } as Response);
    render(<SettingsScreen visible={true} onClose={jest.fn()} />);
    await waitFor(() => {
      expect(mockSetError).toHaveBeenCalledWith(
        'GitHub did not return an access token. Check your OAuth app configuration.'
      );
    });
    (global.fetch as jest.Mock).mockRestore?.();
  });
});

describe('SettingsScreen — GitHub Account section (signed in)', () => {
  beforeEach(() => {
    mockAuthToken = 'ghp_valid';
    mockAuthUsername = 'octocat';
  });

  it('shows username when signed in', () => {
    render(<SettingsScreen visible={true} onClose={jest.fn()} />);
    expect(screen.getByText('@octocat')).toBeTruthy();
  });

  it('shows Sign out button when signed in', () => {
    render(<SettingsScreen visible={true} onClose={jest.fn()} />);
    expect(screen.getByTestId('btn-sign-out')).toBeTruthy();
  });

  it('calls signOut when Sign out button is pressed', () => {
    render(<SettingsScreen visible={true} onClose={jest.fn()} />);
    fireEvent.press(screen.getByTestId('btn-sign-out'));
    expect(mockSignOut).toHaveBeenCalled();
  });

  it('does not show OAuth button when signed in', () => {
    render(<SettingsScreen visible={true} onClose={jest.fn()} />);
    expect(screen.queryByTestId('btn-oauth-signin')).toBeNull();
  });

  it('does not show PAT input when signed in', () => {
    render(<SettingsScreen visible={true} onClose={jest.fn()} />);
    expect(screen.queryByTestId('pat-input')).toBeNull();
    expect(screen.queryByTestId('btn-pat-connect')).toBeNull();
  });
});
