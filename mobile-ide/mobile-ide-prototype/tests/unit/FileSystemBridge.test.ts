/**
 * Unit tests — FileSystemBridge
 *
 * All expo-file-system calls are mocked so tests run without a device/simulator.
 * Coverage targets: listDirectory, readFile, writeFile, createFile, deleteEntry,
 *                   createDirectory, moveEntry, copyEntry, exists, documentDirectory.
 */

import { FileSystemBridge } from '../../src/utils/FileSystemBridge';

// ---------------------------------------------------------------------------
// Mock expo-file-system
// ---------------------------------------------------------------------------

const mockGetInfoAsync = jest.fn();
const mockReadDirectoryAsync = jest.fn();
const mockReadAsStringAsync = jest.fn();
const mockWriteAsStringAsync = jest.fn();
const mockDeleteAsync = jest.fn();
const mockMakeDirectoryAsync = jest.fn();
const mockMoveAsync = jest.fn();
const mockCopyAsync = jest.fn();

jest.mock('expo-file-system', () => ({
  getInfoAsync: (...args: unknown[]) => mockGetInfoAsync(...args),
  readDirectoryAsync: (...args: unknown[]) => mockReadDirectoryAsync(...args),
  readAsStringAsync: (...args: unknown[]) => mockReadAsStringAsync(...args),
  writeAsStringAsync: (...args: unknown[]) => mockWriteAsStringAsync(...args),
  deleteAsync: (...args: unknown[]) => mockDeleteAsync(...args),
  makeDirectoryAsync: (...args: unknown[]) => mockMakeDirectoryAsync(...args),
  moveAsync: (...args: unknown[]) => mockMoveAsync(...args),
  copyAsync: (...args: unknown[]) => mockCopyAsync(...args),
  documentDirectory: '/docs/',
  EncodingType: { UTF8: 'utf8' },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

beforeEach(() => jest.clearAllMocks());

// ---------------------------------------------------------------------------
// listDirectory
// ---------------------------------------------------------------------------

describe('FileSystemBridge.listDirectory', () => {
  it('returns sorted entries (dirs first, then files)', async () => {
    mockGetInfoAsync
      .mockResolvedValueOnce({ exists: true, isDirectory: true }) // root
      .mockResolvedValueOnce({ exists: true, isDirectory: true,  size: 0 }) // src/
      .mockResolvedValueOnce({ exists: true, isDirectory: false, size: 100 }) // README.md
      .mockResolvedValueOnce({ exists: true, isDirectory: false, size: 200 }); // App.tsx
    mockReadDirectoryAsync.mockResolvedValueOnce(['README.md', 'App.tsx', 'src']);

    const entries = await FileSystemBridge.listDirectory('/docs/project');

    expect(entries[0].name).toBe('src');
    expect(entries[0].isDirectory).toBe(true);
    expect(entries[1].name).toBe('App.tsx');
    expect(entries[2].name).toBe('README.md');
  });

  it('returns empty array when directory does not exist', async () => {
    mockGetInfoAsync.mockResolvedValueOnce({ exists: false, isDirectory: false });

    const entries = await FileSystemBridge.listDirectory('/does/not/exist');
    expect(entries).toEqual([]);
  });

  it('returns empty array when path is a file, not a directory', async () => {
    mockGetInfoAsync.mockResolvedValueOnce({ exists: true, isDirectory: false });

    const entries = await FileSystemBridge.listDirectory('/docs/file.ts');
    expect(entries).toEqual([]);
  });

  it('normalizes paths that already end with /', async () => {
    mockGetInfoAsync.mockResolvedValueOnce({ exists: true, isDirectory: true });
    mockReadDirectoryAsync.mockResolvedValueOnce([]);

    const entries = await FileSystemBridge.listDirectory('/docs/');
    expect(mockGetInfoAsync).toHaveBeenCalledWith('/docs/');
    expect(entries).toEqual([]);
  });

  it('appends missing trailing slash before calling getInfoAsync', async () => {
    mockGetInfoAsync.mockResolvedValueOnce({ exists: true, isDirectory: true });
    mockReadDirectoryAsync.mockResolvedValueOnce([]);

    await FileSystemBridge.listDirectory('/docs/project');
    expect(mockGetInfoAsync).toHaveBeenCalledWith('/docs/project/');
  });
});

// ---------------------------------------------------------------------------
// readFile
// ---------------------------------------------------------------------------

describe('FileSystemBridge.readFile', () => {
  it('returns file content as string', async () => {
    mockReadAsStringAsync.mockResolvedValueOnce('const x = 1;');

    const content = await FileSystemBridge.readFile('/docs/index.ts');
    expect(content).toBe('const x = 1;');
    expect(mockReadAsStringAsync).toHaveBeenCalledWith('/docs/index.ts', { encoding: 'utf8' });
  });

  it('propagates errors from expo-file-system', async () => {
    mockReadAsStringAsync.mockRejectedValueOnce(new Error('File not found'));

    await expect(FileSystemBridge.readFile('/missing.ts')).rejects.toThrow('File not found');
  });
});

// ---------------------------------------------------------------------------
// writeFile
// ---------------------------------------------------------------------------

describe('FileSystemBridge.writeFile', () => {
  it('writes content with UTF-8 encoding', async () => {
    mockWriteAsStringAsync.mockResolvedValueOnce(undefined);

    await FileSystemBridge.writeFile('/docs/out.ts', 'hello');
    expect(mockWriteAsStringAsync).toHaveBeenCalledWith('/docs/out.ts', 'hello', { encoding: 'utf8' });
  });

  it('propagates write errors', async () => {
    mockWriteAsStringAsync.mockRejectedValueOnce(new Error('Disk full'));

    await expect(FileSystemBridge.writeFile('/docs/out.ts', '')).rejects.toThrow('Disk full');
  });
});

// ---------------------------------------------------------------------------
// createFile
// ---------------------------------------------------------------------------

describe('FileSystemBridge.createFile', () => {
  it('creates file with empty string by default', async () => {
    mockWriteAsStringAsync.mockResolvedValueOnce(undefined);

    await FileSystemBridge.createFile('/docs/new.ts');
    expect(mockWriteAsStringAsync).toHaveBeenCalledWith('/docs/new.ts', '', { encoding: 'utf8' });
  });

  it('creates file with provided initial content', async () => {
    mockWriteAsStringAsync.mockResolvedValueOnce(undefined);

    await FileSystemBridge.createFile('/docs/hello.ts', 'console.log("hi")');
    expect(mockWriteAsStringAsync).toHaveBeenCalledWith('/docs/hello.ts', 'console.log("hi")', { encoding: 'utf8' });
  });
});

// ---------------------------------------------------------------------------
// deleteEntry
// ---------------------------------------------------------------------------

describe('FileSystemBridge.deleteEntry', () => {
  it('calls deleteAsync with idempotent flag', async () => {
    mockDeleteAsync.mockResolvedValueOnce(undefined);

    await FileSystemBridge.deleteEntry('/docs/old.ts');
    expect(mockDeleteAsync).toHaveBeenCalledWith('/docs/old.ts', { idempotent: true });
  });
});

// ---------------------------------------------------------------------------
// createDirectory
// ---------------------------------------------------------------------------

describe('FileSystemBridge.createDirectory', () => {
  it('calls makeDirectoryAsync with intermediates flag', async () => {
    mockMakeDirectoryAsync.mockResolvedValueOnce(undefined);

    await FileSystemBridge.createDirectory('/docs/a/b/c');
    expect(mockMakeDirectoryAsync).toHaveBeenCalledWith('/docs/a/b/c', { intermediates: true });
  });
});

// ---------------------------------------------------------------------------
// moveEntry / copyEntry
// ---------------------------------------------------------------------------

describe('FileSystemBridge.moveEntry', () => {
  it('calls moveAsync with from/to', async () => {
    mockMoveAsync.mockResolvedValueOnce(undefined);

    await FileSystemBridge.moveEntry('/docs/old.ts', '/docs/new.ts');
    expect(mockMoveAsync).toHaveBeenCalledWith({ from: '/docs/old.ts', to: '/docs/new.ts' });
  });
});

describe('FileSystemBridge.copyEntry', () => {
  it('calls copyAsync with from/to', async () => {
    mockCopyAsync.mockResolvedValueOnce(undefined);

    await FileSystemBridge.copyEntry('/docs/a.ts', '/docs/b.ts');
    expect(mockCopyAsync).toHaveBeenCalledWith({ from: '/docs/a.ts', to: '/docs/b.ts' });
  });
});

// ---------------------------------------------------------------------------
// exists
// ---------------------------------------------------------------------------

describe('FileSystemBridge.exists', () => {
  it('returns true when file exists', async () => {
    mockGetInfoAsync.mockResolvedValueOnce({ exists: true });
    expect(await FileSystemBridge.exists('/docs/file.ts')).toBe(true);
  });

  it('returns false when file does not exist', async () => {
    mockGetInfoAsync.mockResolvedValueOnce({ exists: false });
    expect(await FileSystemBridge.exists('/docs/missing.ts')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// documentDirectory
// ---------------------------------------------------------------------------

describe('FileSystemBridge.documentDirectory', () => {
  it('returns the expo document directory', () => {
    expect(FileSystemBridge.documentDirectory).toBe('/docs/');
  });
});
