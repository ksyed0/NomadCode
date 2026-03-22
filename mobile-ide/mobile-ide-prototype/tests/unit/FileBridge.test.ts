/**
 * Unit tests — FileBridge
 *
 * Covers: readFile, writeFile, listDirectory, makeDirectory, deleteEntry,
 *         and handleMessage routing.
 *
 * AC-0126: readFile reads file content
 * AC-0127: writeFile writes content and returns 'ok'
 * AC-0128: listDirectory returns JSON array with '/' suffix for directories
 */

import { FileBridge } from '../../src/terminal/FileBridge';
import type { WebViewToRN } from '../../src/terminal/protocol';

// ---------------------------------------------------------------------------
// Mock expo-file-system
// ---------------------------------------------------------------------------

const mockReadAsStringAsync = jest.fn();
const mockWriteAsStringAsync = jest.fn();
const mockReadDirectoryAsync = jest.fn();
const mockGetInfoAsync = jest.fn();
const mockMakeDirectoryAsync = jest.fn();
const mockDeleteAsync = jest.fn();

jest.mock('expo-file-system', () => ({
  readAsStringAsync: (...args: unknown[]) => mockReadAsStringAsync(...args),
  writeAsStringAsync: (...args: unknown[]) => mockWriteAsStringAsync(...args),
  readDirectoryAsync: (...args: unknown[]) => mockReadDirectoryAsync(...args),
  getInfoAsync: (...args: unknown[]) => mockGetInfoAsync(...args),
  makeDirectoryAsync: (...args: unknown[]) => mockMakeDirectoryAsync(...args),
  deleteAsync: (...args: unknown[]) => mockDeleteAsync(...args),
  documentDirectory: '/docs/',
}));

beforeEach(() => jest.clearAllMocks());

// ---------------------------------------------------------------------------
// readFile
// ---------------------------------------------------------------------------

describe('FileBridge.readFile', () => {
  it('AC-0126: reads file and returns content', async () => {
    mockReadAsStringAsync.mockResolvedValueOnce('const x = 42;');

    const result = await FileBridge.readFile('/docs/index.ts');

    expect(result).toEqual({ result: 'const x = 42;' });
    expect(mockReadAsStringAsync).toHaveBeenCalledWith('/docs/index.ts');
  });

  it('returns error when read fails', async () => {
    mockReadAsStringAsync.mockRejectedValueOnce(new Error('File not found'));

    const result = await FileBridge.readFile('/docs/missing.ts');

    expect(result).toEqual({ result: null, error: 'File not found' });
  });
});

// ---------------------------------------------------------------------------
// writeFile
// ---------------------------------------------------------------------------

describe('FileBridge.writeFile', () => {
  it('AC-0127: writes content and returns ok', async () => {
    mockWriteAsStringAsync.mockResolvedValueOnce(undefined);

    const result = await FileBridge.writeFile('/docs/out.ts', 'hello world');

    expect(result).toEqual({ result: 'ok' });
    expect(mockWriteAsStringAsync).toHaveBeenCalledWith('/docs/out.ts', 'hello world');
  });

  it('returns error when write fails', async () => {
    mockWriteAsStringAsync.mockRejectedValueOnce(new Error('Disk full'));

    const result = await FileBridge.writeFile('/docs/out.ts', '');

    expect(result).toEqual({ result: null, error: 'Disk full' });
  });
});

// ---------------------------------------------------------------------------
// listDirectory
// ---------------------------------------------------------------------------

describe('FileBridge.listDirectory', () => {
  it('AC-0128: returns JSON array of names with "/" suffix for directories', async () => {
    mockReadDirectoryAsync.mockResolvedValueOnce(['src', 'README.md', 'index.ts']);
    mockGetInfoAsync
      .mockResolvedValueOnce({ isDirectory: true })   // src → dir
      .mockResolvedValueOnce({ isDirectory: false })  // README.md → file
      .mockResolvedValueOnce({ isDirectory: false }); // index.ts → file

    const result = await FileBridge.listDirectory('/docs/project');

    expect(result.error).toBeUndefined();
    const parsed = JSON.parse(result.result as string) as string[];
    expect(parsed).toEqual(['src/', 'README.md', 'index.ts']);
  });

  it('appends "/" to path when joining names without trailing slash', async () => {
    mockReadDirectoryAsync.mockResolvedValueOnce(['file.ts']);
    mockGetInfoAsync.mockResolvedValueOnce({ isDirectory: false });

    await FileBridge.listDirectory('/docs/project');

    expect(mockGetInfoAsync).toHaveBeenCalledWith('/docs/project/file.ts');
  });

  it('does not double-add "/" when path already ends with "/"', async () => {
    mockReadDirectoryAsync.mockResolvedValueOnce(['file.ts']);
    mockGetInfoAsync.mockResolvedValueOnce({ isDirectory: false });

    await FileBridge.listDirectory('/docs/project/');

    expect(mockGetInfoAsync).toHaveBeenCalledWith('/docs/project/file.ts');
  });

  it('returns error when listing fails', async () => {
    mockReadDirectoryAsync.mockRejectedValueOnce(new Error('Not a directory'));

    const result = await FileBridge.listDirectory('/docs/bad');

    expect(result).toEqual({ result: null, error: 'Not a directory' });
  });
});

