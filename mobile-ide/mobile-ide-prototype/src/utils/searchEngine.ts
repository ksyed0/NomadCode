import { FileSystemBridge } from './FileSystemBridge';

export interface SearchOptions {
  caseSensitive: boolean;
  regex: boolean;
  wholeWord: boolean;
  glob: string;
}

export interface MatchLine {
  lineNumber: number;   // 1-based
  preview: string;      // trimmed to 120 chars
  matchStart: number;   // char offset within preview
  matchEnd: number;
}

export interface FileSearchResult {
  filePath: string;
  matches: MatchLine[];
}

export const EXCLUDED_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', '.expo', 'coverage', '.superpowers',
]);

export const MAX_FILE_SIZE_BYTES = 4 * 1024 * 1024; // 4 MB
export const MAX_TOTAL_MATCHES = 1000;

export function globToRegex(glob: string): RegExp {
  if (!glob) return /.*/;
  const escaped = glob
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '__DOUBLESTAR__')
    .replace(/\*/g, '[^/]*')
    .replace(/__DOUBLESTAR__/g, '.*')
    .replace(/\?/g, '[^/]');
  return new RegExp(`^${escaped}$`);
}

export function buildPattern(query: string, opts: SearchOptions): RegExp {
  let src = opts.regex
    ? query
    : query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (opts.wholeWord) src = `\\b${src}\\b`;
  // In regex mode the user controls case via their own pattern; never add `i`.
  const flags = (!opts.regex && !opts.caseSensitive) ? 'i' : '';
  return new RegExp(src, flags);
}

export function matchFile(content: string, pattern: RegExp): MatchLine[] {
  const lines = content.split('\n');
  const results: MatchLine[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    pattern.lastIndex = 0;
    const m = pattern.exec(line);
    if (m) {
      const preview = line.length > 120 ? line.slice(0, 120) : line;
      results.push({
        lineNumber: i + 1,
        preview,
        matchStart: Math.min(m.index, preview.length),
        matchEnd: Math.min(m.index + m[0].length, preview.length),
      });
    }
  }
  return results;
}

export async function* searchFiles(
  root: string,
  query: string,
  opts: SearchOptions,
  signal: AbortSignal,
): AsyncGenerator<FileSearchResult> {
  if (!query) return;
  let pattern: RegExp;
  try {
    pattern = buildPattern(query, opts);
  } catch {
    return;
  }
  const globPattern = globToRegex(opts.glob);
  const counter = { total: 0 };
  yield* walkDir(root, root, pattern, globPattern, signal, counter);
}

async function* walkDir(
  root: string,
  dir: string,
  pattern: RegExp,
  globPattern: RegExp,
  signal: AbortSignal,
  counter: { total: number },
): AsyncGenerator<FileSearchResult> {
  if (signal.aborted || counter.total >= MAX_TOTAL_MATCHES) return;
  let entries;
  try {
    entries = await FileSystemBridge.listDirectory(dir);
  } catch {
    return;
  }
  for (const entry of entries) {
    if (signal.aborted || counter.total >= MAX_TOTAL_MATCHES) return;
    if (entry.isDirectory) {
      if (EXCLUDED_DIRS.has(entry.name)) continue;
      yield* walkDir(root, entry.path, pattern, globPattern, signal, counter);
    } else {
      let size = 0;
      try {
        size = await FileSystemBridge.getFileSize(entry.path);
      } catch {
        continue;
      }
      if (size > MAX_FILE_SIZE_BYTES) continue;
      let content: string;
      try {
        content = await FileSystemBridge.readFile(entry.path);
      } catch {
        continue;
      }
      if (signal.aborted) return;
      // Glob: test relative path from root.
      // Prepend '/' so that patterns like **/*.ts (which require a slash) also
      // match files at the root level (e.g. rel='foo.ts' → '/foo.ts').
      const rel = entry.path.startsWith(root)
        ? entry.path.slice(root.length).replace(/^[/]/, '')
        : entry.name;
      const relWithSlash = `/${rel}`;
      if (!globPattern.test(relWithSlash) && !globPattern.test(rel) && !globPattern.test(entry.name)) continue;
      const matches = matchFile(content, pattern);
      if (matches.length === 0) continue;
      const allowed = Math.min(matches.length, MAX_TOTAL_MATCHES - counter.total);
      counter.total += allowed;
      yield { filePath: entry.path, matches: matches.slice(0, allowed) };
    }
  }
}
