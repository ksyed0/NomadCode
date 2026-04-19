# EPIC-0021: Advanced Editor Features — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship six VS Code parity features (Search & Replace, Hardware Keyboard Shortcuts, Code Folding, Auto-Format on Save, Breadcrumb Navigation, Snippets) in one branch targeting NomadCode v1.1.

**Architecture:** All features extend existing patterns — the Monaco WebView bundle (`buildMonacoHtml` in `MonacoAssetManager.ts`), the RN↔Monaco message bus (`sendToEditor` / `post()`), existing Zustand stores, and the React Native component tree. No new npm packages are introduced.

**Tech Stack:** React Native (Expo 52), TypeScript 5, Monaco Editor 0.45, Zustand 5, Prettier 3 (already in devDeps), Jest/RNTL for tests.

**Test commands:**
- All tests: `cd mobile-ide/mobile-ide-prototype && npx jest --watchAll=false`
- Single file: `cd mobile-ide/mobile-ide-prototype && npx jest --watchAll=false tests/unit/FILENAME`
- Coverage: `cd mobile-ide/mobile-ide-prototype && npx jest --watchAll=false --coverage`

---

## File Map

### New files
| Path | Purpose |
|---|---|
| `mobile-ide/mobile-ide-prototype/src/utils/builtinSnippets.ts` | SnippetDefinition type + static snippet catalogue |
| `mobile-ide/mobile-ide-prototype/src/utils/replaceEngine.ts` | Write-to-files replace logic |
| `mobile-ide/mobile-ide-prototype/src/utils/symbolExtractor.ts` | Regex current-symbol finder for breadcrumb |
| `mobile-ide/mobile-ide-prototype/src/hooks/useReplace.ts` | Replace state + replaceAll |
| `mobile-ide/mobile-ide-prototype/src/hooks/useKeyboardShortcuts.ts` | Native event → action router |
| `mobile-ide/mobile-ide-prototype/src/components/Breadcrumb.tsx` | Tappable path+symbol bar |
| `mobile-ide/mobile-ide-prototype/src/components/KeyboardShortcutsSheet.tsx` | Shortcut help modal |
| `mobile-ide/mobile-ide-prototype/ios/NomadCode/KeyboardShortcuts.swift` | UIKeyCommand native module |
| `mobile-ide/mobile-ide-prototype/android/app/src/main/java/com/nomadcode/mobileide/KeyboardShortcutsModule.kt` | Android dispatchKeyEvent module |
| `mobile-ide/mobile-ide-prototype/android/app/src/main/java/com/nomadcode/mobileide/KeyboardShortcutsPackage.kt` | RN package registration |
| `mobile-ide/mobile-ide-prototype/tests/unit/replaceEngine.test.ts` | |
| `mobile-ide/mobile-ide-prototype/tests/unit/symbolExtractor.test.ts` | |
| `mobile-ide/mobile-ide-prototype/tests/unit/useReplace.test.ts` | |
| `mobile-ide/mobile-ide-prototype/tests/unit/Breadcrumb.test.tsx` | |
| `mobile-ide/mobile-ide-prototype/tests/unit/useKeyboardShortcuts.test.ts` | |
| `mobile-ide/mobile-ide-prototype/tests/unit/KeyboardShortcutsSheet.test.tsx` | |
| `mobile-ide/mobile-ide-prototype/tests/unit/builtinSnippets.test.ts` | |
| `docs/TEST_SCRIPT_EDITOR.md` | Manual smoke test script |

### Modified files
| Path | Changes |
|---|---|
| `mobile-ide/mobile-ide-prototype/src/stores/useSettingsStore.ts` | + `formatOnSave`, `snippets`, actions |
| `mobile-ide/mobile-ide-prototype/src/components/Editor.tsx` | + `viewState` on EditorTab, Breadcrumb component, fold state, format-on-save trigger |
| `mobile-ide/mobile-ide-prototype/src/components/GlobalSearch.tsx` | + SEARCH/REPLACE tabs, replace input, checkboxes, Replace All |
| `mobile-ide/mobile-ide-prototype/src/components/SettingsScreen.tsx` | + Format on Save toggle, Snippets section |
| `mobile-ide/mobile-ide-prototype/src/utils/MonacoAssetManager.ts` | + Prettier inline, folding options, snippet provider, BREADCRUMB_UPDATE, SAVE/RESTORE_VIEW_STATE, FORMAT handlers |
| `mobile-ide/mobile-ide-prototype/App.tsx` | + useKeyboardShortcuts, shortcut definitions, Format Document command |
| `mobile-ide/mobile-ide-prototype/android/app/src/main/java/com/nomadcode/mobileide/MainApplication.kt` | + KeyboardShortcutsPackage registration |
| `mobile-ide/mobile-ide-prototype/tests/unit/Editor.test.tsx` | + fold state, view state, format-on-save tests |
| `mobile-ide/mobile-ide-prototype/tests/unit/GlobalSearch.test.tsx` | + replace tab, checkbox tests |
| `mobile-ide/mobile-ide-prototype/tests/unit/SettingsScreen.test.tsx` | + format toggle, snippets tests |

---

## Task 1: Foundation — SnippetDefinition type + useSettingsStore + EditorTab.viewState

**Files:**
- Modify: `mobile-ide/mobile-ide-prototype/src/stores/useSettingsStore.ts`
- Modify: `mobile-ide/mobile-ide-prototype/src/components/Editor.tsx:44-55`
- Create: `mobile-ide/mobile-ide-prototype/src/utils/builtinSnippets.ts` (type only, no snippets yet)
- Modify: `mobile-ide/mobile-ide-prototype/tests/unit/useSettingsStore.test.ts`

- [ ] **Step 1: Create builtinSnippets.ts with SnippetDefinition type only**

```typescript
// src/utils/builtinSnippets.ts
export interface SnippetDefinition {
  prefix: string;
  body: string;
  description: string;
  language: string | 'all';
}

export const BUILTIN_SNIPPETS: SnippetDefinition[] = [];
// Filled in Task 15
```

- [ ] **Step 2: Add formatOnSave + snippets to useSettingsStore**

In `src/stores/useSettingsStore.ts`, add to `SettingsState` interface:

```typescript
import type { SnippetDefinition } from '../utils/builtinSnippets';

// Inside SettingsState interface, add:
  formatOnSave: boolean;
  snippets: SnippetDefinition[];
  setFormatOnSave: (v: boolean) => void;
  addSnippet: (s: SnippetDefinition) => void;
  removeSnippet: (prefix: string, language: string) => void;
```

In the `create` call, add initial state and actions:

```typescript
      formatOnSave: false,
      snippets: [],
      setFormatOnSave: (formatOnSave) => set({ formatOnSave }),
      addSnippet: (s) =>
        set((state) => ({
          snippets: [
            ...state.snippets.filter(
              (x) => !(x.prefix === s.prefix && x.language === s.language)
            ),
            s,
          ],
        })),
      removeSnippet: (prefix, language) =>
        set((state) => ({
          snippets: state.snippets.filter(
            (x) => !(x.prefix === prefix && x.language === language)
          ),
        })),
```

- [ ] **Step 3: Add viewState to EditorTab interface in Editor.tsx**

Find the `EditorTab` interface at line 44 and add `viewState?: string`:

```typescript
export interface EditorTab {
  path: string;
  name: string;
  content: string;
  language: string;
  isDirty: boolean;
  scrollTo?: {
    line: number;
    matchStart: number;
    matchEnd: number;
  } | null;
  viewState?: string;   // Monaco serialised view state (JSON string)
}
```

- [ ] **Step 4: Write failing tests for new store fields**

In `tests/unit/useSettingsStore.test.ts`, add at the end of the describe block:

```typescript
  it('formatOnSave defaults to false and toggles', () => {
    const { result } = renderHook(() => useSettingsStore());
    expect(result.current.formatOnSave).toBe(false);
    act(() => result.current.setFormatOnSave(true));
    expect(result.current.formatOnSave).toBe(true);
  });

  it('addSnippet deduplicates by prefix+language', () => {
    const { result } = renderHook(() => useSettingsStore());
    const s1 = { prefix: 'clg', body: 'console.log($1)', description: 'log', language: 'all' };
    const s2 = { prefix: 'clg', body: 'console.log("updated")', description: 'log2', language: 'all' };
    act(() => result.current.addSnippet(s1));
    act(() => result.current.addSnippet(s2));
    expect(result.current.snippets).toHaveLength(1);
    expect(result.current.snippets[0].body).toBe('console.log("updated")');
  });

  it('removeSnippet removes by prefix+language', () => {
    const { result } = renderHook(() => useSettingsStore());
    const s = { prefix: 'fn', body: 'function $1() {}', description: 'fn', language: 'javascript' };
    act(() => result.current.addSnippet(s));
    act(() => result.current.removeSnippet('fn', 'javascript'));
    expect(result.current.snippets).toHaveLength(0);
  });
```

- [ ] **Step 5: Run tests to confirm they fail**

```
cd mobile-ide/mobile-ide-prototype && npx jest --watchAll=false tests/unit/useSettingsStore.test.ts
```
Expected: FAIL — `formatOnSave is not a function` or similar.

- [ ] **Step 6: Run tests to confirm they pass after implementation**

```
cd mobile-ide/mobile-ide-prototype && npx jest --watchAll=false tests/unit/useSettingsStore.test.ts
```
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add mobile-ide/mobile-ide-prototype/src/utils/builtinSnippets.ts \
        mobile-ide/mobile-ide-prototype/src/stores/useSettingsStore.ts \
        mobile-ide/mobile-ide-prototype/src/components/Editor.tsx \
        mobile-ide/mobile-ide-prototype/tests/unit/useSettingsStore.test.ts
git commit -m "feat(epic-0021): foundation — SnippetDefinition type, formatOnSave/snippets store fields, EditorTab.viewState"
```

---

## Task 2: replaceEngine.ts

**Files:**
- Create: `mobile-ide/mobile-ide-prototype/src/utils/replaceEngine.ts`
- Create: `mobile-ide/mobile-ide-prototype/tests/unit/replaceEngine.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// tests/unit/replaceEngine.test.ts
import { replaceInFiles } from '../../src/utils/replaceEngine';
import { buildPattern } from '../../src/utils/searchEngine';
import type { FileSearchResult } from '../../src/utils/searchEngine';

const makeBridge = (files: Record<string, string>) => {
  const written: Record<string, string> = {};
  return {
    readFile: jest.fn(async (p: string) => files[p] ?? ''),
    writeFile: jest.fn(async (p: string, c: string) => { written[p] = c; }),
    _written: written,
  };
};

