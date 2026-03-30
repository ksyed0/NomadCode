/**
 * FileSystemBridge — abstraction over expo-file-system for local storage.
 *
 * Supports two URI schemes transparently:
 *   file://  — standard iOS/Android file paths (including iCloud Drive paths
 *              returned by react-native-document-picker on iOS)
 *   content:// — Android Storage Access Framework (SAF) URIs returned by
 *              StorageAccessFramework.requestDirectoryPermissionsAsync()
 *
 * All public methods accept either URI type; callers do not need to know which.
 *
 * Future extension points:
 *  - AI integration: add `analyzeFile(path)` calling a Claude API endpoint
 *  - GitHub integration: add `cloneRepo`, `fetchRemote` via GitBridge (see below)
 */

import * as ExpoFS from 'expo-file-system';
import DocumentPicker from 'react-native-document-picker';
import { Platform } from 'react-native';
import type { WorkspaceRoot, WorkspaceUriType } from '../types/workspace';

export interface FileEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  size?: number;
  modifiedAt?: number; // undefined for SAF entries (mtime unavailable via SAF)
}

// ---------------------------------------------------------------------------
// URI-type helpers
// ---------------------------------------------------------------------------

/** Returns 'saf' for Android SAF content:// URIs, 'file' for everything else. */
export function getUriType(path: string): WorkspaceUriType {
  return path.startsWith('content://') ? 'saf' : 'file';
}

function normalizeDirPath(path: string): string {
  return path.endsWith('/') ? path : `${path}/`;
}

// ---------------------------------------------------------------------------
// SAF private helpers (Android Storage Access Framework)
// ---------------------------------------------------------------------------

