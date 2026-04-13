/**
 * Unit tests — GitPanel
 */

import React from 'react';
import { Alert } from 'react-native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import GitPanel from '../../src/components/GitPanel';
import useGitStore from '../../src/stores/useGitStore';
import { GitBridge } from '../../src/utils/FileSystemBridge';

jest.mock('../../src/utils/FileSystemBridge', () => ({
  GitBridge: {
    status: jest.fn(),
    branches: jest.fn(),
    add: jest.fn(),
    remove: jest.fn(),
    commit: jest.fn(),
    push: jest.fn(),
    pull: jest.fn(),
    checkout: jest.fn(),
    createBranch: jest.fn(),
  },
  categorizeStatusMatrix: jest.fn(),
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

const mockStatus = GitBridge.status as jest.Mock;
const mockBranches = GitBridge.branches as jest.Mock;
const mockAdd = GitBridge.add as jest.Mock;
const mockRemove = GitBridge.remove as jest.Mock;
const mockCommit = GitBridge.commit as jest.Mock;
const mockPush = GitBridge.push as jest.Mock;
const mockPull = GitBridge.pull as jest.Mock;
const mockCheckout = GitBridge.checkout as jest.Mock;
const mockCreateBranch = GitBridge.createBranch as jest.Mock;

describe('GitPanel', () => {
  const onClose = jest.fn();
  const onOpenSettings = jest.fn();
  const onOpenDiff = jest.fn();
  const alertSpy = jest.spyOn(Alert, 'alert');

  const defaultStatus = {
    branch: 'main',
    ahead: 0,
    behind: 0,
    modified: ['a.ts'],
    staged: [],
    untracked: [],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    useGitStore.getState().reset();
    mockStatus.mockResolvedValue(defaultStatus);
    mockBranches.mockResolvedValue(['main']);
    mockAdd.mockResolvedValue(undefined);
    mockRemove.mockResolvedValue(undefined);
    mockCommit.mockResolvedValue(undefined);
    mockPush.mockResolvedValue(undefined);
    mockPull.mockResolvedValue(undefined);
    mockCheckout.mockResolvedValue(undefined);
    mockCreateBranch.mockResolvedValue(undefined);
  });

  it('loads status and branches when visible', async () => {
    render(
      <GitPanel
        visible
        onClose={onClose}
        rootPath="/repo"
        authToken="t"
        onOpenSettings={onOpenSettings}
        onOpenDiff={onOpenDiff}
      />,
    );
    await waitFor(() => expect(mockStatus).toHaveBeenCalledWith('/repo'));
    expect(screen.getByText(/Branch: main/)).toBeTruthy();
    expect(useGitStore.getState().branch).toBe('main');
  });

  it('stages file when toggling unstaged path', async () => {
    render(
      <GitPanel
        visible
        onClose={onClose}
        rootPath="/repo"
        authToken="t"
        onOpenSettings={onOpenSettings}
        onOpenDiff={onOpenDiff}
      />,
    );
    await waitFor(() => expect(screen.getByLabelText('Toggle stage a.ts')).toBeTruthy());
    fireEvent.press(screen.getByLabelText('Toggle stage a.ts'));
    await waitFor(() => expect(mockAdd).toHaveBeenCalledWith('/repo', 'a.ts'));
  });

  it('runs commit with trimmed message defaulting to chore string', async () => {
    render(
      <GitPanel
        visible
        onClose={onClose}
        rootPath="/repo"
        authToken="t"
        onOpenSettings={onOpenSettings}
        onOpenDiff={onOpenDiff}
      />,
    );
    await waitFor(() => expect(screen.getByLabelText('Create commit')).toBeTruthy());
    fireEvent.press(screen.getByLabelText('Create commit'));
    await waitFor(() =>
      expect(mockCommit).toHaveBeenCalledWith(
        '/repo',
        'chore: commit from NomadCode',
        expect.objectContaining({ name: 'NomadCode User' }),
      ),
    );
  });

  it('push requires token', async () => {
    render(
      <GitPanel
        visible
        onClose={onClose}
        rootPath="/repo"
        authToken={null}
        onOpenSettings={onOpenSettings}
        onOpenDiff={onOpenDiff}
      />,
    );
    await waitFor(() => expect(screen.getByLabelText('Push to remote')).toBeTruthy());
    fireEvent.press(screen.getByLabelText('Push to remote'));
    expect(alertSpy).toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('pull and push call GitBridge when token present', async () => {
    render(
      <GitPanel
        visible
        onClose={onClose}
        rootPath="/repo"
        authToken="tok"
        onOpenSettings={onOpenSettings}
        onOpenDiff={onOpenDiff}
      />,
    );
    await waitFor(() => expect(screen.getByLabelText('Pull from remote')).toBeTruthy());
    fireEvent.press(screen.getByLabelText('Pull from remote'));
    await waitFor(() =>
      expect(mockPull).toHaveBeenCalledWith(
        '/repo',
        'tok',
        expect.objectContaining({ email: 'user@nomadcode.app' }),
      ),
    );
    fireEvent.press(screen.getByLabelText('Push to remote'));
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/repo', 'tok'));
  });

  it('opens diff for modified file', async () => {
    render(
      <GitPanel
        visible
        onClose={onClose}
        rootPath="/repo"
        authToken="t"
        onOpenSettings={onOpenSettings}
        onOpenDiff={onOpenDiff}
      />,
    );
    await waitFor(() => expect(screen.getByLabelText('Diff a.ts')).toBeTruthy());
    fireEvent.press(screen.getByLabelText('Diff a.ts'));
    expect(onOpenDiff).toHaveBeenCalledWith('a.ts');
  });

  it('creates and checks out branch', async () => {
    render(
      <GitPanel
        visible
        onClose={onClose}
        rootPath="/repo"
        authToken="t"
        onOpenSettings={onOpenSettings}
        onOpenDiff={onOpenDiff}
      />,
    );
    await waitFor(() => expect(screen.getByLabelText('New branch name')).toBeTruthy());
    fireEvent.changeText(screen.getByLabelText('New branch name'), 'feat-x');
    fireEvent.press(screen.getByLabelText('Create and checkout branch'));
    await waitFor(() =>
      expect(mockCreateBranch).toHaveBeenCalledWith('/repo', 'feat-x', true),
    );
    await waitFor(() => expect(screen.getByLabelText('Checkout branch main')).toBeTruthy());
    fireEvent.press(screen.getByLabelText('Checkout branch main'));
    await waitFor(() => expect(mockCheckout).toHaveBeenCalledWith('/repo', 'main'));
  });
});
