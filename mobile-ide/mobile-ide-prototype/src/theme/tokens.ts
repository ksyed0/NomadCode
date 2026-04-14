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
 */

import useSettingsStore from '../stores/useSettingsStore';

export type ThemeId =
  | 'nomad-dark' | 'one-dark-pro' | 'dracula' | 'monokai' | 'nord' | 'tokyo-night'
  | 'nomad-light' | 'github-light' | 'solarized-light' | 'catppuccin-latte' | 'night-owl-light';

export interface ThemeTokens {
  id: ThemeId;
  mode: 'dark' | 'light';
  name: string;
  bg: string;
  bgElevated: string;
  bgHighlight: string;
  text: string;
  textMuted: string;
  border: string;
  accent: string;
  keyword: string;
  string: string;
  error: string;
  success: string;
}

export const DARK_THEME_IDS: ThemeId[] = [
  'nomad-dark', 'one-dark-pro', 'dracula', 'monokai', 'nord', 'tokyo-night',
];

export const LIGHT_THEME_IDS: ThemeId[] = [
  'nomad-light', 'github-light', 'solarized-light', 'catppuccin-latte', 'night-owl-light',
];

const FIXED = { error: '#EF4444', success: '#22C55E' } as const;

export const THEMES: Record<ThemeId, ThemeTokens> = {
  'nomad-dark': {
    id: 'nomad-dark', mode: 'dark', name: 'Nomad Dark',
    bg: '#0F172A', bgElevated: '#1E293B', bgHighlight: '#1D3461',
    text: '#E2E8F0', textMuted: '#64748B', border: '#334155',
    accent: '#2563EB', keyword: '#7C3AED', string: '#0D9488',
    ...FIXED,
  },
  'one-dark-pro': {
    id: 'one-dark-pro', mode: 'dark', name: 'One Dark Pro',
    bg: '#282C34', bgElevated: '#21252B', bgHighlight: '#2C313A',
    text: '#ABB2BF', textMuted: '#5C6370', border: '#3E4451',
    accent: '#61AFEF', keyword: '#C678DD', string: '#98C379',
    ...FIXED,
  },
  'dracula': {
    id: 'dracula', mode: 'dark', name: 'Dracula',
    bg: '#282A36', bgElevated: '#21222C', bgHighlight: '#44475A',
    text: '#F8F8F2', textMuted: '#6272A4', border: '#44475A',
    accent: '#BD93F9', keyword: '#FF79C6', string: '#F1FA8C',
    ...FIXED,
  },
  'monokai': {
    id: 'monokai', mode: 'dark', name: 'Monokai',
    bg: '#272822', bgElevated: '#1E1F1C', bgHighlight: '#3E3D32',
    text: '#F8F8F2', textMuted: '#75715E', border: '#49483E',
    accent: '#66D9E8', keyword: '#F92672', string: '#E6DB74',
    ...FIXED,
  },
  'nord': {
    id: 'nord', mode: 'dark', name: 'Nord',
    bg: '#2E3440', bgElevated: '#3B4252', bgHighlight: '#434C5E',
    text: '#D8DEE9', textMuted: '#4C566A', border: '#434C5E',
    accent: '#88C0D0', keyword: '#81A1C1', string: '#A3BE8C',
    ...FIXED,
  },
  'tokyo-night': {
    id: 'tokyo-night', mode: 'dark', name: 'Tokyo Night',
    bg: '#1A1B26', bgElevated: '#16161E', bgHighlight: '#1F2335',
    text: '#C0CAF5', textMuted: '#565F89', border: '#292E42',
    accent: '#7AA2F7', keyword: '#BB9AF7', string: '#9ECE6A',
    ...FIXED,
  },
  'nomad-light': {
    id: 'nomad-light', mode: 'light', name: 'Nomad Light',
    bg: '#F9FAFB', bgElevated: '#FFFFFF', bgHighlight: '#DBEAFE',
    text: '#111827', textMuted: '#6B7280', border: '#E5E7EB',
    accent: '#2563EB', keyword: '#7C3AED', string: '#0D9488',
    ...FIXED,
  },
  'github-light': {
    id: 'github-light', mode: 'light', name: 'GitHub Light',
    bg: '#FFFFFF', bgElevated: '#F6F8FA', bgHighlight: '#DDF4FF',
    text: '#24292F', textMuted: '#6E7781', border: '#D0D7DE',
    accent: '#0969DA', keyword: '#CF222E', string: '#0A3069',
    ...FIXED,
  },
  'solarized-light': {
    id: 'solarized-light', mode: 'light', name: 'Solarized Light',
    bg: '#FDF6E3', bgElevated: '#EEE8D5', bgHighlight: '#E8DCCA',
    text: '#657B83', textMuted: '#93A1A1', border: '#D3CBBA',
    accent: '#268BD2', keyword: '#859900', string: '#2AA198',
    ...FIXED,
  },
  'catppuccin-latte': {
    id: 'catppuccin-latte', mode: 'light', name: 'Catppuccin Latte',
    bg: '#EFF1F5', bgElevated: '#E6E9EF', bgHighlight: '#CCD0DA',
    text: '#4C4F69', textMuted: '#8C8FA1', border: '#BCC0CC',
    accent: '#1E66F5', keyword: '#8839EF', string: '#40A02B',
    ...FIXED,
  },
  'night-owl-light': {
    id: 'night-owl-light', mode: 'light', name: 'Night Owl Light',
    bg: '#FBFBFB', bgElevated: '#F0F0F0', bgHighlight: '#E0E9FF',
    text: '#403F53', textMuted: '#989FB1', border: '#D9D9D9',
    accent: '#4876D6', keyword: '#994CC3', string: '#4876D6',
    ...FIXED,
  },
};

export function useTheme(): ThemeTokens {
  const themeId = useSettingsStore((s) => s.theme);
  return THEMES[themeId];
}

/**
 * Maps a NomadCode ThemeId to a Monaco built-in theme name.
 * Custom themes are not registered with monaco.editor.defineTheme yet, so
 * setTheme would silently fail on a custom name and Monaco would stay on
 * its default vs-dark. Mapping to vs / vs-dark keeps the editor in sync
 * with the user's light/dark preference at minimum.
 *
 * Future enhancement: register full per-theme colour palettes via
 * monaco.editor.defineTheme so editor syntax colours match the chosen theme.
 */
export function getMonacoTheme(id: ThemeId): 'vs' | 'vs-dark' {
  return THEMES[id].mode === 'dark' ? 'vs-dark' : 'vs';
}
