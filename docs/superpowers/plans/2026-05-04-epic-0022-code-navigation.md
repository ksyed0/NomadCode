# EPIC-0022 Code Navigation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Go to Definition (long-press/⌘Click), Find All References (file-grouped panel), and Workspace Symbol Search (⌘T) to NomadCode's Monaco editor.

**Architecture:** Monaco TS worker provides same-file semantic GoToDef; a regex-based declaration index (AsyncStorage-cached) handles cross-file navigation and symbol search; text search over FileSystemBridge handles Find References across unloaded files. All touch/keyboard triggers are detected inside the Monaco WebView HTML and posted to React Native via the existing WebView bridge.

**Tech Stack:** React Native (Expo 54), TypeScript 5, Monaco 0.45.0 (WebView), Zustand, AsyncStorage, FileSystemBridge (Expo FileSystem), `@testing-library/react-native`.

**Test runner:** `cd mobile-ide/mobile-ide-prototype && npx jest --watchAll=false`
**Single file:** `cd mobile-ide/mobile-ide-prototype && npx jest tests/unit/<file> --watchAll=false`

---

## Task 1: codeNavUtils.ts — shared helpers

**Files:**
- Create: `mobile-ide/mobile-ide-prototype/src/codeNav/codeNavUtils.ts`
- Create: `mobile-ide/mobile-ide-prototype/tests/unit/codeNavUtils.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// tests/unit/codeNavUtils.test.ts
import { isCodeFile, escapeRegex } from '../../src/codeNav/codeNavUtils';

describe('isCodeFile', () => {
  it('returns true for .ts', () => expect(isCodeFile('/src/foo.ts')).toBe(true));
  it('returns true for .tsx', () => expect(isCodeFile('/src/foo.tsx')).toBe(true));
  it('returns true for .js', () => expect(isCodeFile('/src/foo.js')).toBe(true));
  it('returns true for .py', () => expect(isCodeFile('/src/foo.py')).toBe(true));
  it('returns true for .json', () => expect(isCodeFile('/src/foo.json')).toBe(true));
  it('returns true for .md', () => expect(isCodeFile('/README.md')).toBe(true));
  it('returns false for .png', () => expect(isCodeFile('/assets/icon.png')).toBe(false));
  it('returns false for .wasm', () => expect(isCodeFile('/bundle.wasm')).toBe(false));
  it('returns false for .db', () => expect(isCodeFile('/data.db')).toBe(false));
  it('handles file with no extension', () => expect(isCodeFile('/Makefile')).toBe(false));
});

describe('escapeRegex', () => {
  it('escapes dot', () => expect(escapeRegex('foo.bar')).toBe('foo\\.bar'));
  it('escapes asterisk', () => expect(escapeRegex('a*b')).toBe('a\\*b'));
  it('escapes parens', () => expect(escapeRegex('fn()')).toBe('fn\\(\\)'));
  it('leaves plain identifiers unchanged', () => expect(escapeRegex('formatDate')).toBe('formatDate'));
  it('escapes dollar sign', () => expect(escapeRegex('$el')).toBe('\\$el'));
});
```

- [ ] **Step 2: Run — expect failure**

```bash
cd mobile-ide/mobile-ide-prototype && npx jest tests/unit/codeNavUtils.test.ts --watchAll=false 2>&1 | tail -3
```
Expected: `Cannot find module '../../src/codeNav/codeNavUtils'`

- [ ] **Step 3: Create codeNavUtils.ts**

```typescript
// src/codeNav/codeNavUtils.ts

const CODE_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
  '.py', '.go', '.rs', '.swift', '.kt', '.java',
  '.c', '.cpp', '.h', '.cs', '.rb', '.php',
  '.json', '.yaml', '.yml', '.toml', '.md',
  '.css', '.scss', '.html',
]);

export function isCodeFile(filePath: string): boolean {
  const dot = filePath.lastIndexOf('.');
  if (dot === -1) return false;
  return CODE_EXTENSIONS.has(filePath.slice(dot));
}

export function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
```

- [ ] **Step 4: Run — expect pass**

```bash
cd mobile-ide/mobile-ide-prototype && npx jest tests/unit/codeNavUtils.test.ts --watchAll=false
```
Expected: 15 tests pass.

- [ ] **Step 5: Commit**

```bash
git add mobile-ide/mobile-ide-prototype/src/codeNav/codeNavUtils.ts \
        mobile-ide/mobile-ide-prototype/tests/unit/codeNavUtils.test.ts
git commit -m "feat US-0079: add codeNavUtils — isCodeFile, escapeRegex"
```

---

## Task 2: symbolContextMenu.ts — types + buildActions

**Files:**
- Create: `mobile-ide/mobile-ide-prototype/src/codeNav/symbolContextMenu.ts`
- Create: `mobile-ide/mobile-ide-prototype/tests/unit/symbolContextMenu.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// tests/unit/symbolContextMenu.test.ts
import { buildActions } from '../../src/codeNav/symbolContextMenu';

describe('buildActions', () => {
  it('includes goToDefinition + peekDefinition when hasDefinition is true', () => {
    const actions = buildActions({ word: 'foo', hasDefinition: true, canFindRefs: true });
    expect(actions).toContain('goToDefinition');
    expect(actions).toContain('peekDefinition');
  });

  it('includes findReferences when canFindRefs is true', () => {
    const actions = buildActions({ word: 'foo', hasDefinition: false, canFindRefs: true });
    expect(actions).toContain('findReferences');
  });

  it('always includes copySymbol when word is non-empty', () => {
    const actions = buildActions({ word: 'foo', hasDefinition: false, canFindRefs: false });
    expect(actions).toContain('copySymbol');
  });

  it('returns only [findReferences, copySymbol] when hasDefinition is false', () => {
    const actions = buildActions({ word: 'foo', hasDefinition: false, canFindRefs: true });
    expect(actions).not.toContain('goToDefinition');
    expect(actions).not.toContain('peekDefinition');
    expect(actions).toContain('findReferences');
    expect(actions).toContain('copySymbol');
  });

  it('returns empty array when word is empty', () => {
    expect(buildActions({ word: '', hasDefinition: false, canFindRefs: false })).toEqual([]);
  });
});
```

- [ ] **Step 2: Run — expect failure**

```bash
cd mobile-ide/mobile-ide-prototype && npx jest tests/unit/symbolContextMenu.test.ts --watchAll=false 2>&1 | tail -3
```

- [ ] **Step 3: Create symbolContextMenu.ts**

```typescript
// src/codeNav/symbolContextMenu.ts

export interface SymbolAtCursor {
  word:          string;
  hasDefinition: boolean;
  canFindRefs:   boolean;
  position?:     { line: number; column: number };
}

export type SymbolAction =
  | 'goToDefinition'
  | 'peekDefinition'
  | 'findReferences'
  | 'copySymbol';

export interface ContextMenuState {
  visible:  boolean;
  screenX:  number;
  screenY:  number;
  word:     string;
  actions:  SymbolAction[];
}

export function buildActions(s: SymbolAtCursor): SymbolAction[] {
  if (!s.word) return [];
  const actions: SymbolAction[] = [];
  if (s.hasDefinition) actions.push('goToDefinition', 'peekDefinition');
  if (s.canFindRefs)   actions.push('findReferences');
  actions.push('copySymbol');
  return actions;
}
```

- [ ] **Step 4: Run — expect pass**

```bash
cd mobile-ide/mobile-ide-prototype && npx jest tests/unit/symbolContextMenu.test.ts --watchAll=false
```
Expected: 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add mobile-ide/mobile-ide-prototype/src/codeNav/symbolContextMenu.ts \
        mobile-ide/mobile-ide-prototype/tests/unit/symbolContextMenu.test.ts
git commit -m "feat US-0079: add symbolContextMenu types and buildActions"
```

---

## Task 3: FileSystemBridge.listFilesRecursive

**Files:**
- Modify: `mobile-ide/mobile-ide-prototype/src/utils/FileSystemBridge.ts`
- Modify: `mobile-ide/mobile-ide-prototype/tests/unit/FileSystemBridge.test.ts` (or create if missing)

- [ ] **Step 1: Check test file location**

```bash
ls mobile-ide/mobile-ide-prototype/tests/unit/ | grep -i bridge
```

If no existing test file: create `tests/unit/FileSystemBridgeRecursive.test.ts`.

- [ ] **Step 2: Write failing tests**

Create `tests/unit/FileSystemBridgeRecursive.test.ts`:

```typescript
import { FileSystemBridge } from '../../src/utils/FileSystemBridge';

// Mock the underlying Expo filesystem
jest.mock('expo-file-system/legacy', () => ({
  getInfoAsync:       jest.fn(),
  readDirectoryAsync: jest.fn(),
  readAsStringAsync:  jest.fn(),
  writeAsStringAsync: jest.fn(),
  deleteAsync:        jest.fn(),
  documentDirectory:  '/docs/',
  EncodingType:       { UTF8: 'utf8' },
}));

import * as ExpoFS from 'expo-file-system/legacy';

