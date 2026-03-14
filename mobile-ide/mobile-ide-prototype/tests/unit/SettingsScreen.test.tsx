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

import SettingsScreen from '../../src/components/SettingsScreen';

beforeEach(() => {
  jest.clearAllMocks();
  mockActivateExtension.mockClear();
  mockDeactivateExtension.mockClear();
  mockTheme = 'nomad-dark';
  mockFontSize = 14;
  mockInstalledExtensions = [];
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
