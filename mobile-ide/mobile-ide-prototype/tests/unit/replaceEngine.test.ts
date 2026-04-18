import { replaceInFiles } from '../../src/utils/replaceEngine';
import { buildPattern } from '../../src/utils/searchEngine';
import type { FileSearchResult } from '../../src/utils/searchEngine';

const makeBridge = (files: Record<string, string>) => {
  const written: Record<string, string> = {};
  return {
    readFile: jest.fn(async (p: string) => files[p] ?? ''),
    writeFile: jest.fn(async (p: string, c: string) => { written[p] = c; }),
    _written: written,
  };
};

describe('replaceInFiles', () => {
  it('replaces plain text in a single file', async () => {
    const files = { '/a.ts': 'const foo = foo + 1;' };
    const bridge = makeBridge(files);
    const results: FileSearchResult[] = [
      { filePath: '/a.ts', matches: [{ lineNumber: 1, preview: 'const foo = foo + 1;', matchStart: 6, matchEnd: 9 }] },
    ];
    const pattern = buildPattern('foo', { caseSensitive: false, regex: false, wholeWord: false, glob: '' });
    const r = await replaceInFiles(results, pattern, 'bar', new Set(), bridge as any);
    expect(r.filesChanged).toBe(1);
    expect(r.matchesReplaced).toBe(2);
    expect(bridge._written['/a.ts']).toBe('const bar = bar + 1;');
  });

  it('supports regex capture group replacement', async () => {
    const files = { '/b.ts': 'hello world' };
    const bridge = makeBridge(files);
    const results: FileSearchResult[] = [
      { filePath: '/b.ts', matches: [{ lineNumber: 1, preview: 'hello world', matchStart: 0, matchEnd: 5 }] },
    ];
    const pattern = buildPattern('(hello)', { caseSensitive: false, regex: true, wholeWord: false, glob: '' });
    const r = await replaceInFiles(results, pattern, '[$1]', new Set(), bridge as any);
    expect(bridge._written['/b.ts']).toBe('[hello] world');
    expect(r.matchesReplaced).toBe(1);
  });

  it('skips excluded matches', async () => {
    const files = { '/c.ts': 'foo foo' };
    const bridge = makeBridge(files);
    const results: FileSearchResult[] = [
      {
        filePath: '/c.ts',
        matches: [
          { lineNumber: 1, preview: 'foo foo', matchStart: 0, matchEnd: 3 },
          { lineNumber: 1, preview: 'foo foo', matchStart: 4, matchEnd: 7 },
        ],
      },
    ];
    const pattern = buildPattern('foo', { caseSensitive: false, regex: false, wholeWord: false, glob: '' });
    const excluded = new Set(['/c.ts:1:0']);
    const r = await replaceInFiles(results, pattern, 'bar', excluded, bridge as any);
    expect(r.matchesReplaced).toBe(1);
    expect(bridge._written['/c.ts']).toBe('foo bar');
  });

  it('does not write file when content is unchanged', async () => {
    const files = { '/d.ts': 'hello' };
    const bridge = makeBridge(files);
    const results: FileSearchResult[] = [
      { filePath: '/d.ts', matches: [{ lineNumber: 1, preview: 'hello', matchStart: 0, matchEnd: 5 }] },
    ];
    const excluded = new Set(['/d.ts:1:0']);
    const pattern = buildPattern('hello', { caseSensitive: false, regex: false, wholeWord: false, glob: '' });
    await replaceInFiles(results, pattern, 'world', excluded, bridge as any);
    expect(bridge.writeFile).not.toHaveBeenCalled();
  });

  it('processes multiple files', async () => {
    const files = { '/e.ts': 'old', '/f.ts': 'old' };
    const bridge = makeBridge(files);
    const results: FileSearchResult[] = [
      { filePath: '/e.ts', matches: [{ lineNumber: 1, preview: 'old', matchStart: 0, matchEnd: 3 }] },
      { filePath: '/f.ts', matches: [{ lineNumber: 1, preview: 'old', matchStart: 0, matchEnd: 3 }] },
    ];
    const pattern = buildPattern('old', { caseSensitive: false, regex: false, wholeWord: false, glob: '' });
    const r = await replaceInFiles(results, pattern, 'new', new Set(), bridge as any);
    expect(r.filesChanged).toBe(2);
    expect(r.matchesReplaced).toBe(2);
  });
});
