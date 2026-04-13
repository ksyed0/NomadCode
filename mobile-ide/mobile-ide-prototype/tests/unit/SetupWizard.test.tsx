/**
 * Unit tests — SetupWizard
 *
 * useSettingsStore, expo-document-picker, and expo-file-system are mocked.
 * Coverage: visibility, step 1 theme selection, step 2 font size, step 3 workspace.
 */

import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Platform } from 'react-native';

const mockSetTheme = jest.fn();
const mockSetFontSize = jest.fn();
const mockSetWorkspacePath = jest.fn();
const mockCompleteSetup = jest.fn();
let mockHasCompletedSetup = false;
let mockFontSize = 14;
let mockTheme = 'nomad-dark';
let mockWorkspacePath = '';

jest.mock('../../src/stores/useSettingsStore', () => ({
  __esModule: true,
  default: jest.fn((sel: (s: object) => unknown) =>
    sel({
      theme: mockTheme,
      fontSize: mockFontSize,
      workspacePath: mockWorkspacePath,
      hasCompletedSetup: mockHasCompletedSetup,
      setTheme: mockSetTheme,
      setFontSize: mockSetFontSize,
      setWorkspacePath: mockSetWorkspacePath,
      completeSetup: mockCompleteSetup,
    })
  ),
}));

jest.mock('expo-document-picker', () => ({
  getDocumentAsync: jest.fn(() => Promise.resolve({ canceled: true })),
}));

jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///mock-docs/',
  StorageAccessFramework: {
    requestDirectoryPermissionsAsync: jest.fn(() => Promise.resolve({ granted: false })),
  },
}));

import SetupWizard from '../../src/components/SetupWizard';
import * as DocumentPicker from 'expo-document-picker';
import * as ExpoFS from 'expo-file-system/legacy';

beforeEach(() => {
  jest.clearAllMocks();
  mockHasCompletedSetup = false;
  mockFontSize = 14;
  mockTheme = 'nomad-dark';
  mockWorkspacePath = '';
  (ExpoFS.StorageAccessFramework.requestDirectoryPermissionsAsync as jest.Mock).mockResolvedValue({ granted: false });
});

describe('SetupWizard — visibility', () => {
  it('renders when visible is true', () => {
    render(<SetupWizard visible={true} />);
    expect(screen.getByTestId('setup-wizard')).toBeTruthy();
  });

  it('does not render content when visible is false', () => {
    render(<SetupWizard visible={false} />);
    expect(screen.queryByTestId('setup-wizard')).toBeNull();
  });
});

describe('SetupWizard — Step 1 (Theme)', () => {
  it('shows step 1 of 3 indicator', () => {
    render(<SetupWizard visible={true} />);
    expect(screen.getByText('1 / 3')).toBeTruthy();
  });

  it('shows Dark and Light mode buttons', () => {
    render(<SetupWizard visible={true} />);
    expect(screen.getByTestId('mode-dark')).toBeTruthy();
    expect(screen.getByTestId('mode-light')).toBeTruthy();
  });

  it('pressing Dark mode button shows dark theme swatches', () => {
    render(<SetupWizard visible={true} />);
    fireEvent.press(screen.getByTestId('mode-dark'));
    expect(screen.getByTestId('swatch-nomad-dark')).toBeTruthy();
    expect(screen.getByTestId('swatch-dracula')).toBeTruthy();
  });

  it('pressing Light mode button shows light theme swatches', () => {
    render(<SetupWizard visible={true} />);
    fireEvent.press(screen.getByTestId('mode-light'));
    expect(screen.getByTestId('swatch-nomad-light')).toBeTruthy();
    expect(screen.getByTestId('swatch-github-light')).toBeTruthy();
  });

  it('pressing a theme swatch calls setTheme with that id', () => {
    render(<SetupWizard visible={true} />);
    fireEvent.press(screen.getByTestId('mode-dark'));
    fireEvent.press(screen.getByTestId('swatch-dracula'));
    expect(mockSetTheme).toHaveBeenCalledWith('dracula');
  });

  it('Next button advances to step 2', () => {
    render(<SetupWizard visible={true} />);
    fireEvent.press(screen.getByTestId('btn-next'));
    expect(screen.getByText('2 / 3')).toBeTruthy();
  });
});

describe('SetupWizard — Step 2 (Font Size)', () => {
  function goToStep2() {
    render(<SetupWizard visible={true} />);
    fireEvent.press(screen.getByTestId('btn-next'));
  }

  it('shows step 2 of 3 indicator', () => {
    goToStep2();
    expect(screen.getByText('2 / 3')).toBeTruthy();
  });

  it('A+ button calls setFontSize with fontSize + 1', () => {
    goToStep2();
    fireEvent.press(screen.getByTestId('btn-font-inc'));
    expect(mockSetFontSize).toHaveBeenCalledWith(15);
  });

  it('A- button calls setFontSize with fontSize - 1', () => {
    goToStep2();
    fireEvent.press(screen.getByTestId('btn-font-dec'));
    expect(mockSetFontSize).toHaveBeenCalledWith(13);
  });

  it('Reset button calls setFontSize with 14', () => {
    mockFontSize = 20;
    goToStep2();
    fireEvent.press(screen.getByTestId('btn-font-reset'));
    expect(mockSetFontSize).toHaveBeenCalledWith(14);
  });

  it('Back button returns to step 1', () => {
    goToStep2();
    fireEvent.press(screen.getByTestId('btn-back'));
    expect(screen.getByText('1 / 3')).toBeTruthy();
  });

  it('Next button advances to step 3', () => {
    goToStep2();
    fireEvent.press(screen.getByTestId('btn-next'));
    expect(screen.getByText('3 / 3')).toBeTruthy();
  });

  it('does not go below fontSize 8 — A- calls setFontSize(7) (store clamps to 8)', () => {
    mockFontSize = 8;
    goToStep2();
    fireEvent.press(screen.getByTestId('btn-font-dec'));
    expect(mockSetFontSize).toHaveBeenCalledWith(7);
  });

  it('does not go above fontSize 32 — A+ calls setFontSize(33) (store clamps to 32)', () => {
    mockFontSize = 32;
    goToStep2();
    fireEvent.press(screen.getByTestId('btn-font-inc'));
    expect(mockSetFontSize).toHaveBeenCalledWith(33);
  });
});

