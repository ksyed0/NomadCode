/**
 * Unit tests — tokens (theme system)
 *
 * useSettingsStore is mocked so tests run without AsyncStorage.
 * Coverage: all 11 theme token maps, useTheme hook, getMonacoTheme utility.
 *
 * Note: jest.mock factory cannot reference out-of-scope variables unless
 * the variable name is prefixed with "mock" (case-insensitive). The mutable
 * variable is therefore named `mockTheme` instead of `_theme`.
 */

import { renderHook } from '@testing-library/react-native';

// Mock the settings store — useTheme reads from it.
// Variable must be named with "mock" prefix for jest.mock factory scope.
let mockTheme = 'nomad-dark';
jest.mock('../../src/stores/useSettingsStore', () => ({
  __esModule: true,
  default: jest.fn((sel: (s: { theme: string }) => unknown) =>
    sel({ theme: mockTheme })
  ),
}));

import { THEMES, useTheme, getMonacoTheme, DARK_THEME_IDS, LIGHT_THEME_IDS } from '../../src/theme/tokens';

const ALL_THEME_IDS = [...DARK_THEME_IDS, ...LIGHT_THEME_IDS];
const REQUIRED_KEYS: (keyof import('../../src/theme/tokens').ThemeTokens)[] = [
  'id', 'mode', 'name', 'bg', 'bgElevated', 'bgHighlight',
  'text', 'textMuted', 'border', 'accent', 'keyword', 'string', 'error', 'success',
];

beforeEach(() => {
  mockTheme = 'nomad-dark';
});

describe('THEMES map', () => {
  it('has exactly 11 themes', () => {
    expect(Object.keys(THEMES).length).toBe(11);
  });

  it.each(ALL_THEME_IDS)('%s has all required token keys', (id) => {
    REQUIRED_KEYS.forEach(key => {
      expect(THEMES[id as keyof typeof THEMES]).toHaveProperty(key);
    });
  });

  it.each(DARK_THEME_IDS)('%s has mode === dark', (id) => {
    expect(THEMES[id].mode).toBe('dark');
  });

  it.each(LIGHT_THEME_IDS)('%s has mode === light', (id) => {
    expect(THEMES[id].mode).toBe('light');
  });

  it.each(ALL_THEME_IDS)('%s error token is always #EF4444', (id) => {
    expect(THEMES[id as keyof typeof THEMES].error).toBe('#EF4444');
  });

  it.each(ALL_THEME_IDS)('%s success token is always #22C55E', (id) => {
    expect(THEMES[id as keyof typeof THEMES].success).toBe('#22C55E');
  });
});

describe('useTheme', () => {
  it('returns nomad-dark tokens when store theme is nomad-dark', () => {
    mockTheme = 'nomad-dark';
    const { result } = renderHook(() => useTheme());
    expect(result.current.id).toBe('nomad-dark');
    expect(result.current.mode).toBe('dark');
  });

  it('returns dracula tokens when store theme is dracula', () => {
    mockTheme = 'dracula';
    const { result } = renderHook(() => useTheme());
    expect(result.current.id).toBe('dracula');
  });

  it('returns nomad-light tokens when store theme is nomad-light', () => {
    mockTheme = 'nomad-light';
    const { result } = renderHook(() => useTheme());
    expect(result.current.id).toBe('nomad-light');
    expect(result.current.mode).toBe('light');
  });
});

describe('getMonacoTheme', () => {
  it.each(DARK_THEME_IDS)('returns vs-dark for dark theme %s', (id) => {
    expect(getMonacoTheme(id)).toBe('vs-dark');
  });

  it.each(LIGHT_THEME_IDS)('returns vs for light theme %s', (id) => {
    expect(getMonacoTheme(id)).toBe('vs');
  });
});
