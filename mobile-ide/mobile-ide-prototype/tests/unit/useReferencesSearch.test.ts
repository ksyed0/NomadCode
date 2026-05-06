import { act, renderHook } from '@testing-library/react-native';
import { useReferencesSearch } from '../../src/hooks/useReferencesSearch';
import { FileSystemBridge } from '../../src/utils/FileSystemBridge';

jest.mock('../../src/utils/FileSystemBridge', () => ({
  FileSystemBridge: {
    listFilesRecursive: jest.fn(),
    readFile:           jest.fn(),
  },
}));

const mockMonacoRefs = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  (FileSystemBridge.listFilesRecursive as jest.Mock).mockResolvedValue([]);
  (FileSystemBridge.readFile as jest.Mock).mockResolvedValue('');
  mockMonacoRefs.mockResolvedValue([]);
});

describe('useReferencesSearch', () => {
  it('initial state: empty results, not searching', () => {
    const { result } = renderHook(() => useReferencesSearch());
    expect(result.current.results).toEqual([]);
    expect(result.current.isSearching).toBe(false);
    expect(result.current.totalCount).toBe(0);
  });

  it('includes Monaco matches for the current file', async () => {
    const monacoMatches = [{ line: 5, column: 3, lineText: 'function formatDate() {}' }];
    mockMonacoRefs.mockResolvedValue(monacoMatches);
    const { result } = renderHook(() => useReferencesSearch());
    await act(async () => {
      await result.current.search('formatDate', '/src/date.ts', '/src', mockMonacoRefs);
    });
    expect(result.current.results.find(g => g.filePath === '/src/date.ts')?.matches).toEqual(monacoMatches);
  });

  it('includes text-search matches from other files', async () => {
    (FileSystemBridge.listFilesRecursive as jest.Mock).mockResolvedValue(['/src/other.ts']);
    (FileSystemBridge.readFile as jest.Mock).mockResolvedValue('const x = formatDate(new Date());\n');
    const { result } = renderHook(() => useReferencesSearch());
    await act(async () => {
      await result.current.search('formatDate', '/src/date.ts', '/src', mockMonacoRefs);
    });
    const otherGroup = result.current.results.find(g => g.filePath === '/src/other.ts');
    expect(otherGroup?.matches[0].line).toBe(1);
  });

  it('does NOT duplicate the current file via text search', async () => {
    (FileSystemBridge.listFilesRecursive as jest.Mock).mockResolvedValue(['/src/date.ts', '/src/other.ts']);
    const { result } = renderHook(() => useReferencesSearch());
    await act(async () => {
      await result.current.search('formatDate', '/src/date.ts', '/src', mockMonacoRefs);
    });
    const groups = result.current.results.filter(g => g.filePath === '/src/date.ts');
    expect(groups.length).toBeLessThanOrEqual(1);
  });

  it('skips non-code files (.png)', async () => {
    (FileSystemBridge.listFilesRecursive as jest.Mock).mockResolvedValue(['/assets/icon.png']);
    const { result } = renderHook(() => useReferencesSearch());
    await act(async () => {
      await result.current.search('formatDate', '/src/date.ts', '/src', mockMonacoRefs);
    });
    expect(FileSystemBridge.readFile).not.toHaveBeenCalledWith('/assets/icon.png');
  });

  it('cancel() stops an in-progress search', async () => {
    let resolveFile: (v: string) => void;
    (FileSystemBridge.readFile as jest.Mock).mockReturnValue(new Promise(r => { resolveFile = r; }));
    (FileSystemBridge.listFilesRecursive as jest.Mock).mockResolvedValue(['/src/a.ts']);
    const { result } = renderHook(() => useReferencesSearch());
    act(() => {
      result.current.search('formatDate', '/src/date.ts', '/src', mockMonacoRefs);
    });
    act(() => { result.current.cancel(); });
    expect(result.current.isSearching).toBe(false);
    resolveFile!('');
  });

  it('results are sorted alphabetically by fileName', async () => {
    (FileSystemBridge.listFilesRecursive as jest.Mock).mockResolvedValue(['/src/z.ts', '/src/a.ts']);
    (FileSystemBridge.readFile as jest.Mock).mockResolvedValue('const x = formatDate();');
    const { result } = renderHook(() => useReferencesSearch());
    await act(async () => {
      await result.current.search('formatDate', '/src/date.ts', '/src', mockMonacoRefs);
    });
    const fileNames = result.current.results.map(g => g.fileName);
    expect(fileNames).toEqual([...fileNames].sort());
  });

  it('totalCount equals sum of all match counts', async () => {
    (FileSystemBridge.listFilesRecursive as jest.Mock).mockResolvedValue(['/src/a.ts']);
    (FileSystemBridge.readFile as jest.Mock).mockResolvedValue('formatDate()\nformatDate()');
    const { result } = renderHook(() => useReferencesSearch());
    await act(async () => {
      await result.current.search('formatDate', '/src/date.ts', '/src', mockMonacoRefs);
    });
    expect(result.current.totalCount).toBe(2);
  });
});
