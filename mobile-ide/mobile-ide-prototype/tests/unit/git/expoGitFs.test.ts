/**
 * Unit tests — expoGitFs (Expo FileSystem fs adapter for isomorphic-git)
 */

import { buildExpoGitFs } from '../../../src/git/expoGitFs';

const mockReadAsStringAsync = jest.fn();
const mockWriteAsStringAsync = jest.fn();
const mockDeleteAsync = jest.fn();
const mockReadDirectoryAsync = jest.fn();
const mockMakeDirectoryAsync = jest.fn();
const mockGetInfoAsync = jest.fn();

jest.mock('expo-file-system', () => ({
  readAsStringAsync: (...a: unknown[]) => mockReadAsStringAsync(...a),
  writeAsStringAsync: (...a: unknown[]) => mockWriteAsStringAsync(...a),
  deleteAsync: (...a: unknown[]) => mockDeleteAsync(...a),
  readDirectoryAsync: (...a: unknown[]) => mockReadDirectoryAsync(...a),
  makeDirectoryAsync: (...a: unknown[]) => mockMakeDirectoryAsync(...a),
  getInfoAsync: (...a: unknown[]) => mockGetInfoAsync(...a),
  EncodingType: { UTF8: 'utf8', Base64: 'base64' },
}));

beforeEach(() => {
  jest.clearAllMocks();
});

describe('buildExpoGitFs', () => {
  it('readFile returns UTF-8 string when encoding is set', async () => {
    mockReadAsStringAsync.mockResolvedValueOnce('hello');
    const fs = buildExpoGitFs();
    const out = await fs.promises.readFile('/p', { encoding: 'utf8' });
    expect(out).toBe('hello');
    expect(mockReadAsStringAsync).toHaveBeenCalledWith('/p', { encoding: 'utf8' });
  });

  it('readFile returns Uint8Array for binary (base64 path)', async () => {
    mockReadAsStringAsync.mockResolvedValueOnce(btoa('ab'));
    const fs = buildExpoGitFs();
    const out = await fs.promises.readFile('/obj');
    expect(out).toBeInstanceOf(Uint8Array);
    expect([...(out as Uint8Array)]).toEqual([97, 98]);
  });

  it('writeFile writes UTF-8 for string data', async () => {
    mockWriteAsStringAsync.mockResolvedValueOnce(undefined);
    const fs = buildExpoGitFs();
    await fs.promises.writeFile('/f', 'text');
    expect(mockWriteAsStringAsync).toHaveBeenCalledWith('/f', 'text', { encoding: 'utf8' });
  });

  it('writeFile writes base64 for Uint8Array data', async () => {
    mockWriteAsStringAsync.mockResolvedValueOnce(undefined);
    const fs = buildExpoGitFs();
    await fs.promises.writeFile('/f', new Uint8Array([65]));
    expect(mockWriteAsStringAsync).toHaveBeenCalledWith('/f', 'QQ==', { encoding: 'base64' });
  });

  it('readdir strips trailing slash from path', async () => {
    mockReadDirectoryAsync.mockResolvedValueOnce(['a']);
    const fs = buildExpoGitFs();
    await fs.promises.readdir('/dir/');
    expect(mockReadDirectoryAsync).toHaveBeenCalledWith('/dir');
  });

  it('stat throws ENOENT when file missing', async () => {
    mockGetInfoAsync.mockResolvedValueOnce({ exists: false });
    const fs = buildExpoGitFs();
    await expect(fs.promises.stat('/missing')).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('stat returns file-like stats when exists', async () => {
    mockGetInfoAsync.mockResolvedValueOnce({
      exists: true,
      isDirectory: false,
      size: 10,
      modificationTime: 5,
    });
    const fs = buildExpoGitFs();
    const s = await fs.promises.stat('/x');
    expect(s.isFile()).toBe(true);
    expect(s.size).toBe(10);
    expect(s.mtimeMs).toBe(5000);
  });

  it('lstat mirrors stat for existing paths', async () => {
    mockGetInfoAsync.mockResolvedValueOnce({
      exists: true,
      isDirectory: true,
      size: 0,
      modificationTime: 1,
    });
    const fs = buildExpoGitFs();
    const s = await fs.promises.lstat('/d');
    expect(s.isDirectory()).toBe(true);
  });

  it('readlink and symlink reject with ENOSYS', async () => {
    const fs = buildExpoGitFs();
    await expect(fs.promises.readlink('/l')).rejects.toMatchObject({ code: 'ENOSYS' });
    await expect(fs.promises.symlink('t', '/l')).rejects.toMatchObject({ code: 'ENOSYS' });
  });

  it('unlink and rmdir delegate to deleteAsync', async () => {
    mockDeleteAsync.mockResolvedValue(undefined);
    const fs = buildExpoGitFs();
    await fs.promises.unlink('/a');
    await fs.promises.rmdir('/b');
    expect(mockDeleteAsync).toHaveBeenCalledTimes(2);
  });

  it('mkdir delegates to makeDirectoryAsync with intermediates', async () => {
    mockMakeDirectoryAsync.mockResolvedValue(undefined);
    const fs = buildExpoGitFs();
    await fs.promises.mkdir('/nested');
    expect(mockMakeDirectoryAsync).toHaveBeenCalledWith('/nested', { intermediates: true });
  });
});
