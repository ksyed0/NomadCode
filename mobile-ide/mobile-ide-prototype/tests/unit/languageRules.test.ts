import {
  getLanguageRules,
  DEFAULT_RULES,
  LANGUAGE_RULES_MAP,
  type LanguageRules,
} from '../../src/utils/languageRules';

// ── Helpers ────────────────────────────────────────────────────────────────

const allLanguageIds = Object.keys(LANGUAGE_RULES_MAP);

// ── LANGUAGE_RULES_MAP invariants ─────────────────────────────────────────

describe('LANGUAGE_RULES_MAP', () => {
  test('contains entries for all expected language groups', () => {
    const expected = [
      // Web
      'typescript', 'javascript', 'html', 'css', 'scss', 'less', 'xml',
      'json', 'jsonc', 'graphql', 'markdown', 'yaml',
      // Systems
      'c', 'cpp', 'csharp', 'fsharp', 'java', 'kotlin', 'swift', 'rust',
      'zig', 'go', 'objective-c', 'vb',
      // JVM
      'scala',
      // Mobile
      'dart',
      // Scripting
      'python', 'ruby', 'php', 'perl', 'lua', 'elixir', 'r',
      // Shell / infra
      'shell', 'powershell', 'dockerfile', 'hcl',
      // Data
      'sql', 'proto', 'ini', 'toml',
    ];
    for (const id of expected) {
      expect(allLanguageIds).toContain(id);
    }
  });

  test('every entry has detectIndentation: false', () => {
    for (const [id, rules] of Object.entries(LANGUAGE_RULES_MAP)) {
      expect(rules.indent.detectIndentation).toBe(false);
    }
  });

  test.each([
    'typescript', 'javascript', 'html', 'css', 'scss', 'less', 'xml',
    'json', 'jsonc', 'graphql', 'markdown', 'yaml', 'scala', 'dart',
    'ruby', 'lua', 'elixir', 'r', 'hcl', 'sql', 'proto', 'ini', 'toml',
  ])('%s has tabSize 2', (lang) => {
    expect(LANGUAGE_RULES_MAP[lang].indent.tabSize).toBe(2);
  });

  test.each([
    'c', 'cpp', 'csharp', 'fsharp', 'java', 'kotlin', 'swift', 'rust',
    'zig', 'go', 'objective-c', 'vb', 'python', 'php', 'perl',
    'shell', 'powershell', 'dockerfile',
  ])('%s has tabSize 4', (lang) => {
    expect(LANGUAGE_RULES_MAP[lang].indent.tabSize).toBe(4);
  });

  test.each([
    'typescript', 'javascript', 'html', 'css', 'scss', 'less', 'xml',
    'json', 'jsonc', 'graphql', 'markdown', 'yaml', 'scala', 'dart',
    'c', 'cpp', 'csharp', 'fsharp', 'java', 'kotlin', 'swift', 'rust',
    'zig', 'objective-c', 'vb', 'python', 'ruby', 'php', 'perl', 'lua',
    'elixir', 'r', 'shell', 'powershell', 'dockerfile', 'hcl', 'sql',
    'proto', 'ini', 'toml',
  ])('%s has insertSpaces: true', (lang) => {
    expect(LANGUAGE_RULES_MAP[lang].indent.insertSpaces).toBe(true);
  });

  test('go has insertSpaces: false (hard tabs per gofmt)', () => {
    expect(LANGUAGE_RULES_MAP['go'].indent.insertSpaces).toBe(false);
  });

  test.each(['python', 'ruby', 'r', 'html', 'xml'])(
    '%s has autoClosingQuotes: languageDefined',
    (lang) => {
      expect(LANGUAGE_RULES_MAP[lang].autoClose.autoClosingQuotes).toBe('languageDefined');
    },
  );

  test.each([
    'typescript', 'javascript', 'css', 'scss', 'less',
    'json', 'jsonc', 'graphql', 'markdown', 'yaml',
    'c', 'cpp', 'csharp', 'fsharp', 'java', 'kotlin', 'swift', 'rust',
    'zig', 'go', 'scala', 'dart', 'php', 'perl', 'lua', 'elixir',
    'shell', 'powershell', 'dockerfile', 'hcl', 'sql', 'proto', 'ini', 'toml',
  ])('%s has autoClosingQuotes: always', (lang) => {
    expect(LANGUAGE_RULES_MAP[lang].autoClose.autoClosingQuotes).toBe('always');
  });

  test('every entry has autoClosingBrackets: always', () => {
    for (const [id, rules] of Object.entries(LANGUAGE_RULES_MAP)) {
      expect(rules.autoClose.autoClosingBrackets).toBe('always');
    }
  });
});

