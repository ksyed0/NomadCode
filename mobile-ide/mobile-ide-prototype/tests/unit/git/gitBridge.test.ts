/**
 * Unit tests — gitBridge (GitBridge + categorizeStatusMatrix)
 */

const mockClone = jest.fn();
const mockAdd = jest.fn();
const mockRemove = jest.fn();
const mockCommit = jest.fn();
const mockPush = jest.fn();
const mockPull = jest.fn();
const mockCurrentBranch = jest.fn();
const mockStatusMatrix = jest.fn();
const mockListBranches = jest.fn();
const mockCheckout = jest.fn();
const mockBranch = jest.fn();
const mockWalk = jest.fn();
const mockResolveRef = jest.fn();
const mockReadBlob = jest.fn();
const mockDeleteBranch = jest.fn();
const mockLog = jest.fn();

jest.mock('isomorphic-git', () => ({
  __esModule: true,
  default: {
    clone: (...a: unknown[]) => mockClone(...a),
    add: (...a: unknown[]) => mockAdd(...a),
    remove: (...a: unknown[]) => mockRemove(...a),
    commit: (...a: unknown[]) => mockCommit(...a),
    push: (...a: unknown[]) => mockPush(...a),
    pull: (...a: unknown[]) => mockPull(...a),
    currentBranch: (...a: unknown[]) => mockCurrentBranch(...a),
    statusMatrix: (...a: unknown[]) => mockStatusMatrix(...a),
    listBranches: (...a: unknown[]) => mockListBranches(...a),
    checkout: (...a: unknown[]) => mockCheckout(...a),
    branch: (...a: unknown[]) => mockBranch(...a),
    walk: (...a: unknown[]) => mockWalk(...a),
    resolveRef: (...a: unknown[]) => mockResolveRef(...a),
    readBlob: (...a: unknown[]) => mockReadBlob(...a),
    deleteBranch: (...a: unknown[]) => mockDeleteBranch(...a),
    log: (...a: unknown[]) => mockLog(...a),
    TREE: jest.fn(() => ({})),
    WORKDIR: jest.fn(() => ({})),
  },
}));

jest.mock('isomorphic-git/http/web', () => ({}));

const mockMakeDirectoryAsync = jest.fn();
const mockReadAsStringAsync = jest.fn();
const mockWriteAsStringAsync = jest.fn();
const mockDeleteAsync = jest.fn();

jest.mock('expo-file-system/legacy', () => ({
  makeDirectoryAsync: (...a: unknown[]) => mockMakeDirectoryAsync(...a),
  readAsStringAsync: (...a: unknown[]) => mockReadAsStringAsync(...a),
  writeAsStringAsync: (...a: unknown[]) => mockWriteAsStringAsync(...a),
  deleteAsync: (...a: unknown[]) => mockDeleteAsync(...a),
  EncodingType: { UTF8: 'utf8', Base64: 'base64' },
}));

jest.mock('../../../src/git/expoGitFs', () => ({
  buildExpoGitFs: jest.fn(() => ({
    promises: {
      readFile: jest.fn(),
      writeFile: jest.fn(),
      unlink: jest.fn(),
      readdir: jest.fn(),
      mkdir: jest.fn(),
      rmdir: jest.fn(),
      stat: jest.fn(),
      lstat: jest.fn(),
      readlink: jest.fn(),
      symlink: jest.fn(),
    },
  })),
}));

// require after mocks — ESM import cannot follow const/jest.mock in this parser config
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { GitBridge, categorizeStatusMatrix } = require('../../../src/git/gitBridge') as typeof import('../../../src/git/gitBridge');

beforeEach(() => {
  jest.clearAllMocks();
  mockMakeDirectoryAsync.mockResolvedValue(undefined);
  mockClone.mockResolvedValue(undefined);
  mockAdd.mockResolvedValue(undefined);
  mockRemove.mockResolvedValue(undefined);
  mockCommit.mockResolvedValue('abc123');
  mockPush.mockResolvedValue(undefined);
  mockPull.mockResolvedValue(undefined);
  mockCurrentBranch.mockResolvedValue('main');
  mockStatusMatrix.mockResolvedValue([]);
  mockListBranches.mockResolvedValue(['main']);
  mockWriteAsStringAsync.mockResolvedValue(undefined);
  mockCheckout.mockResolvedValue(undefined);
  mockBranch.mockResolvedValue(undefined);
  mockDeleteAsync.mockResolvedValue(undefined);
});

