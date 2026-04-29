/**
 * Unit tests — monacoThemes
 *
 * buildMonacoThemeData converts NomadCode ThemeTokens to Monaco theme format.
 * ALL_MONACO_THEMES pre-builds all 11 themes.
 *
 * useSettingsStore is mocked so tests run without AsyncStorage.
 */

// Mock the settings store to avoid AsyncStorage initialization in tests
jest.mock('../../src/stores/useSettingsStore', () => ({
  __esModule: true,
  default: jest.fn((sel: (s: { theme: string }) => unknown) =>
    sel({ theme: 'nomad-dark' })
  ),
}));

import { buildMonacoThemeData, ALL_MONACO_THEMES } from '../../src/theme/monacoThemes';
import { THEMES, DARK_THEME_IDS, LIGHT_THEME_IDS, ThemeId } from '../../src/theme/tokens';

describe('buildMonacoThemeData', () => {
  it('sets base to vs-dark for all dark themes', () => {
    DARK_THEME_IDS.forEach(id => {
      expect(buildMonacoThemeData(THEMES[id]).base).toBe('vs-dark');
    });
  });

  it('sets base to vs for all light themes', () => {
    LIGHT_THEME_IDS.forEach(id => {
      expect(buildMonacoThemeData(THEMES[id]).base).toBe('vs');
    });
  });

  it('has non-empty editor.background for every theme', () => {
    Object.values(THEMES).forEach(t => {
      expect(buildMonacoThemeData(t).colors['editor.background']).toBeTruthy();
    });
  });

  it('has non-empty editor.foreground for every theme', () => {
    Object.values(THEMES).forEach(t => {
      expect(buildMonacoThemeData(t).colors['editor.foreground']).toBeTruthy();
    });
  });

  it('has a keyword token rule for every theme', () => {
    Object.values(THEMES).forEach(t => {
      const kw = buildMonacoThemeData(t).rules.find(r => r.token === 'keyword');
      expect(kw?.foreground).toBeTruthy();
    });
  });

  it('has a string token rule for every theme', () => {
    Object.values(THEMES).forEach(t => {
      const str = buildMonacoThemeData(t).rules.find(r => r.token === 'string');
      expect(str?.foreground).toBeTruthy();
    });
  });

  it('has a comment token rule for every theme', () => {
    Object.values(THEMES).forEach(t => {
      const comment = buildMonacoThemeData(t).rules.find(r => r.token === 'comment');
      expect(comment?.foreground).toBeTruthy();
    });
  });

  it('strips # prefix from hex values in token rules', () => {
    const data = buildMonacoThemeData(THEMES['nomad-dark']);
    data.rules.forEach(rule => {
      if (rule.foreground) expect(rule.foreground).not.toMatch(/^#/);
    });
  });

  it('strips # prefix from hex values in colors', () => {
    const data = buildMonacoThemeData(THEMES['nomad-dark']);
    Object.values(data.colors).forEach(value => {
      // Strip any trailing alpha digits before checking
      const base = value.replace(/[0-9a-fA-F]{2}$/, '');
      expect(base).not.toMatch(/^#/);
    });
  });
});

describe('ALL_MONACO_THEMES', () => {
  it('contains all 11 theme ids', () => {
    expect(Object.keys(ALL_MONACO_THEMES)).toHaveLength(11);
  });

  it('every entry has a valid base value', () => {
    Object.values(ALL_MONACO_THEMES).forEach(data => {
      expect(['vs', 'vs-dark']).toContain(data.base);
    });
  });
});
