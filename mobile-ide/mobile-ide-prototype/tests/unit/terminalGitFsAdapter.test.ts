/**
 * Unit tests — gitFs adapter (TC-0325)
 *
 * BUG-0021: isomorphic-git's bindFs() iterates a hardcoded `commands` array
 * that includes "readlink" and "symlink".  It calls `.bind()` on every entry
 * during FileSystem construction — before any git operation runs.  If the fs
 * adapter is missing these methods, `undefined.bind()` throws at runtime and
 * every git command fails with "Cannot read properties of undefined (reading
 * 'bind')".
 *
 * These tests verify that the gitFs adapter satisfies the full contract that
 * isomorphic-git's FileSystem class requires.
 */

import { buildGitFs } from '../../src/terminal/bundle/gitFsAdapter';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Minimal VFS callbacks — we only care about method presence, not I/O. */
function makeNoopVfs() {
  return {
    read: jest.fn().mockResolvedValue(''),
    write: jest.fn().mockResolvedValue(undefined),
    list: jest.fn().mockResolvedValue([]),
    mkdir: jest.fn().mockResolvedValue(undefined),
    del: jest.fn().mockResolvedValue(undefined),
  };
}

/** Full command list that isomorphic-git's bindFs() iterates. */
const ISOMORPHIC_GIT_COMMANDS = [
  'readFile',
  'writeFile',
  'mkdir',
  'rmdir',
  'unlink',
  'stat',
  'lstat',
  'readdir',
  'readlink', // ← was missing — caused BUG-0021
  'symlink',  // ← was missing — caused BUG-0021
] as const;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('buildGitFs', () => {
  describe('gitFs.promises contract', () => {
    it('exposes all methods required by isomorphic-git bindFs', () => {
      const gitFs = buildGitFs(makeNoopVfs());

      for (const method of ISOMORPHIC_GIT_COMMANDS) {
        expect(typeof gitFs.promises[method]).toBe('function');
      }
    });

    it('readlink rejects with ENOSYS (symlinks not supported in VFS)', async () => {
      const gitFs = buildGitFs(makeNoopVfs());
      await expect(gitFs.promises.readlink('/foo')).rejects.toThrow('ENOSYS');
    });

    it('symlink rejects with ENOSYS (symlinks not supported in VFS)', async () => {
      const gitFs = buildGitFs(makeNoopVfs());
      await expect(gitFs.promises.symlink('/target', '/link')).rejects.toThrow('ENOSYS');
    });
  });

  describe('existing I/O delegates', () => {
    it('readFile delegates to vfs.read', async () => {
      const vfs = makeNoopVfs();
      vfs.read.mockResolvedValue('hello');
      const gitFs = buildGitFs(vfs);

      const result = await gitFs.promises.readFile('/test.ts', { encoding: 'utf8' });
      expect(result).toBe('hello');
      expect(vfs.read).toHaveBeenCalledWith('/test.ts');
    });

    it('writeFile delegates to vfs.write', async () => {
      const vfs = makeNoopVfs();
      const gitFs = buildGitFs(vfs);

      await gitFs.promises.writeFile('/out.ts', 'content');
      expect(vfs.write).toHaveBeenCalledWith('/out.ts', 'content');
    });

    it('readdir delegates to vfs.list and strips trailing slashes', async () => {
      const vfs = makeNoopVfs();
      vfs.list.mockResolvedValue(['a/', 'b.ts']);
      const gitFs = buildGitFs(vfs);

      const entries = await gitFs.promises.readdir('/dir');
      expect(entries).toEqual(['a', 'b.ts']);
    });

    it('unlink delegates to vfs.del', async () => {
      const vfs = makeNoopVfs();
      const gitFs = buildGitFs(vfs);

      await gitFs.promises.unlink('/file.ts');
      expect(vfs.del).toHaveBeenCalledWith('/file.ts');
    });

    it('mkdir delegates to vfs.mkdir', async () => {
      const vfs = makeNoopVfs();
      const gitFs = buildGitFs(vfs);

      await gitFs.promises.mkdir('/newdir');
      expect(vfs.mkdir).toHaveBeenCalledWith('/newdir');
    });

    it('rmdir delegates to vfs.del', async () => {
      const vfs = makeNoopVfs();
      const gitFs = buildGitFs(vfs);

      await gitFs.promises.rmdir('/olddir');
      expect(vfs.del).toHaveBeenCalledWith('/olddir');
    });
  });

  describe('stat / lstat', () => {
    it('stat returns directory shape when vfs.list succeeds', async () => {
      const vfs = makeNoopVfs();
      vfs.list.mockResolvedValue(['child.ts']);
      const gitFs = buildGitFs(vfs);

      const s = await gitFs.promises.stat('/dir');
      expect(s.isDirectory()).toBe(true);
      expect(s.isFile()).toBe(false);
      expect(s.isSymbolicLink()).toBe(false);
    });

    it('stat returns file shape when vfs.list throws', async () => {
      const vfs = makeNoopVfs();
      vfs.list.mockRejectedValue(new Error('not a dir'));
      const gitFs = buildGitFs(vfs);

      const s = await gitFs.promises.stat('/file.ts');
      expect(s.isFile()).toBe(true);
      expect(s.isDirectory()).toBe(false);
    });

    it('lstat matches stat (VFS has no symlinks)', async () => {
      const vfs = makeNoopVfs();
      vfs.list.mockResolvedValue([]);
      const gitFs = buildGitFs(vfs);

      const stat = await gitFs.promises.stat('/dir');
      const lstat = await gitFs.promises.lstat('/dir');
      expect(lstat.isDirectory()).toBe(stat.isDirectory());
      expect(lstat.isSymbolicLink()).toBe(false);
    });
  });
});
