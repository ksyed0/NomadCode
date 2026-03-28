import {
  globToRegex,
  buildPattern,
  matchFile,
  SearchOptions,
} from '../../src/utils/searchEngine';

const DEFAULT_OPTS: SearchOptions = {
  caseSensitive: false,
  regex: false,
  wholeWord: false,
  glob: '',
};

// ── globToRegex ────────────────────────────────────────────────────────────

describe('globToRegex', () => {
  it('empty string matches everything', () => {
    expect(globToRegex('').test('src/foo.ts')).toBe(true);
    expect(globToRegex('').test('anything')).toBe(true);
  });

  it('**/*.ts matches nested .ts files', () => {
    const re = globToRegex('**/*.ts');
    expect(re.test('src/foo.ts')).toBe(true);
    expect(re.test('src/hooks/useSearch.ts')).toBe(true);
    expect(re.test('src/foo.js')).toBe(false);
    expect(re.test('src/foo.tsx')).toBe(false);
  });

  it('*.ts matches root-level .ts only (no slash crossing)', () => {
    const re = globToRegex('*.ts');
    expect(re.test('foo.ts')).toBe(true);
    expect(re.test('src/foo.ts')).toBe(false);
  });

  it('? matches exactly one non-slash character', () => {
    const re = globToRegex('src/?.ts');
    expect(re.test('src/a.ts')).toBe(true);
    expect(re.test('src/ab.ts')).toBe(false);
  });

  it('escapes regex special chars in glob', () => {
    const re = globToRegex('**/*.test.ts');
    expect(re.test('src/foo.test.ts')).toBe(true);
    expect(re.test('src/footestts')).toBe(false);
  });
});

// ── buildPattern ──────────────────────────────────────────────────────────

describe('buildPattern', () => {
  it('plain string, case-insensitive by default', () => {
    const re = buildPattern('foo', DEFAULT_OPTS);
    expect(re.test('FOO')).toBe(true);
    expect(re.test('foo')).toBe(true);
  });

  it('case-sensitive when caseSensitive=true', () => {
    const re = buildPattern('foo', { ...DEFAULT_OPTS, caseSensitive: true });
    expect(re.test('foo')).toBe(true);
    expect(re.test('FOO')).toBe(false);
  });

  it('treats query as regex when regex=true', () => {
    const re = buildPattern('use[A-Z]\\w+', { ...DEFAULT_OPTS, regex: true });
    expect(re.test('useState')).toBe(true);
    expect(re.test('usestate')).toBe(false);
  });

  it('escapes regex metacharacters when regex=false', () => {
    const re = buildPattern('foo.bar', DEFAULT_OPTS);
    expect(re.test('foo.bar')).toBe(true);
    expect(re.test('fooXbar')).toBe(false); // dot is literal
  });

  it('wraps with word boundaries when wholeWord=true', () => {
    const re = buildPattern('foo', { ...DEFAULT_OPTS, wholeWord: true });
    expect(re.test('foo')).toBe(true);
    expect(re.test('foobar')).toBe(false);
    expect(re.test('barfoo')).toBe(false);
  });

  it('throws on invalid regex', () => {
    expect(() => buildPattern('[invalid', { ...DEFAULT_OPTS, regex: true })).toThrow();
  });
});

// ── matchFile ─────────────────────────────────────────────────────────────

describe('matchFile', () => {
  it('returns empty array when no matches', () => {
    const pattern = buildPattern('xyz', DEFAULT_OPTS);
    expect(matchFile('const foo = 1;', pattern)).toEqual([]);
  });

  it('returns correct lineNumber (1-based) and preview', () => {
    const pattern = buildPattern('foo', DEFAULT_OPTS);
    const results = matchFile('line1\nconst foo = 1;\nline3', pattern);
    expect(results).toHaveLength(1);
    expect(results[0].lineNumber).toBe(2);
    expect(results[0].preview).toBe('const foo = 1;');
  });

  it('returns correct matchStart and matchEnd offsets', () => {
    const pattern = buildPattern('foo', DEFAULT_OPTS);
    const results = matchFile('const foo = 1;', pattern);
    expect(results[0].matchStart).toBe(6);
    expect(results[0].matchEnd).toBe(9);
  });

  it('matches multiple lines', () => {
    const pattern = buildPattern('foo', DEFAULT_OPTS);
    const results = matchFile('foo\nbar\nfoo again', pattern);
    expect(results).toHaveLength(2);
    expect(results[0].lineNumber).toBe(1);
    expect(results[1].lineNumber).toBe(3);
  });

  it('truncates preview to 120 characters', () => {
    const longLine = 'a'.repeat(200);
    const pattern = buildPattern('aaa', DEFAULT_OPTS);
    const results = matchFile(longLine, pattern);
    expect(results[0].preview.length).toBe(120);
  });

  it('handles empty content', () => {
    const pattern = buildPattern('foo', DEFAULT_OPTS);
    expect(matchFile('', pattern)).toEqual([]);
  });
});
