/**
 * FileSystemBridge
 *
 * Abstracts native file I/O behind a uniform async API.
 * On mobile (Expo), this delegates to expo-file-system.
 * On web, it falls back to the Web File System Access API (or an in-memory stub).
 *
 * All components should use this bridge rather than calling platform APIs directly.
 */

export interface FileEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  size?: number;
  modifiedAt?: Date;
}

export interface IFileSystemBridge {
  readFile(path: string): Promise<string>;
  writeFile(path: string, content: string): Promise<void>;
  listDirectory(path: string): Promise<FileEntry[]>;
  createDirectory(path: string): Promise<void>;
  deleteFile(path: string): Promise<void>;
  exists(path: string): Promise<boolean>;
}

/**
 * In-memory stub implementation used in the prototype and unit tests.
 * Replace with a native-backed implementation for production use.
 */
class InMemoryFileSystem implements IFileSystemBridge {
  private files = new Map<string, string>([
    ['/README.md', '# NomadCode\n\nWelcome to NomadCode!\n'],
    ['/src/index.ts', 'console.log("Hello, NomadCode!");\n'],
    ['/src/App.tsx', 'export default function App() {\n  return null;\n}\n'],
  ]);

  private directories = new Set<string>(['/', '/src']);

  async readFile(path: string): Promise<string> {
    const content = this.files.get(path);
    if (content === undefined) throw new Error(`File not found: ${path}`);
    return content;
  }

  async writeFile(path: string, content: string): Promise<void> {
    this.files.set(path, content);
  }

  async listDirectory(path: string): Promise<FileEntry[]> {
    const normalizedPath = path.endsWith('/') ? path.slice(0, -1) : path;
    const entries: FileEntry[] = [];
    const seen = new Set<string>();

    for (const filePath of this.files.keys()) {
      if (!filePath.startsWith(normalizedPath + '/')) continue;
      const relative = filePath.slice(normalizedPath.length + 1);
      const parts = relative.split('/');
      const name = parts[0];
      if (!name || seen.has(name)) continue;
      seen.add(name);

      const isDirectory = parts.length > 1;
      const childPath = `${normalizedPath}/${name}`;
      entries.push({
        name,
        path: childPath,
        isDirectory,
        size: isDirectory ? undefined : (this.files.get(filePath)?.length ?? 0),
        modifiedAt: new Date(),
      });
    }

    return entries;
  }

  async createDirectory(path: string): Promise<void> {
    this.directories.add(path);
  }

  async deleteFile(path: string): Promise<void> {
    this.files.delete(path);
    this.directories.delete(path);
  }

  async exists(path: string): Promise<boolean> {
    return this.files.has(path) || this.directories.has(path);
  }
}

export const FileSystemBridge: IFileSystemBridge = new InMemoryFileSystem();
