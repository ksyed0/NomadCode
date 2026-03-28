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
    .replace(/\*\*/g, '\x00DS\x00')
    .replace(/\*/g, '[^/]*')
    .replace(/\x00DS\x00/g, '.*')
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

// searchFiles is added in Task 3
export async function* searchFiles(
  _root: string,
  _query: string,
  _opts: SearchOptions,
  _signal: AbortSignal,
): AsyncGenerator<FileSearchResult> {
  // stub — implemented in Task 3
}
