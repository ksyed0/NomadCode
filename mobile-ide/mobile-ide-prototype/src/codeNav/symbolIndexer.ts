// src/codeNav/symbolIndexer.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { simpleHash } from '../utils/hash';

export interface SymbolEntry {
  word:     string;
  filePath: string;
  line:     number;
  kind:     'function' | 'class' | 'const' | 'interface' | 'type';
}

// Only top-level declarations are matched — patterns anchor to line start (trimmed).
const PATTERNS: Array<[RegExp, SymbolEntry['kind']]> = [
  [/^(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/,    'function'],
  [/^(?:export\s+)?(?:default\s+)?class\s+([A-Za-z_$][\w$]*)/,     'class'],
  [/^(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*[=:]/, 'const'],
  [/^(?:export\s+)?interface\s+([A-Za-z_$][\w$]*)/,                 'interface'],
  [/^(?:export\s+)?type\s+([A-Za-z_$][\w$]*)\s*[=<]/,              'type'],
];

export function indexFile(filePath: string, content: string): SymbolEntry[] {
  const entries: SymbolEntry[] = [];
  content.split('\n').forEach((lineText, i) => {
    // Match against the original line (no trimStart) — the ^ anchor in each
    // pattern correctly rejects indented lines (local vars, nested functions).
    for (const [pattern, kind] of PATTERNS) {
      const m = lineText.match(pattern);
      if (m?.[1]) {
        entries.push({ word: m[1], filePath, line: i + 1, kind });
      }
    }
  });
  return entries;
}

export function updateIndex(
  existing:   SymbolEntry[],
  filePath:   string,
  newEntries: SymbolEntry[],
): SymbolEntry[] {
  return [...existing.filter(e => e.filePath !== filePath), ...newEntries];
}

const cacheKey = (workspacePath: string): string =>
  `nomadcode_symbol_index_${simpleHash(workspacePath)}`;

export async function loadIndex(workspacePath: string): Promise<SymbolEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(cacheKey(workspacePath));
    return raw ? (JSON.parse(raw) as SymbolEntry[]) : [];
  } catch { return []; }
}

export async function saveIndex(workspacePath: string, index: SymbolEntry[]): Promise<void> {
  try {
    await AsyncStorage.setItem(cacheKey(workspacePath), JSON.stringify(index));
  } catch { /* ignore storage errors */ }
}
