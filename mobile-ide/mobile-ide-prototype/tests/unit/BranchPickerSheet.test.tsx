import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import BranchPickerSheet from '../../src/components/BranchPickerSheet';

jest.mock('../../src/git/gitBridge', () => ({
  GitBridge: {
    branches: jest.fn().mockResolvedValue(['main', 'develop', 'origin/main', 'origin/develop']),
    checkout: jest.fn().mockResolvedValue(undefined),
    createBranch: jest.fn().mockResolvedValue(undefined),
  },
}));
jest.mock('../../src/theme/tokens', () => ({
  useTheme: () => ({
    bg: '#0F172A', bgElevated: '#1E293B', bgHighlight: '#1D3461',
    text: '#E2E8F0', textMuted: '#64748B', border: '#334155',
    accent: '#2563EB', error: '#EF4444', success: '#22C55E', mode: 'dark',
  }),
}));

const defaultProps = {
  visible: true,
  onClose: jest.fn(),
  currentBranch: 'main',
  repoDir: '/repo',
  onBranchSelected: jest.fn(),
};

describe('BranchPickerSheet', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders local branches from GitBridge.branches()', async () => {
    const { getByText } = render(<BranchPickerSheet {...defaultProps} />);
    await waitFor(() => expect(getByText('develop')).toBeTruthy());
  });

  it('shows current branch with a check mark', async () => {
    const { getByText } = render(<BranchPickerSheet {...defaultProps} />);
    await waitFor(() => expect(getByText('✓ main')).toBeTruthy());
  });

  it('filters branches by search query', async () => {
    const { getByPlaceholderText, queryByText } = render(<BranchPickerSheet {...defaultProps} />);
    await waitFor(() => {});
    fireEvent.changeText(getByPlaceholderText(/search/i), 'develop');
    expect(queryByText('✓ main')).toBeNull();
  });

  it('calls GitBridge.checkout and onBranchSelected on branch tap', async () => {
    const { GitBridge } = require('../../src/git/gitBridge');
    const { getByText } = render(<BranchPickerSheet {...defaultProps} />);
    await waitFor(() => getByText('develop'));
    fireEvent.press(getByText('develop'));
    await waitFor(() => {
      expect(GitBridge.checkout).toHaveBeenCalledWith('/repo', 'develop');
      expect(defaultProps.onBranchSelected).toHaveBeenCalledWith('develop');
    });
  });

  it('creates a new branch when name entered and Create pressed', async () => {
    const { GitBridge } = require('../../src/git/gitBridge');
    const { getByText, getByPlaceholderText } = render(<BranchPickerSheet {...defaultProps} />);
    await waitFor(() => {});
    fireEvent.press(getByText('+ New branch'));
    fireEvent.changeText(getByPlaceholderText(/branch name/i), 'feature/xyz');
    fireEvent.press(getByText('Create'));
    await waitFor(() => {
      expect(GitBridge.createBranch).toHaveBeenCalledWith('/repo', 'feature/xyz', true);
    });
  });

  it('does not render branch list when visible is false', () => {
    const { queryByText } = render(<BranchPickerSheet {...defaultProps} visible={false} />);
    expect(queryByText('develop')).toBeNull();
  });
});
