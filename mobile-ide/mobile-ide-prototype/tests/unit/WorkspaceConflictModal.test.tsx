/**
 * Unit tests — WorkspaceConflictModal
 *
 * Verifies visibility, file name rendering, and all three resolution buttons.
 */

import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

// AsyncStorage must be mocked before anything imports useSettingsStore (which
// tokens.ts pulls in transitively at module evaluation time).
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
  removeItem: jest.fn(() => Promise.resolve()),
}));

jest.mock('../../src/theme/tokens', () => {
  const actual = jest.requireActual('../../src/theme/tokens');
  return {
    ...actual,
    useTheme: () => actual.THEMES['nomad-dark'],
  };
});

import WorkspaceConflictModal from '../../src/components/WorkspaceConflictModal';
import type { ConflictInfo } from '../../src/types/workspace';

const CONFLICT: ConflictInfo = {
  tabPath: 'file:///var/mobile/Documents/Projects/index.ts',
  fileName: 'index.ts',
  localContent: 'const a = 1;',
  cloudContent: 'const a = 2;',
};

describe('WorkspaceConflictModal', () => {
  it('renders nothing when conflict is null', () => {
    render(<WorkspaceConflictModal conflict={null} onResolve={jest.fn()} />);
    expect(screen.queryByTestId('conflict-modal')).toBeNull();
  });

  it('renders the modal when conflict is set', () => {
    render(<WorkspaceConflictModal conflict={CONFLICT} onResolve={jest.fn()} />);
    expect(screen.getByTestId('conflict-modal')).toBeTruthy();
  });

  it('shows the conflicted file name', () => {
    render(<WorkspaceConflictModal conflict={CONFLICT} onResolve={jest.fn()} />);
    expect(screen.getByText('index.ts')).toBeTruthy();
  });

  it('"Keep My Changes" button calls onResolve with keep-mine', () => {
    const onResolve = jest.fn();
    render(<WorkspaceConflictModal conflict={CONFLICT} onResolve={onResolve} />);
    fireEvent.press(screen.getByTestId('btn-keep-mine'));
    expect(onResolve).toHaveBeenCalledWith('keep-mine');
  });

  it('"Use Cloud Version" button calls onResolve with use-cloud', () => {
    const onResolve = jest.fn();
    render(<WorkspaceConflictModal conflict={CONFLICT} onResolve={onResolve} />);
    fireEvent.press(screen.getByTestId('btn-use-cloud'));
    expect(onResolve).toHaveBeenCalledWith('use-cloud');
  });

  it('"Keep Both" button calls onResolve with keep-both', () => {
    const onResolve = jest.fn();
    render(<WorkspaceConflictModal conflict={CONFLICT} onResolve={onResolve} />);
    fireEvent.press(screen.getByTestId('btn-keep-both'));
    expect(onResolve).toHaveBeenCalledWith('keep-both');
  });

  it('all three resolution buttons are present', () => {
    render(<WorkspaceConflictModal conflict={CONFLICT} onResolve={jest.fn()} />);
    expect(screen.getByTestId('btn-keep-mine')).toBeTruthy();
    expect(screen.getByTestId('btn-use-cloud')).toBeTruthy();
    expect(screen.getByTestId('btn-keep-both')).toBeTruthy();
  });
});
