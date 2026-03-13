/**
 * Unit tests — SetupWizard
 *
 * useSettingsStore, expo-document-picker, and expo-file-system are mocked.
 * Coverage: visibility, step 1 theme selection, step 2 font size, step 3 workspace.
 */

import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

const mockSetTheme = jest.fn();
const mockSetFontSize = jest.fn();
const mockSetWorkspacePath = jest.fn();
const mockCompleteSetup = jest.fn();
let mockHasCompletedSetup = false;
let mockFontSize = 14;
let mockTheme = 'nomad-dark';

jest.mock('../../src/stores/useSettingsStore', () => ({
  __esModule: true,
  default: jest.fn((sel: (s: object) => unknown) =>
    sel({
      theme: mockTheme,
      fontSize: mockFontSize,
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

jest.mock('expo-file-system', () => ({
  documentDirectory: 'file:///mock-docs/',
}));

import SetupWizard from '../../src/components/SetupWizard';

beforeEach(() => {
  jest.clearAllMocks();
  mockHasCompletedSetup = false;
  mockFontSize = 14;
  mockTheme = 'nomad-dark';
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
});
