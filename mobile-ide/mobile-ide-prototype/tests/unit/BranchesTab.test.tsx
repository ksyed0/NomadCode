import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import BranchesTab from '../../src/components/git/BranchesTab';
import useGitStore from '../../src/stores/useGitStore';

const mockBranches = jest.fn();
const mockCreateBranch = jest.fn();
const mockCheckout = jest.fn();
const mockDeleteBranch = jest.fn();

jest.mock('../../src/utils/FileSystemBridge', () => ({
  GitBridge: {
    branches: (...a: unknown[]) => mockBranches(...a),
    createBranch: (...a: unknown[]) => mockCreateBranch(...a),
    checkout: (...a: unknown[]) => mockCheckout(...a),
    deleteBranch: (...a: unknown[]) => mockDeleteBranch(...a),
  },
}));

jest.mock('../../src/theme/tokens', () => ({
  useTheme: () => ({
    bg: '#0F172A', text: '#E2E8F0', border: '#1e293b',
    accent: '#2563EB', textMuted: '#94a3b8', success: '#22c55e', error: '#EF4444',
  }),
}));

const props = { rootPath: 'file:///workspace', authToken: null };

describe('BranchesTab', () => {
  beforeEach(() => {
    useGitStore.getState().reset();
    useGitStore.getState().setBranchInfo('main', 2, 0);
    mockBranches.mockResolvedValue(['main', 'feature/login', 'bugfix/auth']);
    mockCreateBranch.mockResolvedValue(undefined);
    mockCheckout.mockResolvedValue(undefined);
    mockDeleteBranch.mockResolvedValue(undefined);
  });

  it('lists local branches after mount', async () => {
    const { getByText } = render(<BranchesTab {...props} />);
    await waitFor(() => expect(getByText('⎇ feature/login')).toBeTruthy());
  });

  it('shows current branch with a current badge', async () => {
    const { getByTestId } = render(<BranchesTab {...props} />);
    await waitFor(() => expect(getByTestId('current-branch-badge')).toBeTruthy());
  });

  it('shows ahead/behind counts for current branch', async () => {
    const { getByText } = render(<BranchesTab {...props} />);
    await waitFor(() => expect(getByText('↑2 ↓0')).toBeTruthy());
  });

  it('calls checkout when Switch is pressed', async () => {
    const { getAllByText } = render(<BranchesTab {...props} />);
    await waitFor(() => getAllByText('Switch'));
    fireEvent.press((await waitFor(() => getAllByText('Switch')))[0]);
    await waitFor(() => expect(mockCheckout).toHaveBeenCalledWith('file:///workspace', 'feature/login'));
  });

  it('creates branch on pressing Create', async () => {
    const { getByTestId } = render(<BranchesTab {...props} />);
    await waitFor(() => getByTestId('new-branch-input'));
    fireEvent.changeText(getByTestId('new-branch-input'), 'feat/new');
    fireEvent.press(getByTestId('create-branch-btn'));
    await waitFor(() => expect(mockCreateBranch).toHaveBeenCalledWith('file:///workspace', 'feat/new', true));
  });

  it('Create button is disabled when input is blank', async () => {
    const { getByTestId } = render(<BranchesTab {...props} />);
    await waitFor(() => getByTestId('create-branch-btn'));
    expect(getByTestId('create-branch-btn').props.accessibilityState?.disabled).toBe(true);
  });
});
