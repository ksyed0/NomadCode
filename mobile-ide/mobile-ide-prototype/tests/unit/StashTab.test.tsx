import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import StashTab from '../../src/components/git/StashTab';
import useGitStore from '../../src/stores/useGitStore';
import type { StashEntry } from '../../src/types/git';

const mockStash = jest.fn();
const mockListStashes = jest.fn();
const mockApplyStash = jest.fn();
const mockDropStash = jest.fn();

jest.mock('../../src/utils/FileSystemBridge', () => ({
  GitBridge: {
    stash: (...a: unknown[]) => mockStash(...a),
    listStashes: (...a: unknown[]) => mockListStashes(...a),
    applyStash: (...a: unknown[]) => mockApplyStash(...a),
    dropStash: (...a: unknown[]) => mockDropStash(...a),
  },
}));
// Use actual field names from src/theme/tokens.ts
jest.mock('../../src/theme/tokens', () => ({
  useTheme: () => ({
    bg: '#0F172A', text: '#E2E8F0', border: '#1e293b',
    accent: '#2563EB', textMuted: '#94a3b8', success: '#22c55e', error: '#EF4444',
  }),
}));

const stashEntries: StashEntry[] = [
  { index: 0, message: 'WIP: auth token', timestamp: Date.now() - 60000, fileCount: 3, files: {} },
  { index: 1, message: 'feature/login in-progress', timestamp: Date.now() - 86400000, fileCount: 7, files: {} },
];

const props = { rootPath: 'file:///workspace' };

describe('StashTab', () => {
  beforeEach(() => {
    useGitStore.getState().reset();
    mockListStashes.mockResolvedValue(stashEntries);
    mockStash.mockResolvedValue(undefined);
    mockApplyStash.mockResolvedValue(undefined);
    mockDropStash.mockResolvedValue(undefined);
    jest.spyOn(Alert, 'alert').mockImplementation((_title, _msg, buttons) => {
      buttons?.find((b) => b.style === 'destructive')?.onPress?.();
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('shows empty state when no stashes', async () => {
    mockListStashes.mockResolvedValue([]);
    const { getByTestId } = render(<StashTab {...props} />);
    await waitFor(() => expect(getByTestId('no-stashes')).toBeTruthy());
  });

  it('lists stash entries with messages', async () => {
    const { getByText } = render(<StashTab {...props} />);
    await waitFor(() => {
      expect(getByText('WIP: auth token')).toBeTruthy();
      expect(getByText('feature/login in-progress')).toBeTruthy();
    });
  });

  it('shows stash@{N} index label', async () => {
    const { getByText } = render(<StashTab {...props} />);
    await waitFor(() => expect(getByText('stash@{0}')).toBeTruthy());
  });

  it('calls stash on Stash button press', async () => {
    const { getByTestId } = render(<StashTab {...props} />);
    await waitFor(() => getByTestId('stash-btn'));
    fireEvent.changeText(getByTestId('stash-message-input'), 'my stash');
    fireEvent.press(getByTestId('stash-btn'));
    await waitFor(() => expect(mockStash).toHaveBeenCalledWith('file:///workspace', 'my stash'));
  });

  it('calls applyStash with drop=true on Pop', async () => {
    const { getAllByText } = render(<StashTab {...props} />);
    await waitFor(() => getAllByText('Pop'));
    fireEvent.press((await waitFor(() => getAllByText('Pop')))[0]);
    await waitFor(() => expect(mockApplyStash).toHaveBeenCalledWith('file:///workspace', 0, true));
  });

  it('calls applyStash with drop=false on Apply', async () => {
    const { getAllByText } = render(<StashTab {...props} />);
    await waitFor(() => getAllByText('Apply'));
    fireEvent.press((await waitFor(() => getAllByText('Apply')))[0]);
    await waitFor(() => expect(mockApplyStash).toHaveBeenCalledWith('file:///workspace', 0, false));
  });

  it('calls dropStash on Drop confirm', async () => {
    const { getAllByText } = render(<StashTab {...props} />);
    await waitFor(() => getAllByText('Drop'));
    fireEvent.press((await waitFor(() => getAllByText('Drop')))[0]);
    await waitFor(() => expect(mockDropStash).toHaveBeenCalledWith('file:///workspace', 0));
  });
});
