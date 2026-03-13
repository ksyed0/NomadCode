/**
 * Unit tests — SettingsScreen
 *
 * useSettingsStore, expo-file-system, and tokens (useTheme) are mocked.
 * Coverage: visibility, close button, mode toggle, theme swatches, font size.
 */

import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

// Mock settings store
const mockSetTheme = jest.fn();
const mockSetFontSize = jest.fn();
let mockTheme = 'nomad-dark';
let mockFontSize = 14;

jest.mock('../../src/stores/useSettingsStore', () => ({
  __esModule: true,
  default: jest.fn((sel: (s: {
    theme: string;
    fontSize: number;
    setTheme: typeof mockSetTheme;
    setFontSize: typeof mockSetFontSize;
  }) => unknown) =>
    sel({
      theme: mockTheme,
      fontSize: mockFontSize,
      setTheme: mockSetTheme,
      setFontSize: mockSetFontSize,
    })
  ),
}));

jest.mock('expo-file-system', () => ({
  documentDirectory: 'file:///mock-docs/',
}));

jest.mock('../../src/theme/tokens', () => {
  const actual = jest.requireActual('../../src/theme/tokens');
  return {
    ...actual,
    useTheme: () => actual.THEMES['nomad-dark'],
  };
});

import SettingsScreen from '../../src/components/SettingsScreen';

beforeEach(() => {
  jest.clearAllMocks();
  mockTheme = 'nomad-dark';
  mockFontSize = 14;
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
