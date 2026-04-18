import { useState, useCallback } from 'react';
import { useSearch, UseSearchReturn } from './useSearch';
import { replaceInFiles } from '../utils/replaceEngine';
import { buildPattern } from '../utils/searchEngine';
import { FileSystemBridge } from '../utils/FileSystemBridge';

export interface UseReplaceReturn extends UseSearchReturn {
  mode: 'search' | 'replace';
  setMode: (m: 'search' | 'replace') => void;
  replaceQuery: string;
  setReplaceQuery: (q: string) => void;
  excludedMatches: Set<string>;
  toggleExclude: (key: string) => void;
  replacePreview: string;
  replaceAll: () => Promise<{ filesChanged: number; matchesReplaced: number }>;
}

export function useReplace(workspaceRoot: string): UseReplaceReturn {
  const search = useSearch(workspaceRoot);
  const [mode, setMode] = useState<'search' | 'replace'>('search');
  const [replaceQuery, setReplaceQuery] = useState('');
  const [excludedMatches, setExcludedMatches] = useState<Set<string>>(new Set());

  const toggleExclude = useCallback((key: string) => {
    setExcludedMatches((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const replacePreview =
    search.query && replaceQuery ? `"${search.query}" → "${replaceQuery}"` : '';

  const replaceAll = useCallback(async () => {
    const pattern = buildPattern(search.query, search.options);
    return replaceInFiles(
      search.results,
      pattern,
      replaceQuery,
      excludedMatches,
      FileSystemBridge,
    );
  }, [search.query, search.options, search.results, replaceQuery, excludedMatches]);

  return {
    ...search,
    mode,
    setMode,
    replaceQuery,
    setReplaceQuery,
    excludedMatches,
    toggleExclude,
    replacePreview,
    replaceAll,
  };
}