describe('categorizeStatusMatrix', () => {
  it('buckets untracked, staged, and modified paths', () => {
    const m: [string, number, number, number][] = [
      ['u.txt', 0, 2, 0],
      ['staged.txt', 0, 2, 2],
      ['mod.txt', 1, 2, 0],
    ];
    const out = categorizeStatusMatrix(m);
    expect(out.untracked).toContain('u.txt');
    expect(out.staged).toContain('staged.txt');
    expect(out.modified).toContain('mod.txt');
  });
});

describe('GitBridge', () => {
  const dir = '/workspace/repo';
  const author = { name: 'T', email: 't@t.com' };

  it('clone rejects SAF content:// workspaces', async () => {
    await expect(GitBridge.clone('https://github.com/o/r.git', 'content://x')).rejects.toThrow(
      /not supported/,
    );
    expect(mockClone).not.toHaveBeenCalled();
  });

  it('clone normalizes trailing slash and calls git.clone', async () => {
    await GitBridge.clone('https://github.com/o/r.git', `${dir}/`, 'tok');
    // Note: clone no longer pre-creates the destination — expoGitFs.writeFile
    // creates parent dirs on demand, and pre-creating leaves a stale empty
    // folder on failure. Removed assertion for makeDirectoryAsync.
    expect(mockClone).toHaveBeenCalled();
    const arg = mockClone.mock.calls[0][0];
    expect(arg.dir).toBe(dir);
    expect(arg.url).toBe('https://github.com/o/r.git');
    expect(arg.onAuth).toBeDefined();
  });

  it('add and remove call isomorphic-git', async () => {
    await GitBridge.add(dir, 'a.ts');
    await GitBridge.remove(dir, 'b.ts');
    expect(mockAdd).toHaveBeenCalled();
    expect(mockRemove).toHaveBeenCalled();
  });

  it('commit returns sha', async () => {
    const sha = await GitBridge.commit(dir, 'msg', author);
    expect(sha).toBe('abc123');
    expect(mockCommit).toHaveBeenCalled();
  });

  it('push uses current branch and onAuth when token set', async () => {
    mockCurrentBranch.mockResolvedValueOnce('dev');
    await GitBridge.push(dir, 'tok');
    expect(mockPush).toHaveBeenCalled();
    const arg = mockPush.mock.calls[0][0];
    expect(arg.ref).toBe('dev');
    expect(arg.onAuth).toBeDefined();
  });

  it('pull passes author and optional onAuth', async () => {
    await GitBridge.pull(dir, 'tok', author);
    expect(mockPull).toHaveBeenCalled();
  });

  it('status aggregates matrix', async () => {
    mockStatusMatrix.mockResolvedValueOnce([
      ['f.ts', 1, 2, 0],
    ]);
    const s = await GitBridge.status(dir);
    expect(s.branch).toBe('main');
    expect(s.modified).toContain('f.ts');
  });

  it('statusMatrix returns raw matrix', async () => {
    const rows: [string, number, number, number][] = [['x', 0, 0, 0]];
    mockStatusMatrix.mockResolvedValueOnce(rows);
    await expect(GitBridge.statusMatrix(dir)).resolves.toEqual(rows);
  });

  it('branches lists branch names', async () => {
    mockListBranches.mockResolvedValueOnce(['a', 'b']);
    await expect(GitBridge.branches(dir)).resolves.toEqual(['a', 'b']);
  });

  it('checkout and createBranch delegate to isomorphic-git', async () => {
    await GitBridge.checkout(dir, 'other');
    await GitBridge.createBranch(dir, 'feat', true);
    expect(mockCheckout).toHaveBeenCalled();
    expect(mockBranch).toHaveBeenCalledWith(
      expect.objectContaining({ ref: 'feat', checkout: true }),
    );
  });

  it('getWorkingDiff reads HEAD blob + workdir file for a tracked file', async () => {
    mockResolveRef.mockResolvedValueOnce('deadbeef');
    const encoder = new TextEncoder();
    mockReadBlob.mockResolvedValueOnce({ blob: encoder.encode('original') });
    mockReadAsStringAsync.mockResolvedValueOnce('modified');
    const d = await GitBridge.getWorkingDiff(dir, 'file.txt');
    expect(d.headText).toBe('original');
    expect(d.workText).toBe('modified');
  });

  it('getWorkingDiff returns empty headText when file is not in HEAD (untracked)', async () => {
    mockResolveRef.mockRejectedValueOnce(new Error('no HEAD'));
    mockReadAsStringAsync.mockResolvedValueOnce('local only');
    const d = await GitBridge.getWorkingDiff(dir, 'new.txt');
    expect(d.workText).toBe('local only');
    expect(d.headText).toBe('');
  });
});

