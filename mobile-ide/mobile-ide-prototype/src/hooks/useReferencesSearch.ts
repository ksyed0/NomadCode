import { useState, useCallback, useMemo, useRef } from 'react';
import { FileSystemBridge } from '../utils/FileSystemBridge';
import { isCodeFile, escapeRegex } from '../codeNav/codeNavUtils';

export interface ReferenceMatch {
  line:     number;
  column:   number;
  lineText: string;
}

export interface ReferenceGroup {
  filePath: string;
  fileName: string;
  matches:  ReferenceMatch[];
}

export function useReferencesSearch() {
  const [results,     setResults]     = useState<ReferenceGroup[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const search = useCallback(async (
    word:            string,
    currentFilePath: string,
    workspacePath:   string,
    getMonacoRefs:   () => Promise<ReferenceMatch[]>,
  ) => {
    abortRef.current?.abort();
    const abort = new AbortController();
    abortRef.current = abort;

    setIsSearching(true);
    setResults([]);

    try {
      const monacoMatches = await getMonacoRefs();
      const allFiles      = await FileSystemBridge.listFilesRecursive(workspacePath);
      const codeFiles     = allFiles
        .filter(isCodeFile)
        .filter(p => p !== currentFilePath);

      const groups: ReferenceGroup[] = [];

      if (monacoMatches.length) {
        groups.push({
          filePath: currentFilePath,
          fileName: currentFilePath.split('/').pop() ?? currentFilePath,
          matches:  monacoMatches,
        });
      }

      for (const filePath of codeFiles) {
        if (abort.signal.aborted) break;
        const content = await FileSystemBridge.readFile(filePath);
        const matches = searchWord(word, content);
        if (matches.length) {
          groups.push({
            filePath,
            fileName: filePath.split('/').pop() ?? filePath,
            matches,
          });
        }
      }

      if (!abort.signal.aborted) {
        setResults(groups.sort((a, b) => a.fileName.localeCompare(b.fileName)));
      }
    } catch { /* aborted or filesystem error */ }
    finally {
      if (!abort.signal.aborted) setIsSearching(false);
    }
  }, []);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    setIsSearching(false);
  }, []);

  const totalCount = useMemo(
    () => results.reduce((n, g) => n + g.matches.length, 0),
    [results],
  );

  return { search, cancel, results, isSearching, totalCount };
}

function searchWord(word: string, content: string): ReferenceMatch[] {
  const pattern = new RegExp(`\\b${escapeRegex(word)}\\b`, 'g');
  const matches: ReferenceMatch[] = [];
  content.split('\n').forEach((lineText, i) => {
    pattern.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = pattern.exec(lineText)) !== null) {
      matches.push({ line: i + 1, column: m.index + 1, lineText: lineText.slice(0, 120) });
    }
  });
  return matches;
}
