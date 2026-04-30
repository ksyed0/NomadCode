import { stash, stashList, stashPop, stashApply } from '../../src/git/stashStore';
import { GitBridge } from '../../src/git/gitBridge';
import { FileSystemBridge } from '../../src/utils/FileSystemBridge';

// Mock AsyncStorage
const mockStorage: Record<string, string> = {};
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn((key: string) => Promise.resolve(mockStorage[key] ?? null)),
  setItem: jest.fn((key: string, val: string) => { mockStorage[key] = val; return Promise.resolve(); }),
}));

// Mock GitBridge
jest.mock('../../src/git/gitBridge', () => ({
  GitBridge: {
    status: jest.fn().mockResolvedValue({
      modified: ['src/a.ts', 'src/b.ts'],
      staged: [],
      untracked: [],
      branch: 'main', ahead: 0, behind: 0, repoDir: '/repo', noRepo: false,
    }),
    readHeadFile: jest.fn().mockResolvedValue('head content'),
  },
}));

// Mock FileSystemBridge
const writtenFiles: Record<string, string> = {};
jest.mock('../../src/utils/FileSystemBridge', () => ({
  FileSystemBridge: {
    readFile: jest.fn().mockImplementation((path: string) =>
      Promise.resolve(`working content of ${path}`)),
    writeFile: jest.fn().mockImplementation((path: string, content: string) => {
      writtenFiles[path] = content;
      return Promise.resolve();
    }),
  },
}));

beforeEach(() => {
  Object.keys(mockStorage).forEach(k => delete mockStorage[k]);
  Object.keys(writtenFiles).forEach(k => delete writtenFiles[k]);
  jest.clearAllMocks();
});

describe('stash', () => {
  it('saves modified file contents to storage', async () => {
    await stash('/repo', 'my stash');
    const entries = await stashList('/repo');
    expect(entries).toHaveLength(1);
    expect(entries[0].message).toBe('my stash');
    expect(entries[0].files).toHaveLength(2);
  });

  it('reverts modified files to HEAD content', async () => {
    await stash('/repo');
    expect((FileSystemBridge.writeFile as jest.Mock)).toHaveBeenCalledWith(
      expect.stringContaining('src/a.ts'), 'head content',
    );
  });

  it('skips untracked files (readHeadFile returns null)', async () => {
    (GitBridge.readHeadFile as jest.Mock)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce('head content');
    await stash('/repo');
    const [entry] = await stashList('/repo');
    expect(entry.files).toHaveLength(1);
  });

  it('throws when there are no unstaged modifications', async () => {
    (GitBridge.status as jest.Mock).mockResolvedValueOnce({
      modified: [], staged: [], untracked: [],
      branch: 'main', ahead: 0, behind: 0, repoDir: '/repo', noRepo: false,
    });
    await expect(stash('/repo')).rejects.toThrow('Nothing to stash');
  });
});

describe('stashList', () => {
  it('returns empty array when no stash exists', async () => {
    expect(await stashList('/repo')).toEqual([]);
  });

  it('returns entries newest-first', async () => {
    await stash('/repo', 'first');
    await stash('/repo', 'second');
    const list = await stashList('/repo');
    expect(list[0].message).toBe('second');
    expect(list[1].message).toBe('first');
  });
});

describe('stashPop', () => {
  it('restores file contents and removes the entry', async () => {
    await stash('/repo', 'pop me');
    const [entry] = await stashList('/repo');
    await stashPop('/repo', entry.id);
    expect(await stashList('/repo')).toHaveLength(0);
    expect((FileSystemBridge.writeFile as jest.Mock)).toHaveBeenCalled();
  });

  it('throws when entry id is not found', async () => {
    await expect(stashPop('/repo', 'nonexistent-id')).rejects.toThrow('Stash entry not found');
  });
});

describe('stashApply', () => {
  it('restores file contents and keeps the entry', async () => {
    await stash('/repo', 'apply me');
    const [entry] = await stashList('/repo');
    await stashApply('/repo', entry.id);
    expect(await stashList('/repo')).toHaveLength(1);
  });

  it('throws when entry id is not found', async () => {
    await expect(stashApply('/repo', 'nonexistent-id')).rejects.toThrow('Stash entry not found');
  });
});
