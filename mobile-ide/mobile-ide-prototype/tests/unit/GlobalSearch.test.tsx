import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react-native';
import { GlobalSearch } from '../../src/components/GlobalSearch';
import { UseSearchReturn } from '../../src/hooks/useSearch';

// Mock useReplace
const mockSubmit = jest.fn();
const mockClear = jest.fn();
const mockSetQuery = jest.fn();
const mockSetOptions = jest.fn();
const mockSetMode = jest.fn();
const mockSetReplaceQuery = jest.fn();
const mockToggleExclude = jest.fn();
const mockReplaceAll = jest.fn().mockResolvedValue({ filesChanged: 0, matchesReplaced: 0 });

let mockState: Partial<UseSearchReturn> & {
  mode?: 'search' | 'replace';
  replaceQuery?: string;
  excludedMatches?: Set<string>;
  replacePreview?: string;
} = {};

jest.mock('../../src/hooks/useReplace', () => ({
  useReplace: () => ({
    query: '',
    setQuery: mockSetQuery,
    options: { caseSensitive: false, regex: false, wholeWord: false, glob: '' },
    setOptions: mockSetOptions,
    results: [],
    isSearching: false,
    fileCount: 0,
    totalMatchCount: 0,
    error: null,
    submit: mockSubmit,
    clear: mockClear,
    mode: 'search',
    setMode: mockSetMode,
    replaceQuery: '',
    setReplaceQuery: mockSetReplaceQuery,
    excludedMatches: new Set(),
    toggleExclude: mockToggleExclude,
    replacePreview: '',
    replaceAll: mockReplaceAll,
    ...mockState,
  }),
}));

// Mock useTheme to return ThemeTokens shape
jest.mock('../../src/theme/tokens', () => ({
  useTheme: () => ({
    id: 'nomad-dark',
    mode: 'dark',
    name: 'Nomad Dark',
    bg: '#0F172A',
    bgElevated: '#1E293B',
    bgHighlight: '#1D3461',
    text: '#E2E8F0',
    textMuted: '#64748B',
    border: '#334155',
    accent: '#2563EB',
    keyword: '#7C3AED',
    string: '#0D9488',
    error: '#EF4444',
    success: '#22C55E',
  }),
}));

const WORKSPACE = 'file:///workspace';
const onNavigate = jest.fn();

function renderSearch(state: typeof mockState = {}) {
  mockState = state;
  return render(<GlobalSearch workspaceRoot={WORKSPACE} onNavigate={onNavigate} />);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockState = {};
});

describe('GlobalSearch', () => {
  it('renders search input', () => {
    const { getByPlaceholderText } = renderSearch();
    expect(getByPlaceholderText('Search')).toBeTruthy();
  });

  it('renders four option toggles', () => {
    const { getByText } = renderSearch();
    expect(getByText('Aa')).toBeTruthy();
    expect(getByText('.*')).toBeTruthy();
    expect(getByText('\\b')).toBeTruthy();
  });

  it('renders glob filter input', () => {
    const { getByPlaceholderText } = renderSearch();
    expect(getByPlaceholderText(/files to include/i)).toBeTruthy();
  });

  it('pressing Aa toggle calls setOptions with toggled caseSensitive', () => {
    const { getByText } = renderSearch();
    fireEvent.press(getByText('Aa'));
    expect(mockSetOptions).toHaveBeenCalledWith({ caseSensitive: true });
  });

  it('pressing .* toggle calls setOptions with toggled regex', () => {
    const { getByText } = renderSearch();
    fireEvent.press(getByText('.*'));
    expect(mockSetOptions).toHaveBeenCalledWith({ regex: true });
  });

  it('pressing \\b toggle calls setOptions with toggled wholeWord', () => {
    const { getByText } = renderSearch();
    fireEvent.press(getByText('\\b'));
    expect(mockSetOptions).toHaveBeenCalledWith({ wholeWord: true });
  });

  it('pressing Enter calls submit', () => {
    const { getByPlaceholderText } = renderSearch();
    fireEvent(getByPlaceholderText('Search'), 'submitEditing');
    expect(mockSubmit).toHaveBeenCalled();
  });

  it('shows loading indicator while isSearching', () => {
    const { getByText } = renderSearch({ isSearching: true, fileCount: 3 });
    expect(getByText(/searching/i)).toBeTruthy();
  });

  it('shows empty state when no results and not searching', () => {
    mockState = { query: 'foo', results: [], isSearching: false };
    const { getByText } = renderSearch({ query: 'foo', results: [], isSearching: false });
    expect(getByText(/no results/i)).toBeTruthy();
  });

  it('shows summary line with result counts', () => {
    const { getByText } = renderSearch({
      results: [
        { filePath: 'a.ts', matches: [{ lineNumber: 1, preview: 'foo', matchStart: 0, matchEnd: 3 }] },
      ],
      totalMatchCount: 1,
    });
    expect(getByText(/1 result/i)).toBeTruthy();
  });

  it('renders results grouped by file', () => {
    const { getByText } = renderSearch({
      results: [
        {
          filePath: 'file:///workspace/src/App.tsx',
          matches: [
            { lineNumber: 42, preview: 'const foo = 1;', matchStart: 6, matchEnd: 9 },
          ],
        },
      ],
      totalMatchCount: 1,
    });
    expect(getByText(/App\.tsx/)).toBeTruthy();
    expect(getByText('const foo = 1;')).toBeTruthy();
  });

  it('tapping a result calls onNavigate with correct args', () => {
    const { getByText } = renderSearch({
      results: [
        {
          filePath: 'file:///workspace/src/App.tsx',
          matches: [
            { lineNumber: 42, preview: 'const foo = 1;', matchStart: 6, matchEnd: 9 },
          ],
        },
      ],
    });
    fireEvent.press(getByText('const foo = 1;'));
    expect(onNavigate).toHaveBeenCalledWith(
      'file:///workspace/src/App.tsx', 42, 6, 9,
    );
  });

  it('shows error message when error is set', () => {
    const { getByText } = renderSearch({ error: 'Invalid regex: bad pattern' });
    expect(getByText(/Invalid regex/)).toBeTruthy();
  });
});