function mockDir(path: string, children: string[]) {
  (ExpoFS.getInfoAsync as jest.Mock).mockImplementation((p: string) =>
    Promise.resolve({ exists: true, isDirectory: p === path || p.endsWith('/') })
  );
  (ExpoFS.readDirectoryAsync as jest.Mock).mockResolvedValue(children);
}

beforeEach(() => jest.clearAllMocks());

describe('FileSystemBridge.listFilesRecursive', () => {
  it('returns all files under a flat directory', async () => {
    (ExpoFS.getInfoAsync as jest.Mock).mockImplementation((p: string) =>
      Promise.resolve({ exists: true, isDirectory: p === '/workspace/' })
    );
    (ExpoFS.readDirectoryAsync as jest.Mock).mockResolvedValue(['foo.ts', 'bar.js']);
    const files = await FileSystemBridge.listFilesRecursive('/workspace/');
    expect(files).toContain('/workspace/foo.ts');
    expect(files).toContain('/workspace/bar.js');
  });

  it('recurses into subdirectories', async () => {
    (ExpoFS.getInfoAsync as jest.Mock).mockImplementation((p: string) =>
      Promise.resolve({ exists: true, isDirectory: p === '/ws/' || p === '/ws/src/' })
    );
    (ExpoFS.readDirectoryAsync as jest.Mock)
      .mockResolvedValueOnce(['src'])      // /ws/ → ['src']
      .mockResolvedValueOnce(['index.ts']); // /ws/src/ → ['index.ts']
    const files = await FileSystemBridge.listFilesRecursive('/ws/');
    expect(files).toContain('/ws/src/index.ts');
    expect(files).not.toContain('/ws/src'); // directories excluded
  });

  it('excludes node_modules directories', async () => {
    (ExpoFS.getInfoAsync as jest.Mock).mockImplementation((p: string) =>
      Promise.resolve({ exists: true, isDirectory: p === '/ws/' || p === '/ws/node_modules/' })
    );
    (ExpoFS.readDirectoryAsync as jest.Mock)
      .mockResolvedValueOnce(['index.ts', 'node_modules']);
    const files = await FileSystemBridge.listFilesRecursive('/ws/');
    expect(files).not.toEqual(expect.arrayContaining([expect.stringContaining('node_modules')]));
  });

  it('excludes .git directories', async () => {
    (ExpoFS.getInfoAsync as jest.Mock).mockImplementation((p: string) =>
      Promise.resolve({ exists: true, isDirectory: p === '/ws/' || p === '/ws/.git/' })
    );
    (ExpoFS.readDirectoryAsync as jest.Mock)
      .mockResolvedValueOnce(['index.ts', '.git']);
    const files = await FileSystemBridge.listFilesRecursive('/ws/');
    expect(files).not.toEqual(expect.arrayContaining([expect.stringContaining('.git')]));
  });

  it('returns empty array for empty directory', async () => {
    (ExpoFS.getInfoAsync as jest.Mock).mockResolvedValue({ exists: true, isDirectory: true });
    (ExpoFS.readDirectoryAsync as jest.Mock).mockResolvedValue([]);
    expect(await FileSystemBridge.listFilesRecursive('/ws/')).toEqual([]);
  });
});
```

- [ ] **Step 3: Run — expect failure**

```bash
cd mobile-ide/mobile-ide-prototype && npx jest tests/unit/FileSystemBridgeRecursive.test.ts --watchAll=false 2>&1 | tail -3
```
Expected: `FileSystemBridge.listFilesRecursive is not a function`

- [ ] **Step 4: Add listFilesRecursive to FileSystemBridge**

Open `src/utils/FileSystemBridge.ts`. After the `writeFile` method (around line 165), add:

```typescript
  /**
   * Recursively list all file paths under root, excluding node_modules and dot directories.
   * Returns flat array of absolute file paths (directories excluded).
   */
  async listFilesRecursive(root: string): Promise<string[]> {
    const SKIP_DIRS = new Set(['node_modules', '.git', '.expo', '__pycache__']);
    const results: string[] = [];

    async function walk(dir: string): Promise<void> {
      const normalized = dir.endsWith('/') ? dir : `${dir}/`;
      const names = await ExpoFS.readDirectoryAsync(normalized).catch(() => []);
      await Promise.all(names.map(async (name: string) => {
        if (name.startsWith('.') || SKIP_DIRS.has(name)) return;
        const fullPath = `${normalized}${name}`;
        const info = await ExpoFS.getInfoAsync(fullPath).catch(() => ({ exists: false, isDirectory: false }));
        if (!info.exists) return;
        if (info.isDirectory) {
          await walk(fullPath);
        } else {
          results.push(fullPath);
        }
      }));
    }

    await walk(root);
    return results;
  },
```

- [ ] **Step 5: Run — expect pass**

```bash
cd mobile-ide/mobile-ide-prototype && npx jest tests/unit/FileSystemBridgeRecursive.test.ts --watchAll=false
```
Expected: 5 tests pass.

- [ ] **Step 6: Commit**

```bash
git add mobile-ide/mobile-ide-prototype/src/utils/FileSystemBridge.ts \
        mobile-ide/mobile-ide-prototype/tests/unit/FileSystemBridgeRecursive.test.ts
git commit -m "feat US-0080: add FileSystemBridge.listFilesRecursive"
```

---

## Task 4: symbolIndexer.ts

**Files:**
- Create: `mobile-ide/mobile-ide-prototype/src/codeNav/symbolIndexer.ts`
- Create: `mobile-ide/mobile-ide-prototype/tests/unit/symbolIndexer.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// tests/unit/symbolIndexer.test.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { indexFile, updateIndex, loadIndex, saveIndex } from '../../src/codeNav/symbolIndexer';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(undefined),
}));

beforeEach(() => jest.clearAllMocks());

describe('indexFile', () => {
  it('extracts top-level function declarations', () => {
    const entries = indexFile('/f.ts', 'function formatDate(d: Date) {}');
    expect(entries).toEqual([{ word: 'formatDate', filePath: '/f.ts', line: 1, kind: 'function' }]);
  });

  it('extracts exported async functions', () => {
    const entries = indexFile('/f.ts', 'export async function fetchData() {}');
    expect(entries[0]).toMatchObject({ word: 'fetchData', kind: 'function' });
  });

  it('extracts class declarations', () => {
    const entries = indexFile('/f.ts', 'class MyComponent {}');
    expect(entries[0]).toMatchObject({ word: 'MyComponent', kind: 'class' });
  });

  it('extracts exported const declarations', () => {
    const entries = indexFile('/f.ts', 'export const API_URL = "https://api.example.com";');
    expect(entries[0]).toMatchObject({ word: 'API_URL', kind: 'const' });
  });

  it('extracts interface declarations with kind "interface"', () => {
    const entries = indexFile('/f.ts', 'export interface UserProps { name: string }');
    expect(entries[0]).toMatchObject({ word: 'UserProps', kind: 'interface' });
  });

  it('extracts type declarations with kind "type" (not "interface")', () => {
    const entries = indexFile('/f.ts', 'export type UserId = string;');
    expect(entries[0]).toMatchObject({ word: 'UserId', kind: 'type' });
  });

  it('does NOT extract local variables inside function bodies', () => {
    const code = 'function foo() {\n  const bar = 1;\n}';
    const entries = indexFile('/f.ts', code);
    expect(entries.map(e => e.word)).not.toContain('bar');
    expect(entries.map(e => e.word)).toContain('foo');
  });

  it('handles empty file without throwing', () => {
    expect(() => indexFile('/f.ts', '')).not.toThrow();
    expect(indexFile('/f.ts', '')).toEqual([]);
  });

  it('records correct line numbers', () => {
    const code = '\nfunction first() {}\nfunction second() {}';
    const entries = indexFile('/f.ts', code);
    expect(entries.find(e => e.word === 'first')?.line).toBe(2);
    expect(entries.find(e => e.word === 'second')?.line).toBe(3);
  });
});

describe('updateIndex', () => {
  const existing = [
    { word: 'foo', filePath: '/a.ts', line: 1, kind: 'function' as const },
    { word: 'bar', filePath: '/b.ts', line: 2, kind: 'class' as const },
  ];

  it('removes old entries for the given filePath and adds new ones', () => {
    const updated = updateIndex(existing, '/a.ts', [
      { word: 'newFoo', filePath: '/a.ts', line: 5, kind: 'function' },
    ]);
    expect(updated.find(e => e.word === 'foo')).toBeUndefined();
    expect(updated.find(e => e.word === 'newFoo')).toBeDefined();
  });

  it('preserves entries from other files unchanged', () => {
    const updated = updateIndex(existing, '/a.ts', []);
    expect(updated.find(e => e.filePath === '/b.ts')).toBeDefined();
  });
});

