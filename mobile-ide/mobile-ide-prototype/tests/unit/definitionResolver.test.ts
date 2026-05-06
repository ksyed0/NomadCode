import { resolveDefinition } from '../../src/codeNav/definitionResolver';
import type { SymbolEntry } from '../../src/codeNav/symbolIndexer';

const index: SymbolEntry[] = [
  { word: 'formatDate', filePath: '/src/utils/date.ts',    line: 5,  kind: 'function' },
  { word: 'formatDate', filePath: '/src/helpers/date.js',  line: 3,  kind: 'function' },
  { word: 'parseDate',  filePath: '/src/utils/date.ts',    line: 12, kind: 'function' },
];

describe('resolveDefinition', () => {
  it('returns a match for an exact word', () => {
    const hit = resolveDefinition('parseDate', index);
    expect(hit).not.toBeNull();
    expect(hit!.word).toBe('parseDate');
    expect(hit!.filePath).toBe('/src/utils/date.ts');
  });

  it('prefers .ts over .js when both files define the same word', () => {
    const hit = resolveDefinition('formatDate', index);
    expect(hit!.filePath).toContain('.ts');
  });

  it('returns null when word is not in the index', () => {
    expect(resolveDefinition('unknownSymbol', index)).toBeNull();
  });

  it('returns null for empty index', () => {
    expect(resolveDefinition('foo', [])).toBeNull();
  });

  it('returns correct line number', () => {
    const hit = resolveDefinition('parseDate', index);
    expect(hit!.line).toBe(12);
  });
});
