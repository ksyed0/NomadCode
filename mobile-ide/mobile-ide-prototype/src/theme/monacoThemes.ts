import { ThemeId, ThemeTokens, THEMES } from './themeData';

export interface MonacoThemeData {
  base: 'vs' | 'vs-dark';
  inherit: boolean;
  rules: { token: string; foreground?: string; fontStyle?: string }[];
  colors: Record<string, string>;
}

/** Strips leading '#' from a hex colour string (Monaco expects no hash). */
function stripHash(hex: string): string {
  return hex.startsWith('#') ? hex.slice(1) : hex;
}

/**
 * Converts a NomadCode ThemeTokens object into Monaco's IStandaloneThemeData
 * format. All 11 themes are derived from the same source-of-truth palette in
 * tokens.ts — no colour values are hardcoded here.
 */
export function buildMonacoThemeData(t: ThemeTokens): MonacoThemeData {
  return {
    base: t.mode === 'dark' ? 'vs-dark' : 'vs',
    inherit: true,
    rules: [
      { token: 'keyword',              foreground: stripHash(t.keyword) },
      { token: 'keyword.operator',     foreground: stripHash(t.keyword) },
      { token: 'keyword.control',      foreground: stripHash(t.keyword) },
      { token: 'string',               foreground: stripHash(t.string) },
      { token: 'string.quoted',        foreground: stripHash(t.string) },
      { token: 'comment',              foreground: stripHash(t.textMuted), fontStyle: 'italic' },
      { token: 'comment.line',         foreground: stripHash(t.textMuted), fontStyle: 'italic' },
      { token: 'comment.block',        foreground: stripHash(t.textMuted), fontStyle: 'italic' },
      { token: 'number',               foreground: stripHash(t.accent) },
      { token: 'type',                 foreground: stripHash(t.accent) },
      { token: 'entity.name.function', foreground: stripHash(t.accent) },
    ],
    colors: {
      'editor.background':               stripHash(t.bg),
      'editor.foreground':               stripHash(t.text),
      'editor.selectionBackground':      stripHash(t.bgHighlight) + '88',
      'editor.lineHighlightBackground':  stripHash(t.bgElevated) + '66',
      'editorCursor.foreground':         stripHash(t.accent),
    },
  };
}

/** Pre-built theme data for all 11 NomadCode themes, keyed by ThemeId. */
export const ALL_MONACO_THEMES: Record<ThemeId, MonacoThemeData> = (() => {
  const result = {} as Record<ThemeId, MonacoThemeData>;
  for (const [id, tokens] of Object.entries(THEMES)) {
    result[id as ThemeId] = buildMonacoThemeData(tokens);
  }
  return result;
})();