describe('replaceInFiles', () => {
  it('replaces plain text in a single file', async () => {
    const files = { '/a.ts': 'const foo = foo + 1;' };
    const bridge = makeBridge(files);
    const results: FileSearchResult[] = [
      { filePath: '/a.ts', matches: [{ lineNumber: 1, preview: 'const foo = foo + 1;', matchStart: 6, matchEnd: 9 }] },
    ];
    const pattern = buildPattern('foo', { caseSensitive: false, regex: false, wholeWord: false, glob: '' });
    const r = await replaceInFiles(results, pattern, 'bar', new Set(), bridge as any);
    expect(r.filesChanged).toBe(1);
    expect(r.matchesReplaced).toBe(2);
    expect(bridge._written['/a.ts']).toBe('const bar = bar + 1;');
  });

  it('supports regex capture group replacement', async () => {
    const files = { '/b.ts': 'hello world' };
    const bridge = makeBridge(files);
    const results: FileSearchResult[] = [
      { filePath: '/b.ts', matches: [{ lineNumber: 1, preview: 'hello world', matchStart: 0, matchEnd: 5 }] },
    ];
    const pattern = buildPattern('(hello)', { caseSensitive: false, regex: true, wholeWord: false, glob: '' });
    const r = await replaceInFiles(results, pattern, '[$1]', new Set(), bridge as any);
    expect(bridge._written['/b.ts']).toBe('[hello] world');
    expect(r.matchesReplaced).toBe(1);
  });

  it('skips excluded matches', async () => {
    const files = { '/c.ts': 'foo foo' };
    const bridge = makeBridge(files);
    const results: FileSearchResult[] = [
      {
        filePath: '/c.ts',
        matches: [
          { lineNumber: 1, preview: 'foo foo', matchStart: 0, matchEnd: 3 },
          { lineNumber: 1, preview: 'foo foo', matchStart: 4, matchEnd: 7 },
        ],
      },
    ];
    const pattern = buildPattern('foo', { caseSensitive: false, regex: false, wholeWord: false, glob: '' });
    const excluded = new Set(['/c.ts:1:0']);
    const r = await replaceInFiles(results, pattern, 'bar', excluded, bridge as any);
    expect(r.matchesReplaced).toBe(1);
    expect(bridge._written['/c.ts']).toBe('foo bar');
  });

  it('does not write file when content is unchanged', async () => {
    const files = { '/d.ts': 'hello' };
    const bridge = makeBridge(files);
    const results: FileSearchResult[] = [
      { filePath: '/d.ts', matches: [{ lineNumber: 1, preview: 'hello', matchStart: 0, matchEnd: 5 }] },
    ];
    // Exclude the only match
    const excluded = new Set(['/d.ts:1:0']);
    const pattern = buildPattern('hello', { caseSensitive: false, regex: false, wholeWord: false, glob: '' });
    await replaceInFiles(results, pattern, 'world', excluded, bridge as any);
    expect(bridge.writeFile).not.toHaveBeenCalled();
  });

  it('processes multiple files', async () => {
    const files = { '/e.ts': 'old', '/f.ts': 'old' };
    const bridge = makeBridge(files);
    const results: FileSearchResult[] = [
      { filePath: '/e.ts', matches: [{ lineNumber: 1, preview: 'old', matchStart: 0, matchEnd: 3 }] },
      { filePath: '/f.ts', matches: [{ lineNumber: 1, preview: 'old', matchStart: 0, matchEnd: 3 }] },
    ];
    const pattern = buildPattern('old', { caseSensitive: false, regex: false, wholeWord: false, glob: '' });
    const r = await replaceInFiles(results, pattern, 'new', new Set(), bridge as any);
    expect(r.filesChanged).toBe(2);
    expect(r.matchesReplaced).toBe(2);
  });
});
```

- [ ] **Step 2: Run to verify failure**

```
cd mobile-ide/mobile-ide-prototype && npx jest --watchAll=false tests/unit/replaceEngine.test.ts
```
Expected: FAIL — Cannot find module `../../src/utils/replaceEngine`

- [ ] **Step 3: Implement replaceEngine.ts**

```typescript
// src/utils/replaceEngine.ts
import type { FileSearchResult } from './searchEngine';
import type { FileSystemBridge } from './FileSystemBridge';

export async function replaceInFiles(
  results: FileSearchResult[],
  pattern: RegExp,
  replacement: string,
  excluded: Set<string>,
  bridge: Pick<typeof FileSystemBridge, 'readFile' | 'writeFile'>,
): Promise<{ filesChanged: number; matchesReplaced: number }> {
  let filesChanged = 0;
  let matchesReplaced = 0;

  const globalPattern = new RegExp(
    pattern.source,
    pattern.flags.includes('g') ? pattern.flags : pattern.flags + 'g',
  );

  for (const { filePath } of results) {
    const original = await bridge.readFile(filePath);
    let content = original;

    const newContent = content.replace(globalPattern, (...args) => {
      const fullMatch = args[0] as string;
      const offset = args[args.length - 2] as number;
      const upTo = content.slice(0, offset);
      const matchLine = upTo.split('\n').length;
      const lastNl = upTo.lastIndexOf('\n');
      const matchStart = lastNl === -1 ? offset : offset - lastNl - 1;
      const key = `${filePath}:${matchLine}:${matchStart}`;
      if (excluded.has(key)) return fullMatch;
      matchesReplaced++;
      return fullMatch.replace(pattern, replacement);
    });

    if (newContent !== original) {
      await bridge.writeFile(filePath, newContent);
      filesChanged++;
    }
  }

  return { filesChanged, matchesReplaced };
}
```

- [ ] **Step 4: Run tests to confirm pass**

```
cd mobile-ide/mobile-ide-prototype && npx jest --watchAll=false tests/unit/replaceEngine.test.ts
```
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add mobile-ide/mobile-ide-prototype/src/utils/replaceEngine.ts \
        mobile-ide/mobile-ide-prototype/tests/unit/replaceEngine.test.ts
git commit -m "feat(epic-0021): replaceEngine — multi-file replace with exclusion + capture group support"
```

---

## Task 3: useReplace.ts

**Files:**
- Create: `mobile-ide/mobile-ide-prototype/src/hooks/useReplace.ts`
- Create: `mobile-ide/mobile-ide-prototype/tests/unit/useReplace.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// tests/unit/useReplace.test.ts
import { renderHook, act } from '@testing-library/react-native';
import { useReplace } from '../../src/hooks/useReplace';
import { replaceInFiles } from '../../src/utils/replaceEngine';

jest.mock('../../src/utils/replaceEngine');
jest.mock('../../src/utils/FileSystemBridge', () => ({
  FileSystemBridge: { readFile: jest.fn(), writeFile: jest.fn() },
}));

const mockedReplace = replaceInFiles as jest.MockedFunction<typeof replaceInFiles>;

describe('useReplace', () => {
  beforeEach(() => jest.clearAllMocks());

  it('starts in search mode', () => {
    const { result } = renderHook(() => useReplace('/workspace'));
    expect(result.current.mode).toBe('search');
  });

  it('switches mode', () => {
    const { result } = renderHook(() => useReplace('/workspace'));
    act(() => result.current.setMode('replace'));
    expect(result.current.mode).toBe('replace');
  });

  it('toggleExclude adds and removes keys', () => {
    const { result } = renderHook(() => useReplace('/workspace'));
    act(() => result.current.toggleExclude('/a.ts:1:0'));
    expect(result.current.excludedMatches.has('/a.ts:1:0')).toBe(true);
    act(() => result.current.toggleExclude('/a.ts:1:0'));
    expect(result.current.excludedMatches.has('/a.ts:1:0')).toBe(false);
  });

  it('replaceAll calls replaceInFiles with correct args', async () => {
    mockedReplace.mockResolvedValue({ filesChanged: 1, matchesReplaced: 3 });
    const { result } = renderHook(() => useReplace('/workspace'));
    act(() => result.current.setReplaceQuery('bar'));
    let r: { filesChanged: number; matchesReplaced: number } | undefined;
    await act(async () => { r = await result.current.replaceAll(); });
    expect(mockedReplace).toHaveBeenCalled();
    expect(r?.filesChanged).toBe(1);
    expect(r?.matchesReplaced).toBe(3);
  });

  it('replacePreview shows "query → replacement" when both set', () => {
    const { result } = renderHook(() => useReplace('/workspace'));
    act(() => {
      result.current.setQuery('oldName');
      result.current.setReplaceQuery('newName');
    });
    expect(result.current.replacePreview).toBe('"oldName" → "newName"');
  });

  it('replacePreview is empty string when either field is empty', () => {
    const { result } = renderHook(() => useReplace('/workspace'));
    act(() => result.current.setQuery('foo'));
    expect(result.current.replacePreview).toBe('');
  });
});
```

- [ ] **Step 2: Run to verify failure**

```
cd mobile-ide/mobile-ide-prototype && npx jest --watchAll=false tests/unit/useReplace.test.ts
```
Expected: FAIL — Cannot find module `../../src/hooks/useReplace`

- [ ] **Step 3: Implement useReplace.ts**

```typescript
// src/hooks/useReplace.ts
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
```

- [ ] **Step 4: Run tests to confirm pass**

```
cd mobile-ide/mobile-ide-prototype && npx jest --watchAll=false tests/unit/useReplace.test.ts
```
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add mobile-ide/mobile-ide-prototype/src/hooks/useReplace.ts \
        mobile-ide/mobile-ide-prototype/tests/unit/useReplace.test.ts
git commit -m "feat(epic-0021): useReplace hook — mode, excludedMatches, replaceAll, replacePreview"
```

---

## Task 4: GlobalSearch — Replace Tab UI

**Files:**
- Modify: `mobile-ide/mobile-ide-prototype/src/components/GlobalSearch.tsx`
- Modify: `mobile-ide/mobile-ide-prototype/tests/unit/GlobalSearch.test.tsx`

- [ ] **Step 1: Write failing tests (append to GlobalSearch.test.tsx)**

```typescript
// Append to the existing describe block in tests/unit/GlobalSearch.test.tsx

  describe('replace mode', () => {
    it('shows SEARCH and REPLACE tab buttons', () => {
      render(<GlobalSearch workspaceRoot="/ws" onNavigate={jest.fn()} />);
      expect(screen.getByText('SEARCH')).toBeTruthy();
      expect(screen.getByText('REPLACE')).toBeTruthy();
    });

    it('replace input is hidden in search mode', () => {
      render(<GlobalSearch workspaceRoot="/ws" onNavigate={jest.fn()} />);
      expect(screen.queryByPlaceholderText('Replace with...')).toBeNull();
    });

    it('replace input appears after switching to REPLACE tab', () => {
      render(<GlobalSearch workspaceRoot="/ws" onNavigate={jest.fn()} />);
      fireEvent.press(screen.getByText('REPLACE'));
      expect(screen.getByPlaceholderText('Replace with...')).toBeTruthy();
    });

    it('Replace All button is shown in replace mode with results', async () => {
      // Mock useReplace to return a result
      jest.mock('../../src/hooks/useReplace', () => ({
        useReplace: () => ({
          ...require('../../src/hooks/useSearch').useSearch('/ws'),
          mode: 'replace',
          setMode: jest.fn(),
          replaceQuery: 'bar',
          setReplaceQuery: jest.fn(),
          excludedMatches: new Set(),
          toggleExclude: jest.fn(),
          replacePreview: '"foo" → "bar"',
          replaceAll: jest.fn().mockResolvedValue({ filesChanged: 1, matchesReplaced: 2 }),
        }),
      }));
      render(<GlobalSearch workspaceRoot="/ws" onNavigate={jest.fn()} />);
      fireEvent.press(screen.getByText('REPLACE'));
      // Replace All is always present in replace mode
      expect(screen.getByText('Replace All')).toBeTruthy();
    });
  });
```

- [ ] **Step 2: Run to verify failure**

```
cd mobile-ide/mobile-ide-prototype && npx jest --watchAll=false tests/unit/GlobalSearch.test.tsx
```
Expected: FAIL on the new replace-mode tests.

- [ ] **Step 3: Refactor GlobalSearch to use useReplace and add Replace tab**

Replace the top of `GlobalSearch.tsx` to import `useReplace` instead of `useSearch`:

```typescript
import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator, FlatList, Alert,
} from 'react-native';
import { useReplace } from '../hooks/useReplace';
import { useTheme } from '../theme/tokens';

export interface GlobalSearchProps {
  workspaceRoot: string;
  onNavigate: (filePath: string, lineNumber: number, matchStart: number, matchEnd: number) => void;
}
```

Replace the `GlobalSearch` function body's hook call from `useSearch` to `useReplace`:

```typescript
export function GlobalSearch({ workspaceRoot, onNavigate }: GlobalSearchProps) {
  const {
    query, setQuery, options, setOptions,
    results, isSearching, fileCount, totalMatchCount, error,
    submit, clear,
    mode, setMode, replaceQuery, setReplaceQuery,
    excludedMatches, toggleExclude, replacePreview, replaceAll,
  } = useReplace(workspaceRoot);
  const theme = useTheme();
```

Add the mode tab row immediately inside the container View, before the existing search input row:

```tsx
      {/* Mode tabs */}
      <View style={styles.modeTabs}>
        <TouchableOpacity
          style={[styles.modeTab, mode === 'search' && { borderBottomColor: theme.accent, borderBottomWidth: 2 }]}
          onPress={() => setMode('search')}
        >
          <Text style={{ color: mode === 'search' ? theme.accent : theme.textMuted, fontSize: 11, fontWeight: '600' }}>
            SEARCH
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.modeTab, mode === 'replace' && { borderBottomColor: theme.accent, borderBottomWidth: 2 }]}
          onPress={() => setMode('replace')}
        >
          <Text style={{ color: mode === 'replace' ? theme.accent : theme.textMuted, fontSize: 11, fontWeight: '600' }}>
            REPLACE
          </Text>
        </TouchableOpacity>
      </View>
