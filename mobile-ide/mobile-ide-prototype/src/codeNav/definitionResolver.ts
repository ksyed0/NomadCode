// src/codeNav/definitionResolver.ts
import type { SymbolEntry } from './symbolIndexer';

export interface DeclarationHit {
  filePath: string;
  line:     number;
  word:     string;
}

function fileScore(filePath: string): number {
  if (filePath.endsWith('.ts') || filePath.endsWith('.tsx')) return 2;
  if (filePath.endsWith('.js') || filePath.endsWith('.jsx')) return 1;
  return 0;
}

export function resolveDefinition(
  word:  string,
  index: SymbolEntry[],
): DeclarationHit | null {
  const candidates = index.filter(e => e.word === word);
  if (!candidates.length) return null;
  const best = candidates.sort((a, b) => fileScore(b.filePath) - fileScore(a.filePath))[0];
  return { filePath: best.filePath, line: best.line, word: best.word };
}
