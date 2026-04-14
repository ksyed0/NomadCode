/**
 * Git operations for the IDE (isomorphic-git + Expo FS).
 * UI imports GitBridge only — not isomorphic-git directly.
 */

import git from 'isomorphic-git';
import http from 'isomorphic-git/http/web';
import * as ExpoFS from 'expo-file-system/legacy';
import { buildExpoGitFs, type ExpoGitFs } from './expoGitFs';
import { createGithubOnAuth } from './gitHubAuth';
import { withNetworkRetry } from './networkRetry';

function isSafWorkspace(path: string): boolean {
  return path.startsWith('content://');
}

/**
 * Find the nearest git repository root starting from `dir`.
 * Walks up first (standard git behavior), then — if nothing is found —
 * scans one level of subdirectories and returns the first one that
 * contains a .git/ folder. This handles the common case where the user
 * clones into a subfolder (e.g. workspace=Documents/, repo=Documents/CTCmw/)
 * and expects the Git panel to work without manually changing workspace.
 *
 * Returns null if no .git/ is found anywhere in that limited search.
 */
export async function findRepoRoot(fs: ExpoGitFs, dir: string): Promise<string | null> {
  // Walk up
  let d = dir.endsWith('/') ? dir.slice(0, -1) : dir;
  const minLen = d.startsWith('file://') ? 'file://'.length : 0;
  while (d.length > minLen) {
    try {
      await fs.promises.stat(`${d}/.git/HEAD`);
      return d;
    } catch {
      // continue walking up
    }
    const parentIdx = d.lastIndexOf('/');
    if (parentIdx <= minLen) break;
    d = d.slice(0, parentIdx);
  }
  // Scan one level of subdirs
  try {
    const children = await fs.promises.readdir(dir);
    for (const child of children) {
      if (child === '.git') continue;
      const base = dir.endsWith('/') ? dir.slice(0, -1) : dir;
      const sub = `${base}/${child}`;
      try {
        await fs.promises.stat(`${sub}/.git/HEAD`);
        return sub;
      } catch {
        // continue
      }
    }
  } catch {
    // dir unreadable
  }
  return null;
}

/**
 * isomorphic-git's http adapter shape. The body is an async iterable of
 * Uint8Array chunks streamed from the HTTP response. We tap into it to
 * report bytes received so the UI can show download progress during the
 * silent pack-download phase of clone/fetch.
 */
type GitHttpAdapter = {
  request: (params: {
    url: string;
    method?: string;
    headers?: Record<string, string>;
    body?: AsyncIterableIterator<Uint8Array>;
  }) => Promise<{
    url: string;
    method?: string;
    headers: Record<string, string>;
    body?: AsyncIterableIterator<Uint8Array>;
    statusCode: number;
    statusMessage: string;
  }>;
};

function wrapHttpWithByteCounter(
  base: GitHttpAdapter,
  onBytes: (bytes: number) => void,
): GitHttpAdapter {
  return {
    request: async (params) => {
      const res = await base.request(params);
      if (!res.body) return res;
      const originalBody = res.body;
      // Wrap the async-iterable body to count bytes as they stream past.
      const countingBody = (async function* () {
        for await (const chunk of originalBody) {
          if (chunk && chunk.byteLength) onBytes(chunk.byteLength);
          yield chunk;
        }
      })();
      return { ...res, body: countingBody };
    },
  };
}

let fsSingleton: ExpoGitFs | null = null;

function getFs(): ExpoGitFs {
  if (!fsSingleton) fsSingleton = buildExpoGitFs();
  return fsSingleton;
}

function assertGitWorkspace(dir: string): void {
  if (isSafWorkspace(dir)) {
    throw new Error(
      'Git is not supported for this workspace (Android folder picker). Pick a folder in app storage or use iOS Files.',
    );
  }
}

function normalizeDir(dir: string): string {
  return dir.endsWith('/') ? dir.slice(0, -1) : dir;
}

