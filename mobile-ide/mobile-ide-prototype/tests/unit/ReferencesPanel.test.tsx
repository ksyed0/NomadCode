import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import ReferencesPanel from '../../src/components/ReferencesPanel';
import type { ReferenceGroup } from '../../src/hooks/useReferencesSearch';

jest.mock('../../src/theme/tokens', () => ({
  useTheme: () => ({
    bg: '#000', bgElevated: '#111', border: '#222',
    text: '#fff', textMuted: '#888', accent: '#2563eb',
    bgHighlight: '#333',
  }),
}));

const GROUPS: ReferenceGroup[] = [
  {
    filePath: '/src/utils/date.ts',
    fileName: 'date.ts',
    matches: [
      { line: 5,  column: 1, lineText: 'export function formatDate(d) {}' },
      { line: 12, column: 3, lineText: '  return formatDate(x);' },
    ],
  },
  {
    filePath: '/src/components/Editor.tsx',
    fileName: 'Editor.tsx',
    matches: [
      { line: 7, column: 1, lineText: "import { formatDate } from '../utils'" },
    ],
  },
];

describe('ReferencesPanel', () => {
  it('shows reference count in header', () => {
    const { getByText } = render(
      <ReferencesPanel word="formatDate" results={GROUPS}
        isSearching={false} totalCount={3} onNavigate={jest.fn()} onClose={jest.fn()} />
    );
    expect(getByText(/3 references/i)).toBeTruthy();
  });

  it('shows the searched word in header', () => {
    const { getByText } = render(
      <ReferencesPanel word="formatDate" results={GROUPS}
        isSearching={false} totalCount={3} onNavigate={jest.fn()} onClose={jest.fn()} />
    );
    expect(getByText(/formatDate/)).toBeTruthy();
  });

  it('renders file names', () => {
    const { getByText } = render(
      <ReferencesPanel word="formatDate" results={GROUPS}
        isSearching={false} totalCount={3} onNavigate={jest.fn()} onClose={jest.fn()} />
    );
    expect(getByText('date.ts')).toBeTruthy();
    expect(getByText('Editor.tsx')).toBeTruthy();
  });

  it('renders line previews', () => {
    const { getByText } = render(
      <ReferencesPanel word="formatDate" results={GROUPS}
        isSearching={false} totalCount={3} onNavigate={jest.fn()} onClose={jest.fn()} />
    );
    expect(getByText(/export function formatDate/)).toBeTruthy();
  });

  it('calls onNavigate with correct args when a result row is pressed', () => {
    const onNavigate = jest.fn();
    const { getAllByTestId } = render(
      <ReferencesPanel word="formatDate" results={GROUPS}
        isSearching={false} totalCount={3} onNavigate={onNavigate} onClose={jest.fn()} />
    );
    fireEvent.press(getAllByTestId('ref-row')[0]);
    expect(onNavigate).toHaveBeenCalledWith('/src/utils/date.ts', 5);
  });

  it('shows activity indicator when isSearching', () => {
    const { getByTestId } = render(
      <ReferencesPanel word="formatDate" results={[]}
        isSearching={true} totalCount={0} onNavigate={jest.fn()} onClose={jest.fn()} />
    );
    expect(getByTestId('refs-searching')).toBeTruthy();
  });

  it('shows "No references found" when results empty and not searching', () => {
    const { getByText } = render(
      <ReferencesPanel word="formatDate" results={[]}
        isSearching={false} totalCount={0} onNavigate={jest.fn()} onClose={jest.fn()} />
    );
    expect(getByText(/No references found/i)).toBeTruthy();
  });
});