describe('loadIndex / saveIndex', () => {
  it('loadIndex returns [] when AsyncStorage has no entry', async () => {
    expect(await loadIndex('/ws')).toEqual([]);
  });

  it('loadIndex returns parsed array when entry exists', async () => {
    const data = [{ word: 'foo', filePath: '/a.ts', line: 1, kind: 'function' }];
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(data));
    expect(await loadIndex('/ws')).toEqual(data);
  });

  it('saveIndex writes JSON string to AsyncStorage', async () => {
    const data = [{ word: 'bar', filePath: '/b.ts', line: 2, kind: 'class' }];
    await saveIndex('/ws', data);
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      expect.stringContaining('nomadcode_symbol_index'),
      JSON.stringify(data),
    );
  });
});
```

- [ ] **Step 2: Run — expect failure**

```bash
cd mobile-ide/mobile-ide-prototype && npx jest tests/unit/symbolIndexer.test.ts --watchAll=false 2>&1 | tail -3
```

- [ ] **Step 3: Create symbolIndexer.ts**

```typescript
// src/codeNav/symbolIndexer.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { simpleHash } from '../utils/hash';

export interface SymbolEntry {
  word:     string;
  filePath: string;
  line:     number;
  kind:     'function' | 'class' | 'const' | 'interface' | 'type';
}

