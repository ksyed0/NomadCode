/**
 * Unit tests — FileSystemBridge
 *
 * All expo-file-system calls are mocked so tests run without a device/simulator.
 * Coverage targets: listDirectory, readFile, writeFile, createFile, deleteEntry,
 *                   createDirectory, moveEntry, copyEntry, exists, documentDirectory.
 */

import { FileSystemBridge, GitBridge, getUriType, requestWorkspacePermission } from '../../src/utils/FileSystemBridge';

// ---------------------------------------------------------------------------
// Mock expo-file-system (including StorageAccessFramework for SAF tests)
// ---------------------------------------------------------------------------

const mockGetInfoAsync = jest.fn();
const mockReadDirectoryAsync = jest.fn();
const mockReadAsStringAsync = jest.fn();
const mockWriteAsStringAsync = jest.fn();
const mockDeleteAsync = jest.fn();
const mockMakeDirectoryAsync = jest.fn();
const mockMoveAsync = jest.fn();
const mockCopyAsync = jest.fn();

// SAF mocks
const mockSAFReadDirectory = jest.fn();
const mockSAFReadAsString = jest.fn();
const mockSAFWriteAsString = jest.fn();
const mockSAFCreateFile = jest.fn();
const mockSAFDeleteAsync = jest.fn();
const mockSAFRequestPermissions = jest.fn();

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
  StorageAccessFramework: {
    readDirectoryAsync: (...args: unknown[]) => mockSAFReadDirectory(...args),
    readAsStringAsync: (...args: unknown[]) => mockSAFReadAsString(...args),
    writeAsStringAsync: (...args: unknown[]) => mockSAFWriteAsString(...args),
    createFileAsync: (...args: unknown[]) => mockSAFCreateFile(...args),
    deleteAsync: (...args: unknown[]) => mockSAFDeleteAsync(...args),
    requestDirectoryPermissionsAsync: (...args: unknown[]) => mockSAFRequestPermissions(...args),
  },
}));

// Mock react-native-document-picker for iOS picker tests
const mockPickDirectory = jest.fn();
const mockIsCancel = jest.fn((err) => err && err.code === 'DOCUMENT_PICKER_CANCELED');
jest.mock('react-native-document-picker', () => ({
  pickDirectory: (...args: unknown[]) => mockPickDirectory(...args),
  isCancel: (err: unknown) => mockIsCancel(err),
  default: {
    pickDirectory: (...args: unknown[]) => mockPickDirectory(...args),
    isCancel: (err: unknown) => mockIsCancel(err),
  },
}));

// Mock react-native Platform
jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

beforeEach(() => jest.clearAllMocks());

// ---------------------------------------------------------------------------
// getUriType
// ---------------------------------------------------------------------------

describe('getUriType', () => {
  it('returns "saf" for content:// URIs', () => {
    expect(getUriType('content://com.android.externalstorage.documents/tree/primary%3A')).toBe('saf');
  });

  it('returns "file" for file:// URIs', () => {
    expect(getUriType('file:///var/mobile/Documents/')).toBe('file');
  });

  it('returns "file" for plain paths', () => {
    expect(getUriType('/docs/file.ts')).toBe('file');
  });
});

// ---------------------------------------------------------------------------
// listDirectory
// ---------------------------------------------------------------------------

