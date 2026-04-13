/**
 * FileBridge — Expo FileSystem adapter that services WebView FILE_* messages.
 *
 * Each static method maps 1-to-1 to an Expo FileSystem operation.
 * All errors are caught and returned as { result: null, error: string }
 * rather than thrown, so the WebView always receives a structured response.
 */

import * as FileSystem from 'expo-file-system/legacy';
import type { WebViewToRN, RNToWebView } from './protocol';

export type FileResult = { result: string | null; error?: string };

type FileMessage = Extract<
  WebViewToRN,
  { type: 'FILE_READ' | 'FILE_WRITE' | 'FILE_LIST' | 'FILE_MKDIR' | 'FILE_DELETE' | 'FILE_COPY' | 'FILE_MOVE' }
>;

export class FileBridge {
  /**
   * Read file contents at path. Returns { result: string } on success,
   * { result: null, error: string } on failure.
   */
  static async readFile(path: string): Promise<FileResult> {
    try {
      const content = await FileSystem.readAsStringAsync(path);
      return { result: content };
    } catch (e) {
      return { result: null, error: (e as Error).message };
    }
  }

  /**
   * Write content to path. Returns { result: 'ok' } on success,
   * { result: null, error: string } on failure.
   */
  static async writeFile(path: string, content: string): Promise<FileResult> {
    try {
      await FileSystem.writeAsStringAsync(path, content);
      return { result: 'ok' };
    } catch (e) {
      return { result: null, error: (e as Error).message };
    }
  }

  /**
   * List directory entries. Returns { result: JSON string of string[] } on success.
   * JSON is array of names — directories have a trailing '/' suffix.
   * Returns { result: null, error: string } on failure.
   */
  static async listDirectory(path: string): Promise<FileResult> {
    try {
      const names = await FileSystem.readDirectoryAsync(path);
      const entries = await Promise.all(
        names.map(async (name) => {
          const fullPath = path.endsWith('/') ? `${path}${name}` : `${path}/${name}`;
          const info = await FileSystem.getInfoAsync(fullPath);
          return info.isDirectory ? `${name}/` : name;
        }),
      );
      return { result: JSON.stringify(entries) };
    } catch (e) {
      return { result: null, error: (e as Error).message };
    }
  }

  /**
   * Create directory (including parents). Returns { result: 'ok' } on success,
   * { result: null, error: string } on failure.
   */
  static async makeDirectory(path: string): Promise<FileResult> {
    try {
      await FileSystem.makeDirectoryAsync(path, { intermediates: true });
      return { result: 'ok' };
    } catch (e) {
      return { result: null, error: (e as Error).message };
    }
  }

  /**
   * Delete file or directory at path. Returns { result: 'ok' } on success,
   * { result: null, error: string } on failure.
   */
  static async deleteEntry(path: string): Promise<FileResult> {
    try {
      await FileSystem.deleteAsync(path, { idempotent: true });
      return { result: 'ok' };
    } catch (e) {
      return { result: null, error: (e as Error).message };
    }
  }

  /**
   * Copy a file or directory from src to dest. Returns { result: 'ok' } on success,
   * { result: null, error: string } on failure.
   */
  static async copyEntry(src: string, dest: string): Promise<FileResult> {
    try {
      await FileSystem.copyAsync({ from: src, to: dest });
      return { result: 'ok' };
    } catch (e) {
      return { result: null, error: (e as Error).message };
    }
  }

  /**
   * Move/rename a file or directory from src to dest. Returns { result: 'ok' } on success,
   * { result: null, error: string } on failure.
   */
  static async moveEntry(src: string, dest: string): Promise<FileResult> {
    try {
      await FileSystem.moveAsync({ from: src, to: dest });
      return { result: 'ok' };
    } catch (e) {
      return { result: null, error: (e as Error).message };
    }
  }

  /**
   * Route a WebViewToRN file message to the correct method.
   * Returns an RNToWebView FILE_RESULT message.
   */
  static async handleMessage(msg: FileMessage): Promise<RNToWebView> {
    let fileResult: FileResult;

    switch (msg.type) {
      case 'FILE_READ':
        fileResult = await FileBridge.readFile(msg.path);
        break;
      case 'FILE_WRITE':
        fileResult = await FileBridge.writeFile(msg.path, msg.content);
        break;
      case 'FILE_LIST':
        fileResult = await FileBridge.listDirectory(msg.path);
        break;
      case 'FILE_MKDIR':
        fileResult = await FileBridge.makeDirectory(msg.path);
        break;
      case 'FILE_DELETE':
        fileResult = await FileBridge.deleteEntry(msg.path);
        break;
      case 'FILE_COPY':
        fileResult = await FileBridge.copyEntry(msg.src, msg.dest);
        break;
      case 'FILE_MOVE':
        fileResult = await FileBridge.moveEntry(msg.src, msg.dest);
        break;
    }

    return {
      type: 'FILE_RESULT',
      requestId: msg.requestId,
      ...fileResult,
    };
  }
}
