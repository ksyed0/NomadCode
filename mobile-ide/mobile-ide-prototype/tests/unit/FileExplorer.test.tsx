/**
 * Unit tests — FileExplorer component
 *
 * FileSystemBridge is mocked so no real filesystem access occurs.
 * Tests cover: initial load, loading state, empty directory, tree
 * expansion/collapse, file selection, long-press delete, and error handling.
 */

import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import FileExplorer from '../../src/components/FileExplorer';
import { FileSystemBridge } from '../../src/utils/FileSystemBridge';

// ---------------------------------------------------------------------------
// Mock FileSystemBridge
// ---------------------------------------------------------------------------

jest.mock('../../src/utils/FileSystemBridge', () => ({
  FileSystemBridge: {
    listDirectory: jest.fn(),
    documentDirectory: '/docs/',
  },
}));

const mockListDirectory = FileSystemBridge.listDirectory as jest.Mock;

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const FILES = [
  { name: 'App.tsx',  path: '/docs/App.tsx',  isDirectory: false },
  { name: 'README.md', path: '/docs/README.md', isDirectory: false },
];

const DIR_WITH_CHILD = [
  { name: 'src', path: '/docs/src', isDirectory: true },
  { name: 'App.tsx', path: '/docs/App.tsx', isDirectory: false },
];