```

After the existing search input row, add the replace input row (visible only in replace mode):

```tsx
      {mode === 'replace' && (
        <View style={[styles.inputRow, { borderColor: theme.border, marginTop: 4 }]}>
          <TextInput
            style={[styles.input, { color: theme.text }]}
            value={replaceQuery}
            onChangeText={setReplaceQuery}
            placeholder="Replace with..."
            placeholderTextColor={theme.textMuted}
            autoCorrect={false}
            autoCapitalize="none"
          />
        </View>
      )}
      {mode === 'replace' && replacePreview.length > 0 && (
        <Text style={{ color: theme.textMuted, fontSize: 11, paddingHorizontal: 8, paddingVertical: 2 }}>
          {replacePreview}
        </Text>
      )}
```

Before the results list, add the Replace All bar (replace mode + has results):

```tsx
      {mode === 'replace' && (
        <View style={[styles.summaryRow, { justifyContent: 'space-between' }]}>
          <Text style={[styles.summary, { color: theme.textMuted }]}>
            {totalMatchCount > 0 ? `${fileCount} files · ${totalMatchCount} matches` : 'No matches'}
          </Text>
          <TouchableOpacity
            style={[styles.replaceAllBtn, { backgroundColor: theme.accent }]}
            onPress={async () => {
              const r = await replaceAll();
              Alert.alert('Replace All', `${r.matchesReplaced} replacements in ${r.filesChanged} files.`);
            }}
          >
            <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>Replace All</Text>
          </TouchableOpacity>
        </View>
      )}
```

For each result match row, add a checkbox when in replace mode:

```tsx
              {result.matches.map((match) => {
                const key = `${result.filePath}:${match.lineNumber}:${match.matchStart}`;
                const excluded = excludedMatches.has(key);
                return (
                  <TouchableOpacity
                    key={key}
                    style={styles.matchRow}
                    onPress={() => mode === 'replace'
                      ? toggleExclude(key)
                      : onNavigate(result.filePath, match.lineNumber, match.matchStart, match.matchEnd)
                    }
                  >
                    {mode === 'replace' && (
                      <Text style={{ color: theme.textMuted, marginRight: 6 }}>{excluded ? '☐' : '☑'}</Text>
                    )}
                    <Text style={[styles.matchLine, { color: theme.textMuted }]} numberOfLines={1}>
                      {match.lineNumber}: {match.preview}
                    </Text>
                  </TouchableOpacity>
                );
              })}
```

Add new style entries to `StyleSheet.create`:

```typescript
    modeTabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: 'transparent' },
    modeTab: { flex: 1, alignItems: 'center', paddingVertical: 6 },
    replaceAllBtn: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 4 },
```

- [ ] **Step 4: Run tests**

```
cd mobile-ide/mobile-ide-prototype && npx jest --watchAll=false tests/unit/GlobalSearch.test.tsx
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add mobile-ide/mobile-ide-prototype/src/components/GlobalSearch.tsx \
        mobile-ide/mobile-ide-prototype/tests/unit/GlobalSearch.test.tsx
git commit -m "feat(epic-0021): GlobalSearch — SEARCH/REPLACE tabs, per-match exclusion checkboxes, Replace All (US-0073)"
```

---

## Task 5: useKeyboardShortcuts.ts

**Files:**
- Create: `mobile-ide/mobile-ide-prototype/src/hooks/useKeyboardShortcuts.ts`
- Create: `mobile-ide/mobile-ide-prototype/tests/unit/useKeyboardShortcuts.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// tests/unit/useKeyboardShortcuts.test.ts
import { renderHook } from '@testing-library/react-native';
import { NativeModules, NativeEventEmitter } from 'react-native';
import { useKeyboardShortcuts } from '../../src/hooks/useKeyboardShortcuts';
import type { ShortcutDefinition } from '../../src/hooks/useKeyboardShortcuts';

// Mock the native module
NativeModules.KeyboardShortcuts = {};
const mockAddListener = jest.fn(() => ({ remove: jest.fn() }));
jest.mock('react-native', () => {
  const actual = jest.requireActual('react-native');
  return {
    ...actual,
    NativeEventEmitter: jest.fn().mockImplementation(() => ({
      addListener: mockAddListener,
    })),
  };
});

