import { useState, useCallback, useEffect } from 'react';
import { FileSystemBridge } from '../utils/FileSystemBridge';
import { isCodeFile } from '../codeNav/codeNavUtils';
import {
  indexFile, updateIndex, loadIndex, saveIndex,
  type SymbolEntry,
} from '../codeNav/symbolIndexer';

export function useSymbolSearch(workspacePath: string) {
  const [index,      setIndex]      = useState<SymbolEntry[]>([]);
  const [isBuilding, setIsBuilding] = useState(false);

  useEffect(() => {
    loadIndex(workspacePath).then(cached => {
      if (cached.length) { setIndex(cached); return; }
      buildFullIndex(workspacePath);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspacePath]);

  const buildFullIndex = useCallback(async (wsPath: string) => {
    setIsBuilding(true);
    try {
      const files = await FileSystemBridge.listFilesRecursive(wsPath);
      let entries: SymbolEntry[] = [];
      for (const f of files.filter(isCodeFile)) {
        const content = await FileSystemBridge.readFile(f);
        entries = [...entries, ...indexFile(f, content)];
      }
      setIndex(entries);
      await saveIndex(wsPath, entries);
    } finally {
      setIsBuilding(false);
    }
  }, []);

  const onFileSaved = useCallback((filePath: string, content: string) => {
    const fresh = indexFile(filePath, content);
    setIndex(prev => {
      const next = updateIndex(prev, filePath, fresh);
      saveIndex(workspacePath, next);
      return next;
    });
  }, [workspacePath]);

  const search = useCallback((query: string): SymbolEntry[] => {
    if (!query) return [];
    const q = query.toLowerCase();
    return index
      .map(e => ({ entry: e, score: scoreMatch(e.word.toLowerCase(), q) }))
      .filter(x => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 50)
      .map(x => x.entry);
  }, [index]);

  return { index, isBuilding, onFileSaved, search };
}

function scoreMatch(word: string, query: string): number {
  if (word === query)          return 3;
  if (word.startsWith(query)) return 2;
  if (word.includes(query))   return 1;
  return 0;
}
