import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import ConflictEditor from '../../src/components/ConflictEditor';

const CONFLICT_CONTENT = `before
<<<<<<< HEAD
ours line
=======
theirs line
>>>>>>> branch
after`;

jest.mock('../../src/utils/FileSystemBridge', () => ({
  FileSystemBridge: {
    readFile: jest.fn().mockResolvedValue(CONFLICT_CONTENT),
    writeFile: jest.fn().mockResolvedValue(undefined),
  },
}));
jest.mock('../../src/git/gitBridge', () => ({
  GitBridge: { add: jest.fn().mockResolvedValue(undefined) },
}));
jest.mock('../../src/theme/tokens', () => ({
  useTheme: () => ({
    bg: '#0F172A', bgElevated: '#1E293B', bgHighlight: '#1D3461',
    text: '#E2E8F0', textMuted: '#64748B', border: '#334155',
    accent: '#2563EB', error: '#EF4444', success: '#22C55E', mode: 'dark',
  }),
}));

const defaultProps = {
  filePath: '/repo/src/file.ts',
  repoDir: '/repo',
  onResolved: jest.fn(),
  onClose: jest.fn(),
};

describe('ConflictEditor', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders OURS and THEIRS content for the conflict', async () => {
    const { getByText } = render(<ConflictEditor {...defaultProps} />);
    await waitFor(() => {
      expect(getByText('ours line')).toBeTruthy();
      expect(getByText('theirs line')).toBeTruthy();
    });
  });

  it('shows Accept Ours button', async () => {
    const { getByText } = render(<ConflictEditor {...defaultProps} />);
    await waitFor(() => expect(getByText('Ours')).toBeTruthy());
  });

  it('"Mark Resolved & Stage" is NOT visible until all hunks resolved', async () => {
    const { queryByText } = render(<ConflictEditor {...defaultProps} />);
    await waitFor(() => {});
    expect(queryByText('Mark Resolved & Stage')).toBeNull();
  });

  it('accepting all hunks reveals Mark Resolved & Stage button', async () => {
    const { getByText } = render(<ConflictEditor {...defaultProps} />);
    await waitFor(() => getByText('Ours'));
    fireEvent.press(getByText('Ours'));
    await waitFor(() => expect(getByText('Mark Resolved & Stage')).toBeTruthy());
  });

  it('Mark Resolved & Stage writes file and calls add then onResolved', async () => {
    const { FileSystemBridge } = require('../../src/utils/FileSystemBridge');
    const { GitBridge } = require('../../src/git/gitBridge');
    const { getByText } = render(<ConflictEditor {...defaultProps} />);
    await waitFor(() => getByText('Ours'));
    fireEvent.press(getByText('Ours'));
    await waitFor(() => getByText('Mark Resolved & Stage'));
    fireEvent.press(getByText('Mark Resolved & Stage'));
    await waitFor(() => {
      expect(FileSystemBridge.writeFile).toHaveBeenCalled();
      expect(GitBridge.add).toHaveBeenCalledWith('/repo', 'src/file.ts');
      expect(defaultProps.onResolved).toHaveBeenCalled();
    });
  });
});