const SRC_CHILDREN = [
  { name: 'index.ts', path: '/docs/src/index.ts', isDirectory: false },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

beforeEach(() => jest.clearAllMocks());

function renderExplorer(
  rootPath = '/docs/',
  onFileSelect = jest.fn(),
  onFileDelete?: jest.Mock,
) {
  return render(
    <FileExplorer
      rootPath={rootPath}
      onFileSelect={onFileSelect}
      onFileDelete={onFileDelete}
    />,
  );
}

// ---------------------------------------------------------------------------
// Loading state
// ---------------------------------------------------------------------------

describe('FileExplorer — loading', () => {
  it('shows a loading indicator while the directory is being fetched', () => {
    // Never resolve — keeps component in loading state
    mockListDirectory.mockReturnValue(new Promise(() => {}));
    renderExplorer();
    expect(screen.getByTestId('activity-indicator')).toBeTruthy();
  });

  it('hides the loading indicator once data arrives', async () => {
    mockListDirectory.mockResolvedValue(FILES);
    renderExplorer();
    await waitFor(() => expect(screen.queryByTestId('activity-indicator')).toBeNull());
  });
});

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

describe('FileExplorer — rendering', () => {
  it('renders the EXPLORER header', async () => {
    mockListDirectory.mockResolvedValue([]);
    renderExplorer();
    await waitFor(() => expect(screen.getByText('EXPLORER')).toBeTruthy());
  });

  it('renders files returned by FileSystemBridge', async () => {
    mockListDirectory.mockResolvedValue(FILES);
    renderExplorer();
    await waitFor(() => {
      expect(screen.getByText('App.tsx')).toBeTruthy();
      expect(screen.getByText('README.md')).toBeTruthy();
    });
  });

  it('renders an empty list without crashing when directory is empty', async () => {
    mockListDirectory.mockResolvedValue([]);
    renderExplorer();
    await waitFor(() => expect(screen.getByText('EXPLORER')).toBeTruthy());
    expect(screen.queryByText('App.tsx')).toBeNull();
  });

  it('renders directory entries with the expand icon ▸', async () => {
    mockListDirectory.mockResolvedValue(DIR_WITH_CHILD);
    renderExplorer();
    await waitFor(() => expect(screen.getByText('src')).toBeTruthy());
    expect(screen.getByText('▸')).toBeTruthy();
  });

  it('renders file entries with the bullet icon ·', async () => {
    mockListDirectory.mockResolvedValue(FILES);
    renderExplorer();
    await waitFor(() => expect(screen.getByText('App.tsx')).toBeTruthy());
    // Both files should have a dot icon
    expect(screen.getAllByText('·')).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// File selection
// ---------------------------------------------------------------------------

describe('FileExplorer — file selection', () => {
  it('calls onFileSelect with the file path when a file is tapped', async () => {
    const onFileSelect = jest.fn();
    mockListDirectory.mockResolvedValue(FILES);
    renderExplorer('/docs/', onFileSelect);

    await waitFor(() => screen.getByText('App.tsx'));
    fireEvent.press(screen.getByText('App.tsx'));

    expect(onFileSelect).toHaveBeenCalledWith('/docs/App.tsx');
  });

  it('does not call onFileSelect when a directory is tapped', async () => {
    const onFileSelect = jest.fn();
    mockListDirectory
      .mockResolvedValueOnce(DIR_WITH_CHILD) // root
      .mockResolvedValueOnce(SRC_CHILDREN);  // src/ children
    renderExplorer('/docs/', onFileSelect);

    await waitFor(() => screen.getByText('src'));
    fireEvent.press(screen.getByText('src'));

    expect(onFileSelect).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Directory expansion / collapse
// ---------------------------------------------------------------------------

describe('FileExplorer — expand/collapse', () => {
  it('expands a directory and shows children on tap', async () => {
    mockListDirectory
      .mockResolvedValueOnce(DIR_WITH_CHILD)
      .mockResolvedValueOnce(SRC_CHILDREN);
    renderExplorer();

    await waitFor(() => screen.getByText('src'));
    await act(async () => { fireEvent.press(screen.getByText('src')); });

    await waitFor(() => expect(screen.getByText('index.ts')).toBeTruthy());
  });

  it('changes directory icon from ▸ to ▾ when expanded', async () => {
    mockListDirectory
      .mockResolvedValueOnce(DIR_WITH_CHILD)
      .mockResolvedValueOnce(SRC_CHILDREN);
    renderExplorer();

    await waitFor(() => screen.getByText('src'));
    await act(async () => { fireEvent.press(screen.getByText('src')); });

    await waitFor(() => expect(screen.getByText('▾')).toBeTruthy());
  });

  it('collapses a directory and hides children on second tap', async () => {
    mockListDirectory
      .mockResolvedValueOnce(DIR_WITH_CHILD)
      .mockResolvedValueOnce(SRC_CHILDREN);
    renderExplorer();

    await waitFor(() => screen.getByText('src'));
    // Expand
    await act(async () => { fireEvent.press(screen.getByText('src')); });
    await waitFor(() => screen.getByText('index.ts'));
    // Collapse
    await act(async () => { fireEvent.press(screen.getByText('src')); });

    await waitFor(() => expect(screen.queryByText('index.ts')).toBeNull());
  });

  it('restores ▸ icon after collapse', async () => {
    mockListDirectory
      .mockResolvedValueOnce(DIR_WITH_CHILD)
      .mockResolvedValueOnce(SRC_CHILDREN);
    renderExplorer();

    await waitFor(() => screen.getByText('src'));
    await act(async () => { fireEvent.press(screen.getByText('src')); });
    await waitFor(() => screen.getByText('▾'));
    await act(async () => { fireEvent.press(screen.getByText('src')); });

    await waitFor(() => expect(screen.getByText('▸')).toBeTruthy());
  });
});

// ---------------------------------------------------------------------------
// File deletion
// ---------------------------------------------------------------------------

describe('FileExplorer — deletion', () => {
  it('calls onFileDelete with path on long-press', async () => {
    const onFileDelete = jest.fn();
    mockListDirectory.mockResolvedValue(FILES);
    renderExplorer('/docs/', jest.fn(), onFileDelete);

    await waitFor(() => screen.getByText('App.tsx'));
    fireEvent(screen.getByText('App.tsx'), 'longPress');

    expect(onFileDelete).toHaveBeenCalledWith('/docs/App.tsx');
  });

  it('does not crash if onFileDelete is not provided', async () => {
    mockListDirectory.mockResolvedValue(FILES);
    renderExplorer('/docs/', jest.fn(), undefined);

    await waitFor(() => screen.getByText('App.tsx'));
    expect(() => fireEvent(screen.getByText('App.tsx'), 'longPress')).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------

describe('FileExplorer — error handling', () => {
  it('does not crash when listDirectory rejects', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    mockListDirectory.mockRejectedValue(new Error('Permission denied'));

    renderExplorer();
    await waitFor(() => expect(screen.getByText('EXPLORER')).toBeTruthy());
    jest.restoreAllMocks();
  });
});
