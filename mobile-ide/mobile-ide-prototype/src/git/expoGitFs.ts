/**
 * Expo FileSystem-backed fs for isomorphic-git (React Native).
 * readFile/writeFile support binary (git objects) via Base64.
 */

import * as ExpoFS from 'expo-file-system/legacy';

/**
 * Ensure a path has the file:// prefix that expo-file-system (SDK 54)
 * requires for sandbox writes. isomorphic-git strips URL prefixes when
 * building child paths (e.g. `${dir}/.git/config`), so by the time our
 * adapter is called the path is often a bare /Users/... absolute path.
 * Without the prefix, writeAsStringAsync fails with "not writable".
 */
function toFileUri(path: string): string {
  if (path.startsWith('file://')) return path;
  if (path.startsWith('/')) return `file://${path}`;
  return path;
}

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

function statFromInfo(info: ExpoFS.FileInfo): StatResult {
  const isDir = info.isDirectory ?? false;
  const size = info.exists ? (info.size ?? 0) : 0;
  const mtimeSec =
    info.exists && 'modificationTime' in info && typeof info.modificationTime === 'number'
      ? info.modificationTime
      : 0;
  return {
    isFile: () => !isDir,
    isDirectory: () => isDir,
    isSymbolicLink: () => false,
    size,
    mode: isDir ? 0o040755 : 0o100644,
    mtimeMs: mtimeSec * 1000,
    ctimeMs: mtimeSec * 1000,
    uid: 0,
    gid: 0,
  };
}

function base64ToUint8Array(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let s = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    const sub = bytes.subarray(i, i + chunk);
    s += String.fromCharCode.apply(null, Array.from(sub) as unknown as number[]);
  }
  return btoa(s);
}

export type ExpoGitFs = {
  promises: {
    readFile: (
      path: string,
      options?: { encoding?: string },
    ) => Promise<string | Uint8Array>;
    writeFile: (path: string, data: string | Uint8Array) => Promise<void>;
    unlink: (path: string) => Promise<void>;
    readdir: (path: string) => Promise<string[]>;
    mkdir: (path: string) => Promise<void>;
    rmdir: (path: string) => Promise<void>;
    stat: (path: string) => Promise<StatResult>;
    lstat: (path: string) => Promise<StatResult>;
    readlink: (path: string) => Promise<Uint8Array>;
    symlink: (target: string, path: string) => Promise<void>;
  };
};

/**
 * Single shared fs instance — isomorphic-git passes absolute paths.
 */
export function buildExpoGitFs(): ExpoGitFs {
  return {
    promises: {
      readFile: async (
        path: string,
        options?: { encoding?: string },
      ): Promise<string | Uint8Array> => {
        const uri = toFileUri(path);
        if (options?.encoding) {
          return ExpoFS.readAsStringAsync(uri, { encoding: ExpoFS.EncodingType.UTF8 });
        }
        const b64 = await ExpoFS.readAsStringAsync(uri, { encoding: ExpoFS.EncodingType.Base64 });
        return base64ToUint8Array(b64);
      },

      writeFile: async (path: string, data: string | Uint8Array): Promise<void> => {
        const uri = toFileUri(path);
        // Ensure parent directory exists. SDK 54's writeAsStringAsync on iOS
        // no longer auto-creates parents; isomorphic-git relies on this.
        const parentIdx = uri.lastIndexOf('/');
        if (parentIdx > 'file://'.length) {
          const parent = uri.slice(0, parentIdx);
          try {
            await ExpoFS.makeDirectoryAsync(parent, { intermediates: true });
          } catch {
            // Ignore: may already exist
          }
        }
        if (typeof data === 'string') {
          await ExpoFS.writeAsStringAsync(uri, data, { encoding: ExpoFS.EncodingType.UTF8 });
        } else {
          await ExpoFS.writeAsStringAsync(uri, uint8ArrayToBase64(data), {
            encoding: ExpoFS.EncodingType.Base64,
          });
        }
      },

      unlink: async (path: string): Promise<void> => {
        await ExpoFS.deleteAsync(toFileUri(path), { idempotent: true });
      },

      readdir: async (path: string): Promise<string[]> => {
        const uri = toFileUri(path);
        const dir = uri.endsWith('/') ? uri.slice(0, -1) : uri;
        const names = await ExpoFS.readDirectoryAsync(dir);
        return names;
      },

      mkdir: async (path: string): Promise<void> => {
        await ExpoFS.makeDirectoryAsync(toFileUri(path), { intermediates: true });
      },

      rmdir: async (path: string): Promise<void> => {
        await ExpoFS.deleteAsync(toFileUri(path), { idempotent: true });
      },

      stat: async (path: string): Promise<StatResult> => {
        const info = await ExpoFS.getInfoAsync(toFileUri(path));
        if (!info.exists) {
          throw Object.assign(new Error(`ENOENT: no such file or directory, stat '${path}'`), {
            code: 'ENOENT',
          });
        }
        return statFromInfo(info);
      },

      lstat: async (path: string): Promise<StatResult> => {
        const info = await ExpoFS.getInfoAsync(toFileUri(path));
        if (!info.exists) {
          throw Object.assign(new Error(`ENOENT: no such file or directory, lstat '${path}'`), {
            code: 'ENOENT',
          });
        }
        return statFromInfo(info);
      },

      readlink: async (path: string): Promise<Uint8Array> => {
        // iOS sandbox has no symlink API. Fall back to reading the file as
        // regular content (isomorphic-git stores the link target as UTF-8
        // bytes in readlink's return value).
        const text = await ExpoFS.readAsStringAsync(toFileUri(path), {
          encoding: ExpoFS.EncodingType.UTF8,
        });
        const bytes = new Uint8Array(text.length);
        for (let i = 0; i < text.length; i++) bytes[i] = text.charCodeAt(i);
        return bytes;
      },

      symlink: async (target: string, path: string): Promise<void> => {
        // iOS sandbox has no symlink API. Materialise the symlink as a plain
        // file whose contents are the target path. This loses symlink
        // semantics but lets isomorphic-git finish the clone. Repos with
        // meaningful symlinks (e.g. to content outside the working tree)
        // will not behave correctly until EPIC-0019 adds native support.
        const uri = toFileUri(path);
        const parentIdx = uri.lastIndexOf('/');
        if (parentIdx > 'file://'.length) {
          const parent = uri.slice(0, parentIdx);
          try {
            await ExpoFS.makeDirectoryAsync(parent, { intermediates: true });
          } catch {
            // Ignore: may already exist
          }
        }
        await ExpoFS.writeAsStringAsync(uri, target, {
          encoding: ExpoFS.EncodingType.UTF8,
        });
      },
    },
  };
}
