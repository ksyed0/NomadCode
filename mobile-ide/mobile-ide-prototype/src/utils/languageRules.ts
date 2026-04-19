/**
 * languageRules.ts
 *
 * Per-language Monaco editor configuration.
 * Keys are Monaco language IDs (used with setModelLanguage).
 * Covers the same language set as VS Code's built-in Monaco v0.45.0.
 */

// ── Interfaces ────────────────────────────────────────────────────────────────

/** Options applied to the Monaco model via editor.getModel().updateOptions(). */
export interface ModelIndentOptions {
  /** Spaces per indent level. */
  tabSize: number;
  /** true = spaces, false = hard tabs. */
  insertSpaces: boolean;
  /**
   * Must always be false — prevents Monaco from overriding configured rules
   * by guessing indentation from file content.
   */
  detectIndentation: false;
}

/** Options applied to the editor instance via editor.updateOptions(). */
export interface EditorAutoCloseOptions {
  /**
   * 'always'           – close on every bracket/quote keystroke
   * 'languageDefined'  – delegate to Monaco's built-in language grammar
   * 'beforeWhitespace' – close only when cursor is before whitespace
   * 'never'            – disable auto-close entirely
   */
  autoClosingBrackets: 'always' | 'languageDefined' | 'beforeWhitespace' | 'never';
  autoClosingQuotes: 'always' | 'languageDefined' | 'beforeWhitespace' | 'never';
}

/** Combined per-language configuration sent to Monaco. */
export interface LanguageRules {
  indent: ModelIndentOptions;
  autoClose: EditorAutoCloseOptions;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function rule(
  tabSize: number,
  insertSpaces: boolean,
  autoClosingBrackets: EditorAutoCloseOptions['autoClosingBrackets'],
  autoClosingQuotes: EditorAutoCloseOptions['autoClosingQuotes'],
): LanguageRules {
  return {
    indent: { tabSize, insertSpaces, detectIndentation: false },
    autoClose: { autoClosingBrackets, autoClosingQuotes },
  };
}

// ── Rules Map ─────────────────────────────────────────────────────────────────

/**
 * Keyed by Monaco language ID.
 * Languages absent from this map receive DEFAULT_RULES.
 */
export const LANGUAGE_RULES_MAP: Readonly<Record<string, LanguageRules>> = {
  // ── Web / scripting ────────────────────────────────────────────────────────
  typescript:   rule(2, true,  'always', 'always'),
  javascript:   rule(2, true,  'always', 'always'),
  html:         rule(2, true,  'always', 'languageDefined'),
  css:          rule(2, true,  'always', 'always'),
  scss:         rule(2, true,  'always', 'always'),
  less:         rule(2, true,  'always', 'always'),
  xml:          rule(2, true,  'always', 'languageDefined'),
  json:         rule(2, true,  'always', 'always'),
  jsonc:        rule(2, true,  'always', 'always'),
  graphql:      rule(2, true,  'always', 'always'),
  markdown:     rule(2, true,  'always', 'always'),
  yaml:         rule(2, true,  'always', 'always'),

  // ── Systems / compiled ─────────────────────────────────────────────────────
  c:            rule(4, true,  'always', 'always'),
  cpp:          rule(4, true,  'always', 'always'),
  csharp:       rule(4, true,  'always', 'always'),
  fsharp:       rule(4, true,  'always', 'always'),
  java:         rule(4, true,  'always', 'always'),
  kotlin:       rule(4, true,  'always', 'always'),
  swift:        rule(4, true,  'always', 'always'),
  rust:         rule(4, true,  'always', 'always'),
  zig:          rule(4, true,  'always', 'always'),
  // gofmt mandates hard tabs; tabSize sets the visual column width
  go:           rule(4, false, 'always', 'always'),
  // Objective-C
  'objective-c': rule(4, true, 'always', 'always'),
  vb:           rule(4, true,  'always', 'always'),

  // ── JVM extras ────────────────────────────────────────────────────────────
  scala:        rule(2, true,  'always', 'always'),

  // ── Flutter / mobile ──────────────────────────────────────────────────────
  dart:         rule(2, true,  'always', 'always'),

  // ── Scripting / dynamic ───────────────────────────────────────────────────
  python:       rule(4, true,  'always', 'languageDefined'),
  ruby:         rule(2, true,  'always', 'languageDefined'),
  php:          rule(4, true,  'always', 'always'),
  perl:         rule(4, true,  'always', 'always'),
  lua:          rule(2, true,  'always', 'always'),
  elixir:       rule(2, true,  'always', 'always'),
  r:            rule(2, true,  'always', 'languageDefined'),

  // ── Shell / infra ─────────────────────────────────────────────────────────
  shell:        rule(4, true,  'always', 'always'),
  powershell:   rule(4, true,  'always', 'always'),
  dockerfile:   rule(4, true,  'always', 'always'),
  hcl:          rule(2, true,  'always', 'always'),

  // ── Data / config ─────────────────────────────────────────────────────────
  sql:          rule(2, true,  'always', 'always'),
  proto:        rule(2, true,  'always', 'always'),
  ini:          rule(2, true,  'always', 'always'),
  toml:         rule(2, true,  'always', 'always'),
};

/** Fallback applied for any language not in LANGUAGE_RULES_MAP. */
export const DEFAULT_RULES: LanguageRules = rule(4, true, 'always', 'always');

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Returns the LanguageRules for a Monaco language ID.
 * Always returns a value — unknown language IDs receive DEFAULT_RULES.
 */
export function getLanguageRules(languageId: string): LanguageRules {
  return LANGUAGE_RULES_MAP[languageId] ?? DEFAULT_RULES;
}
