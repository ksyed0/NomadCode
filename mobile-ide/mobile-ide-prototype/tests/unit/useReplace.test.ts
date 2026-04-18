import { renderHook, act } from '@testing-library/react-native';
import { useReplace } from '../../src/hooks/useReplace';
import { replaceInFiles } from '../../src/utils/replaceEngine';
import { useSearch } from '../../src/hooks/useSearch';

jest.mock('../../src/utils/replaceEngine');
jest.mock('../../src/utils/FileSystemBridge', () => ({
  FileSystemBridge: { readFile: jest.fn(), writeFile: jest.fn() },
}));
jest.mock('../../src/hooks/useSearch');

const mockedReplace = replaceInFiles as jest.MockedFunction<typeof replaceInFiles>;
const mockedUseSearch = useSearch as jest.MockedFunction<typeof useSearch>;

describe('useReplace', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedUseSearch.mockReturnValue({
      query: '',
      setQuery: jest.fn(),
      options: { caseSensitive: false, regex: false, wholeWord: false, glob: '' },
      setOptions: jest.fn(),
      results: [],
      isSearching: false,
      fileCount: 0,
      totalMatchCount: 0,
      error: null,
      submit: jest.fn(),
      clear: jest.fn(),
    });
  });

  it('starts in search mode', () => {
    const { result } = renderHook(() => useReplace('/workspace'));
    expect(result.current.mode).toBe('search');
  });

  it('switches mode', () => {
    const { result } = renderHook(() => useReplace('/workspace'));
    act(() => result.current.setMode('replace'));
    expect(result.current.mode).toBe('replace');
  });

  it('toggleExclude adds and removes keys', () => {
    const { result } = renderHook(() => useReplace('/workspace'));
    act(() => result.current.toggleExclude('/a.ts:1:0'));
    expect(result.current.excludedMatches.has('/a.ts:1:0')).toBe(true);
    act(() => result.current.toggleExclude('/a.ts:1:0'));
    expect(result.current.excludedMatches.has('/a.ts:1:0')).toBe(false);
  });

  it('replaceAll calls replaceInFiles with correct args', async () => {
    mockedReplace.mockResolvedValue({ filesChanged: 1, matchesReplaced: 3 });
    const { result } = renderHook(() => useReplace('/workspace'));
    act(() => result.current.setReplaceQuery('bar'));
    let r: { filesChanged: number; matchesReplaced: number } | undefined;
    await act(async () => {
      r = await result.current.replaceAll();
    });
    expect(mockedReplace).toHaveBeenCalled();
    expect(r?.filesChanged).toBe(1);
    expect(r?.matchesReplaced).toBe(3);
  });

  it('replacePreview shows "query → replacement" when both set', () => {
    let currentQuery = '';
    const setQueryMock = jest.fn((q: string) => {
      currentQuery = q;
    });
    mockedUseSearch.mockReturnValue({
      query: 'oldName',
      setQuery: setQueryMock,
      options: { caseSensitive: false, regex: false, wholeWord: false, glob: '' },
      setOptions: jest.fn(),
      results: [],
      isSearching: false,
      fileCount: 0,
      totalMatchCount: 0,
      error: null,
      submit: jest.fn(),
      clear: jest.fn(),
    });
    const { result } = renderHook(() => useReplace('/workspace'));
    act(() => {
      result.current.setReplaceQuery('newName');
    });
    expect(result.current.replacePreview).toBe('"oldName" → "newName"');
  });

  it('replacePreview is empty string when either field is empty', () => {
    const { result } = renderHook(() => useReplace('/workspace'));
    act(() => result.current.setQuery('foo'));
    expect(result.current.replacePreview).toBe('');
  });
});
