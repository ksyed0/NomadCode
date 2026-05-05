import AsyncStorage from '@react-native-async-storage/async-storage';
import { indexFile, updateIndex, loadIndex, saveIndex } from '../../src/codeNav/symbolIndexer';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(undefined),
}));

beforeEach(() => jest.clearAllMocks());

describe('indexFile', () => {
  it('extracts top-level function declarations', () => {
    const entries = indexFile('/f.ts', 'function formatDate(d: Date) {}');
    expect(entries).toEqual([{ word: 'formatDate', filePath: '/f.ts', line: 1, kind: 'function' }]);
  });

  it('extracts exported async functions', () => {
    const entries = indexFile('/f.ts', 'export async function fetchData() {}');
    expect(entries[0]).toMatchObject({ word: 'fetchData', kind: 'function' });
  });

  it('extracts class declarations', () => {
    const entries = indexFile('/f.ts', 'class MyComponent {}');
    expect(entries[0]).toMatchObject({ word: 'MyComponent', kind: 'class' });
  });

  it('extracts exported const declarations', () => {
    const entries = indexFile('/f.ts', 'export const API_URL = "https://api.example.com";');
    expect(entries[0]).toMatchObject({ word: 'API_URL', kind: 'const' });
  });

  it('extracts interface declarations with kind "interface"', () => {
    const entries = indexFile('/f.ts', 'export interface UserProps { name: string }');
    expect(entries[0]).toMatchObject({ word: 'UserProps', kind: 'interface' });
  });

  it('extracts type declarations with kind "type" (not "interface")', () => {
    const entries = indexFile('/f.ts', 'export type UserId = string;');
    expect(entries[0]).toMatchObject({ word: 'UserId', kind: 'type' });
  });

  it('does NOT extract local variables inside function bodies', () => {
    const code = 'function foo() {\n  const bar = 1;\n}';
    const entries = indexFile('/f.ts', code);
    expect(entries.map(e => e.word)).not.toContain('bar');
    expect(entries.map(e => e.word)).toContain('foo');
  });

  it('handles empty file without throwing', () => {
    expect(() => indexFile('/f.ts', '')).not.toThrow();
    expect(indexFile('/f.ts', '')).toEqual([]);
  });

  it('records correct line numbers', () => {
    const code = '\nfunction first() {}\nfunction second() {}';
    const entries = indexFile('/f.ts', code);
    expect(entries.find(e => e.word === 'first')?.line).toBe(2);
    expect(entries.find(e => e.word === 'second')?.line).toBe(3);
  });
});

describe('updateIndex', () => {
  const existing = [
    { word: 'foo', filePath: '/a.ts', line: 1, kind: 'function' as const },
    { word: 'bar', filePath: '/b.ts', line: 2, kind: 'class' as const },
  ];

  it('removes old entries for the given filePath and adds new ones', () => {
    const updated = updateIndex(existing, '/a.ts', [
      { word: 'newFoo', filePath: '/a.ts', line: 5, kind: 'function' as const },
    ]);
    expect(updated.find(e => e.word === 'foo')).toBeUndefined();
    expect(updated.find(e => e.word === 'newFoo')).toBeDefined();
  });

  it('preserves entries from other files unchanged', () => {
    const updated = updateIndex(existing, '/a.ts', []);
    expect(updated.find(e => e.filePath === '/b.ts')).toBeDefined();
  });
});

describe('loadIndex / saveIndex', () => {
  it('loadIndex returns [] when AsyncStorage has no entry', async () => {
    expect(await loadIndex('/ws')).toEqual([]);
  });

  it('loadIndex returns parsed array when entry exists', async () => {
    const data = [{ word: 'foo', filePath: '/a.ts', line: 1, kind: 'function' }];
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(data));
    expect(await loadIndex('/ws')).toEqual(data);
  });

  it('saveIndex writes JSON string to AsyncStorage', async () => {
    const data = [{ word: 'bar', filePath: '/b.ts', line: 2, kind: 'class' as const }];
    await saveIndex('/ws', data);
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      expect.stringContaining('nomadcode_symbol_index'),
      JSON.stringify(data),
    );
  });
});