/** Map statusMatrix rows to GitStatus buckets (aligned with terminal git status). */
export function categorizeStatusMatrix(
  matrix: [string, number, number, number][],
): { modified: string[]; staged: string[]; untracked: string[] } {
  const modified: string[] = [];
  const staged: string[] = [];
  const untracked: string[] = [];

  for (const [filepath, head, workdir, stage] of matrix) {
    if (head === 0 && workdir === 2 && stage === 0) {
      untracked.push(filepath);
      continue;
    }
    if (head === 0 && workdir === 2 && stage === 2) {
      staged.push(filepath);
      continue;
    }
    if (head === 1 && workdir === 2 && stage === 2) {
      staged.push(filepath);
      continue;
    }
    if (head === 1 && workdir === 2 && (stage === 1 || stage === 0)) {
      modified.push(filepath);
      continue;
    }
    if (head === 1 && workdir === 0 && stage === 1) {
      staged.push(filepath);
      continue;
    }
    if (head === 1 && workdir === 0 && stage === 0) {
      modified.push(filepath);
    }
  }

  return { modified, staged, untracked };
}

export interface GitStatus {
  branch: string;
  ahead: number;
  behind: number;
  modified: string[];
  staged: string[];
  untracked: string[];
  /** Repo root used for this status (may differ from caller's dir if auto-detected). */
  repoDir: string;
  /** True when no git repository was found in or under the caller's dir. */
  noRepo?: boolean;
}