describe('SetupWizard — Step 3 (Workspace)', () => {
  function goToStep3() {
    render(<SetupWizard visible={true} />);
    fireEvent.press(screen.getByTestId('btn-next')); // → step 2
    fireEvent.press(screen.getByTestId('btn-next')); // → step 3
  }

  it('shows step 3 of 3 indicator', () => {
    goToStep3();
    expect(screen.getByText('3 / 3')).toBeTruthy();
  });

  it('Get Started calls completeSetup', () => {
    goToStep3();
    fireEvent.press(screen.getByTestId('btn-get-started'));
    expect(mockCompleteSetup).toHaveBeenCalledTimes(1);
  });

  it('Skip calls completeSetup', () => {
    goToStep3();
    fireEvent.press(screen.getByTestId('btn-skip'));
    expect(mockCompleteSetup).toHaveBeenCalledTimes(1);
  });

  it('Back button returns to step 2', () => {
    goToStep3();
    fireEvent.press(screen.getByTestId('btn-back'));
    expect(screen.getByText('2 / 3')).toBeTruthy();
  });

  it('shows workspace TextInput pre-filled with documentDirectory when workspacePath is empty', () => {
    mockWorkspacePath = '';
    goToStep3();
    const input = screen.getByTestId('workspace-input');
    expect(input.props.value).toBe('file:///mock-docs/');
  });

  it('shows workspace TextInput pre-filled with stored workspacePath when set', () => {
    mockWorkspacePath = 'file:///custom-path/';
    goToStep3();
    const input = screen.getByTestId('workspace-input');
    expect(input.props.value).toBe('file:///custom-path/');
  });

  it('Browse button renders in step 3', () => {
    goToStep3();
    expect(screen.getByTestId('btn-browse')).toBeTruthy();
  });

  it('Browse button (iOS) calls DocumentPicker.getDocumentAsync', async () => {
    goToStep3();
    await fireEvent.press(screen.getByTestId('btn-browse'));
    expect(DocumentPicker.getDocumentAsync).toHaveBeenCalledWith({
      type: 'public.folder',
      copyToCacheDirectory: false,
    });
  });

  it('Browse button (iOS) calls setWorkspacePath with picked URI', async () => {
    (DocumentPicker.getDocumentAsync as jest.Mock).mockResolvedValueOnce({
      canceled: false,
      assets: [{ uri: 'file:///picked-folder/' }],
    });
    goToStep3();
    await fireEvent.press(screen.getByTestId('btn-browse'));
    expect(mockSetWorkspacePath).toHaveBeenCalledWith('file:///picked-folder/');
  });

  it('Browse button (Android) calls StorageAccessFramework.requestDirectoryPermissionsAsync', async () => {
    const originalOS = Platform.OS;
    Platform.OS = 'android';
    try {
      goToStep3();
      await fireEvent.press(screen.getByTestId('btn-browse'));
      expect((ExpoFS.StorageAccessFramework.requestDirectoryPermissionsAsync as jest.Mock)).toHaveBeenCalled();
      expect(DocumentPicker.getDocumentAsync).not.toHaveBeenCalled();
    } finally {
      Platform.OS = originalOS;
    }
  });

  it('Browse button (Android) calls setWorkspacePath when permission granted', async () => {
    const originalOS = Platform.OS;
    Platform.OS = 'android';
    (ExpoFS.StorageAccessFramework.requestDirectoryPermissionsAsync as jest.Mock).mockResolvedValueOnce({
      granted: true,
      directoryUri: 'content://com.android.externalstorage.documents/tree/primary%3AProjects',
    });
    try {
      goToStep3();
      fireEvent.press(screen.getByTestId('btn-browse'));
      await waitFor(() => {
        expect(mockSetWorkspacePath).toHaveBeenCalledWith(
          'content://com.android.externalstorage.documents/tree/primary%3AProjects',
        );
      });
    } finally {
      Platform.OS = originalOS;
    }
  });

  it('Browse button (Android) does not call setWorkspacePath when permission denied', async () => {
    const originalOS = Platform.OS;
    Platform.OS = 'android';
    (ExpoFS.StorageAccessFramework.requestDirectoryPermissionsAsync as jest.Mock).mockResolvedValueOnce({ granted: false });
    try {
      goToStep3();
      fireEvent.press(screen.getByTestId('btn-browse'));
      await waitFor(() => {
        expect((ExpoFS.StorageAccessFramework.requestDirectoryPermissionsAsync as jest.Mock)).toHaveBeenCalled();
      });
      expect(mockSetWorkspacePath).not.toHaveBeenCalled();
    } finally {
      Platform.OS = originalOS;
    }
  });
});
