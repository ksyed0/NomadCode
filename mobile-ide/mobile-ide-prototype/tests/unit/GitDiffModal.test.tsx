/**
 * Unit tests — GitDiffModal
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react-native';
import GitDiffModal from '../../src/components/GitDiffModal';
import { GitBridge } from '../../src/utils/FileSystemBridge';

jest.mock('../../src/utils/FileSystemBridge', () => ({
  GitBridge: {
    getWorkingDiff: jest.fn().mockResolvedValue({ headText: 'a\nb', workText: 'a\nc' }),
    getCommitDiff: jest.fn().mockResolvedValue({ beforeText: 'old\nline', afterText: 'new\nline' }),
  },
}));

jest.mock('../../src/theme/tokens', () => ({
  useTheme: () => ({
    bgElevated: '#1E293B',
    text: '#E2E8F0',
    textMuted: '#64748B',
    border: '#334155',
    accent: '#2563EB',
    error: '#EF4444',
    success: '#22C55E',
  }),
}));

const mockGetWorkingDiff = GitBridge.getWorkingDiff as jest.Mock;
const mockGetCommitDiff = GitBridge.getCommitDiff as jest.Mock;

describe('GitDiffModal', () => {
  const onClose = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('loads diff when visible with filepath', async () => {
    render(
      <GitDiffModal visible onClose={onClose} rootPath="/repo" filepath="src/x.ts" />,
    );
    await waitFor(() => expect(mockGetWorkingDiff).toHaveBeenCalledWith('/repo', 'src/x.ts'));
    expect(screen.getByText(/Diff: src\/x.ts/)).toBeTruthy();
  });

  it('shows error when getWorkingDiff fails', async () => {
    mockGetWorkingDiff.mockRejectedValueOnce(new Error('boom'));
    render(
      <GitDiffModal visible onClose={onClose} rootPath="/repo" filepath="f.ts" />,
    );
    await waitFor(() => expect(screen.getByText('boom')).toBeTruthy());
  });

  it('loads commit diff when commitHash is provided', async () => {
    render(
      <GitDiffModal visible onClose={onClose} rootPath="/repo" filepath="src/x.ts" commitHash="abc1234" />,
    );
    await waitFor(() =>
      expect(mockGetCommitDiff).toHaveBeenCalledWith('/repo', 'abc1234', 'src/x.ts'),
    );
    expect(mockGetWorkingDiff).not.toHaveBeenCalled();
    expect(screen.getByText(/Commit abc1234: src\/x.ts/)).toBeTruthy();
  });

  it('shows error when getCommitDiff fails', async () => {
    mockGetCommitDiff.mockRejectedValueOnce(new Error('no commit'));
    render(
      <GitDiffModal visible onClose={onClose} rootPath="/repo" filepath="f.ts" commitHash="deadbeef" />,
    );
    await waitFor(() => expect(screen.getByText('no commit')).toBeTruthy());
  });

  it('does not call getWorkingDiff when commitHash is provided', async () => {
    render(
      <GitDiffModal visible onClose={onClose} rootPath="/repo" filepath="src/x.ts" commitHash="abc1234" />,
    );
    await waitFor(() => expect(mockGetCommitDiff).toHaveBeenCalled());
    expect(mockGetWorkingDiff).not.toHaveBeenCalled();
  });
});
