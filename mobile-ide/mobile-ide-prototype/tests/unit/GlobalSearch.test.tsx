import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { GlobalSearch } from '../../src/components/GlobalSearch';
import { UseSearchReturn } from '../../src/hooks/useSearch';

// Mock useSearch
const mockSubmit = jest.fn();
const mockClear = jest.fn();
const mockSetQuery = jest.fn();
const mockSetOptions = jest.fn();

let mockState: Partial<UseSearchReturn> = {};

jest.mock('../../src/hooks/useSearch', () => ({
  useSearch: () => ({
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

function renderSearch(state: Partial<UseSearchReturn> = {}) {
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
