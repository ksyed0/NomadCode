import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import ConflictsTab from '../../src/components/git/ConflictsTab';
import useGitStore from '../../src/stores/useGitStore';
import type { ConflictFile } from '../../src/types/git';

const mockGetConflicts = jest.fn();
const mockResolveHunk = jest.fn();
const mockAdd = jest.fn();

jest.mock('../../src/utils/FileSystemBridge', () => ({
  GitBridge: {
    getConflicts: (...a: unknown[]) => mockGetConflicts(...a),
    resolveHunk: (...a: unknown[]) => mockResolveHunk(...a),
    add: (...a: unknown[]) => mockAdd(...a),
  },
}));
// Adjust useTheme mock to use actual field names from src/theme/tokens.ts
jest.mock('../../src/theme/tokens', () => ({
  useTheme: () => ({
    bg: '#0F172A', text: '#E2E8F0', border: '#1e293b',
    accent: '#2563EB', textMuted: '#94a3b8', success: '#22c55e', error: '#EF4444',
  }),
}));

const conflictFiles: ConflictFile[] = [
  { path: 'src/App.tsx', hunks: [{ index: 0, ours: ['  return "Hello";'], theirs: ['  return "Hey";'] }] },
];

const props = { rootPath: 'file:///workspace' };

describe('ConflictsTab', () => {
  beforeEach(() => {
    useGitStore.getState().reset();
    mockGetConflicts.mockResolvedValue(conflictFiles);
    mockResolveHunk.mockResolvedValue(undefined);
    mockAdd.mockResolvedValue(undefined);
  });

  it('shows empty state when no conflicts', async () => {
    useGitStore.getState().setConflicts([]);
    mockGetConflicts.mockResolvedValue([]);
    const { getByTestId } = render(<ConflictsTab {...props} />);
    await waitFor(() => expect(getByTestId('no-conflicts')).toBeTruthy());
  });

  it('lists conflicted files', async () => {
    const { getByText } = render(<ConflictsTab {...props} />);
    await waitFor(() => expect(getByText('src/App.tsx')).toBeTruthy());
  });

  it('shows warning banner with conflict count', async () => {
    const { getByTestId } = render(<ConflictsTab {...props} />);
    await waitFor(() => expect(getByTestId('conflict-banner')).toBeTruthy());
  });

  it('renders ours/theirs panels for selected file', async () => {
    const { getByTestId, getByText } = render(<ConflictsTab {...props} />);
    await waitFor(() => fireEvent.press(getByText('src/App.tsx')));
    await waitFor(() => {
      expect(getByTestId('panel-ours')).toBeTruthy();
      expect(getByTestId('panel-theirs')).toBeTruthy();
    });
  });

  it('calls resolveHunk with ours on Accept Ours press', async () => {
    const { getByText, getByTestId } = render(<ConflictsTab {...props} />);
    await waitFor(() => fireEvent.press(getByText('src/App.tsx')));
    await waitFor(() => fireEvent.press(getByTestId('accept-ours-0')));
    await waitFor(() => expect(mockResolveHunk).toHaveBeenCalledWith('file:///workspace', 'src/App.tsx', 0, 'ours'));
  });

  it('shows Stage File button after all hunks resolved', async () => {
    const { getByText, getByTestId } = render(<ConflictsTab {...props} />);
    await waitFor(() => fireEvent.press(getByText('src/App.tsx')));
    await waitFor(() => fireEvent.press(getByTestId('accept-ours-0')));
    await waitFor(() => expect(getByTestId('stage-file-btn')).toBeTruthy());
  });
});
