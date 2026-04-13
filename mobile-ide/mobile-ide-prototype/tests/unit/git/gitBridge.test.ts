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
    TREE: jest.fn(() => ({})),
    WORKDIR: jest.fn(() => ({})),
  },
}));

jest.mock('isomorphic-git/http/web', () => ({}));

const mockMakeDirectoryAsync = jest.fn();
const mockReadAsStringAsync = jest.fn();

jest.mock('expo-file-system', () => ({
  makeDirectoryAsync: (...a: unknown[]) => mockMakeDirectoryAsync(...a),
  readAsStringAsync: (...a: unknown[]) => mockReadAsStringAsync(...a),
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
  mockCheckout.mockResolvedValue(undefined);
  mockBranch.mockResolvedValue(undefined);
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
    expect(mockMakeDirectoryAsync).toHaveBeenCalled();
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

  it('getWorkingDiff returns walk result when present', async () => {
    mockWalk.mockResolvedValueOnce({ headText: 'a', workText: 'b' });
    const d = await GitBridge.getWorkingDiff(dir, 'file.txt');
    expect(d).toEqual({ headText: 'a', workText: 'b' });
  });

  it('getWorkingDiff falls back to readAsStringAsync when walk finds nothing', async () => {
    mockWalk.mockResolvedValueOnce(null);
    mockReadAsStringAsync.mockResolvedValueOnce('local only');
    const d = await GitBridge.getWorkingDiff(dir, 'new.txt');
    expect(d.workText).toBe('local only');
    expect(d.headText).toBe('');
  });
});
