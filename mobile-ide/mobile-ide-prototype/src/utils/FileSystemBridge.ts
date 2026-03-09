/**
 * FileSystemBridge — abstraction over expo-file-system for local storage.
 *
 * Future extension points:
 *  - AI integration: add `analyzeFile(path)` calling a Claude API endpoint
 *  - Cloud sync: swap readFile/writeFile implementations to sync with remote storage
 *  - GitHub integration: add `cloneRepo`, `fetchRemote` via GitBridge (see below)
 */

import * as ExpoFS from 'expo-file-system';

export interface FileEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  size?: number;
  modifiedAt?: number;
}

function normalizeDirPath(path: string): string {
  return path.endsWith('/') ? path : `${path}/`;
}

export const FileSystemBridge = {
  /**
   * List immediate children of a directory.
   * Returns entries sorted with directories first, then files, both alphabetically.
   */
  async listDirectory(dirPath: string): Promise<FileEntry[]> {
    const normalized = normalizeDirPath(dirPath);
    const info = await ExpoFS.getInfoAsync(normalized);
    if (!info.exists || !info.isDirectory) return [];

    const names = await ExpoFS.readDirectoryAsync(normalized);
    const entries = await Promise.all(
      names.map(async (name): Promise<FileEntry> => {
        const fullPath = `${normalized}${name}`;
        const entryInfo = await ExpoFS.getInfoAsync(fullPath);
        return {
          name,
          path: fullPath,
          isDirectory: entryInfo.isDirectory ?? false,
          size: entryInfo.size,
          modifiedAt: entryInfo.modificationTime,
        };
      }),
    );
    return entries.sort((a, b) => {
      if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  },

  /** Read a text file as a UTF-8 string. */
  async readFile(path: string): Promise<string> {
    return ExpoFS.readAsStringAsync(path, { encoding: ExpoFS.EncodingType.UTF8 });
  },

  /** Overwrite or create a text file. */
  async writeFile(path: string, content: string): Promise<void> {
    await ExpoFS.writeAsStringAsync(path, content, { encoding: ExpoFS.EncodingType.UTF8 });
  },

  /** Create a new empty file (or overwrite with provided content). */
  async createFile(path: string, content = ''): Promise<void> {
    await ExpoFS.writeAsStringAsync(path, content, { encoding: ExpoFS.EncodingType.UTF8 });
  },

  /** Delete a file or directory (idempotent). */
  async deleteEntry(path: string): Promise<void> {
    await ExpoFS.deleteAsync(path, { idempotent: true });
  },

  /** Recursively create a directory path. */
  async createDirectory(path: string): Promise<void> {
    await ExpoFS.makeDirectoryAsync(path, { intermediates: true });
  },

  /** Rename/move a file or directory. */
  async moveEntry(from: string, to: string): Promise<void> {
    await ExpoFS.moveAsync({ from, to });
  },

  /** Copy a file or directory. */
  async copyEntry(from: string, to: string): Promise<void> {
    await ExpoFS.copyAsync({ from, to });
  },

  /** Check whether a path exists. */
  async exists(path: string): Promise<boolean> {
    const info = await ExpoFS.getInfoAsync(path);
    return info.exists;
  },

  /** Root document directory for the app (sandboxed, persistent). */
  get documentDirectory(): string {
    return ExpoFS.documentDirectory ?? '/';
  },
};

// ---------------------------------------------------------------------------
// GitBridge — stub for basic Git operations via isomorphic-git or a native module.
//
// TODO: Replace stubs with real implementations using:
//   - isomorphic-git (pure JS, works in React Native)
//   - @isomorphic-git/lightning-fs for virtual FS
//   - GitHub REST API for remote operations
// ---------------------------------------------------------------------------

export interface GitStatus {
  branch: string;
  ahead: number;
  behind: number;
  modified: string[];
  staged: string[];
  untracked: string[];
}

export const GitBridge = {
  /** Clone a remote repository into the document directory. */
  async clone(_url: string, _dir: string, _token?: string): Promise<void> {
    // TODO: implement with isomorphic-git:
    //   await git.clone({ fs, http, dir, url, onAuth: () => ({ username: token }) });
    throw new Error('GitBridge.clone: not yet implemented — integrate isomorphic-git');
  },

  /** Stage all modified files and create a commit. */
  async commit(_dir: string, _message: string, _author: { name: string; email: string }): Promise<string> {
    // TODO: git.add + git.commit
    throw new Error('GitBridge.commit: not yet implemented');
  },

  /** Push local commits to the remote origin. */
  async push(_dir: string, _token?: string): Promise<void> {
    // TODO: git.push with auth token
    throw new Error('GitBridge.push: not yet implemented');
  },

  /** Pull latest changes from origin. */
  async pull(_dir: string, _token?: string): Promise<void> {
    // TODO: git.pull
    throw new Error('GitBridge.pull: not yet implemented');
  },

  /** Return current branch name + working-tree status. */
  async status(_dir: string): Promise<GitStatus> {
    // TODO: git.currentBranch + git.statusMatrix
    return { branch: 'main', ahead: 0, behind: 0, modified: [], staged: [], untracked: [] };
  },

  /** List local branches. */
  async branches(_dir: string): Promise<string[]> {
    return ['main'];
  },

  /** Switch branch (checkout). */
  async checkout(_dir: string, _branch: string): Promise<void> {
    throw new Error('GitBridge.checkout: not yet implemented');
  },
};