// ── DEFAULT_RULES ─────────────────────────────────────────────────────────

describe('DEFAULT_RULES', () => {
  test('tabSize is 4', () => {
    expect(DEFAULT_RULES.indent.tabSize).toBe(4);
  });

  test('insertSpaces is true', () => {
    expect(DEFAULT_RULES.indent.insertSpaces).toBe(true);
  });

  test('detectIndentation is false', () => {
    expect(DEFAULT_RULES.indent.detectIndentation).toBe(false);
  });

  test('autoClosingBrackets is always', () => {
    expect(DEFAULT_RULES.autoClose.autoClosingBrackets).toBe('always');
  });

  test('autoClosingQuotes is always', () => {
    expect(DEFAULT_RULES.autoClose.autoClosingQuotes).toBe('always');
  });
});

// ── getLanguageRules() ────────────────────────────────────────────────────

describe('getLanguageRules()', () => {
  test('returns correct rules for typescript (tabSize 2)', () => {
    const rules = getLanguageRules('typescript');
    expect(rules.indent.tabSize).toBe(2);
    expect(rules.indent.insertSpaces).toBe(true);
    expect(rules.indent.detectIndentation).toBe(false);
  });

  test('returns correct rules for python (autoClosingQuotes: languageDefined)', () => {
    const rules = getLanguageRules('python');
    expect(rules.indent.tabSize).toBe(4);
    expect(rules.autoClose.autoClosingQuotes).toBe('languageDefined');
  });

  test('returns correct rules for go (insertSpaces: false)', () => {
    const rules = getLanguageRules('go');
    expect(rules.indent.insertSpaces).toBe(false);
    expect(rules.indent.tabSize).toBe(4);
  });

  test('returns correct rules for csharp', () => {
    const rules = getLanguageRules('csharp');
    expect(rules.indent.tabSize).toBe(4);
    expect(rules.indent.insertSpaces).toBe(true);
  });

  test('returns correct rules for fsharp', () => {
    const rules = getLanguageRules('fsharp');
    expect(rules.indent.tabSize).toBe(4);
    expect(rules.indent.insertSpaces).toBe(true);
  });

  test('returns correct rules for dart (tabSize 2, Dart/Flutter style)', () => {
    const rules = getLanguageRules('dart');
    expect(rules.indent.tabSize).toBe(2);
    expect(rules.indent.insertSpaces).toBe(true);
  });

  test('returns correct rules for html (autoClosingQuotes: languageDefined)', () => {
    const rules = getLanguageRules('html');
    expect(rules.autoClose.autoClosingQuotes).toBe('languageDefined');
    expect(rules.indent.tabSize).toBe(2);
  });

  test('returns DEFAULT_RULES for an unknown language ID', () => {
    const rules = getLanguageRules('cobol');
    expect(rules.indent.tabSize).toBe(DEFAULT_RULES.indent.tabSize);
    expect(rules.indent.insertSpaces).toBe(DEFAULT_RULES.indent.insertSpaces);
    expect(rules.autoClose.autoClosingBrackets).toBe(DEFAULT_RULES.autoClose.autoClosingBrackets);
    expect(rules.autoClose.autoClosingQuotes).toBe(DEFAULT_RULES.autoClose.autoClosingQuotes);
  });

  test('returns DEFAULT_RULES for empty string', () => {
    const rules = getLanguageRules('');
    expect(rules.indent.tabSize).toBe(DEFAULT_RULES.indent.tabSize);
  });

  test('returns DEFAULT_RULES for plaintext', () => {
    const rules = getLanguageRules('plaintext');
    expect(rules.indent.tabSize).toBe(4);
    expect(rules.indent.insertSpaces).toBe(true);
    expect(rules.autoClose.autoClosingQuotes).toBe('always');
  });

  test('does not mutate LANGUAGE_RULES_MAP when called repeatedly', () => {
    const before = JSON.stringify(LANGUAGE_RULES_MAP);
    getLanguageRules('typescript');
    getLanguageRules('go');
    getLanguageRules('python');
    getLanguageRules('unknown-lang');
    const after = JSON.stringify(LANGUAGE_RULES_MAP);
    expect(after).toBe(before);
  });

  test('returns the same object reference for repeated calls on the same language', () => {
    const a = getLanguageRules('rust');
    const b = getLanguageRules('rust');
    expect(a).toBe(b);
  });
});