export const GitBridge = {
  categorizeStatusMatrix,

  async clone(
    url: string,
    dir: string,
    token?: string,
    options?: {
      onProgress?: (progress: { loaded: number; total: number; phase?: string }) => void;
      onMessage?: (message: string) => void;
      onHttpBytes?: (bytes: number) => void;
    },
  ): Promise<void> {
    assertGitWorkspace(dir);
    const d = normalizeDir(dir);
    const fs = getFs();
    const onAuth = createGithubOnAuth(token ?? null);
    // Wrap the http adapter so we can count bytes received during the pack
    // download. isomorphic-git's onProgress events go silent between
    // "Compressing objects: done" and "Analyzing workdir" because the pack
    // stream doesn't emit phase events — but those are the minutes a user
    // stares at a stuck-looking 100% indicator. Byte counting fills the gap.
    const wrappedHttp = options?.onHttpBytes
      ? wrapHttpWithByteCounter(http as unknown as GitHttpAdapter, options.onHttpBytes)
      : http;
    // Note: do not pre-create the destination directory. expoGitFs.writeFile
    // creates parent dirs on demand, and pre-creating leaves a stale empty
    // folder on failure (see GitCloneModal cleanup logic).
    await withNetworkRetry(
      () =>
        git.clone({
          fs,
          http: wrappedHttp,
          dir: d,
          url,
          singleBranch: true,
          ...(onAuth ? { onAuth } : {}),
          ...(options?.onProgress ? { onProgress: options.onProgress } : {}),
          ...(options?.onMessage ? { onMessage: options.onMessage } : {}),
        }),
      'Clone',
    );
  },

  async add(dir: string, filepath: string): Promise<void> {
    assertGitWorkspace(dir);
    const fs = getFs();
    const d = normalizeDir(dir);
    await git.add({ fs, dir: d, filepath });
  },

  async remove(dir: string, filepath: string): Promise<void> {
    assertGitWorkspace(dir);
    const fs = getFs();
    const d = normalizeDir(dir);
    await git.remove({ fs, dir: d, filepath });
  },

  async commit(
    dir: string,
    message: string,
    author: { name: string; email: string },
  ): Promise<string> {
    assertGitWorkspace(dir);
    const fs = getFs();
    const d = normalizeDir(dir);
    const sha = await git.commit({
      fs,
      dir: d,
      message,
      author,
    });
    return sha;
  },

  async push(dir: string, token?: string): Promise<void> {
    assertGitWorkspace(dir);
    const fs = getFs();
    const d = normalizeDir(dir);
    const branch = (await git.currentBranch({ fs, dir: d, fullname: false })) ?? 'main';
    const onAuth = createGithubOnAuth(token ?? null);
    await withNetworkRetry(
      () =>
        git.push({
          fs,
          http,
          dir: d,
          remote: 'origin',
          ref: branch,
          ...(onAuth ? { onAuth } : {}),
        }),
      'Push',
    );
  },

  async pull(
    dir: string,
    token: string | undefined,
    author: { name: string; email: string },
  ): Promise<void> {
    assertGitWorkspace(dir);
    const fs = getFs();
    const d = normalizeDir(dir);
    const onAuth = createGithubOnAuth(token ?? null);
    await withNetworkRetry(
      () =>
        git.pull({
          fs,
          http,
          dir: d,
          fastForward: true,
          author,
          ...(onAuth ? { onAuth } : {}),
        }),
      'Pull',
    );
  },

  async status(dir: string): Promise<GitStatus> {
    assertGitWorkspace(dir);
    const fs = getFs();
    const d = normalizeDir(dir);
    // Auto-detect the git repo root: walk up first, then scan subdirs.
    // This lets the Git panel work when the user clones into a subfolder
    // (workspace=Documents/, repo=Documents/CTCmw/) without forcing them
    // to change workspace.
    const repoDir = await findRepoRoot(fs, d);
    if (!repoDir) {
      return {
        branch: 'main',
        ahead: 0,
        behind: 0,
        modified: [],
        staged: [],
        untracked: [],
        repoDir: d,
        noRepo: true,
      };
    }
    const branch = (await git.currentBranch({ fs, dir: repoDir, fullname: false }).catch(() => null)) ?? 'main';
    const matrix = await git.statusMatrix({ fs, dir: repoDir });
    const { modified, staged, untracked } = categorizeStatusMatrix(matrix);
    return {
      branch,
      ahead: 0,
      behind: 0,
      modified,
      staged,
      untracked,
      repoDir,
    };
  },

  async statusMatrix(dir: string): Promise<[string, number, number, number][]> {
    assertGitWorkspace(dir);
    const fs = getFs();
    const d = normalizeDir(dir);
    return git.statusMatrix({ fs, dir: d });
  },

  async branches(dir: string): Promise<string[]> {
    assertGitWorkspace(dir);
    const fs = getFs();
    const d = normalizeDir(dir);
    return git.listBranches({ fs, dir: d });
  },

  async checkout(dir: string, ref: string): Promise<void> {
    assertGitWorkspace(dir);
    const fs = getFs();
    const d = normalizeDir(dir);
    await git.checkout({ fs, dir: d, ref, force: false });
  },

  async createBranch(dir: string, name: string, checkout: boolean): Promise<void> {
    assertGitWorkspace(dir);
    const fs = getFs();
    const d = normalizeDir(dir);
    await git.branch({ fs, dir: d, ref: name, checkout });
  },

  /**
   * Line diff: HEAD vs working tree for one file (UTF-8 text).
   */
  async getWorkingDiff(dir: string, filepath: string): Promise<{ headText: string; workText: string }> {
    assertGitWorkspace(dir);
    const fs = getFs();
    const d = normalizeDir(dir);
    // Auto-detect repo root so diff works when the workspace is the
    // parent of a cloned subfolder (see status() for the same pattern).
    const repoDir = (await findRepoRoot(fs, d)) ?? d;
    const mapped = await git.walk({
      fs,
      dir: repoDir,
      trees: [git.TREE({ ref: 'HEAD' }), git.WORKDIR()],
      map: async (path, [head, workdir]) => {
        if (path !== filepath) return null;
        const headBuf = head ? await head.content() : undefined;
        const workBuf = workdir ? await workdir.content() : undefined;
        const headText = headBuf ? new TextDecoder().decode(headBuf) : '';
        const workText = workBuf ? new TextDecoder().decode(workBuf) : '';
        return { headText, workText };
      },
    });
    const flat = Array.isArray(mapped) ? mapped.flat(Infinity) : [mapped];
    const found = flat.find(
      (x): x is { headText: string; workText: string } =>
        x !== null && typeof x === 'object' && 'headText' in x && 'workText' in x,
    );
    if (found) return found;
    const workPath = `${repoDir}/${filepath}`;
    const workUri = workPath.startsWith('file://') || !workPath.startsWith('/')
      ? workPath
      : `file://${workPath}`;
    const workText = await ExpoFS.readAsStringAsync(workUri, {
      encoding: ExpoFS.EncodingType.UTF8,
    }).catch(() => '');
    return { headText: '', workText };
  },
};