// Only top-level declarations — local variables inside functions are NOT matched
// because the patterns don't start with indentation guards. The regex \b ensures
// we don't match inside larger identifiers.
const PATTERNS: Array<[RegExp, SymbolEntry['kind']]> = [
  [/^(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/,    'function'],
  [/^(?:export\s+)?(?:default\s+)?class\s+([A-Za-z_$][\w$]*)/,     'class'],
  [/^(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*[=:]/, 'const'],
  [/^(?:export\s+)?interface\s+([A-Za-z_$][\w$]*)/,                 'interface'],
  [/^(?:export\s+)?type\s+([A-Za-z_$][\w$]*)\s*[=<]/,              'type'],
];

export function indexFile(filePath: string, content: string): SymbolEntry[] {
  const entries: SymbolEntry[] = [];
  const lines = content.split('\n');
  lines.forEach((lineText, i) => {
    const trimmed = lineText.trimStart();
    for (const [pattern, kind] of PATTERNS) {
      const m = trimmed.match(pattern);
      if (m?.[1]) {
        entries.push({ word: m[1], filePath, line: i + 1, kind });
      }
    }
  });
  return entries;
}

export function updateIndex(
  existing: SymbolEntry[],
  filePath: string,
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
```

- [ ] **Step 4: Run — expect pass**

```bash
cd mobile-ide/mobile-ide-prototype && npx jest tests/unit/symbolIndexer.test.ts --watchAll=false
```
Expected: 12 tests pass.

- [ ] **Step 5: Commit**

```bash
git add mobile-ide/mobile-ide-prototype/src/codeNav/symbolIndexer.ts \
        mobile-ide/mobile-ide-prototype/tests/unit/symbolIndexer.test.ts
git commit -m "feat US-0081: add symbolIndexer — regex declaration scanner, AsyncStorage cache"
```

---

## Task 5: definitionResolver.ts

**Files:**
- Create: `mobile-ide/mobile-ide-prototype/src/codeNav/definitionResolver.ts`
- Create: `mobile-ide/mobile-ide-prototype/tests/unit/definitionResolver.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// tests/unit/definitionResolver.test.ts
import { resolveDefinition } from '../../src/codeNav/definitionResolver';
import type { SymbolEntry } from '../../src/codeNav/symbolIndexer';

const index: SymbolEntry[] = [
  { word: 'formatDate', filePath: '/src/utils/date.ts', line: 5,  kind: 'function' },
  { word: 'formatDate', filePath: '/src/helpers/date.js', line: 3, kind: 'function' },
  { word: 'parseDate',  filePath: '/src/utils/date.ts', line: 12, kind: 'function' },
];

describe('resolveDefinition', () => {
  it('returns a match for an exact word', () => {
    const hit = resolveDefinition('parseDate', index);
    expect(hit).not.toBeNull();
    expect(hit!.word).toBe('parseDate');
    expect(hit!.filePath).toBe('/src/utils/date.ts');
  });

  it('prefers .ts over .js when both files define the same word', () => {
    const hit = resolveDefinition('formatDate', index);
    expect(hit!.filePath).toContain('.ts');
  });

  it('returns null when word is not in the index', () => {
    expect(resolveDefinition('unknownSymbol', index)).toBeNull();
  });

  it('returns null for empty index', () => {
    expect(resolveDefinition('foo', [])).toBeNull();
  });

  it('returns correct line number', () => {
    const hit = resolveDefinition('parseDate', index);
    expect(hit!.line).toBe(12);
  });
});
```

- [ ] **Step 2: Run — expect failure**

```bash
cd mobile-ide/mobile-ide-prototype && npx jest tests/unit/definitionResolver.test.ts --watchAll=false 2>&1 | tail -3
```

- [ ] **Step 3: Create definitionResolver.ts**

```typescript
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
```

- [ ] **Step 4: Run — expect pass**

```bash
cd mobile-ide/mobile-ide-prototype && npx jest tests/unit/definitionResolver.test.ts --watchAll=false
```
Expected: 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add mobile-ide/mobile-ide-prototype/src/codeNav/definitionResolver.ts \
        mobile-ide/mobile-ide-prototype/tests/unit/definitionResolver.test.ts
git commit -m "feat US-0079: add definitionResolver — symbol index lookup with .ts preference"
```

---

## Task 6: useReferencesSearch hook

**Files:**
- Create: `mobile-ide/mobile-ide-prototype/src/hooks/useReferencesSearch.ts`
- Create: `mobile-ide/mobile-ide-prototype/tests/unit/useReferencesSearch.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// tests/unit/useReferencesSearch.test.ts
import { act, renderHook } from '@testing-library/react-native';
import { useReferencesSearch } from '../../src/hooks/useReferencesSearch';
import { FileSystemBridge } from '../../src/utils/FileSystemBridge';

jest.mock('../../src/utils/FileSystemBridge', () => ({
  FileSystemBridge: {
    listFilesRecursive: jest.fn(),
    readFile:           jest.fn(),
  },
}));

const mockMonacoRefs = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  (FileSystemBridge.listFilesRecursive as jest.Mock).mockResolvedValue([]);
  (FileSystemBridge.readFile as jest.Mock).mockResolvedValue('');
  mockMonacoRefs.mockResolvedValue([]);
});

describe('useReferencesSearch', () => {
  it('initial state: empty results, not searching', () => {
    const { result } = renderHook(() => useReferencesSearch());
    expect(result.current.results).toEqual([]);
    expect(result.current.isSearching).toBe(false);
    expect(result.current.totalCount).toBe(0);
  });

  it('includes Monaco matches for the current file', async () => {
    const monacoMatches = [{ line: 5, column: 3, lineText: 'function formatDate() {}' }];
    mockMonacoRefs.mockResolvedValue(monacoMatches);
    const { result } = renderHook(() => useReferencesSearch());
    await act(async () => {
      await result.current.search('formatDate', '/src/date.ts', '/src', mockMonacoRefs);
    });
    expect(result.current.results.find(g => g.filePath === '/src/date.ts')?.matches).toEqual(monacoMatches);
  });

  it('includes text-search matches from other files', async () => {
    (FileSystemBridge.listFilesRecursive as jest.Mock).mockResolvedValue(['/src/other.ts']);
    (FileSystemBridge.readFile as jest.Mock).mockResolvedValue('const x = formatDate(new Date());\n');
    const { result } = renderHook(() => useReferencesSearch());
    await act(async () => {
      await result.current.search('formatDate', '/src/date.ts', '/src', mockMonacoRefs);
    });
    const otherGroup = result.current.results.find(g => g.filePath === '/src/other.ts');
    expect(otherGroup?.matches[0].line).toBe(1);
  });

  it('does NOT duplicate the current file via text search', async () => {
    (FileSystemBridge.listFilesRecursive as jest.Mock).mockResolvedValue(['/src/date.ts', '/src/other.ts']);
    const { result } = renderHook(() => useReferencesSearch());
    await act(async () => {
      await result.current.search('formatDate', '/src/date.ts', '/src', mockMonacoRefs);
    });
    const groups = result.current.results.filter(g => g.filePath === '/src/date.ts');
    expect(groups.length).toBeLessThanOrEqual(1);
  });

  it('skips non-code files (.png)', async () => {
    (FileSystemBridge.listFilesRecursive as jest.Mock).mockResolvedValue(['/assets/icon.png']);
    const { result } = renderHook(() => useReferencesSearch());
    await act(async () => {
      await result.current.search('formatDate', '/src/date.ts', '/src', mockMonacoRefs);
    });
    expect(FileSystemBridge.readFile).not.toHaveBeenCalledWith('/assets/icon.png');
  });

  it('cancel() stops an in-progress search', async () => {
    let resolveFile: (v: string) => void;
    (FileSystemBridge.readFile as jest.Mock).mockReturnValue(new Promise(r => { resolveFile = r; }));
    (FileSystemBridge.listFilesRecursive as jest.Mock).mockResolvedValue(['/src/a.ts']);
    const { result } = renderHook(() => useReferencesSearch());
    act(() => {
      result.current.search('formatDate', '/src/date.ts', '/src', mockMonacoRefs);
    });
    act(() => { result.current.cancel(); });
    expect(result.current.isSearching).toBe(false);
    resolveFile!('');
  });

  it('results are sorted alphabetically by fileName', async () => {
    (FileSystemBridge.listFilesRecursive as jest.Mock).mockResolvedValue(['/src/z.ts', '/src/a.ts']);
    (FileSystemBridge.readFile as jest.Mock).mockResolvedValue('const x = formatDate();');
    const { result } = renderHook(() => useReferencesSearch());
    await act(async () => {
      await result.current.search('formatDate', '/src/date.ts', '/src', mockMonacoRefs);
    });
    const fileNames = result.current.results.map(g => g.fileName);
    expect(fileNames).toEqual([...fileNames].sort());
  });

  it('totalCount equals sum of all match counts', async () => {
    (FileSystemBridge.listFilesRecursive as jest.Mock).mockResolvedValue(['/src/a.ts']);
    (FileSystemBridge.readFile as jest.Mock).mockResolvedValue('formatDate()\nformatDate()');
    const { result } = renderHook(() => useReferencesSearch());
    await act(async () => {
      await result.current.search('formatDate', '/src/date.ts', '/src', mockMonacoRefs);
    });
    expect(result.current.totalCount).toBe(2);
  });
});
```

- [ ] **Step 2: Run — expect failure**

```bash
cd mobile-ide/mobile-ide-prototype && npx jest tests/unit/useReferencesSearch.test.ts --watchAll=false 2>&1 | tail -3
```

- [ ] **Step 3: Create useReferencesSearch.ts**

```typescript
// src/hooks/useReferencesSearch.ts
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
```

- [ ] **Step 4: Run — expect pass**

```bash
cd mobile-ide/mobile-ide-prototype && npx jest tests/unit/useReferencesSearch.test.ts --watchAll=false
```
Expected: 7 tests pass.

- [ ] **Step 5: Commit**

```bash
git add mobile-ide/mobile-ide-prototype/src/hooks/useReferencesSearch.ts \
        mobile-ide/mobile-ide-prototype/tests/unit/useReferencesSearch.test.ts
git commit -m "feat US-0080: add useReferencesSearch — hybrid Monaco + text search with AbortController"
```

---

## Task 7: useSymbolSearch hook

**Files:**
- Create: `mobile-ide/mobile-ide-prototype/src/hooks/useSymbolSearch.ts`
- Create: `mobile-ide/mobile-ide-prototype/tests/unit/useSymbolSearch.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// tests/unit/useSymbolSearch.test.ts
import { act, renderHook } from '@testing-library/react-native';
import { useSymbolSearch } from '../../src/hooks/useSymbolSearch';
import { FileSystemBridge } from '../../src/utils/FileSystemBridge';
import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../src/utils/FileSystemBridge', () => ({
  FileSystemBridge: {
    listFilesRecursive: jest.fn().mockResolvedValue([]),
    readFile: jest.fn().mockResolvedValue(''),
  },
}));

beforeEach(() => jest.clearAllMocks());

describe('useSymbolSearch', () => {
  it('initial state: empty index, not building', () => {
    const { result } = renderHook(() => useSymbolSearch('/ws'));
    expect(result.current.index).toEqual([]);
    expect(result.current.isBuilding).toBe(false);
  });

  it('loads from AsyncStorage on mount when cache exists', async () => {
    const cached = [{ word: 'foo', filePath: '/a.ts', line: 1, kind: 'function' }];
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(cached));
    const { result } = renderHook(() => useSymbolSearch('/ws'));
    await act(async () => {});
    expect(result.current.index).toEqual(cached);
    expect(FileSystemBridge.listFilesRecursive).not.toHaveBeenCalled();
  });

  it('builds full index when cache is empty', async () => {
    (FileSystemBridge.listFilesRecursive as jest.Mock).mockResolvedValue(['/ws/a.ts']);
    (FileSystemBridge.readFile as jest.Mock).mockResolvedValue('function foo() {}');
    const { result } = renderHook(() => useSymbolSearch('/ws'));
    await act(async () => {});
    expect(result.current.index.find(e => e.word === 'foo')).toBeDefined();
  });

  it('search returns exact match with highest score', () => {
    const { result } = renderHook(() => useSymbolSearch('/ws'));
    act(() => {
      result.current.onFileSaved('/a.ts', 'function formatDate() {}\nfunction format() {}');
    });
    const results = result.current.search('formatDate');
    expect(results[0].word).toBe('formatDate');
  });

  it('search returns prefix matches', () => {
    const { result } = renderHook(() => useSymbolSearch('/ws'));
    act(() => {
      result.current.onFileSaved('/a.ts', 'function formatDate() {}\nfunction parseDate() {}');
    });
    const results = result.current.search('format');
    expect(results.map(r => r.word)).toContain('formatDate');
    expect(results.map(r => r.word)).not.toContain('parseDate');
  });

  it('search returns empty for empty query', () => {
    const { result } = renderHook(() => useSymbolSearch('/ws'));
    expect(result.current.search('')).toEqual([]);
  });

  it('search caps results at 50', () => {
    const { result } = renderHook(() => useSymbolSearch('/ws'));
    const code = Array.from({ length: 60 }, (_, i) => `function fn${i}() {}`).join('\n');
    act(() => { result.current.onFileSaved('/a.ts', code); });
    expect(result.current.search('fn').length).toBeLessThanOrEqual(50);
  });

  it('onFileSaved updates index for the saved file only', () => {
    const { result } = renderHook(() => useSymbolSearch('/ws'));
    act(() => { result.current.onFileSaved('/a.ts', 'function foo() {}'); });
    act(() => { result.current.onFileSaved('/b.ts', 'function bar() {}'); });
    act(() => { result.current.onFileSaved('/a.ts', 'function baz() {}'); });
    const words = result.current.index.map(e => e.word);
    expect(words).not.toContain('foo'); // replaced by baz
    expect(words).toContain('baz');
    expect(words).toContain('bar');     // /b.ts unchanged
  });

  it('onFileSaved saves to AsyncStorage', () => {
    const { result } = renderHook(() => useSymbolSearch('/ws'));
    act(() => { result.current.onFileSaved('/a.ts', 'function foo() {}'); });
    expect(AsyncStorage.setItem).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run — expect failure**

```bash
cd mobile-ide/mobile-ide-prototype && npx jest tests/unit/useSymbolSearch.test.ts --watchAll=false 2>&1 | tail -3
```

- [ ] **Step 3: Create useSymbolSearch.ts**

```typescript
// src/hooks/useSymbolSearch.ts
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
      saveIndex(workspacePath, next);   // fire-and-forget, outside setter
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
```

- [ ] **Step 4: Run — expect pass**

```bash
cd mobile-ide/mobile-ide-prototype && npx jest tests/unit/useSymbolSearch.test.ts --watchAll=false
```
Expected: 9 tests pass.

- [ ] **Step 5: Commit**

```bash
git add mobile-ide/mobile-ide-prototype/src/hooks/useSymbolSearch.ts \
        mobile-ide/mobile-ide-prototype/tests/unit/useSymbolSearch.test.ts
git commit -m "feat US-0081: add useSymbolSearch — declaration index lifecycle and fuzzy search"
```

---

## Task 8: ReferencesPanel component

**Files:**
- Create: `mobile-ide/mobile-ide-prototype/src/components/ReferencesPanel.tsx`
- Create: `mobile-ide/mobile-ide-prototype/tests/unit/ReferencesPanel.test.tsx`

- [ ] **Step 1: Write failing tests**

```typescript
// tests/unit/ReferencesPanel.test.tsx
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import ReferencesPanel from '../../src/components/ReferencesPanel';
import type { ReferenceGroup } from '../../src/hooks/useReferencesSearch';

jest.mock('../../src/theme/tokens', () => ({
  useTheme: () => ({
    bg: '#000', bgElevated: '#111', border: '#222',
    text: '#fff', textMuted: '#888', accent: '#2563eb',
    bgHighlight: '#333',
  }),
}));

const GROUPS: ReferenceGroup[] = [
  {
    filePath: '/src/utils/date.ts',
    fileName: 'date.ts',
    matches: [
      { line: 5,  column: 1, lineText: 'export function formatDate(d) {}' },
      { line: 12, column: 3, lineText: '  return formatDate(x);' },
    ],
  },
  {
    filePath: '/src/components/Editor.tsx',
    fileName: 'Editor.tsx',
    matches: [
      { line: 7, column: 1, lineText: "import { formatDate } from '../utils'" },
    ],
  },
];

describe('ReferencesPanel', () => {
  it('shows reference count in header', () => {
    const { getByText } = render(
      <ReferencesPanel word="formatDate" results={GROUPS}
        isSearching={false} totalCount={3} onNavigate={jest.fn()} onClose={jest.fn()} />
    );
    expect(getByText(/3 references/i)).toBeTruthy();
  });

  it('shows the searched word in header', () => {
    const { getByText } = render(
      <ReferencesPanel word="formatDate" results={GROUPS}
        isSearching={false} totalCount={3} onNavigate={jest.fn()} onClose={jest.fn()} />
    );
    expect(getByText(/formatDate/i)).toBeTruthy();
  });

  it('renders file names', () => {
    const { getByText } = render(
      <ReferencesPanel word="formatDate" results={GROUPS}
        isSearching={false} totalCount={3} onNavigate={jest.fn()} onClose={jest.fn()} />
    );
    expect(getByText('date.ts')).toBeTruthy();
    expect(getByText('Editor.tsx')).toBeTruthy();
  });

  it('renders line previews', () => {
    const { getByText } = render(
      <ReferencesPanel word="formatDate" results={GROUPS}
        isSearching={false} totalCount={3} onNavigate={jest.fn()} onClose={jest.fn()} />
    );
    expect(getByText(/export function formatDate/)).toBeTruthy();
  });

  it('calls onNavigate with correct args when a result row is pressed', () => {
    const onNavigate = jest.fn();
    const { getAllByTestId } = render(
      <ReferencesPanel word="formatDate" results={GROUPS}
        isSearching={false} totalCount={3} onNavigate={onNavigate} onClose={jest.fn()} />
    );
    fireEvent.press(getAllByTestId('ref-row')[0]);
    expect(onNavigate).toHaveBeenCalledWith('/src/utils/date.ts', 5);
  });

  it('shows activity indicator when isSearching', () => {
    const { getByTestId } = render(
      <ReferencesPanel word="formatDate" results={[]}
        isSearching={true} totalCount={0} onNavigate={jest.fn()} onClose={jest.fn()} />
    );
    expect(getByTestId('refs-searching')).toBeTruthy();
  });

  it('shows "No references found" when results empty and not searching', () => {
    const { getByText } = render(
      <ReferencesPanel word="formatDate" results={[]}
        isSearching={false} totalCount={0} onNavigate={jest.fn()} onClose={jest.fn()} />
    );
    expect(getByText(/No references found/i)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run — expect failure**

```bash
cd mobile-ide/mobile-ide-prototype && npx jest tests/unit/ReferencesPanel.test.tsx --watchAll=false 2>&1 | tail -3
```

- [ ] **Step 3: Create ReferencesPanel.tsx**

```typescript
// src/components/ReferencesPanel.tsx
import React from 'react';
import {
  View, Text, TouchableOpacity, FlatList,
  ActivityIndicator, StyleSheet,
} from 'react-native';
import { useTheme } from '../theme/tokens';
import type { ReferenceGroup, ReferenceMatch } from '../hooks/useReferencesSearch';

interface ReferencesPanelProps {
  word:        string;
  results:     ReferenceGroup[];
  isSearching: boolean;
  totalCount:  number;
  onNavigate:  (filePath: string, line: number) => void;
  onClose:     () => void;
}

export default function ReferencesPanel({
  word, results, isSearching, totalCount, onNavigate, onClose,
}: ReferencesPanelProps) {
  const t = useTheme();

  // Flatten groups into a list of items for FlatList
  type FlatItem =
    | { kind: 'header'; group: ReferenceGroup }
    | { kind: 'row';    group: ReferenceGroup; match: ReferenceMatch };

  const items: FlatItem[] = [];
  results.forEach(g => {
    items.push({ kind: 'header', group: g });
    g.matches.forEach(m => items.push({ kind: 'row', group: g, match: m }));
  });

  return (
    <View style={[styles.container, { backgroundColor: t.bg }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: t.border, backgroundColor: t.bgElevated }]}>
        <Text style={[styles.headerText, { color: t.text }]}>
          {totalCount} {totalCount === 1 ? 'reference' : 'references'} to &apos;{word}&apos;
        </Text>
        <TouchableOpacity onPress={onClose} accessibilityRole="button" accessibilityLabel="Close references">
          <Text style={[styles.closeBtn, { color: t.textMuted }]}>✕</Text>
        </TouchableOpacity>
      </View>

      {/* Body */}
      {isSearching && (
        <View style={styles.center} testID="refs-searching">
          <ActivityIndicator color={t.accent} />
          <Text style={[styles.hint, { color: t.textMuted }]}>Searching…</Text>
        </View>
      )}

      {!isSearching && results.length === 0 && (
        <View style={styles.center}>
          <Text style={[styles.hint, { color: t.textMuted }]}>No references found</Text>
        </View>
      )}

      {!isSearching && items.length > 0 && (
        <FlatList
          data={items}
          keyExtractor={(_, i) => String(i)}
          renderItem={({ item }) => {
            if (item.kind === 'header') {
              return (
                <View style={[styles.fileHeader, { backgroundColor: t.bgElevated, borderBottomColor: t.border }]}>
                  <Text style={[styles.fileName, { color: t.accent }]}>
                    {item.group.fileName}
                    <Text style={[styles.matchCount, { color: t.textMuted }]}>
                      {' '}({item.group.matches.length})
                    </Text>
                  </Text>
                </View>
              );
            }
            return (
              <TouchableOpacity
                testID="ref-row"
                style={[styles.row, { borderBottomColor: t.border }]}
                onPress={() => onNavigate(item.group.filePath, item.match.line)}
                accessibilityRole="button"
              >
                <Text style={[styles.lineNum, { color: t.textMuted }]}>{item.match.line}</Text>
                <Text
                  style={[styles.lineText, { color: t.text }]}
                  numberOfLines={1}
                >
                  {item.match.lineText}
                </Text>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container:  { flex: 1 },
  header:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                padding: 12, borderBottomWidth: 1 },
  headerText: { fontSize: 13, fontWeight: '600', flex: 1 },
  closeBtn:   { fontSize: 16, paddingHorizontal: 8, paddingVertical: 4 },
  center:     { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 8 },
  hint:       { fontSize: 13 },
  fileHeader: { paddingHorizontal: 12, paddingVertical: 6, borderBottomWidth: 1 },
  fileName:   { fontSize: 12, fontWeight: '700', fontFamily: 'JetBrains Mono' },
  matchCount: { fontWeight: '400' },
  row:        { flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 8,
                borderBottomWidth: StyleSheet.hairlineWidth, gap: 10 },
  lineNum:    { fontSize: 11, fontFamily: 'JetBrains Mono', width: 36, textAlign: 'right' },
  lineText:   { fontSize: 12, fontFamily: 'JetBrains Mono', flex: 1 },
});
```

- [ ] **Step 4: Run — expect pass**

```bash
cd mobile-ide/mobile-ide-prototype && npx jest tests/unit/ReferencesPanel.test.tsx --watchAll=false
```
Expected: 7 tests pass.

- [ ] **Step 5: Commit**

```bash
git add mobile-ide/mobile-ide-prototype/src/components/ReferencesPanel.tsx \
        mobile-ide/mobile-ide-prototype/tests/unit/ReferencesPanel.test.tsx
git commit -m "feat US-0080: add ReferencesPanel — file-grouped results, line previews, navigation"
```

---

## Task 9: CommandPalette symbolSearch mode

**Files:**
- Modify: `mobile-ide/mobile-ide-prototype/src/components/CommandPalette.tsx`
- Modify: `mobile-ide/mobile-ide-prototype/tests/unit/CommandPalette.test.tsx`

- [ ] **Step 1: Read CommandPalette.tsx**

```bash
sed -n '1,50p' mobile-ide/mobile-ide-prototype/src/components/CommandPalette.tsx
```

- [ ] **Step 2: Write failing tests**

Add to `tests/unit/CommandPalette.test.tsx` (keep existing tests, add new describe block):

```typescript
// Add these imports at the top if not present:
// import type { SymbolEntry } from '../../src/codeNav/symbolIndexer';

describe('CommandPalette — symbolSearch mode', () => {
  const SYMBOLS: SymbolEntry[] = [
    { word: 'formatDate', filePath: '/src/utils/date.ts', line: 5,  kind: 'function' },
    { word: 'parseDate',  filePath: '/src/utils/date.ts', line: 12, kind: 'function' },
    { word: 'DatePicker', filePath: '/src/components/DatePicker.tsx', line: 1, kind: 'class' },
  ];

  it('renders symbol search header when mode is symbolSearch', () => {
    const { getByText } = render(
      <CommandPalette
        isOpen={true} commands={[]} onClose={jest.fn()} onSelect={jest.fn()}
        mode="symbolSearch" symbolIndex={SYMBOLS} onNavigateSymbol={jest.fn()}
      />
    );
    expect(getByText(/Go to Symbol/i)).toBeTruthy();
  });

  it('shows symbol results matching query', () => {
    const { getByPlaceholderText, getByText } = render(
      <CommandPalette
        isOpen={true} commands={[]} onClose={jest.fn()} onSelect={jest.fn()}
        mode="symbolSearch" symbolIndex={SYMBOLS} onNavigateSymbol={jest.fn()}
      />
    );
    fireEvent.changeText(getByPlaceholderText(/symbol/i), 'format');
    expect(getByText('formatDate')).toBeTruthy();
  });

  it('calls onNavigateSymbol with filePath and line when a symbol is selected', () => {
    const onNavigate = jest.fn();
    const { getByPlaceholderText, getByText } = render(
      <CommandPalette
        isOpen={true} commands={[]} onClose={jest.fn()} onSelect={jest.fn()}
        mode="symbolSearch" symbolIndex={SYMBOLS} onNavigateSymbol={onNavigate}
      />
    );
    fireEvent.changeText(getByPlaceholderText(/symbol/i), 'format');
    fireEvent.press(getByText('formatDate'));
    expect(onNavigate).toHaveBeenCalledWith('/src/utils/date.ts', 5);
  });

  it('shows kind badge for each symbol', () => {
    const { getByPlaceholderText, getByText } = render(
      <CommandPalette
        isOpen={true} commands={[]} onClose={jest.fn()} onSelect={jest.fn()}
        mode="symbolSearch" symbolIndex={SYMBOLS} onNavigateSymbol={jest.fn()}
      />
    );
    fireEvent.changeText(getByPlaceholderText(/symbol/i), 'Date');
    expect(getByText('cls')).toBeTruthy(); // DatePicker kind badge
  });
});
```

- [ ] **Step 3: Run — expect failure**

```bash
cd mobile-ide/mobile-ide-prototype && npx jest tests/unit/CommandPalette.test.tsx --watchAll=false 2>&1 | tail -5
```

- [ ] **Step 4: Update CommandPalette.tsx**

Read the file first to find the exact interface and component signature. Add to the **imports** section:

```typescript
import type { SymbolEntry } from '../codeNav/symbolIndexer';
```

Extend the `CommandPaletteProps` interface (add after `placeholder?:`):

```typescript
  mode?:             'commands' | 'symbolSearch';
  symbolIndex?:      SymbolEntry[];
  onNavigateSymbol?: (filePath: string, line: number) => void;
```

Inside the component, add symbol search logic alongside the existing `filteredCommands`:

```typescript
const { mode = 'commands', symbolIndex = [], onNavigateSymbol } = props; // destructure new props

const filteredSymbols = useMemo(() => {
  if (mode !== 'symbolSearch' || !query) return symbolIndex;
  const q = query.toLowerCase();
  return symbolIndex
    .filter(s => s.word.toLowerCase().includes(q))
    .sort((a, b) => {
      const aw = a.word.toLowerCase(), bw = b.word.toLowerCase();
      const aExact = aw === q ? 2 : aw.startsWith(q) ? 1 : 0;
      const bExact = bw === q ? 2 : bw.startsWith(q) ? 1 : 0;
      return bExact - aExact;
    })
    .slice(0, 50);
}, [mode, query, symbolIndex]);
```

Change the placeholder text when in symbolSearch mode:

```typescript
placeholder={mode === 'symbolSearch' ? 'Type a symbol name…' : (placeholder ?? 'Search commands…')}
```

Add a header label below the text input for symbolSearch mode:

```typescript
{mode === 'symbolSearch' && (
  <Text style={[styles.modeLabel, { color: t.textMuted }]}>Go to Symbol in Workspace</Text>
)}
```

Replace the `commands` render section with a conditional that renders symbols when in symbolSearch mode:

```typescript
// In the FlatList / results section, check mode:
{mode === 'symbolSearch' ? (
  filteredSymbols.length === 0 ? (
    <Text style={styles.empty}>
      {query ? 'No symbols found' : 'Start typing to search symbols…'}
    </Text>
  ) : (
    <FlatList
      data={filteredSymbols}
      keyExtractor={(s, i) => `${s.filePath}:${s.line}:${i}`}
      renderItem={({ item }) => (
        <TouchableOpacity
          style={styles.item}
          onPress={() => { onNavigateSymbol?.(item.filePath, item.line); onClose(); }}
        >
          <Text style={[styles.kindBadge, { color: t.accent }]}>
            {kindBadge(item.kind)}
          </Text>
          <View style={{ flex: 1 }}>
            <Text style={[styles.label, { color: t.text }]}>{item.word}</Text>
            <Text style={[styles.desc, { color: t.textMuted }]} numberOfLines={1}>
              {item.filePath.split('/').slice(-2).join('/')} :{item.line}
            </Text>
          </View>
        </TouchableOpacity>
      )}
    />
  )
) : (
  // existing commands render — unchanged
)}
```

Add helper and style (outside component):

```typescript
function kindBadge(kind: SymbolEntry['kind']): string {
  return { function: 'fn', class: 'cls', const: 'const', interface: 'iface', type: 'type' }[kind] ?? kind;
}

// In StyleSheet.create, add:
modeLabel: { fontSize: 11, paddingHorizontal: 16, paddingBottom: 4, fontStyle: 'italic' },
kindBadge:  { fontSize: 10, fontFamily: 'JetBrains Mono', width: 40, color: '#2563eb' },
```

- [ ] **Step 5: Run — expect pass**

```bash
cd mobile-ide/mobile-ide-prototype && npx jest tests/unit/CommandPalette.test.tsx --watchAll=false
```

- [ ] **Step 6: Run full suite to check no regressions**

```bash
cd mobile-ide/mobile-ide-prototype && npx jest --watchAll=false 2>&1 | tail -5
```

- [ ] **Step 7: Commit**

```bash
git add mobile-ide/mobile-ide-prototype/src/components/CommandPalette.tsx \
        mobile-ide/mobile-ide-prototype/tests/unit/CommandPalette.test.tsx
git commit -m "feat US-0081: CommandPalette symbolSearch mode — ⌘T workspace symbol search"
```

---

## Task 10: MonacoAssetManager — WebView JS changes

No unit tests for this task (WebView JS cannot be tested with Jest). Changes are verified via manual smoke tests listed at the end of the plan.

**Files:**
- Modify: `mobile-ide/mobile-ide-prototype/src/utils/MonacoAssetManager.ts`

All changes are inside the `buildMonacoHtml` function's template literal string.

- [ ] **Step 1: Add context menu suppression CSS and long-press + ⌘Click detectors**

Inside `buildMonacoHtml`, find the closing `</style>` tag. Before it, add:

```css
/* Prevent iOS magnifier / Android context menu competing with our menu */
#container { -webkit-touch-callout: none; }
```

After the `mcOverlay.addEventListener('click', ...)` block (around line 462), add:

```javascript
// ── Context menu suppression ─────────────────────────────────────────
document.addEventListener('contextmenu', function(e) { e.preventDefault(); }, true);

// ── Long-press detector (500ms) ───────────────────────────────────────
var longPressTimer = null;
var longPressStart = null;

document.getElementById('container').addEventListener('touchstart', function(e) {
  if (e.touches.length !== 1) return;
  var touch = e.touches[0];
  longPressStart = { x: touch.clientX, y: touch.clientY };
  longPressTimer = setTimeout(function() {
    var target = editor.getTargetAtClientPoint(longPressStart.x, longPressStart.y);
    if (!target || !target.position) return;
    editor.setPosition(target.position);
    var m = editor.getModel();
    var word = m ? m.getWordAtPosition(target.position) : null;
    post({ type: 'LONG_PRESS', x: longPressStart.x, y: longPressStart.y,
           word: word ? word.word : '' });
    longPressTimer = null;
  }, 500);
}, { passive: true });

['touchmove', 'touchend'].forEach(function(evt) {
  document.getElementById('container').addEventListener(evt, function() {
    if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
  }, { passive: true });
});

// ── ⌘Click detector ───────────────────────────────────────────────────
editor.onMouseDown(function(e) {
  if (e.event.metaKey && e.target && e.target.position) {
    var m = editor.getModel();
    var word = m ? m.getWordAtPosition(e.target.position) : null;
    post({ type: 'CMD_CLICK_SYMBOL', x: e.event.clientX, y: e.event.clientY,
           word: word ? word.word : '' });
  }
});
```

- [ ] **Step 2: Extend the BREADCRUMB_UPDATE breadcrumbTimer**

Find the existing `onDidChangeCursorPosition` handler (around line 429):

```javascript
editor.onDidChangeCursorPosition(function(e) {
  if (breadcrumbTimer) clearTimeout(breadcrumbTimer);
  breadcrumbTimer = setTimeout(function() {
    var content = editor.getValue();
    var line = e.position.lineNumber;
    var symbol = getSymbolForBreadcrumb(content, line);
    post({ type: 'BREADCRUMB_UPDATE', symbol: symbol });
  }, 150);
});
```

Replace with:

```javascript
editor.onDidChangeCursorPosition(function(e) {
  if (breadcrumbTimer) clearTimeout(breadcrumbTimer);
  breadcrumbTimer = setTimeout(function() {
    var content = editor.getValue();
    var line    = e.position.lineNumber;
    var symbol  = getSymbolForBreadcrumb(content, line);
    var pos     = editor.getPosition();
    var model   = editor.getModel();
    var word    = model ? model.getWordAtPosition(pos) : null;
    var lang    = model && model.getLanguageId ? model.getLanguageId() : 'plaintext';
    var isTsJs  = lang === 'typescript' || lang === 'javascript';

    var symbolAtCursor = {
      word:          word ? word.word : '',
      hasDefinition: false,
      canFindRefs:   !!(word && word.word.length > 1),
      position:      { line: pos.lineNumber, column: pos.column },
    };

    if (word && isTsJs) {
      var capturedLine = pos.lineNumber;
      var capturedCol  = pos.column;
      monaco.languages.typescript.getTypeScriptWorker()
        .then(function(worker) {
          return worker.getDefinitionAtPosition(model.uri.toString(), model.getOffsetAt(pos));
        })
        .then(function(defs) {
          symbolAtCursor.hasDefinition = !!(defs && defs.length);
        })
        .catch(function() {})
        .finally(function() {
          var cur = editor.getPosition();
          if (cur && cur.lineNumber === capturedLine && cur.column === capturedCol) {
            post({ type: 'BREADCRUMB_UPDATE', symbol: symbol, symbolAtCursor: symbolAtCursor });
          }
        });
    } else {
      post({ type: 'BREADCRUMB_UPDATE', symbol: symbol, symbolAtCursor: symbolAtCursor });
    }
  }, 150);
});
```

- [ ] **Step 3: Add GO_TO_DEFINITION and GET_MONACO_REFS cases to the message switch**

Find the last `case` in the `window.addEventListener('message', ...)` switch (around line 720). Before the closing `}` of the switch, add:

```javascript
case 'GO_TO_DEFINITION': {
  var pos   = editor.getPosition();
  var model = editor.getModel();
  var word  = model.getWordAtPosition(pos);
  if (!word) break;
  var lang   = model.getLanguageId ? model.getLanguageId() : 'plaintext';
  var isTsJs = lang === 'typescript' || lang === 'javascript';
  if (!isTsJs) {
    post({ type: 'GO_TO_DEF_RESULT', resolved: false, word: word.word });
    break;
  }
  monaco.languages.typescript.getTypeScriptWorker()
    .then(function(worker) {
      return worker.getDefinitionAtPosition(model.uri.toString(), model.getOffsetAt(pos));
    })
    .then(function(defs) {
      if (!defs || !defs.length) {
        post({ type: 'GO_TO_DEF_RESULT', resolved: false, word: word.word });
        return;
      }
      var def        = defs[0];
      var isSameFile = def.fileName === model.uri.toString();
      var isBuiltin  = def.fileName.indexOf('ts:') === 0 ||
                       def.fileName.indexOf('node_modules') !== -1;
      if (isSameFile) {
        var defPos = model.getPositionAt(def.textSpan.start);
        editor.revealPositionInCenter(defPos);
        editor.setPosition(defPos);
        post({ type: 'GO_TO_DEF_RESULT', resolved: true, sameFile: true });
      } else if (isBuiltin) {
        post({ type: 'GO_TO_DEF_RESULT', resolved: true, builtin: true,
               fileName: def.fileName, offset: def.textSpan.start });
      } else {
        post({ type: 'GO_TO_DEF_RESULT', resolved: false, word: word.word });
      }
    })
    .catch(function() {
      post({ type: 'GO_TO_DEF_RESULT', resolved: false, word: word.word });
    });
  break;
}

case 'GET_MONACO_REFS': {
  var pos   = editor.getPosition();
  var model = editor.getModel();
  var lang  = model.getLanguageId ? model.getLanguageId() : 'plaintext';
  if (lang !== 'typescript' && lang !== 'javascript') {
    post({ type: 'MONACO_REFS_RESULT', matches: [] });
    break;
  }
  monaco.languages.typescript.getTypeScriptWorker()
    .then(function(worker) {
      return worker.getReferencesAtPosition(model.uri.toString(), model.getOffsetAt(pos));
    })
    .then(function(refs) {
      var matches = (refs || [])
        .filter(function(r) { return r.fileName === model.uri.toString(); })
        .map(function(r) {
          var p = model.getPositionAt(r.textSpan.start);
          return { line: p.lineNumber, column: p.column,
                   lineText: model.getLineContent(p.lineNumber) };
        });
      post({ type: 'MONACO_REFS_RESULT', matches: matches });
    })
    .catch(function() { post({ type: 'MONACO_REFS_RESULT', matches: [] }); });
  break;
}

case 'REVEAL_LINE': {
  if (editor && msg.line) {
    editor.revealLineInCenter(msg.line);
    editor.setPosition({ lineNumber: msg.line, column: 1 });
  }
  break;
}
```

- [ ] **Step 4: Verify the HTML builds without syntax errors**

```bash
cd mobile-ide/mobile-ide-prototype && npx tsc --noEmit 2>&1 | grep "MonacoAssetManager" | head -5 && echo "no errors"
```
Expected: `no errors` (TypeScript errors in the embedded JS string are not caught by tsc, which is expected).

- [ ] **Step 5: Run full suite to ensure no regressions**

```bash
cd mobile-ide/mobile-ide-prototype && npx jest --watchAll=false 2>&1 | tail -5
```

- [ ] **Step 6: Commit**

```bash
git add mobile-ide/mobile-ide-prototype/src/utils/MonacoAssetManager.ts
git commit -m "feat US-0079 US-0080: MonacoAssetManager — symbol feed, long-press, ⌘Click, GoToDef, GetRefs"
```

---

## Task 11: Editor.tsx — extend bridge + EditorHandle

**Files:**
- Modify: `mobile-ide/mobile-ide-prototype/src/components/Editor.tsx`
- Modify: `mobile-ide/mobile-ide-prototype/tests/unit/AIChatPanel.test.tsx` (only if mock needs updating)

- [ ] **Step 1: Add symbolAtCursor state and webViewFrame ref**

At the top of the `Editor` component function (after the existing `useState` declarations), add:

```typescript
import type { SymbolAtCursor, ContextMenuState } from '../codeNav/symbolContextMenu';
import { buildActions } from '../codeNav/symbolContextMenu';
import type { ReferenceMatch } from '../hooks/useReferencesSearch';

// Inside the component:
const [symbolAtCursor, setSymbolAtCursor] = useState<SymbolAtCursor | null>(null);
const [contextMenu,    setContextMenu]    = useState<ContextMenuState>({
  visible: false, screenX: 0, screenY: 0, word: '', actions: [],
});
const webViewFrame         = useRef({ x: 0, y: 0 });
const pendingRefsResolve   = useRef<((m: ReferenceMatch[]) => void) | null>(null);
```

- [ ] **Step 2: Extend the BREADCRUMB_UPDATE case and add new cases**

In the `handleMessage` callback (around line 481), extend the existing case and add new ones:

```typescript
case 'BREADCRUMB_UPDATE':
  setSymbol(msg.symbol ?? null);
  if (msg.symbolAtCursor) setSymbolAtCursor(msg.symbolAtCursor);
  break;

case 'LONG_PRESS':
case 'CMD_CLICK_SYMBOL': {
  const word   = msg.word || symbolAtCursor?.word || '';
  const hasDef = symbolAtCursor?.hasDefinition ?? false;
  const canRef = word.length > 1;
  if (!word) break;
  setContextMenu({
    visible:  true,
    screenX:  msg.x + webViewFrame.current.x,
    screenY:  msg.y + webViewFrame.current.y,
    word,
    actions:  buildActions({ word, hasDefinition: hasDef, canFindRefs: canRef }),
  });
  break;
}

case 'GO_TO_DEF_RESULT':
  onGoToDefResult?.(msg);
  break;

case 'MONACO_REFS_RESULT':
  pendingRefsResolve.current?.(msg.matches ?? []);
  pendingRefsResolve.current = null;
  break;
```

- [ ] **Step 3: Add onLayout measurement to the WebView**

Find the `<WebView` JSX in Editor.tsx. Add:

```typescript
onLayout={() => {
  webViewRef.current?.measureInWindow((x, y) => {
    webViewFrame.current = { x, y };
  });
}}
```

- [ ] **Step 4: Extend EditorHandle via useImperativeHandle**

Add to the `useImperativeHandle` return object:

```typescript
triggerGoToDef: () => sendToEditor('GO_TO_DEFINITION'),
getMonacoRefs:  () => new Promise<ReferenceMatch[]>(resolve => {
  pendingRefsResolve.current = resolve;
  sendToEditor('GET_MONACO_REFS');
  setTimeout(() => {
    if (pendingRefsResolve.current) {
      pendingRefsResolve.current([]);
      pendingRefsResolve.current = null;
    }
  }, 3_000);
}),
revealLine: (line: number) => sendToEditor('REVEAL_LINE', { line }),
```

- [ ] **Step 5: Add new props to EditorProps**

```typescript
// Add to EditorProps interface:
onGoToDefResult?: (result: { resolved: boolean; sameFile?: boolean; builtin?: boolean; word?: string; fileName?: string; offset?: number }) => void;
```

- [ ] **Step 6: Run full suite**

```bash
cd mobile-ide/mobile-ide-prototype && npx jest --watchAll=false 2>&1 | tail -5
```
Fix any failures. Most likely: Editor.test.tsx mock for EditorHandle needs new methods.

- [ ] **Step 7: Commit**

```bash
git add mobile-ide/mobile-ide-prototype/src/components/Editor.tsx
git commit -m "feat US-0079 US-0080: Editor.tsx — symbolAtCursor state, context menu, EditorHandle extensions"
```

---

## Task 12: App.tsx — symbol index, GoToDef handler, references state, ⌘T

**Files:**
- Modify: `mobile-ide/mobile-ide-prototype/App.tsx`
- Modify: `mobile-ide/mobile-ide-prototype/tests/unit/App.test.tsx`

- [ ] **Step 1: Add imports to App.tsx**

```typescript
import { useSymbolSearch } from './src/hooks/useSymbolSearch';
import { useReferencesSearch } from './src/hooks/useReferencesSearch';
import { resolveDefinition } from './src/codeNav/definitionResolver';
import ReferencesPanel from './src/components/ReferencesPanel';
import type { ReferenceMatch } from './src/hooks/useReferencesSearch';
```

- [ ] **Step 2: Add symbol search + references state to App component**

After existing `useState` declarations:

```typescript
const symbolSearch  = useSymbolSearch(rootPath ?? '');
const refSearch     = useReferencesSearch();
const [showRefs,    setShowRefs]    = useState(false);
const [refsWord,    setRefsWord]    = useState('');
const [paletteMode, setPaletteMode] = useState<'commands' | 'symbolSearch'>('commands');
```

- [ ] **Step 3: Wire onFileSaved to symbol indexer**

In the existing `saveFile` callback, after the file is written, add:

```typescript
symbolSearch.onFileSaved(filePath, content);
```

- [ ] **Step 4: Add GoToDef result handler**

```typescript
const handleGoToDefResult = useCallback((result: {
  resolved: boolean; sameFile?: boolean; builtin?: boolean;
  word?: string; fileName?: string;
}) => {
  if (result.sameFile) return;  // Monaco already navigated
  if (result.builtin) {
    // TODO(post-launch): show read-only overlay for .d.ts content
    return;
  }
  if (!result.resolved || !result.word) return;
  const hit = resolveDefinition(result.word, symbolSearch.index);
  if (hit) {
    openFile(hit.filePath);
    // Reveal line after tab switch completes — use a short timeout
    setTimeout(() => editorRef.current?.revealLine(hit.line), 200);
  }
}, [symbolSearch.index, openFile]);
```

- [ ] **Step 5: Add Find References handler**

```typescript
const handleFindRefs = useCallback(async (word: string) => {
  if (!rootPath || !activeTabPath) return;
  setRefsWord(word);
  setShowRefs(true);
  const getMonacoRefs = (): Promise<ReferenceMatch[]> =>
    editorRef.current?.getMonacoRefs() ?? Promise.resolve([]);
  await refSearch.search(word, activeTabPath, rootPath, getMonacoRefs);
}, [rootPath, activeTabPath, refSearch]);
```

- [ ] **Step 6: Wire ⌘T shortcut to symbol search palette**

In the existing `shortcutDefinitions` array (around line 535), add:

```typescript
{ key: 't', modifiers: ['meta'], label: 'Go to Symbol', action: () => {
  setPaletteMode('symbolSearch');
  setShowPalette(true);
}},
```

- [ ] **Step 7: Update Editor props in JSX**

In the `<Editor ...>` JSX, add:

```typescript
onGoToDefResult={handleGoToDefResult}
```

- [ ] **Step 8: Update CommandPalette in JSX**

Find `<CommandPalette ...>` and add:

```typescript
mode={paletteMode}
symbolIndex={symbolSearch.index}
onNavigateSymbol={(filePath, line) => {
  openFile(filePath);
  setTimeout(() => editorRef.current?.revealLine(line), 200);
  setShowPalette(false);
  setPaletteMode('commands');
}}
```

Also ensure `onClose` resets the mode:
```typescript
onClose={() => { setShowPalette(false); setPaletteMode('commands'); }}
```

- [ ] **Step 9: Add ReferencesPanel alongside TerminalWebView**

The references panel replaces the terminal in `TabletResponsive`'s `terminal` slot on tablet, and shows as a bottom sheet on phone. For v1, the simplest approach: conditionally pass `ReferencesPanel` as the `terminal` prop when `showRefs` is true:

```typescript
terminal={
  showRefs ? (
    <ReferencesPanel
      word={refsWord}
      results={refSearch.results}
      isSearching={refSearch.isSearching}
      totalCount={refSearch.totalCount}
      onNavigate={(filePath, line) => {
        openFile(filePath);
        setTimeout(() => editorRef.current?.revealLine(line), 200);
      }}
      onClose={() => { setShowRefs(false); refSearch.cancel(); }}
    />
  ) : (
    <TerminalWebView workingDirectory={rootPath} onCommand={handleCommandComplete} visible={showTerminal} />
  )
}
```

- [ ] **Step 10: Update App.test.tsx mocks**

Add to the existing `useSymbolSearch` / `useReferencesSearch` mocks if not present:

```typescript
jest.mock('./src/hooks/useSymbolSearch', () => ({
  useSymbolSearch: () => ({
    index: [], isBuilding: false, onFileSaved: jest.fn(), search: jest.fn(() => []),
  }),
}));
jest.mock('./src/hooks/useReferencesSearch', () => ({
  useReferencesSearch: () => ({
    results: [], isSearching: false, totalCount: 0,
    search: jest.fn(), cancel: jest.fn(),
  }),
}));
jest.mock('./src/codeNav/definitionResolver', () => ({
  resolveDefinition: jest.fn(() => null),
}));
```

- [ ] **Step 11: Run full suite**

```bash
cd mobile-ide/mobile-ide-prototype && npx jest --watchAll=false 2>&1 | tail -5
```
Expected: all tests pass.

- [ ] **Step 12: Commit**

```bash
git add mobile-ide/mobile-ide-prototype/App.tsx \
        mobile-ide/mobile-ide-prototype/tests/unit/App.test.tsx
git commit -m "feat US-0079 US-0080 US-0081: App.tsx — GoToDef handler, FindRefs, ⌘T symbol search, ReferencesPanel"
```

---

## Task 13: Final test run + self-review

- [ ] **Step 1: Run full test suite**

```bash
cd mobile-ide/mobile-ide-prototype && npx jest --watchAll=false 2>&1 | tail -8
```
Expected: All tests pass, count ≥ 1301 + 45 new = ~1346.

- [ ] **Step 2: TypeScript check**

```bash
cd mobile-ide/mobile-ide-prototype && npx tsc --noEmit 2>&1 | grep "error TS" | head -10
```
Expected: 0 errors.

- [ ] **Step 3: Manual smoke tests** (on device or simulator)

| Test | How | Expected |
|---|---|---|
| Long-press TS identifier | Hold finger on a function name | Context menu within 600ms |
| Long-press whitespace | Hold on empty line | No menu |
| GoToDef same-file | Press "Go to Definition" | Cursor jumps to declaration |
| GoToDef cross-file | Press on imported function | File opens, scrolls to line |
| ⌘Click | Hardware keyboard ⌘+tap | Same as GoToDef |
| Find All References | Press "Find All References" | Panel opens with grouped results |
| Tap reference row | Tap any result | Correct file opens, scrolls to line |
| Cancel search | Tap ✕ while searching | Search stops immediately |
| ⌘T | Hardware keyboard ⌘T | Symbol palette opens |
| ⌘T type "format" | Type in symbol palette | formatDate etc. appear |
| Select symbol | Tap a symbol | File opens at declaration |

- [ ] **Step 4: Final commit (update docs/AI_COST_LOG.md if needed)**

```bash
git add docs/AI_COST_LOG.md 2>/dev/null || true
git commit -m "docs: update AI cost log post EPIC-0022 implementation"
```

---

## Self-Review

**Spec coverage:**

| Spec section | Task(s) |
|---|---|
| §3 File map | Tasks 1–13 (all files created/modified) |
| §4 Symbol state feed | Task 10 (BREADCRUMB_UPDATE), Task 11 (onMessage) |
| §5 Context menu + long-press | Task 10 (detectors), Task 11 (state + menu) |
| §6 Go to Definition | Tasks 5, 10, 11, 12 |
| §7 Find All References | Tasks 6, 8, 11, 12 |
| §8 Workspace Symbol Search | Tasks 4, 7, 9, 12 |
| §9 Shared helpers | Task 1 |
| §10 FileSystemBridge.listFilesRecursive | Task 3 |
| §11 Test strategy (45 tests) | Tasks 1–9 |
| AC-0240–AC-0248 | All covered |

**Type consistency:** `SymbolEntry` defined Task 4 → used Tasks 5, 7, 9, 12 ✅. `ReferenceMatch`/`ReferenceGroup` defined Task 6 → used Tasks 8, 11, 12 ✅. `SymbolAtCursor`/`ContextMenuState`/`SymbolAction` defined Task 2 → used Tasks 11 ✅. `DeclarationHit` defined Task 5 → used Task 12 ✅.

**Placeholder scan:** None found.

**One gap identified and added:** `REVEAL_LINE` message case (Task 10 Step 3) is needed by `editorRef.current?.revealLine()` calls in Task 12. Added to the MonacoAssetManager switch.
