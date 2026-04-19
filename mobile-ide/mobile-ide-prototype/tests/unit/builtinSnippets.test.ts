import { BUILTIN_SNIPPETS } from '../../src/utils/builtinSnippets';

describe('BUILTIN_SNIPPETS', () => {
  it('every entry has prefix, body, description, and language', () => {
    for (const s of BUILTIN_SNIPPETS) {
      expect(s.prefix).toBeTruthy();
      expect(s.body).toBeTruthy();
      expect(s.description).toBeTruthy();
      expect(s.language).toBeTruthy();
    }
  });

  it('has no duplicate prefix+language combinations', () => {
    const keys = BUILTIN_SNIPPETS.map((s) => `${s.prefix}:${s.language}`);
    const unique = new Set(keys);
    expect(unique.size).toBe(keys.length);
  });

  it('includes clg for console.log', () => {
    const clg = BUILTIN_SNIPPETS.find((s) => s.prefix === 'clg');
    expect(clg).toBeDefined();
    expect(clg?.body).toContain('console.log');
  });

  it('includes rfc for React component', () => {
    const rfc = BUILTIN_SNIPPETS.find((s) => s.prefix === 'rfc');
    expect(rfc).toBeDefined();
    expect(rfc?.language).toBe('typescriptreact');
  });

  it('includes Python snippets', () => {
    const pySnippets = BUILTIN_SNIPPETS.filter((s) => s.language === 'python');
    expect(pySnippets.length).toBeGreaterThanOrEqual(3);
  });

  it('includes Rust snippets', () => {
    const rustSnippets = BUILTIN_SNIPPETS.filter((s) => s.language === 'rust');
    expect(rustSnippets.length).toBeGreaterThanOrEqual(2);
  });
});
