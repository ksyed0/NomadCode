import { useState, useCallback, useRef, useMemo } from 'react';
import {
  searchFiles,
  SearchOptions,
  FileSearchResult,
} from '../utils/searchEngine';

export interface UseSearchReturn {
  query: string;
  setQuery: (q: string) => void;
  options: SearchOptions;
  setOptions: (o: Partial<SearchOptions>) => void;
  results: FileSearchResult[];
  isSearching: boolean;
  fileCount: number;
  totalMatchCount: number;
  error: string | null;
  submit: () => void;
  clear: () => void;
}

export function useSearch(workspaceRoot: string): UseSearchReturn {
  const [query, setQuery] = useState('');
  const [options, setOptionsState] = useState<SearchOptions>({
    caseSensitive: false,
    regex: false,
    wholeWord: false,
    glob: '',
  });
  const [results, setResults] = useState<FileSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [fileCount, setFileCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const setOptions = useCallback((partial: Partial<SearchOptions>) => {
    setOptionsState(prev => ({ ...prev, ...partial }));
  }, []);

  const submit = useCallback(async () => {
    // Validate regex before starting
    if (options.regex) {
      try { new RegExp(query); } catch (e) {
        setError(`Invalid regex: ${(e as Error).message}`);
        return;
      }
    }
    // Cancel any running search
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setError(null);
    setResults([]);
    setFileCount(0);
    setIsSearching(true);

    try {
      const gen = searchFiles(workspaceRoot, query, options, controller.signal);
      let count = 0;
      for await (const result of gen) {
        if (controller.signal.aborted) break;
        setResults(prev => [...prev, result]);
        count++;
        setFileCount(count);
      }
    } catch (e) {
      if (!controller.signal.aborted) {
        setError((e as Error).message);
      }
    } finally {
      if (!controller.signal.aborted) {
        setIsSearching(false);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceRoot, query, options]);

  const clear = useCallback(() => {
    abortRef.current?.abort();
    setResults([]);
    setQuery('');
    setFileCount(0);
    setIsSearching(false);
    setError(null);
  }, []);

  const totalMatchCount = useMemo(
    () => results.reduce((sum, r) => sum + r.matches.length, 0),
    [results],
  );

  return { query, setQuery, options, setOptions, results, isSearching, fileCount, totalMatchCount, error, submit, clear };
}