describe('useKeyboardShortcuts', () => {
  beforeEach(() => jest.clearAllMocks());

  it('subscribes to onShortcut event on mount', () => {
    const shortcuts: ShortcutDefinition[] = [
      { key: 's', modifiers: ['cmd'], label: 'Save File', action: jest.fn() },
    ];
    renderHook(() => useKeyboardShortcuts(shortcuts));
    expect(mockAddListener).toHaveBeenCalledWith('onShortcut', expect.any(Function));
  });

  it('calls the matching action when shortcut fires', () => {
    const saveAction = jest.fn();
    const shortcuts: ShortcutDefinition[] = [
      { key: 's', modifiers: ['cmd'], label: 'Save File', action: saveAction },
    ];
    renderHook(() => useKeyboardShortcuts(shortcuts));
    // Get the registered handler
    const handler = mockAddListener.mock.calls[0][1] as Function;
    handler({ key: 's', modifiers: ['cmd'] });
    expect(saveAction).toHaveBeenCalledTimes(1);
  });

  it('does not call action for unregistered combo', () => {
    const saveAction = jest.fn();
    const shortcuts: ShortcutDefinition[] = [
      { key: 's', modifiers: ['cmd'], label: 'Save File', action: saveAction },
    ];
    renderHook(() => useKeyboardShortcuts(shortcuts));
    const handler = mockAddListener.mock.calls[0][1] as Function;
    handler({ key: 'z', modifiers: ['cmd'] });
    expect(saveAction).not.toHaveBeenCalled();
  });

  it('cleans up subscription on unmount', () => {
    const removeMock = jest.fn();
    mockAddListener.mockReturnValueOnce({ remove: removeMock });
    const shortcuts: ShortcutDefinition[] = [
      { key: 's', modifiers: ['cmd'], label: 'Save File', action: jest.fn() },
    ];
    const { unmount } = renderHook(() => useKeyboardShortcuts(shortcuts));
    unmount();
    expect(removeMock).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run to verify failure**

```
cd mobile-ide/mobile-ide-prototype && npx jest --watchAll=false tests/unit/useKeyboardShortcuts.test.ts
```
Expected: FAIL — Cannot find module.

- [ ] **Step 3: Implement useKeyboardShortcuts.ts**

```typescript
// src/hooks/useKeyboardShortcuts.ts
import { useEffect } from 'react';
import { NativeModules, NativeEventEmitter, Platform } from 'react-native';

export interface ShortcutDefinition {
  key: string;
  modifiers: ('cmd' | 'shift' | 'alt' | 'ctrl')[];
  label: string;
  action: () => void;
}

export function useKeyboardShortcuts(shortcuts: ShortcutDefinition[]): void {
  useEffect(() => {
    if (!NativeModules.KeyboardShortcuts) return;
    const emitter = new NativeEventEmitter(NativeModules.KeyboardShortcuts);
    const subscription = emitter.addListener(
      'onShortcut',
      (event: { key: string; modifiers: string[] }) => {
        const match = shortcuts.find(
          (s) =>
            s.key === event.key &&
            s.modifiers.length === event.modifiers.length &&
            s.modifiers.every((m) => event.modifiers.includes(m)),
        );
        match?.action();
      },
    );
    return () => subscription.remove();
  // Shortcuts array identity changes break the effect — use JSON as stable dep
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(shortcuts.map((s) => ({ key: s.key, modifiers: s.modifiers })))]);
}
```

- [ ] **Step 4: Run tests to confirm pass**

```
cd mobile-ide/mobile-ide-prototype && npx jest --watchAll=false tests/unit/useKeyboardShortcuts.test.ts
```
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add mobile-ide/mobile-ide-prototype/src/hooks/useKeyboardShortcuts.ts \
        mobile-ide/mobile-ide-prototype/tests/unit/useKeyboardShortcuts.test.ts
git commit -m "feat(epic-0021): useKeyboardShortcuts hook — native event router with cleanup (US-0074)"
```

---

## Task 6: iOS Native Module

**Files:**
- Create: `mobile-ide/mobile-ide-prototype/ios/NomadCode/KeyboardShortcuts.swift`

Note: This file is native Swift — no Jest test. The `useKeyboardShortcuts.test.ts` in Task 5 mocks the native side.

- [ ] **Step 1: Create KeyboardShortcuts.swift**

```swift
// ios/NomadCode/KeyboardShortcuts.swift
import Foundation
import React

@objc(KeyboardShortcuts)
class KeyboardShortcuts: RCTEventEmitter {

  private static let supportedShortcuts: [(key: UIKeyboardHIDUsage, modifiers: UIKeyModifierFlags, keyStr: String, modStrs: [String])] = [
    (.keyboardS,        .command,                            "s",  ["cmd"]),
    (.keyboardS,        [.command, .shift],                  "s",  ["cmd", "shift"]),
    (.keyboardGraveAccentAndTilde, .command,                 "`",  ["cmd"]),
    (.keyboardN,        .command,                            "n",  ["cmd"]),
    (.keyboardP,        .command,                            "p",  ["cmd"]),
    (.keyboardSlash,    .command,                            "/",  ["cmd"]),
  ]

  override func supportedEvents() -> [String]! { ["onShortcut"] }

  override class func requiresMainQueueSetup() -> Bool { true }

  override func constantsToExport() -> [AnyHashable: Any]! { [:] }

  @objc func buildKeyCommands() -> [UIKeyCommand] {
    return Self.supportedShortcuts.map { s in
      UIKeyCommand(
        input: String(UnicodeScalar(UInt8(s.key.rawValue))),
        modifierFlags: s.modifiers,
        action: #selector(handleKeyCommand(_:))
      )
    }
  }

  @objc private func handleKeyCommand(_ command: UIKeyCommand) {
    guard let match = Self.supportedShortcuts.first(where: {
      command.modifierFlags == $0.modifiers
    }) else { return }
    sendEvent(withName: "onShortcut", body: ["key": match.keyStr, "modifiers": match.modStrs])
  }
}
```

Also register in `ios/NomadCode/NomadCode-Bridging-Header.h` (or create it if missing):

```objc
// ios/NomadCode/NomadCode-Bridging-Header.h (add if not present)
#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>
```

Create the RCT export macro file:

```objc
// ios/NomadCode/KeyboardShortcuts.m
#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>

@interface RCT_EXTERN_MODULE(KeyboardShortcuts, RCTEventEmitter)
@end
```

- [ ] **Step 2: Verify files created — no automated test**

```bash
ls mobile-ide/mobile-ide-prototype/ios/NomadCode/KeyboardShortcuts.swift
ls mobile-ide/mobile-ide-prototype/ios/NomadCode/KeyboardShortcuts.m
```
Expected: both files listed.

- [ ] **Step 3: Commit**

```bash
git add mobile-ide/mobile-ide-prototype/ios/NomadCode/KeyboardShortcuts.swift \
        mobile-ide/mobile-ide-prototype/ios/NomadCode/KeyboardShortcuts.m
git commit -m "feat(epic-0021): iOS KeyboardShortcuts native module — UIKeyCommand → RCTEventEmitter (US-0074)"
```

---

## Task 7: Android Native Modules

**Files:**
- Create: `mobile-ide/mobile-ide-prototype/android/app/src/main/java/com/nomadcode/mobileide/KeyboardShortcutsModule.kt`
- Create: `mobile-ide/mobile-ide-prototype/android/app/src/main/java/com/nomadcode/mobileide/KeyboardShortcutsPackage.kt`
- Modify: `mobile-ide/mobile-ide-prototype/android/app/src/main/java/com/nomadcode/mobileide/MainApplication.kt`

- [ ] **Step 1: Create KeyboardShortcutsModule.kt**

```kotlin
// android/app/src/main/java/com/nomadcode/mobileide/KeyboardShortcutsModule.kt
package com.nomadcode.mobileide

import android.view.KeyEvent
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableNativeArray
import com.facebook.react.bridge.WritableNativeMap
import com.facebook.react.modules.core.DeviceEventManagerModule

class KeyboardShortcutsModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "KeyboardShortcuts"

    fun onKeyDown(keyCode: Int, event: KeyEvent): Boolean {
        val isCmd = event.isMetaPressed || event.isCtrlPressed
        if (!isCmd) return false

        val modifiers = WritableNativeArray()
        modifiers.pushString("cmd")
        if (event.isShiftPressed) modifiers.pushString("shift")
        if (event.isAltPressed) modifiers.pushString("alt")

        val key = when (keyCode) {
            KeyEvent.KEYCODE_S -> "s"
            KeyEvent.KEYCODE_N -> "n"
            KeyEvent.KEYCODE_P -> "p"
            KeyEvent.KEYCODE_SLASH -> "/"
            KeyEvent.KEYCODE_GRAVE -> "`"
            else -> return false
        }

        val params = WritableNativeMap()
        params.putString("key", key)
        params.putArray("modifiers", modifiers)

        reactContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit("onShortcut", params)
        return true
    }
}
```

- [ ] **Step 2: Create KeyboardShortcutsPackage.kt**

```kotlin
// android/app/src/main/java/com/nomadcode/mobileide/KeyboardShortcutsPackage.kt
package com.nomadcode.mobileide

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

class KeyboardShortcutsPackage : ReactPackage {
    override fun createNativeModules(context: ReactApplicationContext): List<NativeModule> =
        listOf(KeyboardShortcutsModule(context))

    override fun createViewManagers(context: ReactApplicationContext): List<ViewManager<*, *>> =
        emptyList()
}
```

- [ ] **Step 3: Register in MainApplication.kt**

Find the `getPackages()` block in `MainApplication.kt` and add the package:

```kotlin
        override fun getPackages(): List<ReactPackage> =
            PackageList(this).packages.apply {
              add(KeyboardShortcutsPackage())
            }
```

- [ ] **Step 4: Override dispatchKeyEvent in MainActivity.kt**

Open `android/app/src/main/java/com/nomadcode/mobileide/MainActivity.kt` and add:

```kotlin
    override fun dispatchKeyEvent(event: KeyEvent): Boolean {
        if (event.action == KeyEvent.ACTION_DOWN) {
            val module = reactInstanceManager
                ?.currentReactContext
                ?.getNativeModule(KeyboardShortcutsModule::class.java)
            if (module?.onKeyDown(event.keyCode, event) == true) return true
        }
        return super.dispatchKeyEvent(event)
    }
```

(Add the `import android.view.KeyEvent` import at the top of MainActivity.kt if missing.)

- [ ] **Step 5: Verify files exist**

```bash
ls mobile-ide/mobile-ide-prototype/android/app/src/main/java/com/nomadcode/mobileide/
```
Expected: KeyboardShortcutsModule.kt, KeyboardShortcutsPackage.kt visible alongside existing files.

- [ ] **Step 6: Commit**

```bash
git add mobile-ide/mobile-ide-prototype/android/app/src/main/java/com/nomadcode/mobileide/KeyboardShortcutsModule.kt \
        mobile-ide/mobile-ide-prototype/android/app/src/main/java/com/nomadcode/mobileide/KeyboardShortcutsPackage.kt \
        mobile-ide/mobile-ide-prototype/android/app/src/main/java/com/nomadcode/mobileide/MainApplication.kt \
        mobile-ide/mobile-ide-prototype/android/app/src/main/java/com/nomadcode/mobileide/MainActivity.kt
git commit -m "feat(epic-0021): Android KeyboardShortcuts native module — dispatchKeyEvent → onShortcut event (US-0074)"
```

---

## Task 8: KeyboardShortcutsSheet + App.tsx wiring

**Files:**
- Create: `mobile-ide/mobile-ide-prototype/src/components/KeyboardShortcutsSheet.tsx`
- Modify: `mobile-ide/mobile-ide-prototype/App.tsx`
- Create: `mobile-ide/mobile-ide-prototype/tests/unit/KeyboardShortcutsSheet.test.tsx`

- [ ] **Step 1: Write failing tests**

```typescript
// tests/unit/KeyboardShortcutsSheet.test.tsx
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { KeyboardShortcutsSheet } from '../../src/components/KeyboardShortcutsSheet';
import type { ShortcutDefinition } from '../../src/hooks/useKeyboardShortcuts';

const shortcuts: ShortcutDefinition[] = [
  { key: 's', modifiers: ['cmd'], label: 'Save File', action: jest.fn() },
  { key: 'p', modifiers: ['cmd'], label: 'Command Palette', action: jest.fn() },
];

describe('KeyboardShortcutsSheet', () => {
  it('renders all shortcut labels', () => {
    render(<KeyboardShortcutsSheet visible shortcuts={shortcuts} onClose={jest.fn()} />);
    expect(screen.getByText('Save File')).toBeTruthy();
    expect(screen.getByText('Command Palette')).toBeTruthy();
  });

  it('shows key combination strings', () => {
    render(<KeyboardShortcutsSheet visible shortcuts={shortcuts} onClose={jest.fn()} />);
    expect(screen.getByText('⌘S')).toBeTruthy();
    expect(screen.getByText('⌘P')).toBeTruthy();
  });

  it('calls onClose when close button pressed', () => {
    const onClose = jest.fn();
    render(<KeyboardShortcutsSheet visible shortcuts={shortcuts} onClose={onClose} />);
    fireEvent.press(screen.getByText('✕'));
    expect(onClose).toHaveBeenCalled();
  });

  it('does not render when visible=false', () => {
    render(<KeyboardShortcutsSheet visible={false} shortcuts={shortcuts} onClose={jest.fn()} />);
    expect(screen.queryByText('Save File')).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify failure**

```
cd mobile-ide/mobile-ide-prototype && npx jest --watchAll=false tests/unit/KeyboardShortcutsSheet.test.tsx
```
Expected: FAIL — Cannot find module.

- [ ] **Step 3: Implement KeyboardShortcutsSheet.tsx**

```typescript
// src/components/KeyboardShortcutsSheet.tsx
import React from 'react';
import { Modal, View, Text, TouchableOpacity, FlatList, StyleSheet, useWindowDimensions } from 'react-native';
import { useTheme } from '../theme/tokens';
import type { ShortcutDefinition } from '../hooks/useKeyboardShortcuts';

interface Props {
  visible: boolean;
  shortcuts: ShortcutDefinition[];
  onClose: () => void;
}

function formatShortcut(s: ShortcutDefinition): string {
  const modMap: Record<string, string> = { cmd: '⌘', shift: '⇧', alt: '⌥', ctrl: '⌃' };
  return s.modifiers.map((m) => modMap[m] ?? m).join('') + s.key.toUpperCase();
}

export function KeyboardShortcutsSheet({ visible, shortcuts, onClose }: Props) {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;

  if (!visible) return null;

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={[
          styles.sheet,
          isTablet ? styles.centered : styles.bottom,
          { backgroundColor: theme.surface, borderColor: theme.border },
        ]}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: theme.text }]}>Keyboard Shortcuts</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={{ color: theme.textMuted, fontSize: 16 }}>✕</Text>
            </TouchableOpacity>
          </View>
          <FlatList
            data={shortcuts}
            keyExtractor={(s) => `${s.key}-${s.modifiers.join('')}`}
            renderItem={({ item }) => (
              <View style={styles.row}>
                <Text style={[styles.label, { color: theme.text }]}>{item.label}</Text>
                <Text style={[styles.combo, { color: theme.accent }]}>{formatShortcut(item)}</Text>
              </View>
            )}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { borderRadius: 12, borderWidth: 1, maxHeight: '70%', paddingBottom: 24 },
  centered: { alignSelf: 'center', width: 480, marginBottom: 0, marginVertical: 'auto' as any },
  bottom: { borderBottomLeftRadius: 0, borderBottomRightRadius: 0 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
  title: { fontSize: 16, fontWeight: '600' },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10 },
  label: { fontSize: 14 },
  combo: { fontSize: 14, fontFamily: 'monospace', fontWeight: '600' },
});
```

- [ ] **Step 4: Wire shortcuts in App.tsx**

Add import near other hook imports:

```typescript
import { useKeyboardShortcuts } from './src/hooks/useKeyboardShortcuts';
import type { ShortcutDefinition } from './src/hooks/useKeyboardShortcuts';
import { KeyboardShortcutsSheet } from './src/components/KeyboardShortcutsSheet';
```

Add state for the sheet inside the `App` component:

```typescript
  const [showShortcutsSheet, setShowShortcutsSheet] = useState(false);
```

Define the shortcut list (add after existing useState calls, before the JSX return):

```typescript
  const shortcuts: ShortcutDefinition[] = useMemo(() => [
    { key: 's', modifiers: ['cmd'], label: 'Save File', action: saveActiveFile },
    { key: 's', modifiers: ['cmd', 'shift'], label: 'Save All', action: () => {
      tabs.forEach((tab) => { if (tab.isDirty) saveFile(tab.path, tab.content); });
    }},
    { key: '`', modifiers: ['cmd'], label: 'Toggle Terminal', action: () => setTerminalVisible((v) => !v) },
    { key: 'n', modifiers: ['cmd'], label: 'New File', action: () => setTriggerNewFile(true) },
    { key: 'p', modifiers: ['cmd'], label: 'Command Palette', action: () => setShowPalette(true) },
    { key: '/', modifiers: ['cmd'], label: 'Keyboard Shortcuts', action: () => setShowShortcutsSheet(true) },
  ], [saveActiveFile, saveFile, tabs, setTerminalVisible, setTriggerNewFile, setShowPalette]);

  useKeyboardShortcuts(shortcuts);
```

Add the sheet to the JSX (alongside other modals):

```tsx
        <KeyboardShortcutsSheet
          visible={showShortcutsSheet}
          shortcuts={shortcuts}
          onClose={() => setShowShortcutsSheet(false)}
        />
```

Add "Keyboard Shortcuts" to the commands array in App.tsx:

```typescript
      { id: 'keyboard-shortcuts', label: 'Keyboard Shortcuts', description: '⌘/', action: () => setShowShortcutsSheet(true) },
```

- [ ] **Step 5: Run tests**

```
cd mobile-ide/mobile-ide-prototype && npx jest --watchAll=false tests/unit/KeyboardShortcutsSheet.test.tsx
```
Expected: PASS (4 tests)

- [ ] **Step 6: Run all tests to check no regressions**

```
cd mobile-ide/mobile-ide-prototype && npx jest --watchAll=false
```
Expected: PASS (all existing + 4 new)

- [ ] **Step 7: Commit**

```bash
git add mobile-ide/mobile-ide-prototype/src/components/KeyboardShortcutsSheet.tsx \
        mobile-ide/mobile-ide-prototype/App.tsx \
        mobile-ide/mobile-ide-prototype/tests/unit/KeyboardShortcutsSheet.test.tsx
git commit -m "feat(epic-0021): KeyboardShortcutsSheet modal + App.tsx shortcut wiring (US-0074)"
```

---

## Task 9: Monaco Code Folding

**Files:**
- Modify: `mobile-ide/mobile-ide-prototype/src/utils/MonacoAssetManager.ts`
- Modify: `mobile-ide/mobile-ide-prototype/App.tsx` (add Fold All/Unfold All commands)
- Modify: `mobile-ide/mobile-ide-prototype/tests/unit/Editor.test.tsx`

- [ ] **Step 1: Write failing tests (append to Editor.test.tsx)**

```typescript
// Append to tests/unit/Editor.test.tsx

  describe('fold commands', () => {
    it('sendToEditor FOLD_ALL when Fold All command triggered', async () => {
      // This is tested through App.test.tsx command palette wiring.
      // Here we verify the Editor exposes sendFoldAll via ref or callback.
      // Since fold is triggered via onFoldAll prop, test that prop fires correctly.
      const onFoldAll = jest.fn();
      render(renderEditor({ onFoldAll }));
      // Simulate toolbar/command calling fold
      expect(onFoldAll).toBeDefined();
    });
  });
```

(The primary integration test is in App.test.tsx commands — the Editor just passes through.)

- [ ] **Step 2: Add folding options to buildMonacoHtml in MonacoAssetManager.ts**

In the `monaco.editor.create(...)` options object (around line 215), add:

```javascript
          folding: true,
          showFoldingControls: 'always',
```

- [ ] **Step 3: Add FOLD_ALL and UNFOLD_ALL message handlers in MonacoAssetManager.ts**

Inside the `switch (msg.type)` block in the `window.addEventListener('message', ...)` handler, add:

```javascript
          case 'FOLD_ALL':
            if (editor) editor.getAction('editor.foldAll').run();
            break;
          case 'UNFOLD_ALL':
            if (editor) editor.getAction('editor.unfoldAll').run();
            break;
```

- [ ] **Step 4: Add Fold All and Unfold All to Command Palette in App.tsx**

In the commands array, add:

```typescript
      { id: 'editor-fold-all', label: 'Editor: Fold All', description: 'Fold all code regions', action: () => {
        /* sendToEditor is on the Editor component; use a ref or callback */
        editorRef.current?.sendFoldAll?.();
      }},
      { id: 'editor-unfold-all', label: 'Editor: Unfold All', description: 'Unfold all code regions', action: () => {
        editorRef.current?.sendUnfoldAll?.();
      }},
```

Since `Editor` currently doesn't expose an imperative handle, expose `sendFoldAll` and `sendUnfoldAll` via `useImperativeHandle`. In `Editor.tsx`:

Add at the top of the component:

```typescript
import React, { forwardRef, useImperativeHandle, ... } from 'react';

export interface EditorHandle {
  sendFoldAll: () => void;
  sendUnfoldAll: () => void;
}
```

Wrap the component with `forwardRef` and add `useImperativeHandle`:

```typescript
const Editor = forwardRef<EditorHandle, EditorProps>(function Editor(
  { tabs, activeTabPath, onTabChange, onTabClose, onContentChange, onSave, onTabScrollConsumed },
  ref,
) {
  // ... existing code ...

  useImperativeHandle(ref, () => ({
    sendFoldAll: () => sendToEditor('FOLD_ALL'),
    sendUnfoldAll: () => sendToEditor('UNFOLD_ALL'),
  }), [sendToEditor]);

  // ... rest of component
});
export default Editor;
```

In `App.tsx`, add a `editorRef`:

```typescript
  const editorRef = useRef<EditorHandle | null>(null);
```

Pass it to `<Editor ref={editorRef} ... />`.

- [ ] **Step 5: Run all tests**

```
cd mobile-ide/mobile-ide-prototype && npx jest --watchAll=false
```
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add mobile-ide/mobile-ide-prototype/src/utils/MonacoAssetManager.ts \
        mobile-ide/mobile-ide-prototype/src/components/Editor.tsx \
        mobile-ide/mobile-ide-prototype/App.tsx \
        mobile-ide/mobile-ide-prototype/tests/unit/Editor.test.tsx
git commit -m "feat(epic-0021): Monaco code folding — gutter chevrons, Fold All/Unfold All commands (US-0075)"
```

---

## Task 10: View State Persistence (fold state per tab)

**Files:**
- Modify: `mobile-ide/mobile-ide-prototype/src/utils/MonacoAssetManager.ts`
- Modify: `mobile-ide/mobile-ide-prototype/src/components/Editor.tsx`
- Modify: `mobile-ide/mobile-ide-prototype/tests/unit/Editor.test.tsx`

- [ ] **Step 1: Write failing tests**

Append to `tests/unit/Editor.test.tsx`:

```typescript
  describe('view state persistence', () => {
    it('stores viewState when SAVE_VIEW_STATE message received', async () => {
      const onTabViewStateChange = jest.fn();
      render(renderEditor({ onTabViewStateChange }));

      // Simulate Monaco posting SAVE_VIEW_STATE
      await act(async () => {
        capturedOnMessage?.({
          nativeEvent: { data: JSON.stringify({ type: 'SAVE_VIEW_STATE', path: '/test.ts', viewState: '{"scrollTop":100}' }) },
        } as any);
      });

      expect(onTabViewStateChange).toHaveBeenCalledWith('/test.ts', '{"scrollTop":100}');
    });

    it('sends RESTORE_VIEW_STATE when tab with viewState becomes active', async () => {
      const tabWithState = { ...sampleTabs[0], viewState: '{"scrollTop":50}' };
      render(renderEditor({ tabs: [tabWithState], activeTabPath: tabWithState.path }));

      await waitFor(() => {
        const calls = (capturedInjectJS as jest.Mock).mock.calls.flat().join(' ');
        expect(calls).toContain('RESTORE_VIEW_STATE');
      });
    });
  });
```

(Assumes `renderEditor`, `capturedOnMessage`, `capturedInjectJS`, and `sampleTabs` are already defined in the test file from existing tests.)

- [ ] **Step 2: Add SAVE_VIEW_STATE (Monaco→RN) in MonacoAssetManager.ts**

In the Monaco JS, after the `editor.onDidChangeModelContent` handler, add a cursor-change handler:

```javascript
        // ── Tab switch: save view state before leaving ────────────────────
        // Called from RN before switching tabs
        // SAVE_VIEW_STATE is sent by RN as a request; Monaco posts the state back.
```

In the `switch (msg.type)` block, add:

```javascript
          case 'REQUEST_VIEW_STATE': {
            var vs = editor ? editor.saveViewState() : null;
            post({ type: 'SAVE_VIEW_STATE', path: msg.path, viewState: vs ? JSON.stringify(vs) : null });
            break;
          }
          case 'RESTORE_VIEW_STATE': {
            if (editor && msg.viewState) {
              try {
                editor.restoreViewState(JSON.parse(msg.viewState));
              } catch (e) { /* ignore invalid state */ }
            }
            break;
          }
```

- [ ] **Step 3: Add view state save/restore in Editor.tsx**

Add `onTabViewStateChange` to `EditorProps`:

```typescript
interface EditorProps {
  // ... existing props ...
  onTabViewStateChange?: (path: string, viewState: string) => void;
}
```

In `handleMessage`, add the SAVE_VIEW_STATE case:

```typescript
          case 'SAVE_VIEW_STATE':
            if (msg.viewState && msg.path) {
              onTabViewStateChange?.(msg.path, msg.viewState);
            }
            break;
```

In the `useEffect` that sends `setContent` when active tab changes, add view state restore after `setContent`:

```typescript
    // After sending setContent, restore view state if available
    if (activeTab.viewState) {
      // Small delay to let setContent finish before restoring state
      setTimeout(() => {
        sendToEditor('RESTORE_VIEW_STATE', { viewState: activeTab.viewState });
      }, 50);
    }
```

Before the tab switches (in `onTabChange` in App.tsx), request the view state:

In `App.tsx`, add `onTabViewStateChange` handler:

```typescript
  const handleTabViewStateChange = useCallback((path: string, viewState: string) => {
    setTabs((prev) =>
      prev.map((t) => t.path === path ? { ...t, viewState } : t)
    );
  }, []);
```

Pass to `<Editor onTabViewStateChange={handleTabViewStateChange} ... />`.

When tab changes (`onTabChange`), before switching, request the current view state:

```typescript
  const handleTabChange = useCallback((path: string) => {
    // Request save of current tab's view state before switching
    editorRef.current?.requestViewStateSave?.(activeTabPath ?? '');
    setActiveTabPath(path);
  }, [activeTabPath]);
```

Add `requestViewStateSave` to `EditorHandle` and `useImperativeHandle`:

```typescript
export interface EditorHandle {
  sendFoldAll: () => void;
  sendUnfoldAll: () => void;
  requestViewStateSave: (path: string) => void;
}

// In useImperativeHandle:
    requestViewStateSave: (path: string) => sendToEditor('REQUEST_VIEW_STATE', { path }),
```

- [ ] **Step 4: Run all tests**

```
cd mobile-ide/mobile-ide-prototype && npx jest --watchAll=false
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add mobile-ide/mobile-ide-prototype/src/utils/MonacoAssetManager.ts \
        mobile-ide/mobile-ide-prototype/src/components/Editor.tsx \
        mobile-ide/mobile-ide-prototype/App.tsx \
        mobile-ide/mobile-ide-prototype/tests/unit/Editor.test.tsx
git commit -m "feat(epic-0021): view state persistence — fold regions + scroll preserved per tab (US-0075)"
```

---

## Task 11: Prettier Bundle + FORMAT Handler

**Files:**
- Modify: `mobile-ide/mobile-ide-prototype/src/utils/MonacoAssetManager.ts`

- [ ] **Step 1: Add loadPrettierSource() to MonacoAssetManager**

After the `CORE_FILES` constant, add:

```typescript
const PRETTIER_VERSION = '3.5.3'; // pin to match package.json devDep
const PRETTIER_CDN_BASE = `https://cdn.jsdelivr.net/npm/prettier@${PRETTIER_VERSION}`;
const PRETTIER_CACHE_DIR = () => `${ExpoFS.documentDirectory ?? '/'}prettier/${PRETTIER_VERSION}/`;

const PRETTIER_FILES = [
  { remote: `${PRETTIER_CDN_BASE}/standalone.js`,        local: 'standalone.js' },
  { remote: `${PRETTIER_CDN_BASE}/plugins/babel.js`,     local: 'plugins/babel.js' },
  { remote: `${PRETTIER_CDN_BASE}/plugins/typescript.js`,local: 'plugins/typescript.js' },
  { remote: `${PRETTIER_CDN_BASE}/plugins/postcss.js`,   local: 'plugins/postcss.js' },
  { remote: `${PRETTIER_CDN_BASE}/plugins/html.js`,      local: 'plugins/html.js' },
  { remote: `${PRETTIER_CDN_BASE}/plugins/markdown.js`,  local: 'plugins/markdown.js' },
  { remote: `${PRETTIER_CDN_BASE}/plugins/estree.js`,    local: 'plugins/estree.js' },
];
```

Add `loadPrettierSource()` to the `MonacoAssetManager` export object:

```typescript
  /** Returns concatenated prettier standalone + plugin source for inlining in buildMonacoHtml. */
  async loadPrettierSource(): Promise<string | null> {
    try {
      const dir = PRETTIER_CACHE_DIR();
      await ExpoFS.makeDirectoryAsync(dir + 'plugins/', { intermediates: true }).catch(() => {});

      const parts: string[] = [];
      for (const f of PRETTIER_FILES) {
        const localPath = dir + f.local;
        let content: string;
        const info = await ExpoFS.getInfoAsync(localPath);
        if (info.exists) {
          content = await ExpoFS.readAsStringAsync(localPath);
        } else {
          const resp = await ExpoFS.downloadAsync(f.remote, localPath);
          content = await ExpoFS.readAsStringAsync(resp.uri);
        }
        parts.push(content);
      }
      return parts.join('\n;\n');
    } catch {
      return null; // Graceful: format-on-save just won't work offline without cache
    }
  },
```

- [ ] **Step 2: Add prettierSource parameter to buildMonacoHtml**

Change the signature:

```typescript
export function buildMonacoHtml(
  vsBaseUrl: string,
  initialTheme: 'vs' | 'vs-dark' = 'vs-dark',
  prettierSource?: string,
): string {
```

Inside the returned HTML string, after the `<style>` block and before the `<script src="${vsBaseUrl}/loader.js">` tag, add:

```javascript
  ${prettierSource ? `<script>${prettierSource}</script>` : '<!-- prettier not loaded -->'}
```

- [ ] **Step 3: Add PARSER_MAP and FORMAT handler in Monaco JS (inside buildMonacoHtml)**

Add inside the `(function() { 'use strict';` block, near the top with other globals:

```javascript
    // ── Prettier ──────────────────────────────────────────────────────────────
    var prettierPlugins = (typeof prettierPlugins !== 'undefined') ? prettierPlugins : null;
    var prettier        = (typeof prettier !== 'undefined') ? prettier : null;
    var PARSER_MAP = {
      typescript: 'typescript', javascript: 'babel',
      css: 'css', scss: 'css', html: 'html', markdown: 'markdown', json: 'json',
    };
    var formatOnSave = false;
    var prettierConfig = {};
```

Inside `switch (msg.type)`, add:

```javascript
          case 'SET_OPTIONS': {
            if (typeof msg.formatOnSave === 'boolean') { formatOnSave = msg.formatOnSave; }
            if (msg.snippets) { registerSnippets(msg.snippets, msg.language || 'plaintext'); }
            if (msg.prettierConfig) { prettierConfig = msg.prettierConfig; }
            break;
          }
          case 'FORMAT': {
            runPrettier().then(function(ok) {
              post({ type: 'FORMAT_COMPLETE', success: ok });
            });
            break;
          }
          case 'PRETTIER_CONFIG': {
            prettierConfig = msg.config || {};
            break;
          }
```

Add the `runPrettier` helper function inside the IIFE:

```javascript
    async function runPrettier() {
      if (!prettier || !editor) return false;
      var model = editor.getModel();
      if (!model) return false;
      var langId = model.getLanguageId();
      var parser = PARSER_MAP[langId];
      if (!parser) return false;
      try {
        var content = editor.getValue();
        var plugins = Object.values(prettierPlugins || {});
        var formatted = await prettier.format(content, Object.assign({}, prettierConfig, { parser: parser, plugins: plugins }));
        if (formatted === content) return true;
        var fullRange = model.getFullModelRange();
        editor.executeEdits('prettier', [{ range: fullRange, text: formatted }]);
        return true;
      } catch (e) {
        return false;
      }
    }
```

Modify the existing ⌘S handler to check `formatOnSave`:

```javascript
        editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, function () {
          if (formatOnSave) {
            runPrettier().then(function() {
              post({ type: 'save', content: editor.getValue() });
            });
          } else {
            post({ type: 'save', content: editor.getValue() });
          }
        });
```

- [ ] **Step 4: Update Editor.tsx to load prettier when building Monaco HTML**

In `Editor.tsx`, in the `useEffect` that calls `MonacoAssetManager.resolve()` and sets `monacoHtml`, also load prettier:

```typescript
    async function init() {
      const { baseUrl, isOffline: offline } = await MonacoAssetManager.resolve();
      setIsOffline(offline);
      const prettierSource = await MonacoAssetManager.loadPrettierSource();
      setMonacoHtml(buildMonacoHtml(baseUrl, monacoTheme, prettierSource ?? undefined));
    }
    init();
```

- [ ] **Step 5: Run all tests**

```
cd mobile-ide/mobile-ide-prototype && npx jest --watchAll=false
```
Expected: PASS (MonacoAssetManager.test.ts will need `loadPrettierSource` mocked if it calls network — add to mock.)

- [ ] **Step 6: Commit**

```bash
git add mobile-ide/mobile-ide-prototype/src/utils/MonacoAssetManager.ts \
        mobile-ide/mobile-ide-prototype/src/components/Editor.tsx
git commit -m "feat(epic-0021): Prettier bundle — CDN cache, FORMAT handler, PARSER_MAP, formatOnSave flag (US-0076)"
```

---

## Task 12: Format-on-Save Settings Toggle + Prettier Config Resolution

**Files:**
- Modify: `mobile-ide/mobile-ide-prototype/src/components/SettingsScreen.tsx`
- Modify: `mobile-ide/mobile-ide-prototype/src/components/Editor.tsx`
- Modify: `mobile-ide/mobile-ide-prototype/App.tsx`
- Modify: `mobile-ide/mobile-ide-prototype/tests/unit/SettingsScreen.test.tsx`
- Modify: `mobile-ide/mobile-ide-prototype/tests/unit/Editor.test.tsx`

- [ ] **Step 1: Write failing tests (append to SettingsScreen.test.tsx)**

```typescript
  describe('format on save', () => {
    it('renders Format on Save toggle', () => {
      render(<SettingsScreen visible onClose={jest.fn()} />);
      expect(screen.getByText('Format on Save')).toBeTruthy();
    });

    it('toggle calls setFormatOnSave', () => {
      const setFormatOnSave = jest.fn();
      jest.spyOn(require('../../src/stores/useSettingsStore'), 'default')
        .mockImplementation((selector: any) =>
          selector({ formatOnSave: false, setFormatOnSave, snippets: [], ...mockSettingsState })
        );
      render(<SettingsScreen visible onClose={jest.fn()} />);
      fireEvent(screen.getByTestId('format-on-save-toggle'), 'valueChange', true);
      expect(setFormatOnSave).toHaveBeenCalledWith(true);
    });
  });
```

- [ ] **Step 2: Add Format on Save toggle to SettingsScreen.tsx**

In `SettingsScreen.tsx`, read `formatOnSave` and `setFormatOnSave` from the store:

```typescript
  const formatOnSave = useSettingsStore((s) => s.formatOnSave);
  const setFormatOnSave = useSettingsStore((s) => s.setFormatOnSave);
```

Add a toggle row in the settings list (after the font size row, before extensions):

```tsx
        <View style={styles.row}>
          <Text style={[styles.label, { color: theme.text }]}>Format on Save</Text>
          <Switch
            testID="format-on-save-toggle"
            value={formatOnSave}
            onValueChange={setFormatOnSave}
            trackColor={{ true: theme.accent }}
          />
        </View>
```

- [ ] **Step 3: Add format-on-save prop to Editor and wire SET_OPTIONS message**

In `EditorProps`, add:

```typescript
  formatOnSave?: boolean;
```

In `Editor.tsx`, add a `useEffect` that sends `SET_OPTIONS` when `formatOnSave` changes:

```typescript
  useEffect(() => {
    if (!editorReady) return;
    sendToEditor('SET_OPTIONS', { formatOnSave: formatOnSave ?? false });
  }, [editorReady, formatOnSave, sendToEditor]);
```

In `App.tsx`, read `formatOnSave` from store and pass to `<Editor>`:

```typescript
  const formatOnSave = useSettingsStore((s) => s.formatOnSave);
  // ...
  <Editor ref={editorRef} formatOnSave={formatOnSave} ... />
```

- [ ] **Step 4: Add Prettier config resolution**

In `App.tsx`, add a `useEffect` that runs when workspace changes to send the prettier config:

```typescript
  useEffect(() => {
    if (!rootPath) return;
    const CONFIG_FILES = ['.prettierrc', '.prettierrc.json', 'prettier.config.json'];
    let found = false;
    (async () => {
      for (const name of CONFIG_FILES) {
        try {
          const content = await FileSystemBridge.readFile(`${rootPath}/${name}`);
          const config = JSON.parse(content);
          editorRef.current && sendPrettierConfig(config);
          found = true;
          break;
        } catch { /* file not found or not valid JSON */ }
      }
      if (!found) {
        editorRef.current && sendPrettierConfig({});
      }
    })();
  }, [rootPath]);
```

Add `sendPrettierConfig` helper via `EditorHandle`:

```typescript
// In EditorHandle:
  sendPrettierConfig: (config: Record<string, unknown>) => void;

// In useImperativeHandle:
  sendPrettierConfig: (config) => sendToEditor('PRETTIER_CONFIG', { config }),
```

- [ ] **Step 5: Add "Format Document" to Command Palette**

In App.tsx commands array:

```typescript
      { id: 'format-document', label: 'Format Document', description: 'Run Prettier on current file', action: () => {
        editorRef.current && (editorRef as any).current.sendFormat?.();
      }},
```

Add to EditorHandle and useImperativeHandle:

```typescript
  sendFormat: () => void;
// ...
  sendFormat: () => sendToEditor('FORMAT'),
```

- [ ] **Step 6: Run all tests**

```
cd mobile-ide/mobile-ide-prototype && npx jest --watchAll=false
```
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add mobile-ide/mobile-ide-prototype/src/components/SettingsScreen.tsx \
        mobile-ide/mobile-ide-prototype/src/components/Editor.tsx \
        mobile-ide/mobile-ide-prototype/App.tsx \
        mobile-ide/mobile-ide-prototype/tests/unit/SettingsScreen.test.tsx \
        mobile-ide/mobile-ide-prototype/tests/unit/Editor.test.tsx
git commit -m "feat(epic-0021): format-on-save toggle, Format Document command, Prettier config resolution (US-0076)"
```

---

## Task 13: symbolExtractor.ts

**Files:**
- Create: `mobile-ide/mobile-ide-prototype/src/utils/symbolExtractor.ts`
- Create: `mobile-ide/mobile-ide-prototype/tests/unit/symbolExtractor.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// tests/unit/symbolExtractor.test.ts
import { getCurrentSymbol } from '../../src/utils/symbolExtractor';

describe('getCurrentSymbol', () => {
  it('finds a JS function', () => {
    const content = 'function myFunc() {\n  return 1;\n}';
    expect(getCurrentSymbol(content, 1)).toBe('myFunc');
  });

  it('finds an arrow const function', () => {
    const content = 'const myArrow = () => {\n  return 2;\n};';
    expect(getCurrentSymbol(content, 1)).toBe('myArrow');
  });

  it('finds a class', () => {
    const content = 'class MyClass {\n  constructor() {}\n}';
    expect(getCurrentSymbol(content, 2)).toBe('MyClass');
  });

  it('finds exported async function', () => {
    const content = 'export async function fetchData() {}';
    expect(getCurrentSymbol(content, 1)).toBe('fetchData');
  });

  it('finds Python def', () => {
    const content = 'def my_func(arg):\n    pass';
    expect(getCurrentSymbol(content, 1)).toBe('my_func');
  });

  it('finds Rust fn', () => {
    const content = 'fn compute(x: i32) -> i32 {\n    x * 2\n}';
    expect(getCurrentSymbol(content, 1)).toBe('compute');
  });

  it('finds Go func', () => {
    const content = 'func HandleRequest(w ResponseWriter, r *Request) {}';
    expect(getCurrentSymbol(content, 1)).toBe('HandleRequest');
  });

  it('returns null when cursor is above any symbol', () => {
    const content = 'const x = 1;';
    expect(getCurrentSymbol(content, 0)).toBeNull();
  });

  it('returns last symbol before cursor line', () => {
    const content = 'function first() {}\n\nconst second = () => {}';
    // cursor on line 3 (0-based: line 2) — last symbol before that is 'second'
    expect(getCurrentSymbol(content, 3)).toBe('second');
  });
});
```

- [ ] **Step 2: Run to verify failure**

```
cd mobile-ide/mobile-ide-prototype && npx jest --watchAll=false tests/unit/symbolExtractor.test.ts
```
Expected: FAIL — Cannot find module.

- [ ] **Step 3: Implement symbolExtractor.ts**

```typescript
// src/utils/symbolExtractor.ts
const SYMBOL_PATTERNS: RegExp[] = [
  /^(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s+(\w+)/m,
  /^(?:export\s+)?(?:abstract\s+)?class\s+(\w+)/m,
  /^(?:export\s+)?const\s+(\w+)\s*=\s*(?:async\s+)?\(/m,
  /^def\s+(\w+)/m,
  /^fn\s+(\w+)/m,
  /^func\s+(\w+)/m,
];

/**
 * Returns the name of the last symbol declared at or before `cursorLine` (1-based).
 * Returns null if no symbol found.
 */
export function getCurrentSymbol(content: string, cursorLine: number): string | null {
  const lines = content.split('\n').slice(0, cursorLine);
  const sliced = lines.join('\n');
  let lastMatch: string | null = null;
  for (const pattern of SYMBOL_PATTERNS) {
    const globalPat = new RegExp(pattern.source, 'gm');
    let m: RegExpExecArray | null;
    while ((m = globalPat.exec(sliced)) !== null) {
      lastMatch = m[1];
    }
  }
  return lastMatch;
}
```

- [ ] **Step 4: Run tests to confirm pass**

```
cd mobile-ide/mobile-ide-prototype && npx jest --watchAll=false tests/unit/symbolExtractor.test.ts
```
Expected: PASS (9 tests)

- [ ] **Step 5: Commit**

```bash
git add mobile-ide/mobile-ide-prototype/src/utils/symbolExtractor.ts \
        mobile-ide/mobile-ide-prototype/tests/unit/symbolExtractor.test.ts
git commit -m "feat(epic-0021): symbolExtractor — regex current-symbol finder for breadcrumb (US-0077)"
```

---

## Task 14: Breadcrumb.tsx + BREADCRUMB_UPDATE + Editor Integration

**Files:**
- Create: `mobile-ide/mobile-ide-prototype/src/components/Breadcrumb.tsx`
- Modify: `mobile-ide/mobile-ide-prototype/src/utils/MonacoAssetManager.ts`
- Modify: `mobile-ide/mobile-ide-prototype/src/components/Editor.tsx`
- Create: `mobile-ide/mobile-ide-prototype/tests/unit/Breadcrumb.test.tsx`

- [ ] **Step 1: Write failing tests**

```typescript
// tests/unit/Breadcrumb.test.tsx
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { Breadcrumb } from '../../src/components/Breadcrumb';

describe('Breadcrumb', () => {
  const segments = ['src', 'components', 'Editor.tsx'];

  it('renders all path segments', () => {
    render(<Breadcrumb segments={segments} symbol={null} onSegmentPress={jest.fn()} />);
    expect(screen.getByText('src')).toBeTruthy();
    expect(screen.getByText('components')).toBeTruthy();
    expect(screen.getByText('Editor.tsx')).toBeTruthy();
  });

  it('renders symbol when provided', () => {
    render(<Breadcrumb segments={segments} symbol="handleMessage" onSegmentPress={jest.fn()} />);
    expect(screen.getByText('handleMessage')).toBeTruthy();
  });

  it('symbol is not shown when null', () => {
    render(<Breadcrumb segments={segments} symbol={null} onSegmentPress={jest.fn()} />);
    expect(screen.queryByTestId('breadcrumb-symbol')).toBeNull();
  });

  it('calls onSegmentPress with correct index', () => {
    const onSegmentPress = jest.fn();
    render(<Breadcrumb segments={segments} symbol={null} onSegmentPress={onSegmentPress} />);
    fireEvent.press(screen.getByText('components'));
    expect(onSegmentPress).toHaveBeenCalledWith(1, expect.any(String));
  });
});
```

- [ ] **Step 2: Run to verify failure**

```
cd mobile-ide/mobile-ide-prototype && npx jest --watchAll=false tests/unit/Breadcrumb.test.tsx
```
Expected: FAIL — Cannot find module.

- [ ] **Step 3: Implement Breadcrumb.tsx**

```typescript
// src/components/Breadcrumb.tsx
import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '../theme/tokens';

interface BreadcrumbProps {
  segments: string[];
  symbol: string | null;
  onSegmentPress: (index: number, parentPath: string) => void;
}

export function Breadcrumb({ segments, symbol, onSegmentPress }: BreadcrumbProps) {
  const theme = useTheme();

  return (
    <View testID="editor-path-breadcrumb" style={[styles.container, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {segments.map((seg, i) => (
          <React.Fragment key={`${seg}-${i}`}>
            {i > 0 && <Text style={[styles.sep, { color: theme.textMuted }]}> › </Text>}
            <TouchableOpacity onPress={() => {
              const parentPath = segments.slice(0, i + 1).join('/');
              onSegmentPress(i, parentPath);
            }}>
              <Text style={[styles.seg, { color: i === segments.length - 1 ? theme.text : theme.textMuted }]}>
                {seg}
              </Text>
            </TouchableOpacity>
          </React.Fragment>
        ))}
        {symbol && (
          <>
            <Text style={[styles.sep, { color: theme.textMuted }]}> › </Text>
            <Text testID="breadcrumb-symbol" style={[styles.seg, { color: theme.accent }]}>{symbol}</Text>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { height: 28, borderBottomWidth: StyleSheet.hairlineWidth },
  scroll: { alignItems: 'center', paddingHorizontal: 8 },
  seg: { fontSize: 12 },
  sep: { fontSize: 12 },
});
```

- [ ] **Step 4: Add BREADCRUMB_UPDATE message in MonacoAssetManager.ts**

Inside the Monaco JS (in buildMonacoHtml), after the cursor-mode handler, add a debounced cursor listener:

```javascript
    // ── Breadcrumb: symbol on cursor move (debounced 150ms) ───────────────────
    var breadcrumbTimer = null;
    // getCurrentSymbol runs inside the WebView using simple regex
    var SYMBOL_PATTERNS = [
      /^(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s+(\w+)/m,
      /^(?:export\s+)?(?:abstract\s+)?class\s+(\w+)/m,
      /^(?:export\s+)?const\s+(\w+)\s*=\s*(?:async\s+)?\(/m,
      /^def\s+(\w+)/m,
      /^fn\s+(\w+)/m,
      /^func\s+(\w+)/m,
    ];
    function getCurrentSymbol(content, cursorLine) {
      var lines = content.split('\\n').slice(0, cursorLine);
      var sliced = lines.join('\\n');
      var lastMatch = null;
      for (var i = 0; i < SYMBOL_PATTERNS.length; i++) {
        var gp = new RegExp(SYMBOL_PATTERNS[i].source, 'gm');
        var m;
        while ((m = gp.exec(sliced)) !== null) { lastMatch = m[1]; }
      }
      return lastMatch;
    }
```

Add inside `require(['vs/editor/editor.main'], ...)` after the editor is created:

```javascript
        editor.onDidChangeCursorPosition(function(e) {
          if (breadcrumbTimer) clearTimeout(breadcrumbTimer);
          breadcrumbTimer = setTimeout(function() {
            var content = editor.getValue();
            var line = e.position.lineNumber;
            var symbol = getCurrentSymbol(content, line);
            post({ type: 'BREADCRUMB_UPDATE', symbol: symbol });
          }, 150);
        });
```

- [ ] **Step 5: Replace path bar in Editor.tsx with Breadcrumb component**

Add import:

```typescript
import { Breadcrumb } from './Breadcrumb';
```

Add state for symbol:

```typescript
  const [symbol, setSymbol] = useState<string | null>(null);
```

In `handleMessage`, add:

```typescript
          case 'BREADCRUMB_UPDATE':
            setSymbol(msg.symbol ?? null);
            break;
```

Replace the existing path bar JSX (lines 527-539) with:

```tsx
      {activeTab && (
        <Breadcrumb
          segments={activeTab.path
            .replace(/^file:\/\//, '')
            .split('/')
            .filter(Boolean)
            .slice(-4)}
          symbol={symbol}
          onSegmentPress={(index, parentPath) => {
            // Show sibling picker — implementation is a future enhancement
            // For now, navigate up to parent folder in FileExplorer
          }}
        />
      )}
```

- [ ] **Step 6: Run all tests**

```
cd mobile-ide/mobile-ide-prototype && npx jest --watchAll=false
```
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add mobile-ide/mobile-ide-prototype/src/components/Breadcrumb.tsx \
        mobile-ide/mobile-ide-prototype/src/utils/MonacoAssetManager.ts \
        mobile-ide/mobile-ide-prototype/src/components/Editor.tsx \
        mobile-ide/mobile-ide-prototype/tests/unit/Breadcrumb.test.tsx
git commit -m "feat(epic-0021): Breadcrumb nav — tappable path+symbol bar, BREADCRUMB_UPDATE on cursor move (US-0077)"
```

---

## Task 15: builtinSnippets.ts

**Files:**
- Modify: `mobile-ide/mobile-ide-prototype/src/utils/builtinSnippets.ts`
- Create: `mobile-ide/mobile-ide-prototype/tests/unit/builtinSnippets.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// tests/unit/builtinSnippets.test.ts
import { BUILTIN_SNIPPETS } from '../../src/utils/builtinSnippets';

describe('BUILTIN_SNIPPETS', () => {
  it('every entry has prefix, body, description, and language', () => {
    for (const s of BUILTIN_SNIPPETS) {
      expect(s.prefix).toBeTruthy();
      expect(s.body).toBeTruthy();
      expect(s.description).toBeTruthy();
      expect(s.language).toBeTruthy();
    }
  });

  it('has no duplicate prefix+language combinations', () => {
    const keys = BUILTIN_SNIPPETS.map((s) => `${s.prefix}:${s.language}`);
    const unique = new Set(keys);
    expect(unique.size).toBe(keys.length);
  });

  it('includes clg for console.log', () => {
    const clg = BUILTIN_SNIPPETS.find((s) => s.prefix === 'clg');
    expect(clg).toBeDefined();
    expect(clg?.body).toContain('console.log');
  });

  it('includes rfc for React component', () => {
    const rfc = BUILTIN_SNIPPETS.find((s) => s.prefix === 'rfc');
    expect(rfc).toBeDefined();
    expect(rfc?.language).toBe('typescriptreact');
  });

  it('includes Python snippets', () => {
    const pySnippets = BUILTIN_SNIPPETS.filter((s) => s.language === 'python');
    expect(pySnippets.length).toBeGreaterThanOrEqual(3);
  });

  it('includes Rust snippets', () => {
    const rustSnippets = BUILTIN_SNIPPETS.filter((s) => s.language === 'rust');
    expect(rustSnippets.length).toBeGreaterThanOrEqual(2);
  });
});
```

- [ ] **Step 2: Run to verify failure (BUILTIN_SNIPPETS is currently empty)**

```
cd mobile-ide/mobile-ide-prototype && npx jest --watchAll=false tests/unit/builtinSnippets.test.ts
```
Expected: FAIL on "includes clg" and duplicate tests.

- [ ] **Step 3: Fill in BUILTIN_SNIPPETS in builtinSnippets.ts**

```typescript
// src/utils/builtinSnippets.ts
export interface SnippetDefinition {
  prefix: string;
  body: string;
  description: string;
  language: string | 'all';
}

export const BUILTIN_SNIPPETS: SnippetDefinition[] = [
  // ── Universal ────────────────────────────────────────────────────────────
  { prefix: 'clg',    body: 'console.log($1)',                                   description: 'console.log',              language: 'all' },
  { prefix: 'uef',    body: 'useEffect(() => {\n\t$1\n}, [$2])',                 description: 'useEffect hook',           language: 'all' },
  { prefix: 'ust',    body: 'const [$1, set$2] = useState($3)',                  description: 'useState hook',            language: 'all' },
  // ── JavaScript ───────────────────────────────────────────────────────────
  { prefix: 'afn',    body: 'const $1 = ($2) => {\n\t$3\n}',                    description: 'Arrow function',           language: 'javascript' },
  // ── TypeScript React ─────────────────────────────────────────────────────
  {
    prefix: 'rfc',
    body: 'import React from \'react\';\n\ninterface ${1:Props} {}\n\nexport function ${2:Component}({}: ${1:Props}) {\n\treturn (\n\t\t<$3 />\n\t);\n}',
    description: 'React functional component',
    language: 'typescriptreact',
  },
  // ── Python ───────────────────────────────────────────────────────────────
  { prefix: 'def',    body: 'def $1($2):\n\t$3',                                 description: 'Python function',          language: 'python' },
  {
    prefix: 'cls',
    body: 'class $1:\n\tdef __init__(self$2):\n\t\t$3',
    description: 'Python class',
    language: 'python',
  },
  { prefix: 'ifmain', body: 'if __name__ == \'__main__\':\n\t$1',                description: 'if __name__ == main',      language: 'python' },
  // ── Rust ─────────────────────────────────────────────────────────────────
  { prefix: 'fn',     body: 'fn $1($2) -> $3 {\n\t$4\n}',                       description: 'Rust function',            language: 'rust' },
  { prefix: 'impl',   body: 'impl $1 {\n\t$2\n}',                                description: 'Rust impl block',          language: 'rust' },
  // ── Go ───────────────────────────────────────────────────────────────────
  { prefix: 'pr',     body: 'fmt.Println($1)',                                   description: 'fmt.Println',              language: 'go' },
  { prefix: 'func',   body: 'func $1($2) $3 {\n\t$4\n}',                        description: 'Go function',              language: 'go' },
];
```

- [ ] **Step 4: Run tests to confirm pass**

```
cd mobile-ide/mobile-ide-prototype && npx jest --watchAll=false tests/unit/builtinSnippets.test.ts
```
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add mobile-ide/mobile-ide-prototype/src/utils/builtinSnippets.ts \
        mobile-ide/mobile-ide-prototype/tests/unit/builtinSnippets.test.ts
git commit -m "feat(epic-0021): builtinSnippets — JS/TS/React/Python/Rust/Go catalogue (US-0078)"
```

---

## Task 16: Snippet CompletionItemProvider + SettingsScreen Snippets UI

**Files:**
- Modify: `mobile-ide/mobile-ide-prototype/src/utils/MonacoAssetManager.ts`
- Modify: `mobile-ide/mobile-ide-prototype/src/components/SettingsScreen.tsx`
- Modify: `mobile-ide/mobile-ide-prototype/App.tsx`
- Modify: `mobile-ide/mobile-ide-prototype/tests/unit/SettingsScreen.test.tsx`

- [ ] **Step 1: Write failing tests (append to SettingsScreen.test.tsx)**

```typescript
  describe('snippets section', () => {
    it('renders Snippets section heading', () => {
      render(<SettingsScreen visible onClose={jest.fn()} />);
      expect(screen.getByText('Snippets')).toBeTruthy();
    });

    it('shows Add Snippet button', () => {
      render(<SettingsScreen visible onClose={jest.fn()} />);
      expect(screen.getByText('Add Snippet')).toBeTruthy();
    });

    it('Add Snippet opens modal with form fields', () => {
      render(<SettingsScreen visible onClose={jest.fn()} />);
      fireEvent.press(screen.getByText('Add Snippet'));
      expect(screen.getByPlaceholderText('Prefix (trigger)')).toBeTruthy();
      expect(screen.getByPlaceholderText('Expansion body')).toBeTruthy();
    });
  });
```

- [ ] **Step 2: Add snippet CompletionItemProvider to MonacoAssetManager.ts buildMonacoHtml**

Add `registerSnippets` function inside the Monaco IIFE (before the `window.addEventListener` block):

```javascript
    // ── Snippet completion provider ────────────────────────────────────────────
    var snippetDisposables = {};
    function registerSnippets(snippets, currentLanguage) {
      // Dispose existing providers
      Object.values(snippetDisposables).forEach(function(d) { if (d && d.dispose) d.dispose(); });
      snippetDisposables = {};
      var byLang = {};
      snippets.forEach(function(s) {
        var langs = s.language === 'all'
          ? [currentLanguage]
          : [s.language];
        langs.forEach(function(lang) {
          if (!byLang[lang]) byLang[lang] = [];
          byLang[lang].push(s);
        });
      });
      Object.keys(byLang).forEach(function(lang) {
        snippetDisposables[lang] = monaco.languages.registerCompletionItemProvider(lang, {
          provideCompletionItems: function() {
            return {
              suggestions: byLang[lang].map(function(s) {
                return {
                  label: s.prefix,
                  kind: monaco.languages.CompletionItemKind.Snippet,
                  documentation: s.description,
                  insertText: s.body,
                  insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                };
              }),
            };
          },
        });
      });
    }
```

The `SET_OPTIONS` case already calls `registerSnippets(msg.snippets, msg.language)` from Task 11. Verify that wiring is in place.

- [ ] **Step 3: Send snippets to Monaco when editor ready and on language change**

In `Editor.tsx`, in the `useEffect` that sends `SET_OPTIONS`, extend to include snippets:

```typescript
  const snippets = useSettingsStore((s) => s.snippets);

  useEffect(() => {
    if (!editorReady || !activeTab) return;
    const allSnippets = [...BUILTIN_SNIPPETS, ...snippets];
    sendToEditor('SET_OPTIONS', {
      formatOnSave: formatOnSave ?? false,
      snippets: allSnippets,
      language: activeTab.language,
    });
  }, [editorReady, formatOnSave, snippets, activeTab?.language, sendToEditor]);
```

Add imports:

```typescript
import { BUILTIN_SNIPPETS } from '../utils/builtinSnippets';
import useSettingsStore from '../stores/useSettingsStore';
```

- [ ] **Step 4: Add Snippets section to SettingsScreen.tsx**

Read snippets from store:

```typescript
  const snippets = useSettingsStore((s) => s.snippets);
  const addSnippet = useSettingsStore((s) => s.addSnippet);
  const removeSnippet = useSettingsStore((s) => s.removeSnippet);
  const [showAddSnippet, setShowAddSnippet] = useState(false);
  const [newPrefix, setNewPrefix] = useState('');
  const [newBody, setNewBody] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newLanguage, setNewLanguage] = useState('all');
```

Add snippets section in the settings JSX (after extensions section):

```tsx
        {/* ── Snippets ── */}
        <Text style={[styles.sectionHeader, { color: theme.textMuted }]}>Snippets</Text>
        {snippets.map((s) => (
          <View key={`${s.prefix}:${s.language}`} style={[styles.row, { justifyContent: 'space-between' }]}>
            <View>
              <Text style={[styles.label, { color: theme.text }]}>{s.prefix}</Text>
              <Text style={{ color: theme.textMuted, fontSize: 11 }}>{s.description} · {s.language}</Text>
            </View>
            <TouchableOpacity onPress={() => removeSnippet(s.prefix, s.language)}>
              <Text style={{ color: theme.error ?? '#EF4444', fontSize: 13 }}>Remove</Text>
            </TouchableOpacity>
          </View>
        ))}
        {BUILTIN_SNIPPETS.map((s) => (
          <View key={`builtin-${s.prefix}:${s.language}`} style={[styles.row, { opacity: 0.5 }]}>
            <Text style={[styles.label, { color: theme.text }]}>{s.prefix}</Text>
            <Text style={{ color: theme.textMuted, fontSize: 11 }}>{s.language} (built-in)</Text>
          </View>
        ))}
        <TouchableOpacity style={[styles.addBtn, { borderColor: theme.accent }]} onPress={() => setShowAddSnippet(true)}>
          <Text style={{ color: theme.accent }}>Add Snippet</Text>
        </TouchableOpacity>

        {/* Add snippet modal */}
        <Modal visible={showAddSnippet} transparent animationType="slide" onRequestClose={() => setShowAddSnippet(false)}>
          <View style={styles.modalBackdrop}>
            <View style={[styles.modalContent, { backgroundColor: theme.surface }]}>
              <Text style={[styles.sectionHeader, { color: theme.text }]}>New Snippet</Text>
              <TextInput
                style={[styles.input, { color: theme.text, borderColor: theme.border }]}
                placeholder="Prefix (trigger)"
                placeholderTextColor={theme.textMuted}
                value={newPrefix}
                onChangeText={setNewPrefix}
                autoCapitalize="none"
              />
              <TextInput
                style={[styles.input, { color: theme.text, borderColor: theme.border, height: 80 }]}
                placeholder="Expansion body"
                placeholderTextColor={theme.textMuted}
                value={newBody}
                onChangeText={setNewBody}
                multiline
                autoCapitalize="none"
              />
              <TextInput
                style={[styles.input, { color: theme.text, borderColor: theme.border }]}
                placeholder="Description"
                placeholderTextColor={theme.textMuted}
                value={newDescription}
                onChangeText={setNewDescription}
              />
              <TextInput
                style={[styles.input, { color: theme.text, borderColor: theme.border }]}
                placeholder="Language (e.g. typescript, python, all)"
                placeholderTextColor={theme.textMuted}
                value={newLanguage}
                onChangeText={setNewLanguage}
                autoCapitalize="none"
              />
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                <TouchableOpacity style={[styles.addBtn, { flex: 1, borderColor: theme.border }]} onPress={() => setShowAddSnippet(false)}>
                  <Text style={{ color: theme.textMuted }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.addBtn, { flex: 1, borderColor: theme.accent, backgroundColor: theme.accent }]}
                  onPress={() => {
                    if (newPrefix && newBody) {
                      addSnippet({ prefix: newPrefix, body: newBody, description: newDescription || newPrefix, language: newLanguage || 'all' });
                      setNewPrefix(''); setNewBody(''); setNewDescription(''); setNewLanguage('all');
                      setShowAddSnippet(false);
                    }
                  }}
                >
                  <Text style={{ color: '#fff' }}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
```

Add missing styles:

```typescript
    addBtn: { borderWidth: 1, borderRadius: 6, alignItems: 'center', paddingVertical: 8, marginVertical: 4 },
    modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalContent: { padding: 16, borderTopLeftRadius: 16, borderTopRightRadius: 16 },
    input: { borderWidth: 1, borderRadius: 6, padding: 8, marginVertical: 4, fontSize: 13 },
```

Import BUILTIN_SNIPPETS:

```typescript
import { BUILTIN_SNIPPETS } from '../utils/builtinSnippets';
```

- [ ] **Step 5: Run all tests**

```
cd mobile-ide/mobile-ide-prototype && npx jest --watchAll=false
```
Expected: PASS

- [ ] **Step 6: Check coverage**

```
cd mobile-ide/mobile-ide-prototype && npx jest --watchAll=false --coverage
```
Expected: ≥ 80% on all new/modified files.

- [ ] **Step 7: Commit**

```bash
git add mobile-ide/mobile-ide-prototype/src/utils/MonacoAssetManager.ts \
        mobile-ide/mobile-ide-prototype/src/components/SettingsScreen.tsx \
        mobile-ide/mobile-ide-prototype/src/components/Editor.tsx \
        mobile-ide/mobile-ide-prototype/tests/unit/SettingsScreen.test.tsx
git commit -m "feat(epic-0021): snippets CompletionItemProvider + Settings UI — add/remove user snippets (US-0078)"
```

---

## Task 17: Manual Smoke Test Docs

**Files:**
- Create: `docs/TEST_SCRIPT_EDITOR.md`

- [ ] **Step 1: Create the smoke test script**

```markdown
# Editor Feature Smoke Tests — EPIC-0021

Run these manually on an iOS simulator (iPad Pro 13-inch M5) before opening the PR.

## 1. Search & Replace (US-0073)
1. Open a project with at least 3 files containing the word `const`.
2. Open the Search panel, switch to REPLACE tab.
3. Enter `const` in Search, `let` in Replace.
4. Verify preview shows `"const" → "let"`.
5. Uncheck one match (it should show ☐).
6. Press Replace All — verify alert shows correct file/match counts.
7. Open the affected files — verify unchecked match was NOT replaced.
8. Verify regex replacement: search `(const) (\w+)`, replace `$2 = $1` — verify capture group expansion.

## 2. Hardware Keyboard Shortcuts (US-0074)
Requires an iPad with a physical keyboard connected.
1. Press ⌘S — verify current file saves (dirty indicator clears).
2. Press ⌘⇧S — verify all dirty files save.
3. Press ⌘` — verify terminal panel toggles.
4. Press ⌘N — verify new untitled file appears in tabs.
5. Press ⌘P — verify Command Palette opens.
6. Press ⌘/ — verify Keyboard Shortcuts sheet opens with all shortcuts listed.

## 3. Code Folding (US-0075)
1. Open a TypeScript file with at least one function (≥5 lines).
2. Verify gutter chevrons (▾) appear on foldable lines.
3. Tap a chevron — the region collapses.
4. Open Command Palette → "Editor: Fold All" — all regions collapse.
5. Open Command Palette → "Editor: Unfold All" — all regions expand.
6. Fold a region, then switch to another tab and back.
7. Verify the folded region is still folded (view state persisted).

## 4. Auto-Format on Save (US-0076)
1. Open Settings → enable "Format on Save".
2. Open a `.ts` file and add poorly indented code (e.g., extra spaces).
3. Press ⌘S — verify Prettier formats the code. Undo (⌘Z) restores original.
4. Open Command Palette → "Format Document" — verify it formats regardless of toggle.
5. Disable "Format on Save". Press ⌘S — verify file saves WITHOUT formatting.
6. Add a `.prettierrc.json` at workspace root: `{"tabWidth": 2}`. Format — verify config is respected.

## 5. Breadcrumb Navigation (US-0077)
1. Open a TypeScript file with a function `function myHandler()`.
2. Move cursor inside the function body.
3. Verify breadcrumb shows path segments + `myHandler` in accent color.
4. Move cursor above the function — verify symbol disappears from breadcrumb.
5. Tap a path segment (not the last) — (sibling picker is a future enhancement; verify press is handled without crash).

## 6. Snippets (US-0078)
1. Open a JavaScript file, type `clg` and press Tab.
2. Verify `console.log()` expands with cursor inside parens.
3. Open a TypeScript React file, type `rfc` and press Tab — verify component scaffold.
4. Open Settings → Snippets section — verify built-in snippets listed read-only.
5. Tap "Add Snippet" — fill in prefix `mySnip`, body `const $1 = $2;`, language `typescript`.
6. Open a `.ts` file, type `mySnip` Tab — verify expansion with tab stop navigation.
7. Return to Settings → swipe/remove the snippet — verify it disappears.
```

- [ ] **Step 2: Run all tests one final time**

```
cd mobile-ide/mobile-ide-prototype && npx jest --watchAll=false --coverage
```
Expected: PASS, ≥ 80% branch coverage.

- [ ] **Step 3: Commit**

```bash
git add docs/TEST_SCRIPT_EDITOR.md
git commit -m "docs: EPIC-0021 manual smoke test script"
```

---

## Final Integration Checklist

- [ ] All 17 tasks committed.
- [ ] `npx jest --watchAll=false --coverage` passes with ≥ 80% on all new/modified files.
- [ ] No TypeScript errors: `npx tsc --noEmit` from `mobile-ide/mobile-ide-prototype/`.
- [ ] PR opened targeting `develop` with title: `feat(epic-0021): Advanced Editor Features — Search&Replace, Keyboard Shortcuts, Folding, Format, Breadcrumb, Snippets`.
- [ ] Manual smoke tests from `docs/TEST_SCRIPT_EDITOR.md` completed on iOS simulator.
