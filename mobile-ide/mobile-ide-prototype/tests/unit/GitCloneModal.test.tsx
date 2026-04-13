/**
 * Unit tests — GitCloneModal
 */

import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import GitCloneModal from '../../src/components/GitCloneModal';
import useGitStore from '../../src/stores/useGitStore';
import { GitBridge } from '../../src/utils/FileSystemBridge';

jest.mock('../../src/utils/FileSystemBridge', () => ({
  GitBridge: {
    clone: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('../../src/theme/tokens', () => ({
  useTheme: () => ({
    bgElevated: '#1E293B',
    text: '#E2E8F0',
    textMuted: '#64748B',
    border: '#334155',
    accent: '#2563EB',
  }),
}));

const mockClone = GitBridge.clone as jest.Mock;

describe('GitCloneModal', () => {
  const onClose = jest.fn();
  const onOpenSettings = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    useGitStore.getState().reset();
  });

  it('shows settings link when no auth token', () => {
    render(
      <GitCloneModal
        visible
        onClose={onClose}
        rootPath="/docs/ws"
        authToken={null}
        onOpenSettings={onOpenSettings}
      />,
    );
    fireEvent.press(screen.getByLabelText('Open settings to sign in with GitHub'));
    expect(onOpenSettings).toHaveBeenCalled();
  });

  it('sets error when URL empty', async () => {
    render(
      <GitCloneModal
        visible
        onClose={onClose}
        rootPath="/docs/ws"
        authToken={null}
        onOpenSettings={onOpenSettings}
      />,
    );
    fireEvent.press(screen.getByLabelText('Clone repository'));
    await waitFor(() => {
      expect(useGitStore.getState().lastError).toBe('Enter a repository URL.');
    });
    expect(mockClone).not.toHaveBeenCalled();
  });

  it('clones into workspace subfolder and bumps file tree', async () => {
    render(
      <GitCloneModal
        visible
        onClose={onClose}
        rootPath="/docs/ws"
        authToken="tok"
        onOpenSettings={onOpenSettings}
      />,
    );
    fireEvent.changeText(screen.getByLabelText('Git clone repository URL'), 'https://github.com/o/hello.git');
    fireEvent.changeText(screen.getByLabelText('Clone destination folder name'), 'my-app');
    fireEvent.press(screen.getByLabelText('Clone repository'));
    await waitFor(() => expect(mockClone).toHaveBeenCalled());
    expect(mockClone.mock.calls[0][0]).toBe('https://github.com/o/hello.git');
    expect(mockClone.mock.calls[0][1]).toBe('/docs/ws/my-app');
    expect(mockClone.mock.calls[0][2]).toBe('tok');
    expect(useGitStore.getState().fileTreeRevision).toBeGreaterThan(0);
    expect(onClose).toHaveBeenCalled();
  });

  it('maps auth failure to friendly message', async () => {
    mockClone.mockRejectedValueOnce(new Error('Authentication failed'));
    render(
      <GitCloneModal
        visible
        onClose={onClose}
        rootPath="/docs/ws"
        authToken={null}
        onOpenSettings={onOpenSettings}
      />,
    );
    fireEvent.changeText(screen.getByLabelText('Git clone repository URL'), 'https://github.com/o/r.git');
    fireEvent.press(screen.getByLabelText('Clone repository'));
    await waitFor(() => {
      expect(useGitStore.getState().lastError).toContain('Sign in with GitHub');
    });
  });
});
