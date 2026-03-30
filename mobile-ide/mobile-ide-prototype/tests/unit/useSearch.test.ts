import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useSearch } from '../../src/hooks/useSearch';
import { FileSearchResult } from '../../src/utils/searchEngine';

// Mock searchEngine
const mockSearchFiles = jest.fn();
jest.mock('../../src/utils/searchEngine', () => ({
  ...jest.requireActual('../../src/utils/searchEngine'),
  searchFiles: (...args: unknown[]) => mockSearchFiles(...args),
}));

const WORKSPACE = 'file:///workspace';

async function* makeGen(results: FileSearchResult[]) {
  for (const r of results) yield r;
}

beforeEach(() => jest.clearAllMocks());

describe('useSearch', () => {
  it('initial state is empty', () => {
    const { result } = renderHook(() => useSearch(WORKSPACE));
    expect(result.current.query).toBe('');
    expect(result.current.results).toEqual([]);
    expect(result.current.isSearching).toBe(false);
    expect(result.current.fileCount).toBe(0);
    expect(result.current.totalMatchCount).toBe(0);
    expect(result.current.error).toBeNull();
  });

  it('submit triggers searchFiles and streams results', async () => {
    const fakeResults: FileSearchResult[] = [
      { filePath: 'file:///workspace/a.ts', matches: [{ lineNumber: 1, preview: 'foo', matchStart: 0, matchEnd: 3 }] },
      { filePath: 'file:///workspace/b.ts', matches: [{ lineNumber: 2, preview: 'foo bar', matchStart: 0, matchEnd: 3 }, { lineNumber: 5, preview: 'foo', matchStart: 0, matchEnd: 3 }] },
    ];
    mockSearchFiles.mockReturnValue(makeGen(fakeResults));

    const { result } = renderHook(() => useSearch(WORKSPACE));
    act(() => { result.current.setQuery('foo'); });
    await act(async () => { result.current.submit(); });

    await waitFor(() => expect(result.current.isSearching).toBe(false));
    expect(result.current.results).toHaveLength(2);
    expect(result.current.fileCount).toBe(2);
    expect(result.current.totalMatchCount).toBe(3);
  });

  it('isSearching is true while generator is running', async () => {
    let resolve: () => void;
    const pending = new Promise<void>(r => { resolve = r; });
    async function* slowGen() {
      await pending;
      yield { filePath: 'a.ts', matches: [] };
    }
    mockSearchFiles.mockReturnValue(slowGen());

    const { result } = renderHook(() => useSearch(WORKSPACE));
    act(() => { result.current.setQuery('foo'); });
    act(() => { result.current.submit(); });

    expect(result.current.isSearching).toBe(true);
    resolve!();
    await waitFor(() => expect(result.current.isSearching).toBe(false));
  });

  it('re-submit cancels previous search', async () => {
    let firstAborted = false;
    async function* firstGen(signal: AbortSignal) {
      await new Promise<void>(res => setTimeout(res, 50));
      if (signal.aborted) { firstAborted = true; return; }
      yield { filePath: 'a.ts', matches: [] };
    }
    mockSearchFiles.mockImplementationOnce((_r: string, _q: string, _o: unknown, signal: AbortSignal) => firstGen(signal));
    mockSearchFiles.mockReturnValueOnce(makeGen([]));

    const { result } = renderHook(() => useSearch(WORKSPACE));
    act(() => { result.current.setQuery('foo'); });
    act(() => { result.current.submit(); });
    act(() => { result.current.submit(); }); // cancel first

    await waitFor(() => expect(result.current.isSearching).toBe(false));
    expect(firstAborted).toBe(true);
  });

  it('clear resets all state', async () => {
    mockSearchFiles.mockReturnValue(makeGen([
      { filePath: 'a.ts', matches: [{ lineNumber: 1, preview: 'foo', matchStart: 0, matchEnd: 3 }] },
    ]));
    const { result } = renderHook(() => useSearch(WORKSPACE));
    act(() => { result.current.setQuery('foo'); });
    await act(async () => { result.current.submit(); });
    await waitFor(() => expect(result.current.results).toHaveLength(1));

    act(() => { result.current.clear(); });
    expect(result.current.query).toBe('');
    expect(result.current.results).toEqual([]);
    expect(result.current.fileCount).toBe(0);
    expect(result.current.isSearching).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('sets error on invalid regex', async () => {
    const { result } = renderHook(() => useSearch(WORKSPACE));
    act(() => {
      result.current.setQuery('[invalid');
      result.current.setOptions({ regex: true });
    });
    act(() => { result.current.submit(); });
    expect(result.current.error).toMatch(/invalid/i);
    expect(mockSearchFiles).not.toHaveBeenCalled();
  });

  it('sets error when searchFiles generator throws and search was not aborted', async () => {
    async function* throwingGen() {
      throw new Error('disk read failure');
    }
    mockSearchFiles.mockReturnValue(throwingGen());

    const { result } = renderHook(() => useSearch(WORKSPACE));
    act(() => { result.current.setQuery('foo'); });
    await act(async () => { result.current.submit(); });

    await waitFor(() => expect(result.current.isSearching).toBe(false));
    expect(result.current.error).toMatch(/disk read failure/i);
  });
});
