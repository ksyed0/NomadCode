# EPIC-0014 Global Search — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add cross-project Find in Files to NomadCode — a left-sidebar search panel with regex/case/word/glob options, progressive result streaming, and click-to-navigate with Monaco highlight.

**Architecture:** A pure async-generator search engine (`searchEngine.ts`) walks the workspace via `FileSystemBridge`, streaming `FileSearchResult` objects as each file completes. A `useSearch` hook wraps it with `AbortController` cancellation and React state. `GlobalSearch.tsx` renders the panel inside `FileExplorer`'s new tab bar. Navigation embeds scroll intent in the `setContent` message so Monaco highlights the match atomically with the file load.

**Tech Stack:** TypeScript, React Native, Expo FileSystem, Monaco Editor (WebView message bridge), Zustand, `@testing-library/react-native`, Jest.

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src/utils/searchEngine.ts` | CREATE | Async generator engine — walk, match, cap, cancel |
| `src/hooks/useSearch.ts` | CREATE | React hook — AbortController, result state, submit/clear |
| `src/components/GlobalSearch.tsx` | CREATE | Search bar + toggles + grouped result list |
| `src/utils/FileSystemBridge.ts` | MODIFY | Add `getFileSize(path): Promise<number>` |
| `src/components/FileExplorer.tsx` | MODIFY | Add Files/Search tab bar; render GlobalSearch when active |
| `src/components/Editor.tsx` | MODIFY | Add `scrollTo` to `EditorTab`; embed in `setContent` message |
| `src/utils/MonacoAssetManager.ts` | MODIFY | Add `case 'scrollToLine'` + CSS injection |
| `App.tsx` | MODIFY | `sidebarTab` state, `handleSearchNavigate`, palette command |
| `tests/unit/searchEngine.test.ts` | CREATE | Pure logic tests (no mocks needed for helpers) |
| `tests/unit/useSearch.test.ts` | CREATE | Hook tests (mocked searchEngine) |
| `tests/unit/GlobalSearch.test.tsx` | CREATE | Component tests (mocked useSearch) |
| `tests/unit/FileSystemBridge.test.ts` | MODIFY | Add getFileSize test |
| `tests/unit/FileExplorer.test.tsx` | MODIFY | Tab bar + GlobalSearch render tests |
| `tests/unit/Editor.test.tsx` | MODIFY | scrollTo field in setContent payload test |

---

## Task 1: Create feature branch

- [ ] **Step 1: Create branch from develop**

```bash
cd /Users/Kamal_Syed/Projects/NomadCode
git checkout develop && git pull origin develop
git checkout -b feature/EPIC-0014-global-search
```

Expected: `Switched to a new branch 'feature/EPIC-0014-global-search'`

---

## Task 2: searchEngine — pure helpers (TDD)

These are exported for testability even though the spec marks them internal.

**Files:**
- Create: `mobile-ide/mobile-ide-prototype/src/utils/searchEngine.ts`
- Create: `mobile-ide/mobile-ide-prototype/tests/unit/searchEngine.test.ts`

- [ ] **Step 1: Write the failing tests for pure helpers**

Create `mobile-ide/mobile-ide-prototype/tests/unit/searchEngine.test.ts`:

```typescript
import {
  globToRegex,
  buildPattern,
  matchFile,
  SearchOptions,
} from '../../src/utils/searchEngine';

const DEFAULT_OPTS: SearchOptions = {
  caseSensitive: false,
  regex: false,
  wholeWord: false,
  glob: '',
};

// ── globToRegex ────────────────────────────────────────────────────────────

describe('globToRegex', () => {
  it('empty string matches everything', () => {
    expect(globToRegex('').test('src/foo.ts')).toBe(true);
    expect(globToRegex('').test('anything')).toBe(true);
  });

  it('**/*.ts matches nested .ts files', () => {
    const re = globToRegex('**/*.ts');
    expect(re.test('src/foo.ts')).toBe(true);
    expect(re.test('src/hooks/useSearch.ts')).toBe(true);
    expect(re.test('src/foo.js')).toBe(false);
    expect(re.test('src/foo.tsx')).toBe(false);
  });

  it('*.ts matches root-level .ts only (no slash crossing)', () => {
    const re = globToRegex('*.ts');
    expect(re.test('foo.ts')).toBe(true);
    expect(re.test('src/foo.ts')).toBe(false);
  });

  it('? matches exactly one non-slash character', () => {
    const re = globToRegex('src/?.ts');
    expect(re.test('src/a.ts')).toBe(true);
    expect(re.test('src/ab.ts')).toBe(false);
  });

  it('escapes regex special chars in glob', () => {
    const re = globToRegex('**/*.test.ts');
    expect(re.test('src/foo.test.ts')).toBe(true);
    expect(re.test('src/footestts')).toBe(false);
  });
});

// ── buildPattern ──────────────────────────────────────────────────────────

describe('buildPattern', () => {
  it('plain string, case-insensitive by default', () => {
    const re = buildPattern('foo', DEFAULT_OPTS);
    expect(re.test('FOO')).toBe(true);
    expect(re.test('foo')).toBe(true);
  });

  it('case-sensitive when caseSensitive=true', () => {
    const re = buildPattern('foo', { ...DEFAULT_OPTS, caseSensitive: true });
    expect(re.test('foo')).toBe(true);
    expect(re.test('FOO')).toBe(false);
  });

  it('treats query as regex when regex=true', () => {
    const re = buildPattern('use[A-Z]\\w+', { ...DEFAULT_OPTS, regex: true });
    expect(re.test('useState')).toBe(true);
    expect(re.test('usestate')).toBe(false);
  });

  it('escapes regex metacharacters when regex=false', () => {
    const re = buildPattern('foo.bar', DEFAULT_OPTS);
    expect(re.test('foo.bar')).toBe(true);
    expect(re.test('fooXbar')).toBe(false); // dot is literal
  });

  it('wraps with word boundaries when wholeWord=true', () => {
    const re = buildPattern('foo', { ...DEFAULT_OPTS, wholeWord: true });
    expect(re.test('foo')).toBe(true);
    expect(re.test('foobar')).toBe(false);
    expect(re.test('barfoo')).toBe(false);
  });

  it('throws on invalid regex', () => {
    expect(() => buildPattern('[invalid', { ...DEFAULT_OPTS, regex: true })).toThrow();
  });
});

// ── matchFile ─────────────────────────────────────────────────────────────

