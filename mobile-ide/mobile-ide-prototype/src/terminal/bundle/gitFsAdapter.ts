/**
 * gitFsAdapter.ts
 *
 * Builds an isomorphic-git–compatible `fs` object backed by the VFS bridge
 * (postMessage round-trips to React Native).
 *
 * Extracted from index.ts so this module can be unit-tested without browser
 * globals or DOM dependencies.
 */

// ---------------------------------------------------------------------------
// VFS callback interface (injected by index.ts)
// ---------------------------------------------------------------------------

export interface VfsCallbacks {
  read: (path: string) => Promise<string>;
  write: (path: string, content: string) => Promise<void>;
  list: (path: string) => Promise<string[]>;
  mkdir: (path: string) => Promise<void>;
  del: (path: string) => Promise<void>;
}

// ---------------------------------------------------------------------------
// Stat shape returned by stat / lstat
// ---------------------------------------------------------------------------

interface StatResult {
  isFile: () => boolean;
  isDirectory: () => boolean;
  isSymbolicLink: () => boolean;
  size: number;
  mode: number;
  mtimeMs: number;
  ctimeMs: number;
  uid: number;
  gid: number;
}

function makeStatResult(isDir: boolean): StatResult {
  return {
    isFile: () => !isDir,
    isDirectory: () => isDir,
    isSymbolicLink: () => false,
    size: 0,
    mode: 0o100644,
    mtimeMs: Date.now(),
    ctimeMs: Date.now(),
    uid: 0,
    gid: 0,
  };
}

// ---------------------------------------------------------------------------
// buildGitFs
// ---------------------------------------------------------------------------

/**
 * Returns an isomorphic-git–compatible `fs` adapter.
 *
 * isomorphic-git's internal `FileSystem` class calls `.bind()` on every
 * method in its `commands` array during construction:
 *
 *   readFile, writeFile, mkdir, rmdir, unlink, stat, lstat, readdir,
 *   readlink, symlink
 *
 * All ten must be present as functions — even if they throw — or the
 * constructor crashes with "Cannot read properties of undefined (reading
 * 'bind')" before any git operation runs.
 */
export function buildGitFs(vfs: VfsCallbacks) {
  return {
    promises: {
      readFile: async (
        path: string,
        options?: { encoding?: string },
      ): Promise<string | Uint8Array> => {
        const content = await vfs.read(path);
        if (options?.encoding) return content;
        return new TextEncoder().encode(content);
      },

      writeFile: async (
        path: string,
        data: string | Uint8Array,
      ): Promise<void> => {
        const text =
          typeof data === 'string' ? data : new TextDecoder().decode(data);
        await vfs.write(path, text);
      },

      unlink: async (path: string): Promise<void> => {
        await vfs.del(path);
      },

      readdir: async (path: string): Promise<string[]> => {
        const entries = await vfs.list(path);
        return entries.map((e) => e.replace(/\/$/, ''));
      },

      mkdir: async (path: string): Promise<void> => {
        await vfs.mkdir(path);
      },

      rmdir: async (path: string): Promise<void> => {
        await vfs.del(path);
      },

      stat: async (path: string): Promise<StatResult> => {
        const entries = await vfs.list(path).catch(() => null);
        return makeStatResult(entries !== null);
      },

      lstat: async (path: string): Promise<StatResult> => {
        const entries = await vfs.list(path).catch(() => null);
        return makeStatResult(entries !== null);
      },

      // isomorphic-git's bindFs() calls .bind() on EVERY entry in its
      // `commands` array during FileSystem construction, including readlink
      // and symlink.  If either is missing, `undefined.bind()` throws before
      // any git operation runs (BUG-0021).  The VFS has no symlink support, so
      // these stubs simply reject — isomorphic-git only invokes readlink when
      // it actually encounters a symlink in the tree, which never happens here.
      readlink: async (_path: string): Promise<Uint8Array> => {
        throw Object.assign(new Error('ENOSYS: readlink not supported'), {
          code: 'ENOSYS',
        });
      },

      symlink: async (_target: string, _path: string): Promise<void> => {
        throw Object.assign(new Error('ENOSYS: symlink not supported'), {
          code: 'ENOSYS',
        });
      },
    },
  };
}