describe('replace mode', () => {
  it('shows SEARCH and REPLACE tab buttons', () => {
    renderSearch();
    expect(screen.getByText('SEARCH')).toBeTruthy();
    expect(screen.getByText('REPLACE')).toBeTruthy();
  });

  it('replace input is hidden in search mode', () => {
    renderSearch();
    expect(screen.queryByPlaceholderText('Replace with...')).toBeNull();
  });

  it('pressing REPLACE tab calls setMode', () => {
    renderSearch();
    fireEvent.press(screen.getByText('REPLACE'));
    expect(mockSetMode).toHaveBeenCalledWith('replace');
  });

  it('replace input is visible in replace mode', () => {
    renderSearch({ mode: 'replace' });
    expect(screen.getByPlaceholderText('Replace with...')).toBeTruthy();
  });

  it('Replace All button is visible in replace mode', () => {
    renderSearch({ mode: 'replace' });
    expect(screen.getByText('Replace All')).toBeTruthy();
  });

  it('replace input is not visible in search mode', () => {
    renderSearch({ mode: 'search' });
    expect(screen.queryByPlaceholderText('Replace with...')).toBeNull();
  });

  it('tapping a match in replace mode calls toggleExclude instead of onNavigate', () => {
    renderSearch({
      mode: 'replace',
      results: [
        {
          filePath: 'file:///workspace/src/App.tsx',
          matches: [
            { lineNumber: 10, preview: 'const bar = 2;', matchStart: 6, matchEnd: 9 },
          ],
        },
      ],
    });
    fireEvent.press(screen.getByText('const bar = 2;'));
    expect(mockToggleExclude).toHaveBeenCalledWith('file:///workspace/src/App.tsx:10:6');
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it('shows checked checkbox for included matches in replace mode', () => {
    renderSearch({
      mode: 'replace',
      results: [
        {
          filePath: 'file:///workspace/src/App.tsx',
          matches: [
            { lineNumber: 10, preview: 'const bar = 2;', matchStart: 6, matchEnd: 9 },
          ],
        },
      ],
      excludedMatches: new Set(),
    });
    // ☑ means included (not excluded)
    expect(screen.getByText('☑')).toBeTruthy();
  });

  it('shows unchecked checkbox for excluded matches in replace mode', () => {
    renderSearch({
      mode: 'replace',
      results: [
        {
          filePath: 'file:///workspace/src/App.tsx',
          matches: [
            { lineNumber: 10, preview: 'const bar = 2;', matchStart: 6, matchEnd: 9 },
          ],
        },
      ],
      excludedMatches: new Set(['file:///workspace/src/App.tsx:10:6']),
    });
    // ☐ means excluded
    expect(screen.getByText('☐')).toBeTruthy();
  });

  it('shows replacePreview text when set', () => {
    renderSearch({ mode: 'replace', replacePreview: '"foo" → "bar"' });
    expect(screen.getByText('"foo" → "bar"')).toBeTruthy();
  });

  it('does not show Replace All bar in search mode', () => {
    renderSearch({ mode: 'search' });
    expect(screen.queryByText('Replace All')).toBeNull();
  });
});
