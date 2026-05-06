import { isCodeFile, escapeRegex } from '../../src/codeNav/codeNavUtils';

describe('isCodeFile', () => {
  it('returns true for .ts', () => expect(isCodeFile('/src/foo.ts')).toBe(true));
  it('returns true for .tsx', () => expect(isCodeFile('/src/foo.tsx')).toBe(true));
  it('returns true for .js', () => expect(isCodeFile('/src/foo.js')).toBe(true));
  it('returns true for .py', () => expect(isCodeFile('/src/foo.py')).toBe(true));
  it('returns true for .json', () => expect(isCodeFile('/src/foo.json')).toBe(true));
  it('returns true for .md', () => expect(isCodeFile('/README.md')).toBe(true));
  it('returns false for .png', () => expect(isCodeFile('/assets/icon.png')).toBe(false));
  it('returns false for .wasm', () => expect(isCodeFile('/bundle.wasm')).toBe(false));
  it('returns false for .db', () => expect(isCodeFile('/data.db')).toBe(false));
  it('handles file with no extension', () => expect(isCodeFile('/Makefile')).toBe(false));
});

describe('escapeRegex', () => {
  it('escapes dot', () => expect(escapeRegex('foo.bar')).toBe('foo\\.bar'));
  it('escapes asterisk', () => expect(escapeRegex('a*b')).toBe('a\\*b'));
  it('escapes parens', () => expect(escapeRegex('fn()')).toBe('fn\\(\\)'));
  it('leaves plain identifiers unchanged', () => expect(escapeRegex('formatDate')).toBe('formatDate'));
  it('escapes dollar sign', () => expect(escapeRegex('$el')).toBe('\\$el'));
});