describe('GitBridge.deleteBranch', () => {
  it('calls git.deleteBranch with correct args', async () => {
    mockDeleteBranch.mockResolvedValue(undefined);
    await GitBridge.deleteBranch('file:///workspace', 'old-branch');
    expect(mockDeleteBranch).toHaveBeenCalledWith(
      expect.objectContaining({ ref: 'old-branch' }),
    );
  });
});

describe('GitBridge.getBlame', () => {
  it('returns BlameLine[] with one entry per line', async () => {
    mockLog.mockResolvedValue([
      { oid: 'abc1234def', commit: { author: { name: 'Alice', timestamp: 1000 }, message: 'init\n' } },
    ]);
    mockReadAsStringAsync.mockResolvedValue('line1\nline2\nline3');
    const result = await GitBridge.getBlame('file:///workspace', 'src/index.ts');
    expect(Array.isArray(result)).toBe(true);
    result.forEach((line) => {
      expect(line).toHaveProperty('lineNumber');
      expect(line).toHaveProperty('commitHash');
      expect(line).toHaveProperty('author');
      expect(line).toHaveProperty('timestamp');
      expect(line).toHaveProperty('message');
    });
  });
});

describe('GitBridge.getConflicts', () => {
  it('returns empty array when no conflicted files', async () => {
    mockStatusMatrix.mockResolvedValue([
      ['src/clean.ts', 1, 1, 1],
    ]);
    const result = await GitBridge.getConflicts('file:///workspace');
    expect(result).toEqual([]);
  });

  it('returns ConflictFile[] for files with conflict markers (head=1,workdir=2,stage=3)', async () => {
    mockStatusMatrix.mockResolvedValue([
      ['src/App.tsx', 1, 2, 3],
    ]);
    // ExpoFS mock will return empty string (no conflict markers), so hunks = []
    // but the array shape should still be ConflictFile[]
    const result = await GitBridge.getConflicts('file:///workspace');
    expect(Array.isArray(result)).toBe(true);
  });
});

describe('GitBridge.resolveHunk', () => {
  it('resolves a hunk with "ours" choice without throwing', async () => {
    // readAsStringAsync will return conflict content from mock
    await expect(
      GitBridge.resolveHunk('file:///workspace', 'src/App.tsx', 0, 'ours'),
    ).resolves.not.toThrow();
  });

  it('resolves a hunk with "theirs" choice without throwing', async () => {
    await expect(
      GitBridge.resolveHunk('file:///workspace', 'src/App.tsx', 0, 'theirs'),
    ).resolves.not.toThrow();
  });

  it('resolves a hunk with "both" choice without throwing', async () => {
    await expect(
      GitBridge.resolveHunk('file:///workspace', 'src/App.tsx', 0, 'both'),
    ).resolves.not.toThrow();
  });
});

describe('GitBridge stash operations', () => {
  beforeEach(() => {
    mockStatusMatrix.mockResolvedValue([['src/App.tsx', 0, 2, 0]]);
    mockResolveRef.mockResolvedValue('abc123oid');
    mockReadBlob.mockResolvedValue({ blob: new TextEncoder().encode('head content') });
    mockCurrentBranch.mockResolvedValue('main');
  });

  it('stash() resolves without error', async () => {
    await expect(GitBridge.stash('file:///workspace', 'WIP')).resolves.not.toThrow();
  });

  it('listStashes() returns an array', async () => {
    const result = await GitBridge.listStashes('file:///workspace');
    expect(Array.isArray(result)).toBe(true);
  });

  it('applyStash() with drop=true resolves without error', async () => {
    await expect(
      GitBridge.applyStash('file:///workspace', 0, true),
    ).resolves.not.toThrow();
  });

  it('applyStash() with drop=false resolves without error', async () => {
    await expect(
      GitBridge.applyStash('file:///workspace', 0, false),
    ).resolves.not.toThrow();
  });

  it('dropStash() resolves without error', async () => {
    await expect(
      GitBridge.dropStash('file:///workspace', 0),
    ).resolves.not.toThrow();
  });
});