describe('FileSystemBridge.listDirectory', () => {
  it('returns sorted entries (dirs first, then files)', async () => {
    mockGetInfoAsync
      .mockResolvedValueOnce({ exists: true, isDirectory: true }) // root
      .mockResolvedValueOnce({ exists: true, isDirectory: false, size: 100 }) // README.md (listed 1st)
      .mockResolvedValueOnce({ exists: true, isDirectory: false, size: 200 }) // App.tsx (listed 2nd)
      .mockResolvedValueOnce({ exists: true, isDirectory: true,  size: 0 }); // src/ (listed 3rd)
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

// ---------------------------------------------------------------------------
// SAF (content:// URI) paths
// ---------------------------------------------------------------------------

const SAF_DIR = 'content://com.android.externalstorage.documents/tree/primary%3AProjects';
const SAF_FILE = `${SAF_DIR}%2Findex.ts`;

describe('FileSystemBridge.listDirectory — SAF path', () => {
  it('lists SAF directory entries sorted dirs first', async () => {
    const childUris = [
      `${SAF_DIR}%2Fsrc`,
      `${SAF_DIR}%2FREADME.md`,
    ];
    mockSAFReadDirectory.mockResolvedValueOnce(childUris);
    mockGetInfoAsync
      .mockResolvedValueOnce({ exists: true, isDirectory: true, size: 0 }) // src
      .mockResolvedValueOnce({ exists: true, isDirectory: false, size: 100 }); // README.md

    const entries = await FileSystemBridge.listDirectory(SAF_DIR);
    expect(entries[0].name).toBe('src');
    expect(entries[0].isDirectory).toBe(true);
    expect(entries[1].name).toBe('README.md');
    expect(entries[1].isDirectory).toBe(false);
  });

  it('sorts same-type entries alphabetically', async () => {
    const uris = [`${SAF_DIR}%2Fzeta.ts`, `${SAF_DIR}%2Falpha.ts`];
    mockSAFReadDirectory.mockResolvedValueOnce(uris);
    mockGetInfoAsync
      .mockResolvedValueOnce({ exists: true, isDirectory: false, size: 10 })
      .mockResolvedValueOnce({ exists: true, isDirectory: false, size: 20 });

    const entries = await FileSystemBridge.listDirectory(SAF_DIR);
    expect(entries[0].name).toBe('alpha.ts');
    expect(entries[1].name).toBe('zeta.ts');
  });

  it('returns undefined modifiedAt for SAF entries', async () => {
    mockSAFReadDirectory.mockResolvedValueOnce([SAF_FILE]);
    mockGetInfoAsync.mockResolvedValueOnce({ exists: true, isDirectory: false, size: 50 });

    const entries = await FileSystemBridge.listDirectory(SAF_DIR);
    expect(entries[0].modifiedAt).toBeUndefined();
  });
});

describe('FileSystemBridge.readFile — SAF path', () => {
  it('reads SAF file content', async () => {
    mockSAFReadAsString.mockResolvedValueOnce('const a = 1;');

    const content = await FileSystemBridge.readFile(SAF_FILE);
    expect(content).toBe('const a = 1;');
    expect(mockSAFReadAsString).toHaveBeenCalledWith(SAF_FILE, { encoding: 'utf8' });
  });
});

describe('FileSystemBridge.writeFile — SAF path', () => {
  it('writes to a SAF file', async () => {
    mockSAFWriteAsString.mockResolvedValueOnce(undefined);

    await FileSystemBridge.writeFile(SAF_FILE, 'hello');
    expect(mockSAFWriteAsString).toHaveBeenCalledWith(SAF_FILE, 'hello', { encoding: 'utf8' });
  });
});

describe('FileSystemBridge.createFile — SAF path', () => {
  it('creates a SAF file and writes content', async () => {
    const newUri = `${SAF_DIR}%2Fnew.ts`;
    mockSAFCreateFile.mockResolvedValueOnce(newUri);
    mockSAFWriteAsString.mockResolvedValueOnce(undefined);

    await FileSystemBridge.createFile(`${SAF_DIR}/new.ts`, 'hello');
    expect(mockSAFCreateFile).toHaveBeenCalled();
    expect(mockSAFWriteAsString).toHaveBeenCalledWith(newUri, 'hello', { encoding: 'utf8' });
  });

  it('creates a SAF file with empty content (no write call)', async () => {
    const newUri = `${SAF_DIR}%2Fempty.ts`;
    mockSAFCreateFile.mockResolvedValueOnce(newUri);

    await FileSystemBridge.createFile(`${SAF_DIR}/empty.ts`);
    expect(mockSAFCreateFile).toHaveBeenCalled();
    expect(mockSAFWriteAsString).not.toHaveBeenCalled();
  });

  it('correctly splits parentUri and fileName when separator is %2F (not literal /)', async () => {
    // SAF paths from readDirectoryAsync use %2F as the encoded path separator.
    // The old code used lastIndexOf('%2F') which returns the position of '%',
    // making parentUri end with '%' and fileName start with '2F'.
    const path = `${SAF_DIR}%2Fnewfile.ts`;
    const returnedUri = `${SAF_DIR}%2Fnewfile.ts`;
    mockSAFCreateFile.mockResolvedValueOnce(returnedUri);
    mockSAFWriteAsString.mockResolvedValueOnce(undefined);

    await FileSystemBridge.createFile(path, 'hello');
    expect(mockSAFCreateFile).toHaveBeenCalledWith(SAF_DIR, 'newfile.ts', 'text/plain');
  });
});

describe('FileSystemBridge.deleteEntry — SAF path', () => {
  it('deletes a SAF entry', async () => {
    mockSAFDeleteAsync.mockResolvedValueOnce(undefined);

    await FileSystemBridge.deleteEntry(SAF_FILE);
    expect(mockSAFDeleteAsync).toHaveBeenCalledWith(SAF_FILE);
  });
});

describe('FileSystemBridge.createDirectory — SAF path', () => {
  it('is a no-op for SAF paths', async () => {
    await FileSystemBridge.createDirectory(SAF_DIR);
    expect(mockMakeDirectoryAsync).not.toHaveBeenCalled();
  });
});

describe('FileSystemBridge.moveEntry — SAF path', () => {
  it('copies then deletes for SAF source', async () => {
    mockSAFReadAsString.mockResolvedValueOnce('data');
    mockSAFCreateFile.mockResolvedValueOnce(`${SAF_DIR}%2Fmoved.ts`);
    mockSAFWriteAsString.mockResolvedValueOnce(undefined);
    mockSAFDeleteAsync.mockResolvedValueOnce(undefined);

    await FileSystemBridge.moveEntry(SAF_FILE, `${SAF_DIR}/moved.ts`);
    expect(mockSAFReadAsString).toHaveBeenCalled();
    expect(mockSAFCreateFile).toHaveBeenCalled();
    expect(mockSAFDeleteAsync).toHaveBeenCalledWith(SAF_FILE);
  });
});

describe('FileSystemBridge.copyEntry — SAF path', () => {
  it('reads then creates for SAF source', async () => {
    mockSAFReadAsString.mockResolvedValueOnce('data');
    mockSAFCreateFile.mockResolvedValueOnce(`${SAF_DIR}%2Fcopy.ts`);
    mockSAFWriteAsString.mockResolvedValueOnce(undefined);

    await FileSystemBridge.copyEntry(SAF_FILE, `${SAF_DIR}/copy.ts`);
    expect(mockSAFReadAsString).toHaveBeenCalledWith(SAF_FILE, { encoding: 'utf8' });
    expect(mockSAFCreateFile).toHaveBeenCalled();
  });
});

describe('FileSystemBridge.exists — SAF path', () => {
  it('returns true when URI is in parent directory listing', async () => {
    mockSAFReadDirectory.mockResolvedValueOnce([SAF_FILE, `${SAF_DIR}%2Fother.ts`]);
    expect(await FileSystemBridge.exists(SAF_FILE)).toBe(true);
  });

  it('returns false when URI is not in parent directory listing', async () => {
    mockSAFReadDirectory.mockResolvedValueOnce([`${SAF_DIR}%2Fother.ts`]);
    expect(await FileSystemBridge.exists(SAF_FILE)).toBe(false);
  });

  it('returns false when SAF readDirectory throws', async () => {
    mockSAFReadDirectory.mockRejectedValueOnce(new Error('Permission denied'));
    expect(await FileSystemBridge.exists(SAF_FILE)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// requestWorkspacePermission
// ---------------------------------------------------------------------------

describe('requestWorkspacePermission — iOS', () => {
  it('returns a WorkspaceRoot with file uriType when user picks a folder', async () => {
    mockPickDirectory.mockResolvedValueOnce({ uri: 'file:///var/mobile/Documents/Projects/' });

    const result = await requestWorkspacePermission();
    expect(result).not.toBeNull();
    expect(result?.uriType).toBe('file');
    expect(result?.uri).toBe('file:///var/mobile/Documents/Projects/');
    expect(result?.displayName).toBe('Projects');
  });

  it('returns null when user cancels (no result)', async () => {
    mockPickDirectory.mockResolvedValueOnce(null);
    expect(await requestWorkspacePermission()).toBeNull();
  });

  it('returns null when picker throws a cancel error', async () => {
    mockIsCancel.mockReturnValueOnce(true);
    mockPickDirectory.mockRejectedValueOnce({ code: 'DOCUMENT_PICKER_CANCELED' });
    expect(await requestWorkspacePermission()).toBeNull();
  });

  it('returns null when picker throws a non-cancel error', async () => {
    mockIsCancel.mockReturnValueOnce(false);
    mockPickDirectory.mockRejectedValueOnce(new Error('Something went wrong'));
    expect(await requestWorkspacePermission()).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// GitBridge (stub implementations)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// getFileSize
// ---------------------------------------------------------------------------

describe('getFileSize', () => {
  it('returns file size when file exists', async () => {
    mockGetInfoAsync.mockResolvedValue({ exists: true, size: 1234, isDirectory: false, uri: 'file:///x' });
    const size = await FileSystemBridge.getFileSize('file:///x');
    expect(size).toBe(1234);
  });

  it('returns 0 when file does not exist', async () => {
    mockGetInfoAsync.mockResolvedValue({ exists: false, uri: 'file:///x' });
    const size = await FileSystemBridge.getFileSize('file:///x');
    expect(size).toBe(0);
  });

  it('returns 0 when size is undefined', async () => {
    mockGetInfoAsync.mockResolvedValue({ exists: true, uri: 'file:///x' });
    const size = await FileSystemBridge.getFileSize('file:///x');
    expect(size).toBe(0);
  });
});

describe('GitBridge', () => {
  it('clone resolves without rejection (BUG-0041)', async () => {
    await expect(GitBridge.clone('https://example.com/repo', '/dir')).resolves.toBeUndefined();
  });

  it('commit resolves with empty string (BUG-0041)', async () => {
    await expect(
      GitBridge.commit('/dir', 'msg', { name: 'Dev', email: 'dev@example.com' }),
    ).resolves.toBe('');
  });

  it('push resolves without rejection (BUG-0041)', async () => {
    await expect(GitBridge.push('/dir')).resolves.toBeUndefined();
  });

  it('pull resolves without rejection (BUG-0041)', async () => {
    await expect(GitBridge.pull('/dir')).resolves.toBeUndefined();
  });

  it('checkout resolves without rejection (BUG-0041)', async () => {
    await expect(GitBridge.checkout('/dir', 'feature')).resolves.toBeUndefined();
  });

  it('status returns a default status object', async () => {
    const s = await GitBridge.status('/dir');
    expect(s.branch).toBe('main');
    expect(s.modified).toEqual([]);
  });

  it('branches returns ["main"]', async () => {
    const b = await GitBridge.branches('/dir');
    expect(b).toEqual(['main']);
  });
});

// BUG-0041 — stub methods should resolve gracefully, not reject
describe('GitBridge (BUG-0041 — graceful stubs)', () => {
  it('clone resolves without rejection (BUG-0041)', async () => {
    await expect(GitBridge.clone('https://example.com/repo', '/dir')).resolves.toBeUndefined();
  });
  it('commit resolves with empty string (BUG-0041)', async () => {
    await expect(
      GitBridge.commit('/dir', 'msg', { name: 'Dev', email: 'dev@example.com' }),
    ).resolves.toBe('');
  });
  it('push resolves without rejection (BUG-0041)', async () => {
    await expect(GitBridge.push('/dir')).resolves.toBeUndefined();
  });
  it('pull resolves without rejection (BUG-0041)', async () => {
    await expect(GitBridge.pull('/dir')).resolves.toBeUndefined();
  });
  it('checkout resolves without rejection (BUG-0041)', async () => {
    await expect(GitBridge.checkout('/dir', 'feature')).resolves.toBeUndefined();
  });
});