describe('matchFile', () => {
  it('returns empty array when no matches', () => {
    const pattern = buildPattern('xyz', DEFAULT_OPTS);
    expect(matchFile('const foo = 1;', pattern)).toEqual([]);
  });

  it('returns correct lineNumber (1-based) and preview', () => {
    const pattern = buildPattern('foo', DEFAULT_OPTS);
    const results = matchFile('line1\nconst foo = 1;\nline3', pattern);
    expect(results).toHaveLength(1);
    expect(results[0].lineNumber).toBe(2);
    expect(results[0].preview).toBe('const foo = 1;');
  });

  it('returns correct matchStart and matchEnd offsets', () => {
    const pattern = buildPattern('foo', DEFAULT_OPTS);
    const results = matchFile('const foo = 1;', pattern);
    expect(results[0].matchStart).toBe(6);
    expect(results[0].matchEnd).toBe(9);
  });

  it('matches multiple lines', () => {
    const pattern = buildPattern('foo', DEFAULT_OPTS);
    const results = matchFile('foo\nbar\nfoo again', pattern);
    expect(results).toHaveLength(2);
    expect(results[0].lineNumber).toBe(1);
    expect(results[1].lineNumber).toBe(3);
  });

  it('truncates preview to 120 characters', () => {
    const longLine = 'a'.repeat(200);
    const pattern = buildPattern('aaa', DEFAULT_OPTS);
    const results = matchFile(longLine, pattern);
    expect(results[0].preview.length).toBe(120);
  });

  it('handles empty content', () => {
    const pattern = buildPattern('foo', DEFAULT_OPTS);
    expect(matchFile('', pattern)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests — expect failures**

```bash
cd mobile-ide/mobile-ide-prototype
npx jest --watchAll=false tests/unit/searchEngine.test.ts 2>&1 | tail -10
```

Expected: `Cannot find module '../../src/utils/searchEngine'`

- [ ] **Step 3: Create searchEngine.ts with types and pure helpers**

Create `mobile-ide/mobile-ide-prototype/src/utils/searchEngine.ts`:

```typescript
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
  return new RegExp(src, opts.caseSensitive ? '' : 'i');
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
```

- [ ] **Step 4: Run tests — expect helpers to pass**

```bash
npx jest --watchAll=false tests/unit/searchEngine.test.ts 2>&1 | tail -10
```

Expected: all `globToRegex`, `buildPattern`, `matchFile` tests pass. `searchFiles` tests (added in Task 3) not yet present.

- [ ] **Step 5: Commit**

```bash
git add mobile-ide/mobile-ide-prototype/src/utils/searchEngine.ts \
        mobile-ide/mobile-ide-prototype/tests/unit/searchEngine.test.ts
git commit -m "feat(search): add searchEngine types and pure helpers (TDD)"
```

---

## Task 3: searchEngine — generator (TDD)

**Files:**
- Modify: `mobile-ide/mobile-ide-prototype/src/utils/searchEngine.ts`
- Modify: `mobile-ide/mobile-ide-prototype/tests/unit/searchEngine.test.ts`

- [ ] **Step 1: Add generator tests to searchEngine.test.ts**

Append to `mobile-ide/mobile-ide-prototype/tests/unit/searchEngine.test.ts`:

```typescript
// ── searchFiles generator ─────────────────────────────────────────────────

const mockListDirectory = jest.fn();
const mockReadFile = jest.fn();
const mockGetFileSize = jest.fn();

jest.mock('../../src/utils/FileSystemBridge', () => ({
  FileSystemBridge: {
    listDirectory: (...args: unknown[]) => mockListDirectory(...args),
    readFile: (...args: unknown[]) => mockReadFile(...args),
    getFileSize: (...args: unknown[]) => mockGetFileSize(...args),
  },
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockGetFileSize.mockResolvedValue(1000); // small file
});

async function collectResults(
  gen: AsyncGenerator<FileSearchResult>,
): Promise<FileSearchResult[]> {
  const out: FileSearchResult[] = [];
  for await (const r of gen) out.push(r);
  return out;
}

describe('searchFiles', () => {
  it('yields nothing for empty query', async () => {
    const signal = new AbortController().signal;
    const results = await collectResults(
      searchFiles('file:///root', '', DEFAULT_OPTS, signal),
    );
    expect(results).toEqual([]);
    expect(mockListDirectory).not.toHaveBeenCalled();
  });

  it('yields matching file results', async () => {
    mockListDirectory.mockResolvedValue([
      { name: 'foo.ts', path: 'file:///root/foo.ts', isDirectory: false },
    ]);
    mockReadFile.mockResolvedValue('const foo = 1;\nconst bar = 2;');
    const signal = new AbortController().signal;
    const results = await collectResults(
      searchFiles('file:///root', 'foo', DEFAULT_OPTS, signal),
    );
    expect(results).toHaveLength(1);
    expect(results[0].filePath).toBe('file:///root/foo.ts');
    expect(results[0].matches[0].lineNumber).toBe(1);
  });

  it('skips excluded directories', async () => {
    mockListDirectory.mockResolvedValueOnce([
      { name: 'node_modules', path: 'file:///root/node_modules', isDirectory: true },
      { name: 'src', path: 'file:///root/src', isDirectory: true },
    ]);
    mockListDirectory.mockResolvedValueOnce([
      { name: 'index.ts', path: 'file:///root/src/index.ts', isDirectory: false },
    ]);
    mockReadFile.mockResolvedValue('foo');
    const signal = new AbortController().signal;
    await collectResults(searchFiles('file:///root', 'foo', DEFAULT_OPTS, signal));
    // node_modules dir should never be listed
    expect(mockListDirectory).toHaveBeenCalledTimes(2); // root + src
    expect(mockListDirectory).not.toHaveBeenCalledWith('file:///root/node_modules');
  });

  it('skips files larger than MAX_FILE_SIZE_BYTES', async () => {
    mockListDirectory.mockResolvedValue([
      { name: 'big.ts', path: 'file:///root/big.ts', isDirectory: false },
    ]);
    mockGetFileSize.mockResolvedValue(MAX_FILE_SIZE_BYTES + 1);
    const signal = new AbortController().signal;
    await collectResults(searchFiles('file:///root', 'foo', DEFAULT_OPTS, signal));
    expect(mockReadFile).not.toHaveBeenCalled();
  });

  it('skips unreadable files and continues', async () => {
    mockListDirectory.mockResolvedValue([
      { name: 'bad.ts', path: 'file:///root/bad.ts', isDirectory: false },
      { name: 'good.ts', path: 'file:///root/good.ts', isDirectory: false },
    ]);
    mockReadFile
      .mockRejectedValueOnce(new Error('permission denied'))
      .mockResolvedValueOnce('foo match');
    const signal = new AbortController().signal;
    const results = await collectResults(
      searchFiles('file:///root', 'foo', DEFAULT_OPTS, signal),
    );
    expect(results).toHaveLength(1);
    expect(results[0].filePath).toBe('file:///root/good.ts');
  });

  it('stops when signal is aborted', async () => {
    mockListDirectory.mockResolvedValue([
      { name: 'a.ts', path: 'file:///root/a.ts', isDirectory: false },
      { name: 'b.ts', path: 'file:///root/b.ts', isDirectory: false },
      { name: 'c.ts', path: 'file:///root/c.ts', isDirectory: false },
    ]);
    mockReadFile.mockImplementation(() => new Promise(res => setTimeout(() => res('foo'), 10)));
    const controller = new AbortController();
    const results: FileSearchResult[] = [];
    const gen = searchFiles('file:///root', 'foo', DEFAULT_OPTS, controller.signal);
    const first = await gen.next();
    if (!first.done) results.push(first.value);
    controller.abort();
    const second = await gen.next();
    expect(second.done).toBe(true);
  });

  it('applies glob filter — skips non-matching files', async () => {
    mockListDirectory.mockResolvedValue([
      { name: 'foo.ts', path: 'file:///root/foo.ts', isDirectory: false },
      { name: 'foo.js', path: 'file:///root/foo.js', isDirectory: false },
    ]);
    mockReadFile.mockResolvedValue('foo match');
    const signal = new AbortController().signal;
    const results = await collectResults(
      searchFiles('file:///root', 'foo', { ...DEFAULT_OPTS, glob: '**/*.ts' }, signal),
    );
    expect(results).toHaveLength(1);
    expect(results[0].filePath).toBe('file:///root/foo.ts');
  });

  it('caps results at MAX_TOTAL_MATCHES', async () => {
    // Create a file that produces 600 matches
    const bigContent = Array.from({ length: 600 }, (_, i) => `line ${i} foo`).join('\n');
    mockListDirectory.mockResolvedValueOnce([
      { name: 'a.ts', path: 'file:///root/a.ts', isDirectory: false },
      { name: 'b.ts', path: 'file:///root/b.ts', isDirectory: false },
    ]);
    mockReadFile.mockResolvedValue(bigContent);
    const signal = new AbortController().signal;
    const results = await collectResults(
      searchFiles('file:///root', 'foo', DEFAULT_OPTS, signal),
    );
    const total = results.reduce((s, r) => s + r.matches.length, 0);
    expect(total).toBeLessThanOrEqual(MAX_TOTAL_MATCHES);
  });
});
```

- [ ] **Step 2: Run tests — expect generator tests to fail**

```bash
npx jest --watchAll=false tests/unit/searchEngine.test.ts 2>&1 | tail -15
```

Expected: generator tests fail (stub yields nothing).

- [ ] **Step 3: Implement searchFiles generator in searchEngine.ts**

Replace the stub `searchFiles` and add the `walkDir` helper at the bottom of `searchEngine.ts`:

```typescript
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
      // Glob: test relative path from root
      const rel = entry.path.startsWith(root)
        ? entry.path.slice(root.length).replace(/^[/]/, '')
        : entry.name;
      if (!globPattern.test(rel) && !globPattern.test(entry.name)) continue;
      const matches = matchFile(content, pattern);
      if (matches.length === 0) continue;
      const allowed = Math.min(matches.length, MAX_TOTAL_MATCHES - counter.total);
      counter.total += allowed;
      yield { filePath: entry.path, matches: matches.slice(0, allowed) };
    }
  }
}
```

- [ ] **Step 4: Run all searchEngine tests**

```bash
npx jest --watchAll=false tests/unit/searchEngine.test.ts 2>&1 | tail -10
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add mobile-ide/mobile-ide-prototype/src/utils/searchEngine.ts \
        mobile-ide/mobile-ide-prototype/tests/unit/searchEngine.test.ts
git commit -m "feat(search): implement searchFiles async generator with walk, cap, and cancellation"
```

---

## Task 4: FileSystemBridge — getFileSize (TDD)

**Files:**
- Modify: `mobile-ide/mobile-ide-prototype/src/utils/FileSystemBridge.ts`
- Modify: `mobile-ide/mobile-ide-prototype/tests/unit/FileSystemBridge.test.ts`

- [ ] **Step 1: Write failing test**

Open `tests/unit/FileSystemBridge.test.ts` and add inside the existing `describe('FileSystemBridge', ...)` block (or at the bottom if the describe wraps all):

```typescript
describe('getFileSize', () => {
  it('returns file size when file exists', async () => {
    mockGetInfoAsync.mockResolvedValue({ exists: true, size: 1234, isDirectory: false, uri: 'file:///x' });
    const size = await FileSystemBridge.getFileSize('file:///x');
    expect(size).toBe(1234);
  });

  it('returns 0 when file does not exist', async () => {
    mockGetInfoAsync.mockResolvedValue({ exists: false, uri: 'file:///x' });
    const size = await FileSystemBridge.getFileSize('file:///x');
    expect(size).toBe(0);
  });

  it('returns 0 when size is undefined', async () => {
    mockGetInfoAsync.mockResolvedValue({ exists: true, uri: 'file:///x' });
    const size = await FileSystemBridge.getFileSize('file:///x');
    expect(size).toBe(0);
  });
});
```

- [ ] **Step 2: Run test — expect failure**

```bash
npx jest --watchAll=false tests/unit/FileSystemBridge.test.ts 2>&1 | tail -10
```

Expected: `TypeError: FileSystemBridge.getFileSize is not a function`

- [ ] **Step 3: Add getFileSize to FileSystemBridge.ts**

Open `src/utils/FileSystemBridge.ts`. Find the `FileSystemBridge` object and add after the existing `exists` method:

```typescript
async getFileSize(path: string): Promise<number> {
  const info = await FileSystem.getInfoAsync(path);
  return info.exists ? ((info as { size?: number }).size ?? 0) : 0;
},
```

- [ ] **Step 4: Run test — expect pass**

```bash
npx jest --watchAll=false tests/unit/FileSystemBridge.test.ts 2>&1 | tail -10
```

Expected: all FileSystemBridge tests pass.

- [ ] **Step 5: Commit**

```bash
git add mobile-ide/mobile-ide-prototype/src/utils/FileSystemBridge.ts \
        mobile-ide/mobile-ide-prototype/tests/unit/FileSystemBridge.test.ts
git commit -m "feat(search): add FileSystemBridge.getFileSize for pre-read size check"
```

---

## Task 5: useSearch hook (TDD)

**Files:**
- Create: `mobile-ide/mobile-ide-prototype/src/hooks/useSearch.ts`
- Create: `mobile-ide/mobile-ide-prototype/tests/unit/useSearch.test.ts`

- [ ] **Step 1: Write failing tests**

Create `mobile-ide/mobile-ide-prototype/tests/unit/useSearch.test.ts`:

```typescript
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useSearch } from '../../src/hooks/useSearch';
import { FileSearchResult } from '../../src/utils/searchEngine';

// Mock searchEngine
const mockSearchFiles = jest.fn();
jest.mock('../../src/utils/searchEngine', () => ({
  ...jest.requireActual('../../src/utils/searchEngine'),
  searchFiles: (...args: unknown[]) => mockSearchFiles(...args),
}));

const WORKSPACE = 'file:///workspace';

async function* makeGen(results: FileSearchResult[]) {
  for (const r of results) yield r;
}

beforeEach(() => jest.clearAllMocks());

describe('useSearch', () => {
  it('initial state is empty', () => {
    const { result } = renderHook(() => useSearch(WORKSPACE));
    expect(result.current.query).toBe('');
    expect(result.current.results).toEqual([]);
    expect(result.current.isSearching).toBe(false);
    expect(result.current.fileCount).toBe(0);
    expect(result.current.totalMatchCount).toBe(0);
    expect(result.current.error).toBeNull();
  });

  it('submit triggers searchFiles and streams results', async () => {
    const fakeResults: FileSearchResult[] = [
      { filePath: 'file:///workspace/a.ts', matches: [{ lineNumber: 1, preview: 'foo', matchStart: 0, matchEnd: 3 }] },
      { filePath: 'file:///workspace/b.ts', matches: [{ lineNumber: 2, preview: 'foo bar', matchStart: 0, matchEnd: 3 }, { lineNumber: 5, preview: 'foo', matchStart: 0, matchEnd: 3 }] },
    ];
    mockSearchFiles.mockReturnValue(makeGen(fakeResults));

    const { result } = renderHook(() => useSearch(WORKSPACE));
    act(() => { result.current.setQuery('foo'); });
    await act(async () => { result.current.submit(); });

    await waitFor(() => expect(result.current.isSearching).toBe(false));
    expect(result.current.results).toHaveLength(2);
    expect(result.current.fileCount).toBe(2);
    expect(result.current.totalMatchCount).toBe(3);
  });

  it('isSearching is true while generator is running', async () => {
    let resolve: () => void;
    const pending = new Promise<void>(r => { resolve = r; });
    async function* slowGen() {
      await pending;
      yield { filePath: 'a.ts', matches: [] };
    }
    mockSearchFiles.mockReturnValue(slowGen());

    const { result } = renderHook(() => useSearch(WORKSPACE));
    act(() => { result.current.setQuery('foo'); });
    act(() => { result.current.submit(); });

    expect(result.current.isSearching).toBe(true);
    resolve!();
    await waitFor(() => expect(result.current.isSearching).toBe(false));
  });

  it('re-submit cancels previous search', async () => {
    let firstAborted = false;
    async function* firstGen(signal: AbortSignal) {
      await new Promise<void>(res => setTimeout(res, 50));
      if (signal.aborted) { firstAborted = true; return; }
      yield { filePath: 'a.ts', matches: [] };
    }
    mockSearchFiles.mockImplementationOnce((_r: string, _q: string, _o: unknown, signal: AbortSignal) => firstGen(signal));
    mockSearchFiles.mockReturnValueOnce(makeGen([]));

    const { result } = renderHook(() => useSearch(WORKSPACE));
    act(() => { result.current.setQuery('foo'); });
    act(() => { result.current.submit(); });
    act(() => { result.current.submit(); }); // cancel first

    await waitFor(() => expect(result.current.isSearching).toBe(false));
    expect(firstAborted).toBe(true);
  });

  it('clear resets all state', async () => {
    mockSearchFiles.mockReturnValue(makeGen([
      { filePath: 'a.ts', matches: [{ lineNumber: 1, preview: 'foo', matchStart: 0, matchEnd: 3 }] },
    ]));
    const { result } = renderHook(() => useSearch(WORKSPACE));
    act(() => { result.current.setQuery('foo'); });
    await act(async () => { result.current.submit(); });
    await waitFor(() => expect(result.current.results).toHaveLength(1));

    act(() => { result.current.clear(); });
    expect(result.current.query).toBe('');
    expect(result.current.results).toEqual([]);
    expect(result.current.fileCount).toBe(0);
    expect(result.current.isSearching).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('sets error on invalid regex', async () => {
    const { result } = renderHook(() => useSearch(WORKSPACE));
    act(() => {
      result.current.setQuery('[invalid');
      result.current.setOptions({ regex: true });
    });
    act(() => { result.current.submit(); });
    expect(result.current.error).toMatch(/invalid/i);
    expect(mockSearchFiles).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests — expect failures**

```bash
npx jest --watchAll=false tests/unit/useSearch.test.ts 2>&1 | tail -10
```

Expected: `Cannot find module '../../src/hooks/useSearch'`

- [ ] **Step 3: Implement useSearch.ts**

Create `mobile-ide/mobile-ide-prototype/src/hooks/useSearch.ts`:

```typescript
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
```

- [ ] **Step 4: Run tests — expect pass**

```bash
npx jest --watchAll=false tests/unit/useSearch.test.ts 2>&1 | tail -10
```

Expected: all 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add mobile-ide/mobile-ide-prototype/src/hooks/useSearch.ts \
        mobile-ide/mobile-ide-prototype/tests/unit/useSearch.test.ts
git commit -m "feat(search): add useSearch hook with AbortController and streaming state"
```

---

## Task 6: GlobalSearch component (TDD)

**Files:**
- Create: `mobile-ide/mobile-ide-prototype/src/components/GlobalSearch.tsx`
- Create: `mobile-ide/mobile-ide-prototype/tests/unit/GlobalSearch.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `mobile-ide/mobile-ide-prototype/tests/unit/GlobalSearch.test.tsx`:

```typescript
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { GlobalSearch } from '../../src/components/GlobalSearch';
import { UseSearchReturn } from '../../src/hooks/useSearch';

// Mock useSearch
const mockSubmit = jest.fn();
const mockClear = jest.fn();
const mockSetQuery = jest.fn();
const mockSetOptions = jest.fn();

let mockState: Partial<UseSearchReturn> = {};

jest.mock('../../src/hooks/useSearch', () => ({
  useSearch: () => ({
    query: '',
    setQuery: mockSetQuery,
    options: { caseSensitive: false, regex: false, wholeWord: false, glob: '' },
    setOptions: mockSetOptions,
    results: [],
    isSearching: false,
    fileCount: 0,
    totalMatchCount: 0,
    error: null,
    submit: mockSubmit,
    clear: mockClear,
    ...mockState,
  }),
}));

jest.mock('../../src/theme/tokens', () => ({
  useTheme: () => ({
    colors: {
      background: '#0F172A', text: '#E2E8F0', textMuted: '#64748B',
      primary: '#2563EB', accent: '#0D9488', error: '#EF4444',
      border: '#334155', surface: '#1E293B',
    },
  }),
}));

const WORKSPACE = 'file:///workspace';
const onNavigate = jest.fn();

function renderSearch(state: Partial<UseSearchReturn> = {}) {
  mockState = state;
  return render(<GlobalSearch workspaceRoot={WORKSPACE} onNavigate={onNavigate} />);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockState = {};
});

describe('GlobalSearch', () => {
  it('renders search input', () => {
    const { getByPlaceholderText } = renderSearch();
    expect(getByPlaceholderText('Search')).toBeTruthy();
  });

  it('renders four option toggles', () => {
    const { getByText } = renderSearch();
    expect(getByText('Aa')).toBeTruthy();
    expect(getByText('.*')).toBeTruthy();
    expect(getByText('\\b')).toBeTruthy();
  });

  it('renders glob filter input', () => {
    const { getByPlaceholderText } = renderSearch();
    expect(getByPlaceholderText(/files to include/i)).toBeTruthy();
  });

  it('pressing Aa toggle calls setOptions with toggled caseSensitive', () => {
    const { getByText } = renderSearch();
    fireEvent.press(getByText('Aa'));
    expect(mockSetOptions).toHaveBeenCalledWith({ caseSensitive: true });
  });

  it('pressing .* toggle calls setOptions with toggled regex', () => {
    const { getByText } = renderSearch();
    fireEvent.press(getByText('.*'));
    expect(mockSetOptions).toHaveBeenCalledWith({ regex: true });
  });

  it('pressing \\b toggle calls setOptions with toggled wholeWord', () => {
    const { getByText } = renderSearch();
    fireEvent.press(getByText('\\b'));
    expect(mockSetOptions).toHaveBeenCalledWith({ wholeWord: true });
  });

  it('pressing Enter calls submit', () => {
    const { getByPlaceholderText } = renderSearch();
    fireEvent(getByPlaceholderText('Search'), 'submitEditing');
    expect(mockSubmit).toHaveBeenCalled();
  });

  it('shows loading indicator while isSearching', () => {
    const { getByText } = renderSearch({ isSearching: true, fileCount: 3 });
    expect(getByText(/searching/i)).toBeTruthy();
  });

  it('shows empty state when no results and not searching', () => {
    const { getByText } = renderSearch({ query: 'foo', results: [], isSearching: false });
    // Need to set query via mock - it reads from useSearch
    mockState = { query: 'foo', results: [], isSearching: false };
    const { getByText: g } = renderSearch({ query: 'foo', results: [], isSearching: false });
    expect(g(/no results/i)).toBeTruthy();
  });

  it('shows summary line with result counts', () => {
    const { getByText } = renderSearch({
      results: [
        { filePath: 'a.ts', matches: [{ lineNumber: 1, preview: 'foo', matchStart: 0, matchEnd: 3 }] },
      ],
      totalMatchCount: 1,
    });
    expect(getByText(/1 result/i)).toBeTruthy();
  });

  it('renders results grouped by file', () => {
    const { getByText } = renderSearch({
      results: [
        {
          filePath: 'file:///workspace/src/App.tsx',
          matches: [
            { lineNumber: 42, preview: 'const foo = 1;', matchStart: 6, matchEnd: 9 },
          ],
        },
      ],
      totalMatchCount: 1,
    });
    expect(getByText(/App\.tsx/)).toBeTruthy();
    expect(getByText('const foo = 1;')).toBeTruthy();
  });

  it('tapping a result calls onNavigate with correct args', () => {
    const { getByText } = renderSearch({
      results: [
        {
          filePath: 'file:///workspace/src/App.tsx',
          matches: [
            { lineNumber: 42, preview: 'const foo = 1;', matchStart: 6, matchEnd: 9 },
          ],
        },
      ],
    });
    fireEvent.press(getByText('const foo = 1;'));
    expect(onNavigate).toHaveBeenCalledWith(
      'file:///workspace/src/App.tsx', 42, 6, 9,
    );
  });

  it('shows error message when error is set', () => {
    const { getByText } = renderSearch({ error: 'Invalid regex: bad pattern' });
    expect(getByText(/Invalid regex/)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run tests — expect failures**

```bash
npx jest --watchAll=false tests/unit/GlobalSearch.test.tsx 2>&1 | tail -10
```

Expected: `Cannot find module '../../src/components/GlobalSearch'`

- [ ] **Step 3: Implement GlobalSearch.tsx**

Create `mobile-ide/mobile-ide-prototype/src/components/GlobalSearch.tsx`:

```typescript
import React from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator,
} from 'react-native';
import { useSearch } from '../hooks/useSearch';
import { useTheme } from '../theme/tokens';

export interface GlobalSearchProps {
  workspaceRoot: string;
  onNavigate: (filePath: string, lineNumber: number, matchStart: number, matchEnd: number) => void;
}

function ToggleButton({
  label, active, onPress,
}: { label: string; active: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[
        styles.toggle,
        { borderColor: active ? colors.primary : colors.border,
          backgroundColor: active ? colors.primary + '33' : 'transparent' },
      ]}
    >
      <Text style={{ color: active ? colors.primary : colors.textMuted, fontSize: 11 }}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

export function GlobalSearch({ workspaceRoot, onNavigate }: GlobalSearchProps) {
  const {
    query, setQuery, options, setOptions,
    results, isSearching, fileCount, totalMatchCount, error,
    submit, clear,
  } = useSearch(workspaceRoot);
  const { colors } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Search input row */}
      <View style={[styles.inputRow, { borderColor: colors.border }]}>
        <TextInput
          style={[styles.input, { color: colors.text }]}
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={submit}
          placeholder="Search"
          placeholderTextColor={colors.textMuted}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={clear} style={styles.clearBtn}>
            <Text style={{ color: colors.textMuted }}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Toggle buttons */}
      <View style={styles.toggleRow}>
        <ToggleButton label="Aa" active={options.caseSensitive}
          onPress={() => setOptions({ caseSensitive: !options.caseSensitive })} />
        <ToggleButton label=".*" active={options.regex}
          onPress={() => setOptions({ regex: !options.regex })} />
        <ToggleButton label="\b" active={options.wholeWord}
          onPress={() => setOptions({ wholeWord: !options.wholeWord })} />
      </View>

      {/* Glob filter */}
      <TextInput
        style={[styles.globInput, { color: colors.text, borderColor: colors.border }]}
        value={options.glob}
        onChangeText={(g) => setOptions({ glob: g })}
        placeholder="files to include (e.g. **/*.ts)"
        placeholderTextColor={colors.textMuted}
        autoCorrect={false}
        autoCapitalize="none"
      />

      {/* Status */}
      {error ? (
        <Text style={[styles.statusText, { color: colors.error }]}>{error}</Text>
      ) : isSearching ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={[styles.statusText, { color: colors.textMuted }]}>
            {' '}Searching... ({fileCount} files scanned)
          </Text>
        </View>
      ) : results.length > 0 ? (
        <Text style={[styles.statusText, { color: colors.textMuted }]}>
          {totalMatchCount} result{totalMatchCount !== 1 ? 's' : ''} in {results.length} file{results.length !== 1 ? 's' : ''}
        </Text>
      ) : null}

      {/* Results list */}
      <ScrollView style={styles.resultList} keyboardShouldPersistTaps="handled">
        {!isSearching && results.length === 0 && query.length > 0 && !error && (
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>No results found</Text>
        )}
        {results.map((fileResult) => (
          <View key={fileResult.filePath}>
            <Text
              style={[styles.filePath, { color: colors.accent }]}
              numberOfLines={1}
            >
              {fileResult.filePath}
            </Text>
            {fileResult.matches.map((match) => (
              <TouchableOpacity
                key={`${fileResult.filePath}:${match.lineNumber}`}
                onPress={() => onNavigate(fileResult.filePath, match.lineNumber, match.matchStart, match.matchEnd)}
                style={styles.matchRow}
              >
                <Text style={[styles.lineNum, { color: colors.textMuted }]}>
                  {match.lineNumber}
                </Text>
                <Text style={[styles.preview, { color: colors.text }]} numberOfLines={1}>
                  {match.preview}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  inputRow: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, paddingHorizontal: 8 },
  input: { flex: 1, height: 36, fontFamily: 'JetBrains Mono', fontSize: 13 },
  clearBtn: { padding: 6 },
  toggleRow: { flexDirection: 'row', paddingHorizontal: 8, paddingVertical: 4, gap: 4 },
  toggle: { paddingHorizontal: 6, paddingVertical: 3, borderRadius: 3, borderWidth: 1 },
  globInput: { marginHorizontal: 8, marginBottom: 4, height: 30, fontSize: 11, borderBottomWidth: 1 },
  statusText: { paddingHorizontal: 8, paddingVertical: 4, fontSize: 11 },
  loadingRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4 },
  resultList: { flex: 1 },
  emptyText: { paddingHorizontal: 12, paddingVertical: 8, fontSize: 12 },
  filePath: { paddingHorizontal: 8, paddingTop: 8, paddingBottom: 2, fontSize: 11, fontWeight: '600' },
  matchRow: { flexDirection: 'row', paddingHorizontal: 8, paddingVertical: 3, gap: 8 },
  lineNum: { fontSize: 11, width: 32, textAlign: 'right' },
  preview: { flex: 1, fontSize: 12, fontFamily: 'JetBrains Mono' },
});
```

- [ ] **Step 4: Run tests**

```bash
npx jest --watchAll=false tests/unit/GlobalSearch.test.tsx 2>&1 | tail -10
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add mobile-ide/mobile-ide-prototype/src/components/GlobalSearch.tsx \
        mobile-ide/mobile-ide-prototype/tests/unit/GlobalSearch.test.tsx
git commit -m "feat(search): add GlobalSearch component with toggles and result list"
```

---

## Task 7: FileExplorer tab bar (TDD)

**Files:**
- Modify: `mobile-ide/mobile-ide-prototype/src/components/FileExplorer.tsx`
- Modify: `mobile-ide/mobile-ide-prototype/tests/unit/FileExplorer.test.tsx`

- [ ] **Step 1: Write failing tests**

Append to `tests/unit/FileExplorer.test.tsx`:

```typescript
// ── Sidebar tab bar ────────────────────────────────────────────────────────

describe('sidebar tab bar', () => {
  it('renders Files and Search tabs', () => {
    const { getByText } = renderExplorer({
      sidebarTab: 'files',
      onSidebarTabChange: jest.fn(),
      onSearchNavigate: jest.fn(),
    });
    expect(getByText('Files')).toBeTruthy();
    expect(getByText('Search')).toBeTruthy();
  });

  it('tapping Search tab calls onSidebarTabChange with "search"', () => {
    const onSidebarTabChange = jest.fn();
    const { getByText } = renderExplorer({
      sidebarTab: 'files',
      onSidebarTabChange,
      onSearchNavigate: jest.fn(),
    });
    fireEvent.press(getByText('Search'));
    expect(onSidebarTabChange).toHaveBeenCalledWith('search');
  });

  it('tapping Files tab calls onSidebarTabChange with "files"', () => {
    const onSidebarTabChange = jest.fn();
    const { getByText } = renderExplorer({
      sidebarTab: 'search',
      onSidebarTabChange,
      onSearchNavigate: jest.fn(),
    });
    fireEvent.press(getByText('Files'));
    expect(onSidebarTabChange).toHaveBeenCalledWith('files');
  });

  it('renders file tree when sidebarTab is "files"', () => {
    const { queryByPlaceholderText } = renderExplorer({
      sidebarTab: 'files',
      onSidebarTabChange: jest.fn(),
      onSearchNavigate: jest.fn(),
    });
    // GlobalSearch input should not be present
    expect(queryByPlaceholderText('Search')).toBeNull();
  });

  it('renders GlobalSearch when sidebarTab is "search"', () => {
    const { getByPlaceholderText } = renderExplorer({
      sidebarTab: 'search',
      onSidebarTabChange: jest.fn(),
      onSearchNavigate: jest.fn(),
    });
    expect(getByPlaceholderText('Search')).toBeTruthy();
  });
});
```

Note: update `renderExplorer` in the test file to accept and pass through the three new props:
```typescript
function renderExplorer(extraProps: Partial<React.ComponentProps<typeof FileExplorer>> = {}) {
  return render(
    <FileExplorer
      workspaceUri="file:///workspace"
      onOpenFile={jest.fn()}
      sidebarTab="files"
      onSidebarTabChange={jest.fn()}
      onSearchNavigate={jest.fn()}
      {...extraProps}
    />,
  );
}
```

- [ ] **Step 2: Run tests — expect failures**

```bash
npx jest --watchAll=false tests/unit/FileExplorer.test.tsx 2>&1 | tail -10
```

Expected: new tests fail (props not yet defined on FileExplorer).

- [ ] **Step 3: Add tab bar to FileExplorer.tsx**

Open `src/components/FileExplorer.tsx`.

**3a.** Add the three new props to the `FileExplorerProps` interface:
```typescript
  sidebarTab: 'files' | 'search';
  onSidebarTabChange: (tab: 'files' | 'search') => void;
  onSearchNavigate: (filePath: string, lineNumber: number, matchStart: number, matchEnd: number) => void;
```

**3b.** Import `GlobalSearch` at the top:
```typescript
import { GlobalSearch } from './GlobalSearch';
```

**3c.** In the component's return, wrap the existing content with a tab bar. Find the root `<View>` of the component and restructure to:
```typescript
return (
  <View style={[styles.container, { backgroundColor: colors.surface }]}>
    {/* Tab bar */}
    <View style={[styles.tabBar, { borderBottomColor: colors.border }]}>
      {(['files', 'search'] as const).map((tab) => (
        <TouchableOpacity
          key={tab}
          style={[styles.tab, sidebarTab === tab && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
          onPress={() => onSidebarTabChange(tab)}
        >
          <Text style={[styles.tabLabel, { color: sidebarTab === tab ? colors.primary : colors.textMuted }]}>
            {tab === 'files' ? 'Files' : 'Search'}
          </Text>
        </TouchableOpacity>
      ))}
    </View>

    {/* Panel content */}
    {sidebarTab === 'search' ? (
      <GlobalSearch workspaceRoot={workspaceUri} onNavigate={onSearchNavigate} />
    ) : (
      /* existing file tree JSX */
      <View style={styles.treeContainer}>
        {/* ... all existing tree content ... */}
      </View>
    )}
  </View>
);
```

Add to StyleSheet:
```typescript
tabBar: { flexDirection: 'row', borderBottomWidth: 1 },
tab: { flex: 1, alignItems: 'center', paddingVertical: 8 },
tabLabel: { fontSize: 12, fontWeight: '600' },
treeContainer: { flex: 1 },
```

- [ ] **Step 4: Run all FileExplorer tests**

```bash
npx jest --watchAll=false tests/unit/FileExplorer.test.tsx 2>&1 | tail -10
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add mobile-ide/mobile-ide-prototype/src/components/FileExplorer.tsx \
        mobile-ide/mobile-ide-prototype/tests/unit/FileExplorer.test.tsx
git commit -m "feat(search): add Files/Search tab bar to FileExplorer sidebar"
```

---

## Task 8: Editor — scrollTo field in setContent (TDD)

**Files:**
- Modify: `mobile-ide/mobile-ide-prototype/src/components/Editor.tsx`
- Modify: `mobile-ide/mobile-ide-prototype/tests/unit/Editor.test.tsx`

- [ ] **Step 1: Write failing test**

Append to `tests/unit/Editor.test.tsx` in the `setContent` describe block (or add a new describe):

```typescript
describe('scrollTo in setContent', () => {
  it('includes scrollTo fields in injectJavaScript payload when tab has scrollTo', async () => {
    const { getByTestId } = renderEditor({
      tabs: [{
        path: 'file:///workspace/src/App.tsx',
        content: 'const x = 1;',
        language: 'typescript',
        isDirty: false,
        scrollTo: { line: 42, matchStart: 6, matchEnd: 9 },
      }],
      activeTabPath: 'file:///workspace/src/App.tsx',
    });
    await waitFor(() => expect(capturedInjectJS).toHaveBeenCalled());
    const lastCall = capturedInjectJS!.mock.calls[capturedInjectJS!.mock.calls.length - 1][0];
    const payload = JSON.parse(JSON.parse(lastCall.replace('window.handleMessage(', '').replace(');', '')));
    expect(payload.scrollTo).toEqual({ line: 42, matchStart: 6, matchEnd: 9 });
  });
});
```

- [ ] **Step 2: Run test — expect failure**

```bash
npx jest --watchAll=false tests/unit/Editor.test.tsx -t "scrollTo in setContent" 2>&1 | tail -10
```

Expected: test fails — `scrollTo` not in payload.

- [ ] **Step 3: Add scrollTo to EditorTab and setContent message**

Open `src/components/Editor.tsx`.

**3a.** Find the `EditorTab` interface and add:
```typescript
  scrollTo?: {
    line: number;
    matchStart: number;
    matchEnd: number;
  } | null;
```

**3b.** Find the `useEffect` that builds the `setContent` message (look for `type: 'setContent'`). Add `scrollTo` to the JSON:
```typescript
const msg = JSON.stringify({
  type: 'setContent',
  content: activeTab.content,
  language: activeTab.language,
  resetView: true,
  rules: getLanguageRules(activeTab.language),
  scrollTo: activeTab.scrollTo ?? null,   // NEW
});
```

**3c.** After sending the message, clear `scrollTo` from the tab so it doesn't re-fire on re-render. Find where `injectJavaScript` is called in the effect, and after it add:
```typescript
// Clear scrollTo after delivery so it doesn't re-trigger
if (activeTab.scrollTo) {
  onTabScrollConsumed?.(activeTab.path);
}
```

**3d.** Add the optional callback to `EditorProps`:
```typescript
  onTabScrollConsumed?: (path: string) => void;
```

- [ ] **Step 4: Run test — expect pass**

```bash
npx jest --watchAll=false tests/unit/Editor.test.tsx 2>&1 | tail -10
```

Expected: all Editor tests pass.

- [ ] **Step 5: Commit**

```bash
git add mobile-ide/mobile-ide-prototype/src/components/Editor.tsx \
        mobile-ide/mobile-ide-prototype/tests/unit/Editor.test.tsx
git commit -m "feat(search): add scrollTo field to EditorTab and embed in setContent message"
```

---

## Task 9: MonacoAssetManager — scrollToLine (TDD)

**Files:**
- Modify: `mobile-ide/mobile-ide-prototype/src/utils/MonacoAssetManager.ts`
- Modify: `mobile-ide/mobile-ide-prototype/tests/unit/MonacoAssetManager.test.ts`

- [ ] **Step 1: Write failing tests**

Append to the `buildMonacoHtml()` describe block in `tests/unit/MonacoAssetManager.test.ts`:

```typescript
it('includes scrollToLine case in the message handler', () => {
  const html = buildMonacoHtml(CDN);
  expect(html).toContain('scrollToLine');
});

it('scrollToLine handler calls revealLineInCenter', () => {
  const html = buildMonacoHtml(CDN);
  expect(html).toContain('revealLineInCenter');
});

it('scrollToLine handler calls deltaDecorations', () => {
  const html = buildMonacoHtml(CDN);
  expect(html).toContain('deltaDecorations');
});

it('scrollToLine handler sets a cleanup timeout', () => {
  const html = buildMonacoHtml(CDN);
  expect(html).toContain('setTimeout');
});

it('injects search-match-highlight CSS class', () => {
  const html = buildMonacoHtml(CDN);
  expect(html).toContain('search-match-highlight');
});

it('setContent message with scrollTo calls revealLineInCenter', () => {
  const html = buildMonacoHtml(CDN);
  // The setContent handler should reference scrollTo
  expect(html).toContain('msg.scrollTo');
});
```

- [ ] **Step 2: Run tests — expect failures**

```bash
npx jest --watchAll=false tests/unit/MonacoAssetManager.test.ts 2>&1 | tail -10
```

Expected: new tests fail.

- [ ] **Step 3: Update MonacoAssetManager.ts**

Open `src/utils/MonacoAssetManager.ts` and find `buildMonacoHtml`.

**3a.** In the `<style>` block of the HTML string, add:
```css
.search-match-highlight { background: rgba(37,99,235,0.4); border-radius: 2px; }
```

**3b.** In the `case 'setContent':` block, after the `setModelLanguage` and rules application, add:
```javascript
if (msg.scrollTo) {
  editor.revealLineInCenter(msg.scrollTo.line);
  var sdec = editor.deltaDecorations([], [{
    range: new monaco.Range(msg.scrollTo.line, msg.scrollTo.matchStart, msg.scrollTo.line, msg.scrollTo.matchEnd),
    options: { inlineClassName: 'search-match-highlight' }
  }]);
  setTimeout(function() { editor.deltaDecorations(sdec, []); }, 4000);
}
```

**3c.** After the `case 'applyLanguageRules':` block, add the standalone `scrollToLine` case before `default`:
```javascript
case 'scrollToLine': {
  if (!editor || !msg.line) break;
  editor.revealLineInCenter(msg.line);
  var dec2 = editor.deltaDecorations([], [{
    range: new monaco.Range(msg.line, msg.matchStart || 1, msg.line, msg.matchEnd || 1),
    options: { inlineClassName: 'search-match-highlight' }
  }]);
  setTimeout(function() { editor.deltaDecorations(dec2, []); }, 4000);
  break;
}
```

- [ ] **Step 4: Run tests**

```bash
npx jest --watchAll=false tests/unit/MonacoAssetManager.test.ts 2>&1 | tail -10
```

Expected: all MonacoAssetManager tests pass.

- [ ] **Step 5: Commit**

```bash
git add mobile-ide/mobile-ide-prototype/src/utils/MonacoAssetManager.ts \
        mobile-ide/mobile-ide-prototype/tests/unit/MonacoAssetManager.test.ts
git commit -m "feat(search): add scrollToLine case and search-match-highlight CSS to Monaco bundle"
```

---

## Task 10: App.tsx — wiring (TDD)

**Files:**
- Modify: `mobile-ide/mobile-ide-prototype/App.tsx`
- Modify: `mobile-ide/mobile-ide-prototype/tests/unit/App.test.tsx`

- [ ] **Step 1: Write failing tests**

Append to `tests/unit/App.test.tsx`:

```typescript
describe('global search wiring', () => {
  it('renders Files and Search tabs in sidebar', () => {
    const { getByText } = render(<App />);
    expect(getByText('Files')).toBeTruthy();
    expect(getByText('Search')).toBeTruthy();
  });

  it('"Search: Find in Files" palette command switches to Search tab', async () => {
    const { getByText, getByPlaceholderText } = render(<App />);
    // Open command palette
    fireEvent.press(getByText('⌘'));
    await waitFor(() => getByPlaceholderText(/command/i));
    // Filter and select the search command
    fireEvent.changeText(getByPlaceholderText(/command/i), 'Find in Files');
    fireEvent(getByPlaceholderText(/command/i), 'submitEditing');
    // Search panel should now be visible
    await waitFor(() => expect(getByPlaceholderText('Search')).toBeTruthy());
  });
});
```

- [ ] **Step 2: Run tests — expect failures**

```bash
npx jest --watchAll=false tests/unit/App.test.tsx -t "global search wiring" 2>&1 | tail -10
```

Expected: tests fail.

- [ ] **Step 3: Wire App.tsx**

Open `App.tsx`.

**3a.** Add `sidebarTab` state after the existing panel states:
```typescript
const [sidebarTab, setSidebarTab] = useState<'files' | 'search'>('files');
```

**3b.** Add `search-global` to the `paletteCommands` array:
```typescript
{ id: 'search-global', label: 'Search: Find in Files',
  description: 'Open global search panel', action: () => setSidebarTab('search') },
```

**3c.** Add `handleSearchNavigate` after the existing file handlers:
```typescript
const handleSearchNavigate = useCallback(async (
  filePath: string, line: number, matchStart: number, matchEnd: number,
) => {
  const existing = tabs.find(t => t.path === filePath);
  if (existing) {
    setActiveTabPath(filePath);
    editorRef.current?.injectJavaScript(
      `window.handleMessage(${JSON.stringify(JSON.stringify({ type: 'scrollToLine', line, matchStart, matchEnd }))});`
    );
  } else {
    try {
      const content = await FileSystemBridge.readFile(filePath);
      const language = getLanguageForFile(filePath);
      setTabs(prev => [...prev, {
        path: filePath, content, language, isDirty: false,
        scrollTo: { line, matchStart, matchEnd },
      }]);
      setActiveTabPath(filePath);
    } catch {
      // file unreadable — ignore
    }
  }
}, [tabs]);
```

**3d.** Add `onTabScrollConsumed` handler:
```typescript
const handleTabScrollConsumed = useCallback((path: string) => {
  setTabs(prev => prev.map(t => t.path === path ? { ...t, scrollTo: null } : t));
}, []);
```

**3e.** Pass new props to `<FileExplorer>`:
```typescript
<FileExplorer
  workspaceUri={workspaceUri}
  onOpenFile={handleOpenFile}
  sidebarTab={sidebarTab}
  onSidebarTabChange={setSidebarTab}
  onSearchNavigate={handleSearchNavigate}
/>
```

**3f.** Pass `onTabScrollConsumed` to `<Editor>`:
```typescript
<Editor
  tabs={tabs}
  activeTabPath={activeTabPath}
  onTabScrollConsumed={handleTabScrollConsumed}
  {/* ... existing props */}
/>
```

- [ ] **Step 4: Run tests**

```bash
npx jest --watchAll=false tests/unit/App.test.tsx 2>&1 | tail -10
```

Expected: all App tests pass.

- [ ] **Step 5: Commit**

```bash
git add mobile-ide/mobile-ide-prototype/App.tsx \
        mobile-ide/mobile-ide-prototype/tests/unit/App.test.tsx
git commit -m "feat(search): wire sidebarTab, handleSearchNavigate, and search-global palette command in App"
```

---

## Task 11: Full test suite + coverage + TypeScript

- [ ] **Step 1: Run full test suite with coverage**

```bash
cd mobile-ide/mobile-ide-prototype
npx jest --watchAll=false --coverage 2>&1 | tail -30
```

Expected:
- All test suites pass, 0 failures
- `searchEngine.ts`: ≥95% all metrics
- `useSearch.ts`: ≥85% all metrics
- `GlobalSearch.tsx`: ≥80% all metrics
- Global thresholds ≥80% branches/functions/lines/statements

- [ ] **Step 2: Run TypeScript check**

```bash
npx tsc --noEmit 2>&1
```

Expected: no output (zero errors).

- [ ] **Step 3: Push branch**

```bash
git push -u origin feature/EPIC-0014-global-search
```

---

## Task 12: Docs — RELEASE_PLAN, TEST_CASES, ID_REGISTRY

- [ ] **Step 1: Update RELEASE_PLAN.md**

In `docs/RELEASE_PLAN.md`:

- Change EPIC-0014 header `Status: Deferred` → `Status: In Progress`
- Add `Branch: feature/EPIC-0014-global-search`
- Mark US-0043 `Status: Deferred` → `Status: In Progress`
- Mark US-0044 `Status: Deferred` → `Status: In Progress`

- [ ] **Step 2: Add TC entries to TEST_CASES.md**

Append to `docs/TEST_CASES.md` (use IDs starting at TC-0347 per ID_REGISTRY):

```
## US-0043: Search across all project files

TC-0347: searchFiles yields nothing for empty query
Related Story: US-0043
Related AC: AC-0114
Type: Unit
Status: [x] Pass
Defect Raised: None

TC-0348: searchFiles yields matching file results
Related Story: US-0043
Related AC: AC-0114
Type: Unit
Status: [x] Pass
Defect Raised: None

TC-0349: searchFiles skips excluded directories
Related Story: US-0043
Related AC: AC-0114
Type: Unit
Status: [x] Pass
Defect Raised: None

TC-0350: searchFiles skips files larger than 4MB
Related Story: US-0043
Related AC: AC-0114
Type: Unit
Status: [x] Pass
Defect Raised: None

TC-0351: searchFiles skips unreadable files and continues
Related Story: US-0043
Related AC: AC-0114
Type: Unit
Status: [x] Pass
Defect Raised: None

TC-0352: searchFiles applies glob filter
Related Story: US-0043
Related AC: AC-0115
Type: Unit
Status: [x] Pass
Defect Raised: None

TC-0353: searchFiles stops when signal aborted
Related Story: US-0043
Related AC: AC-0114
Type: Unit
Status: [x] Pass
Defect Raised: None

TC-0354: searchFiles caps at MAX_TOTAL_MATCHES
Related Story: US-0043
Related AC: AC-0114
Type: Unit
Status: [x] Pass
Defect Raised: None

TC-0355: GlobalSearch renders search input and toggles
Related Story: US-0043
Related AC: AC-0113
Type: Unit
Status: [x] Pass
Defect Raised: None

TC-0356: GlobalSearch shows grouped results by file
Related Story: US-0043
Related AC: AC-0115
Type: Unit
Status: [x] Pass
Defect Raised: None

## US-0044: Navigate to search result

TC-0357: tapping result calls onNavigate with correct args
Related Story: US-0044
Related AC: AC-0116
Type: Unit
Status: [x] Pass
Defect Raised: None

TC-0358: MonacoAssetManager scrollToLine calls revealLineInCenter
Related Story: US-0044
Related AC: AC-0116
Type: Unit
Status: [x] Pass
Defect Raised: None

TC-0359: MonacoAssetManager scrollToLine applies deltaDecorations highlight
Related Story: US-0044
Related AC: AC-0117
Type: Unit
Status: [x] Pass
Defect Raised: None
```

- [ ] **Step 3: Update ID_REGISTRY.md**

In `docs/ID_REGISTRY.md`, update:
```
| TC | TC-0360 | TC-0359 |
```

- [ ] **Step 4: Commit docs**

```bash
git add docs/RELEASE_PLAN.md docs/TEST_CASES.md docs/ID_REGISTRY.md
git commit -m "docs(plan): update RELEASE_PLAN, TEST_CASES, and ID_REGISTRY for EPIC-0014"
```

---

## Task 13: Fix TC-0136–TC-0162 "Not Run" and regenerate plan-status

While on this branch, fix the 27 stale "Not Run" entries in `docs/TEST_CASES.md` (EPIC-0004 and EPIC-0005 tests that all pass but were never marked).

- [ ] **Step 1: Mark TC-0136–TC-0162 as Pass**

```bash
cd /Users/Kamal_Syed/Projects/NomadCode
sed -i '' 's/^Status: \[ \] Not Run$/Status: [x] Pass/' docs/TEST_CASES.md
```

Verify only the intended entries were changed:
```bash
grep -c "Not Run" docs/TEST_CASES.md
```
Expected: `0`

- [ ] **Step 2: Regenerate plan-status**

```bash
node tools/generate-plan.js
```

Expected: `docs/plan-status.html` and `docs/plan-status.json` updated. No TC-0136–TC-0162 entries showing "Not Run".

- [ ] **Step 3: Commit**

```bash
git add docs/TEST_CASES.md docs/plan-status.html docs/plan-status.json
git commit -m "docs(plan): mark TC-0136–TC-0162 as Pass and regenerate plan-status"
```

---

## Task 14: Open PR

- [ ] **Step 1: Open PR to develop**

```bash
gh pr create \
  --title "feat(EPIC-0014): global search — Find in Files" \
  --body "$(cat <<'EOF'
## Summary
- Progressive async-generator search engine with AbortController cancellation
- Left sidebar Files/Search tab bar (tab state lifted to App.tsx)
- Case sensitive, regex, whole word, and file glob filter options
- Results stream live as each file completes; capped at 1,000 matches
- Files > 4MB and excluded dirs (node_modules, .git, etc.) are skipped
- Click-to-navigate: opens file, scrolls Monaco to line, highlights match for 4s
- Command palette integration: "Search: Find in Files"

## Covers
US-0043 (AC-0113, AC-0114, AC-0115), US-0044 (AC-0116, AC-0117)

## Test plan
- [ ] All Jest tests pass, ≥80% coverage
- [ ] `npx tsc --noEmit` — zero errors
- [ ] Manual: open workspace → Search tab → query → results stream in → tap → navigates + highlights

🤖 Generated with [Claude Code](https://claude.ai/code)
EOF
)" \
  --base develop
```

---

## Verification Checklist

- [ ] `npx jest --watchAll=false --coverage` — all pass, ≥80%
- [ ] `npx tsc --noEmit` — zero errors
- [ ] Manual: Search tab opens, Enter triggers search, results group by file with line numbers
- [ ] Manual: Command palette "Find in Files" → switches to Search tab
- [ ] Manual: `**/*.ts` glob → only `.ts` results
- [ ] Manual: Regex `use[A-Z]\w+` → matches hooks
- [ ] Manual: Type query → type new query → only second query results (cancellation works)
- [ ] Manual: Tap result on existing tab → scrolls + highlights
- [ ] Manual: Tap result on new file → file opens, scrolls + highlights
- [ ] Manual: Highlight fades after ~4 seconds
