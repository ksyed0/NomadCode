/**
 * Theme token system — NomadCode design system
 *
 * 11 themes: 6 dark (nomad-dark, one-dark-pro, dracula, monokai, nord, tokyo-night)
 *            5 light (nomad-light, github-light, solarized-light, catppuccin-latte, night-owl-light)
 *
 * useTheme() reads the active theme from useSettingsStore and returns its token map.
 * getMonacoTheme() returns the ThemeId for use as a Monaco custom theme name.
 *
 * error (#EF4444) and success (#22C55E) are fixed across all themes — semantic colours.
 *
 * Pure data (ThemeId, ThemeTokens, THEMES, DARK_THEME_IDS, LIGHT_THEME_IDS) lives in
 * themeData.ts — no hooks, no store imports — so monacoThemes.ts and other pure
 * consumers don't transitively pull in AsyncStorage.
 */

import useSettingsStore from '../stores/useSettingsStore';
import { ThemeId, ThemeTokens, THEMES } from './themeData';

// Re-export pure data so existing callers of tokens.ts are unaffected.
export { ThemeId, ThemeTokens, THEMES, DARK_THEME_IDS, LIGHT_THEME_IDS } from './themeData';

export function useTheme(): ThemeTokens {
  const themeId = useSettingsStore((s) => s.theme);
  return THEMES[themeId];
}

/**
 * Returns the ThemeId for use as a Monaco custom theme name.
 * All 11 themes are registered via monaco.editor.defineTheme in the Monaco
 * HTML bundle (see MonacoAssetManager.ts / monacoThemes.ts), so passing the
 * ThemeId directly to editor.setTheme() applies the full custom palette.
 */
export function getMonacoTheme(id: ThemeId): ThemeId {
  return id;
}
