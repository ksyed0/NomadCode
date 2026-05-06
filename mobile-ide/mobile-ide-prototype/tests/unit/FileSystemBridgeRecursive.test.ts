import { FileSystemBridge } from '../../src/utils/FileSystemBridge';

jest.mock('expo-file-system/legacy', () => ({
  getInfoAsync:       jest.fn(),
  readDirectoryAsync: jest.fn(),
  readAsStringAsync:  jest.fn(),
  writeAsStringAsync: jest.fn(),
  deleteAsync:        jest.fn(),
  documentDirectory:  '/docs/',
  EncodingType:       { UTF8: 'utf8' },
}));

import * as ExpoFS from 'expo-file-system/legacy';

beforeEach(() => jest.clearAllMocks());

describe('FileSystemBridge.listFilesRecursive', () => {
  it('returns all files under a flat directory', async () => {
    (ExpoFS.getInfoAsync as jest.Mock).mockImplementation((p: string) =>
      Promise.resolve({ exists: true, isDirectory: p === '/workspace/' })
    );
    (ExpoFS.readDirectoryAsync as jest.Mock).mockResolvedValue(['foo.ts', 'bar.js']);
    const files = await FileSystemBridge.listFilesRecursive('/workspace/');
    expect(files).toContain('/workspace/foo.ts');
    expect(files).toContain('/workspace/bar.js');
  });

  it('recurses into subdirectories', async () => {
    (ExpoFS.getInfoAsync as jest.Mock).mockImplementation((p: string) =>
      Promise.resolve({ exists: true, isDirectory: p === '/ws/' || p === '/ws/src' })
    );
    (ExpoFS.readDirectoryAsync as jest.Mock)
      .mockResolvedValueOnce(['src'])
      .mockResolvedValueOnce(['index.ts']);
    const files = await FileSystemBridge.listFilesRecursive('/ws/');
    expect(files).toContain('/ws/src/index.ts');
    expect(files).not.toContain('/ws/src');
  });

  it('excludes node_modules directories', async () => {
    (ExpoFS.getInfoAsync as jest.Mock).mockImplementation((p: string) =>
      Promise.resolve({ exists: true, isDirectory: p === '/ws/' || p === '/ws/node_modules' })
    );
    (ExpoFS.readDirectoryAsync as jest.Mock).mockResolvedValueOnce(['index.ts', 'node_modules']);
    const files = await FileSystemBridge.listFilesRecursive('/ws/');
    expect(files).not.toEqual(expect.arrayContaining([expect.stringContaining('node_modules')]));
  });

  it('excludes .git directories', async () => {
    (ExpoFS.getInfoAsync as jest.Mock).mockImplementation((p: string) =>
      Promise.resolve({ exists: true, isDirectory: p === '/ws/' || p === '/ws/.git' })
    );
    (ExpoFS.readDirectoryAsync as jest.Mock).mockResolvedValueOnce(['index.ts', '.git']);
    const files = await FileSystemBridge.listFilesRecursive('/ws/');
    expect(files).not.toEqual(expect.arrayContaining([expect.stringContaining('.git')]));
  });

  it('returns empty array for empty directory', async () => {
    (ExpoFS.getInfoAsync as jest.Mock).mockResolvedValue({ exists: true, isDirectory: true });
    (ExpoFS.readDirectoryAsync as jest.Mock).mockResolvedValue([]);
    expect(await FileSystemBridge.listFilesRecursive('/ws/')).toEqual([]);
  });
});