async function safListDirectory(dirUri: string): Promise<FileEntry[]> {
  const childUris = await ExpoFS.StorageAccessFramework.readDirectoryAsync(dirUri);
  const entries = await Promise.all(
    childUris.map(async (uri): Promise<FileEntry> => {
      const info = await ExpoFS.getInfoAsync(uri);
      // Derive a display name from the URI's last path segment (percent-decoded).
      const rawName = uri.split('%2F').pop() ?? uri.split('/').pop() ?? uri;
      const name = decodeURIComponent(rawName);
      return {
        name,
        path: uri,
        isDirectory: info.isDirectory ?? false,
        size: info.exists ? info.size : undefined,
        modifiedAt: undefined, // SAF does not expose mtime via Expo FileSystem
      };
    }),
  );
  return entries.sort((a, b) => {
    if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

async function safReadFile(uri: string): Promise<string> {
  return ExpoFS.StorageAccessFramework.readAsStringAsync(uri, {
    encoding: ExpoFS.EncodingType.UTF8,
  });
}

async function safWriteFile(uri: string, content: string): Promise<void> {
  await ExpoFS.StorageAccessFramework.writeAsStringAsync(uri, content, {
    encoding: ExpoFS.EncodingType.UTF8,
  });
}

async function safCreateFile(path: string, content = ''): Promise<void> {
  // SAF createFileAsync needs (parentDirUri, fileName, mimeType).
  // The caller passes a path like `<parentUri>/%2F<filename>` or `<parentUri>/<filename>`.
  // lastIndexOf('%2F') returns the position of '%', so we must advance by 3
  // (the length of '%2F') to skip past the separator, not just by 1.
  const pctIdx = path.lastIndexOf('%2F');
  const slashIdx = path.lastIndexOf('/');
  const isSAFSep = pctIdx > slashIdx;
  const sepStart = isSAFSep ? pctIdx : slashIdx;
  const parentUri = path.slice(0, sepStart);
  const fileName = decodeURIComponent(path.slice(sepStart + (isSAFSep ? 3 : 1)));
  const newUri = await ExpoFS.StorageAccessFramework.createFileAsync(
    parentUri,
    fileName,
    'text/plain',
  );
  if (content) {
    await ExpoFS.StorageAccessFramework.writeAsStringAsync(newUri, content, {
      encoding: ExpoFS.EncodingType.UTF8,
    });
  }
}

async function safDeleteEntry(uri: string): Promise<void> {
  await ExpoFS.StorageAccessFramework.deleteAsync(uri);
}

async function safExists(uri: string, parentUri: string): Promise<boolean> {
  try {
    const children = await ExpoFS.StorageAccessFramework.readDirectoryAsync(parentUri);
    return children.includes(uri);
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Public bridge
// ---------------------------------------------------------------------------

export const FileSystemBridge = {
  /**
   * List immediate children of a directory.
   * Returns entries sorted with directories first, then files, both alphabetically.
   */
  async listDirectory(dirPath: string): Promise<FileEntry[]> {
    if (getUriType(dirPath) === 'saf') return safListDirectory(dirPath);

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
          size: entryInfo.exists ? entryInfo.size : undefined,
          modifiedAt: entryInfo.exists ? entryInfo.modificationTime : undefined,
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
    if (getUriType(path) === 'saf') return safReadFile(path);
    return ExpoFS.readAsStringAsync(path, { encoding: ExpoFS.EncodingType.UTF8 });
  },

  /** Overwrite or create a text file. */
  async writeFile(path: string, content: string): Promise<void> {
    if (getUriType(path) === 'saf') { await safWriteFile(path, content); return; }
    await ExpoFS.writeAsStringAsync(path, content, { encoding: ExpoFS.EncodingType.UTF8 });
  },

  /** Create a new empty file (or overwrite with provided content). */
  async createFile(path: string, content = ''): Promise<void> {
    if (getUriType(path) === 'saf') { await safCreateFile(path, content); return; }
    await ExpoFS.writeAsStringAsync(path, content, { encoding: ExpoFS.EncodingType.UTF8 });
  },

  /** Delete a file or directory (idempotent on file:// paths). */
  async deleteEntry(path: string): Promise<void> {
    if (getUriType(path) === 'saf') { await safDeleteEntry(path); return; }
    await ExpoFS.deleteAsync(path, { idempotent: true });
  },

  /** Recursively create a directory path. (file:// only; SAF uses createFileAsync.) */
  async createDirectory(path: string): Promise<void> {
    if (getUriType(path) === 'saf') {
      // SAF doesn't expose a mkdir — directory creation happens implicitly
      // via createFileAsync. No-op here; the parent must already exist.
      return;
    }
    await ExpoFS.makeDirectoryAsync(path, { intermediates: true });
  },

  /** Rename/move a file or directory. SAF falls back to copy + delete. */
  async moveEntry(from: string, to: string): Promise<void> {
    if (getUriType(from) === 'saf') {
      const content = await safReadFile(from);
      await safCreateFile(to, content);
      await safDeleteEntry(from);
      return;
    }
    await ExpoFS.moveAsync({ from, to });
  },

  /** Copy a file or directory. SAF falls back to read + write. */
  async copyEntry(from: string, to: string): Promise<void> {
    if (getUriType(from) === 'saf') {
      const content = await safReadFile(from);
      await safCreateFile(to, content);
      return;
    }
    await ExpoFS.copyAsync({ from, to });
  },

  /** Return the byte size of a file, or 0 if the file does not exist or size is unavailable. */
  async getFileSize(path: string): Promise<number> {
    const info = await ExpoFS.getInfoAsync(path);
    return info.exists ? ((info as { size?: number }).size ?? 0) : 0;
  },

  /** Check whether a path exists. */
  async exists(path: string): Promise<boolean> {
    if (getUriType(path) === 'saf') {
      const lastSlash = Math.max(path.lastIndexOf('/'), path.lastIndexOf('%2F'));
      const parentUri = path.slice(0, lastSlash);
      return safExists(path, parentUri);
    }
    const info = await ExpoFS.getInfoAsync(path);
    return info.exists;
  },

  /** Root document directory for the app (sandboxed, persistent). */
  get documentDirectory(): string {
    return ExpoFS.documentDirectory ?? '/';
  },
};

// ---------------------------------------------------------------------------
// Workspace location picker
// ---------------------------------------------------------------------------

/**
 * Opens the native folder picker and returns a WorkspaceRoot for the
 * selected directory, or null if the user cancels.
 *
 *   iOS  — UIDocumentPickerViewController showing the Files app (iCloud Drive,
 *           OneDrive, and any other registered File Provider). Returns a file://
 *           URI; standard FileSystemBridge methods work without any SAF routing.
 *
 *   Android — StorageAccessFramework directory picker (includes Google Drive).
 *             Returns a content:// URI; FileSystemBridge routes automatically.
 */
export async function requestWorkspacePermission(): Promise<WorkspaceRoot | null> {
  try {
    if (Platform.OS === 'ios') {
      const result = await DocumentPicker.pickDirectory();
      if (!result || !result.uri) return null;
      // Derive a display name from the last path component of the URI.
      const decoded = decodeURIComponent(result.uri);
      const parts = decoded.replace(/\/$/, '').split('/');
      const displayName = parts[parts.length - 1] || 'Selected Folder';
      return { uri: result.uri, uriType: 'file', displayName };
    }

    // Android — use StorageAccessFramework
    const result = await ExpoFS.StorageAccessFramework.requestDirectoryPermissionsAsync();
    if (!result.granted || !result.directoryUri) return null;
    const uri = result.directoryUri;
    // SAF URIs encode the folder name in the last segment after '%3A' or '/'.
    const lastPart = uri.split('%3A').pop() ?? uri.split('/').pop() ?? '';
    const displayName = decodeURIComponent(lastPart) || 'Selected Folder';
    return { uri, uriType: 'saf', displayName };
  } catch (err) {
    // User cancelled or the picker threw — treat as cancellation.
    if (DocumentPicker.isCancel(err)) return null;
    return null;
  }
}

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
    console.warn('GitBridge.clone: not yet implemented — integrate isomorphic-git');
  },

  /** Stage all modified files and create a commit. */
  async commit(_dir: string, _message: string, _author: { name: string; email: string }): Promise<string> {
    console.warn('GitBridge.commit: not yet implemented');
    return '';
  },

  /** Push local commits to the remote origin. */
  async push(_dir: string, _token?: string): Promise<void> {
    console.warn('GitBridge.push: not yet implemented');
  },

  /** Pull latest changes from origin. */
  async pull(_dir: string, _token?: string): Promise<void> {
    console.warn('GitBridge.pull: not yet implemented');
  },

  /** Return current branch name + working-tree status. */
  async status(_dir: string): Promise<GitStatus> {
    return { branch: 'main', ahead: 0, behind: 0, modified: [], staged: [], untracked: [] };
  },

  /** List local branches. */
  async branches(_dir: string): Promise<string[]> {
    return ['main'];
  },

  /** Switch branch (checkout). */
  async checkout(_dir: string, _branch: string): Promise<void> {
    console.warn('GitBridge.checkout: not yet implemented');
  },
};
