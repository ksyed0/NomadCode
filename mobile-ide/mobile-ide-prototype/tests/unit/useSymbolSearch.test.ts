import { act, renderHook } from '@testing-library/react-native';
import { useSymbolSearch } from '../../src/hooks/useSymbolSearch';
import { FileSystemBridge } from '../../src/utils/FileSystemBridge';
import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../src/utils/FileSystemBridge', () => ({
  FileSystemBridge: {
    listFilesRecursive: jest.fn().mockResolvedValue([]),
    readFile: jest.fn().mockResolvedValue(''),
  },
}));

beforeEach(() => jest.clearAllMocks());

describe('useSymbolSearch', () => {
  it('initial state: empty index, not building', () => {
    const { result } = renderHook(() => useSymbolSearch('/ws'));
    expect(result.current.index).toEqual([]);
    expect(result.current.isBuilding).toBe(false);
  });

  it('loads from AsyncStorage on mount when cache exists', async () => {
    const cached = [{ word: 'foo', filePath: '/a.ts', line: 1, kind: 'function' }];
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(cached));
    const { result } = renderHook(() => useSymbolSearch('/ws'));
    await act(async () => {});
    expect(result.current.index).toEqual(cached);
    expect(FileSystemBridge.listFilesRecursive).not.toHaveBeenCalled();
  });

  it('builds full index when cache is empty', async () => {
    (FileSystemBridge.listFilesRecursive as jest.Mock).mockResolvedValue(['/ws/a.ts']);
    (FileSystemBridge.readFile as jest.Mock).mockResolvedValue('function foo() {}');
    const { result } = renderHook(() => useSymbolSearch('/ws'));
    await act(async () => {});
    expect(result.current.index.find(e => e.word === 'foo')).toBeDefined();
  });

  it('search returns exact match with highest score', () => {
    const { result } = renderHook(() => useSymbolSearch('/ws'));
    act(() => {
      result.current.onFileSaved('/a.ts', 'function formatDate() {}\nfunction format() {}');
    });
    const results = result.current.search('formatDate');
    expect(results[0].word).toBe('formatDate');
  });

  it('search returns prefix matches', () => {
    const { result } = renderHook(() => useSymbolSearch('/ws'));
    act(() => {
      result.current.onFileSaved('/a.ts', 'function formatDate() {}\nfunction parseDate() {}');
    });
    const results = result.current.search('format');
    expect(results.map(r => r.word)).toContain('formatDate');
    expect(results.map(r => r.word)).not.toContain('parseDate');
  });

  it('search returns empty for empty query', () => {
    const { result } = renderHook(() => useSymbolSearch('/ws'));
    expect(result.current.search('')).toEqual([]);
  });

  it('search caps results at 50', () => {
    const { result } = renderHook(() => useSymbolSearch('/ws'));
    const code = Array.from({ length: 60 }, (_, i) => `function fn${i}() {}`).join('\n');
    act(() => { result.current.onFileSaved('/a.ts', code); });
    expect(result.current.search('fn').length).toBeLessThanOrEqual(50);
  });

  it('onFileSaved updates index for the saved file only', () => {
    const { result } = renderHook(() => useSymbolSearch('/ws'));
    act(() => { result.current.onFileSaved('/a.ts', 'function foo() {}'); });
    act(() => { result.current.onFileSaved('/b.ts', 'function bar() {}'); });
    act(() => { result.current.onFileSaved('/a.ts', 'function baz() {}'); });
    const words = result.current.index.map(e => e.word);
    expect(words).not.toContain('foo');
    expect(words).toContain('baz');
    expect(words).toContain('bar');
  });

  it('onFileSaved saves to AsyncStorage', () => {
    const { result } = renderHook(() => useSymbolSearch('/ws'));
    act(() => { result.current.onFileSaved('/a.ts', 'function foo() {}'); });
    expect(AsyncStorage.setItem).toHaveBeenCalled();
  });
});
