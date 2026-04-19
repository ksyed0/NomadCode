import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import GitScreen from '../../src/components/GitScreen';
import useGitStore from '../../src/stores/useGitStore';

jest.mock('../../src/components/git/BranchesTab', () => () => null);
jest.mock('../../src/components/git/ConflictsTab', () => () => null);
jest.mock('../../src/components/git/StashTab', () => () => null);
jest.mock('../../src/theme/tokens', () => ({
  useTheme: () => ({
    bg: '#0F172A',
    bgElevated: '#1E293B',
    bgHighlight: '#1D3461',
    text: '#E2E8F0',
    textMuted: '#64748B',
    border: '#334155',
    accent: '#2563EB',
    error: '#EF4444',
    success: '#22C55E',
  }),
}));

const baseProps = { rootPath: 'file:///workspace', authToken: null };

describe('GitScreen', () => {
  beforeEach(() => useGitStore.getState().reset());

  it('renders nothing when isGitScreenOpen is false', () => {
    useGitStore.getState().setIsGitScreenOpen(false);
    const { queryByTestId } = render(<GitScreen {...baseProps} />);
    expect(queryByTestId('git-screen-modal')).toBeNull();
  });

  it('renders the modal when isGitScreenOpen is true', () => {
    useGitStore.getState().setIsGitScreenOpen(true);
    const { getByTestId } = render(<GitScreen {...baseProps} />);
    expect(getByTestId('git-screen-modal')).toBeTruthy();
  });

  it('shows Branches tab by default', () => {
    useGitStore.getState().setIsGitScreenOpen(true);
    const { getByTestId } = render(<GitScreen {...baseProps} />);
    expect(getByTestId('tab-branches')).toBeTruthy();
  });

  it('switches to Stash tab on press', () => {
    useGitStore.getState().setIsGitScreenOpen(true);
    const { getByTestId } = render(<GitScreen {...baseProps} />);
    fireEvent.press(getByTestId('tab-stash'));
    expect(useGitStore.getState().activeGitTab).toBe('stash');
  });

  it('shows conflict badge on Conflicts tab when conflicts exist', () => {
    useGitStore.getState().setIsGitScreenOpen(true);
    useGitStore.getState().setConflicts([{ path: 'a.ts', hunks: [] }]);
    const { getByTestId } = render(<GitScreen {...baseProps} />);
    expect(getByTestId('conflicts-badge')).toBeTruthy();
  });

  it('closes on close button press', () => {
    useGitStore.getState().setIsGitScreenOpen(true);
    const { getByTestId } = render(<GitScreen {...baseProps} />);
    fireEvent.press(getByTestId('git-screen-close'));
    expect(useGitStore.getState().isGitScreenOpen).toBe(false);
  });
});