// ---------------------------------------------------------------------------
// makeDirectory
// ---------------------------------------------------------------------------

describe('FileBridge.makeDirectory', () => {
  it('creates directory and returns ok', async () => {
    mockMakeDirectoryAsync.mockResolvedValueOnce(undefined);

    const result = await FileBridge.makeDirectory('/docs/a/b/c');

    expect(result).toEqual({ result: 'ok' });
    expect(mockMakeDirectoryAsync).toHaveBeenCalledWith('/docs/a/b/c', { intermediates: true });
  });

  it('returns error when creation fails', async () => {
    mockMakeDirectoryAsync.mockRejectedValueOnce(new Error('Permission denied'));

    const result = await FileBridge.makeDirectory('/docs/locked');

    expect(result).toEqual({ result: null, error: 'Permission denied' });
  });
});

// ---------------------------------------------------------------------------
// deleteEntry
// ---------------------------------------------------------------------------

describe('FileBridge.deleteEntry', () => {
  it('deletes entry and returns ok', async () => {
    mockDeleteAsync.mockResolvedValueOnce(undefined);

    const result = await FileBridge.deleteEntry('/docs/old.ts');

    expect(result).toEqual({ result: 'ok' });
    expect(mockDeleteAsync).toHaveBeenCalledWith('/docs/old.ts', { idempotent: true });
  });

  it('returns error when deletion fails', async () => {
    mockDeleteAsync.mockRejectedValueOnce(new Error('Cannot delete'));

    const result = await FileBridge.deleteEntry('/docs/locked.ts');

    expect(result).toEqual({ result: null, error: 'Cannot delete' });
  });
});

// ---------------------------------------------------------------------------
// handleMessage
// ---------------------------------------------------------------------------

type FileMsg = Extract<
  WebViewToRN,
  { type: 'FILE_READ' | 'FILE_WRITE' | 'FILE_LIST' | 'FILE_MKDIR' | 'FILE_DELETE' }
>;

describe('FileBridge.handleMessage', () => {
  it('routes FILE_READ to readFile', async () => {
    mockReadAsStringAsync.mockResolvedValueOnce('file content');

    const msg: FileMsg = { type: 'FILE_READ', requestId: 'req-1', path: '/docs/a.ts' };
    const response = await FileBridge.handleMessage(msg);

    expect(response.type).toBe('FILE_RESULT');
    expect(response).toMatchObject({ type: 'FILE_RESULT', requestId: 'req-1', result: 'file content' });
  });

  it('routes FILE_WRITE to writeFile', async () => {
    mockWriteAsStringAsync.mockResolvedValueOnce(undefined);

    const msg: FileMsg = { type: 'FILE_WRITE', requestId: 'req-2', path: '/docs/b.ts', content: 'hello' };
    const response = await FileBridge.handleMessage(msg);

    expect(response).toMatchObject({ type: 'FILE_RESULT', requestId: 'req-2', result: 'ok' });
  });

  it('routes FILE_LIST to listDirectory', async () => {
    mockReadDirectoryAsync.mockResolvedValueOnce(['child.ts']);
    mockGetInfoAsync.mockResolvedValueOnce({ isDirectory: false });

    const msg: FileMsg = { type: 'FILE_LIST', requestId: 'req-3', path: '/docs' };
    const response = await FileBridge.handleMessage(msg);

    expect(response.type).toBe('FILE_RESULT');
    expect(response).toMatchObject({ type: 'FILE_RESULT', requestId: 'req-3' });
    if (response.type === 'FILE_RESULT') {
      const parsed = JSON.parse(response.result as string) as string[];
      expect(parsed).toEqual(['child.ts']);
    }
  });

  it('routes FILE_MKDIR to makeDirectory', async () => {
    mockMakeDirectoryAsync.mockResolvedValueOnce(undefined);

    const msg: FileMsg = { type: 'FILE_MKDIR', requestId: 'req-4', path: '/docs/newdir' };
    const response = await FileBridge.handleMessage(msg);

    expect(response).toMatchObject({ type: 'FILE_RESULT', requestId: 'req-4', result: 'ok' });
  });

  it('routes FILE_DELETE to deleteEntry', async () => {
    mockDeleteAsync.mockResolvedValueOnce(undefined);

    const msg: FileMsg = { type: 'FILE_DELETE', requestId: 'req-5', path: '/docs/old.ts' };
    const response = await FileBridge.handleMessage(msg);

    expect(response).toMatchObject({ type: 'FILE_RESULT', requestId: 'req-5', result: 'ok' });
  });

  it('returned message has correct type FILE_RESULT and preserves requestId', async () => {
    mockReadAsStringAsync.mockResolvedValueOnce('data');

    const msg: FileMsg = { type: 'FILE_READ', requestId: 'unique-id-999', path: '/docs/x.ts' };
    const response = await FileBridge.handleMessage(msg);

    expect(response.type).toBe('FILE_RESULT');
    if (response.type === 'FILE_RESULT') {
      expect(response.requestId).toBe('unique-id-999');
    }
  });
});
