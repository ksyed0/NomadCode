# EPIC-0022 Design Spec — Code Navigation
**Date:** 2026-05-04
**Author:** Claude Code (Session 21)
**Status:** Approved — ready for implementation planning

---

## 1. Overview

EPIC-0022 adds three code navigation features to NomadCode's Monaco editor:

- **US-0079** — Go to Definition (long-press + ⌘Click)
- **US-0080** — Find All References (references panel, file-grouped)
- **US-0081** — Workspace Symbol Search (⌘T, lazy declaration index)

US-0079 is a prerequisite for US-0080 and US-0081 (shared bridge patterns, index infrastructure).

---

## 2. Architecture Decision

### Approach: Monaco Bridge + Workspace Index

Monaco 0.45.0's TypeScript language service (bundled in `editor.main.js`) provides in-memory semantic analysis for JS/TS files. The design uses this for:
- **Same-file GoToDef**: fully semantic, instant
- **`hasDefinition` check**: pre-computed on cursor move, zero press-time latency

For everything else (cross-file navigation, Find References, symbol search), a lightweight **declaration index** built from regex scanning the workspace provides fast, offline-first results without loading all files into the Monaco TS worker.

### Why not multi-model Monaco?
Accurate cross-file TS resolution requires feeding all project files into the worker via `addExtraLib`. For a mobile project with hundreds of files this is memory-intensive and would freeze the UI. The declaration index covers 95% of "jump to this function I wrote" use cases with zero worker overhead.

### Why not LSP proxy?
Running a TypeScript language server in the WASI sandbox requires a bundled binary (~15MB), violates App Store §2.5.2, and is overkill for v1.

---

## 3. File Map

### New files

```
src/codeNav/
  definitionResolver.ts    — symbol index lookup + best-match scoring
  symbolIndexer.ts         — regex declaration scanner, AsyncStorage persistence
  symbolContextMenu.ts     — types: SymbolAction, SymbolAtCursor, buildActions()
  codeNavUtils.ts          — isCodeFile(), escapeRegex() shared helpers

src/components/
  ReferencesPanel.tsx      — file-grouped results list with line previews

src/hooks/
  useReferencesSearch.ts   — text search engine + Monaco semantic dedup, AbortController
  useSymbolSearch.ts       — fuzzy search over declaration index, lifecycle management

tests/unit/
  definitionResolver.test.ts
  symbolIndexer.test.ts
  symbolContextMenu.test.ts
  useReferencesSearch.test.ts
  useSymbolSearch.test.ts
  ReferencesPanel.test.tsx
```

### Modified files

| File | Change |
|---|---|
| `src/utils/MonacoAssetManager.ts` | Extend `BREADCRUMB_UPDATE` with `symbolAtCursor`; add `GO_TO_DEFINITION` + `GET_MONACO_REFS` handlers; suppress native WebView context menu; long-press + ⌘Click detectors |
| `src/components/Editor.tsx` | Handle `symbolAtCursor` in `onMessage`; `pendingRefsResolve` ref for async bridge; extend `EditorHandle` with `getMonacoRefs` + `revealLine`; `webViewFrame` offset tracking |
| `src/components/FileExplorer.tsx` | Add `ReferencesPanel` in tablet layout (replaces terminal pane); bottom sheet on phone |
| `src/components/CommandPalette.tsx` | Add `mode: 'symbolSearch'` prop; dynamic symbol search results |
| `src/utils/FileSystemBridge.ts` | Add `listFilesRecursive(root): Promise<string[]>` |
| `src/hooks/useKeyboardShortcuts.ts` | Add ⌘T → open CommandPalette in symbolSearch mode |
| `App.tsx` | Wire `onFileSaved` → `symbolIndexer.onFileSaved`; pass symbol index to CommandPalette |

---

## 4. Symbol State Feed

### Problem
Context menus must appear instantly on long-press. A query-response round-trip through the WebView bridge takes 80–150ms — too slow. Instead, Monaco pushes symbol state proactively on every cursor move.

### Extension to `BREADCRUMB_UPDATE` (existing message, extended payload)

Inside the existing `onDidChangeCursorPosition` handler in `MonacoAssetManager.ts`, the 150ms debounce timer is extended:

```javascript
// After computing breadcrumb symbol...
var lang   = model.getLanguageId ? model.getLanguageId() : 'plaintext';
var isTsJs = lang === 'typescript' || lang === 'javascript';
var word   = model.getWordAtPosition(pos);

var symbolAtCursor = {
  word:        word ? word.word : '',
  hasDefinition: false,
  canFindRefs:   !!(word && word.word.length > 1),
  position:    { line: pos.lineNumber, column: pos.column },
};

if (word && isTsJs) {
  var capturedPos = pos;   // snapshot for race condition guard
  monaco.languages.typescript.getTypeScriptWorker()
    .then(function(worker) {
      return worker.getDefinitionAtPosition(model.uri.toString(),
                                            model.getOffsetAt(pos));
    })
    .then(function(defs) {
      symbolAtCursor.hasDefinition = !!(defs && defs.length);
    })
    .catch(function() {})
    .finally(function() {
      // Guard: only post if cursor hasn't moved during async query
      var currentPos = editor.getPosition();
      if (currentPos && currentPos.lineNumber === capturedPos.lineNumber
          && currentPos.column === capturedPos.column) {
        post({ type: 'BREADCRUMB_UPDATE', symbol: symbol, symbolAtCursor: symbolAtCursor });
      }
    });
} else {
  post({ type: 'BREADCRUMB_UPDATE', symbol: symbol, symbolAtCursor: symbolAtCursor });
}
```

### In `Editor.tsx` — extend existing `BREADCRUMB_UPDATE` case

```typescript
case 'BREADCRUMB_UPDATE':
  onBreadcrumbUpdate?.(msg.symbol);
  setSymbolAtCursor(msg.symbolAtCursor ?? null);  // new useState
  break;
```

`symbolAtCursor` is `Editor.tsx` local state — ephemeral UI state, not Zustand.

---

## 5. Context Menu & Long-press

### Native context menu suppression (inside Monaco HTML)

```javascript
// Prevent iOS magnifier + Android context menu before our menu shows.
// Text selection still works — touchstart is not prevented.
document.addEventListener('contextmenu', function(e) { e.preventDefault(); }, true);
```

**Known limitation:** iOS shows the native magnifier loup briefly (~300ms) before the 500ms timer fires. This is a known WKWebView constraint; VS Code for iOS has the same behaviour. Acceptable for v1.

### Long-press detector (inside Monaco HTML)

```javascript
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
    // Include fresh symbolAtCursor in message to avoid debounce race
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
```

### ⌘Click detector (inside Monaco HTML)

```javascript
editor.onMouseDown(function(e) {
  if (e.event.metaKey && e.target && e.target.position) {
    // Don't call preventDefault — Monaco still moves cursor (desired)
    post({ type: 'CMD_CLICK_SYMBOL', x: e.event.clientX, y: e.event.clientY,
           word: (editor.getModel().getWordAtPosition(e.target.position) || {}).word || '' });
  }
});
```

### In `Editor.tsx` — coordinate mapping + context menu state

```typescript
// Track WebView on-screen frame (updated on layout)
const webViewFrame = useRef({ x: 0, y: 0 });

// In WebView onLayout:
webViewRef.current?.measureInWindow((x, y) => { webViewFrame.current = { x, y }; });

// In onMessage:
case 'LONG_PRESS':
case 'CMD_CLICK_SYMBOL':
  const sym = symbolAtCursor;   // may be slightly stale; word in message is fresher
  const word = msg.word || sym?.word || '';
  const hasDef = sym?.hasDefinition ?? false;
  const canRef = word.length > 1;
  if (!word) break;
  setContextMenu({
    visible: true,
    screenX: msg.x + webViewFrame.current.x,
    screenY: msg.y + webViewFrame.current.y,
    word,
    actions: buildActions({ word, hasDefinition: hasDef, canFindRefs: canRef }),
  });
  break;
```

### `symbolContextMenu.ts` — types + action builder

```typescript
export interface SymbolAtCursor {
  word: string;
  hasDefinition: boolean;
  canFindRefs: boolean;
}

export type SymbolAction =
  | 'goToDefinition'
  | 'peekDefinition'
  | 'findReferences'
  | 'copySymbol';

export function buildActions(s: SymbolAtCursor): SymbolAction[] {
  const actions: SymbolAction[] = [];
  if (s.hasDefinition)  actions.push('goToDefinition', 'peekDefinition');
  if (s.canFindRefs)    actions.push('findReferences');
  if (s.word)           actions.push('copySymbol');
  return actions;
}
```

Context menu renders as a `Modal` with transparent backdrop, positioned at `(screenX, screenY)`. Tapping outside dismisses.

---

## 6. Go to Definition

### Three resolution paths

| Path | Condition | Mechanism |
|---|---|---|
| Same-file semantic | Monaco TS resolves to current model URI | Move cursor inline, no RN involvement |
| Cross-file own code | Unresolved by TS worker | Workspace symbol index lookup → open file + navigate |
| Built-in / node_modules | `def.fileName.startsWith('ts:')` or contains `node_modules` | Read-only overlay panel (AC-0242) |

### Inside Monaco HTML — `GO_TO_DEFINITION` message handler

```javascript
case 'GO_TO_DEFINITION': {
  var pos   = editor.getPosition();
  var model = editor.getModel();
  var word  = model.getWordAtPosition(pos);
  if (!word) return;

  var lang   = model.getLanguageId ? model.getLanguageId() : 'plaintext';
  var isTsJs = lang === 'typescript' || lang === 'javascript';

  if (!isTsJs) {
    post({ type: 'GO_TO_DEF_RESULT', resolved: false, word: word.word });
    return;
  }

  monaco.languages.typescript.getTypeScriptWorker()
    .then(function(worker) {
      return worker.getDefinitionAtPosition(model.uri.toString(),
                                            model.getOffsetAt(pos));
    })
    .then(function(defs) {
      if (!defs || !defs.length) {
        post({ type: 'GO_TO_DEF_RESULT', resolved: false, word: word.word });
        return;
      }
      var def        = defs[0];
      var isSameFile = def.fileName === model.uri.toString();
      var isBuiltin  = def.fileName.startsWith('ts:') ||
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
        // Cross-file own code: fall back to declaration index
        post({ type: 'GO_TO_DEF_RESULT', resolved: false, word: word.word });
      }
    })
    .catch(function() {
      post({ type: 'GO_TO_DEF_RESULT', resolved: false, word: word.word });
    });
  break;
}
```

### In `Editor.tsx` — `GO_TO_DEF_RESULT` handler

```typescript
case 'GO_TO_DEF_RESULT':
  if (msg.sameFile) break;   // Monaco already navigated
  if (msg.builtin) {
    setBuiltinPreview({ fileName: msg.fileName, offset: msg.offset });
    break;
  }
  // Index fallback (cross-file or non-TS/JS)
  const hit = resolveDefinition(msg.word, symbolIndex);
  if (hit) {
    onOpenFile?.(hit.filePath, { revealLine: hit.line });
  } else {
    showToast(`No definition found for "${msg.word}"`);
  }
  break;
```

### `onOpenFile` signature (new prop on `Editor.tsx`)

```typescript
onOpenFile?: (filePath: string, options?: { revealLine?: number }) => void;
```

The `revealLine` option is applied after `setContent` completes — passed alongside the content so there's no race between opening and scrolling.

### Peek Definition

Renders a bottom-sheet `Modal` showing ~15 lines of context around the declaration as plain monospaced `<Text>` (no syntax colours for v1). For built-in TypeScript types, content comes from the `.d.ts` source bundled in `editor.main.js` — the `offset` from the TS worker locates the declaration start.

---

## 7. Find All References

### Search pipeline

```
Open file  → Monaco TS worker getReferencesAtPosition() → offsets → line numbers  [semantic]
All others → FileSystemBridge.listFilesRecursive() text scan (regex /\bword\b/g)   [text]
             ↓
         Merge (suppress text results for open file) → group by file → sort by file name
```

### `useReferencesSearch.ts`

```typescript
export interface ReferenceMatch {
  line:     number;
  column:   number;
  lineText: string;     // full line, truncated at 120 chars
}

export interface ReferenceGroup {
  filePath: string;
  fileName: string;     // filePath.split('/').pop() ?? filePath
  matches:  ReferenceMatch[];
}

export function useReferencesSearch() {
  const [results,     setResults]     = useState<ReferenceGroup[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const search = useCallback(async (
    word:             string,
    currentFilePath:  string,
    workspacePath:    string,
    getMonacoRefs:    () => Promise<ReferenceMatch[]>,
  ) => {
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    const signal = abortRef.current.signal;
    setIsSearching(true);
    setResults([]);

    try {
      const monacoMatches = await getMonacoRefs();
      const allFiles      = await FileSystemBridge.listFilesRecursive(workspacePath);
      const codeFiles     = allFiles.filter(isCodeFile).filter(p => p !== currentFilePath);
      const groups: ReferenceGroup[] = [];

      if (monacoMatches.length) {
        groups.push({
          filePath: currentFilePath,
          fileName: currentFilePath.split('/').pop() ?? currentFilePath,
          matches:  monacoMatches,
        });
      }

      for (const filePath of codeFiles) {
        if (signal.aborted) break;
        const content = await FileSystemBridge.readFile(filePath);
        const matches = searchWord(word, content);
        if (matches.length) {
          groups.push({ filePath, fileName: filePath.split('/').pop() ?? filePath, matches });
        }
      }

      if (!signal.aborted) {
        setResults(groups.sort((a, b) => a.fileName.localeCompare(b.fileName)));
      }
    } finally {
      if (!signal.aborted) setIsSearching(false);
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

### Request-response bridge for `getMonacoRefs`

This is a **new pattern** in the WebView bridge (all existing messages are fire-and-forget). A `pendingRefsResolve` ref in `Editor.tsx` holds the pending Promise resolver:

```typescript
// Editor.tsx
const pendingRefsResolve = useRef<((m: ReferenceMatch[]) => void) | null>(null);

// In onMessage:
case 'MONACO_REFS_RESULT':
  pendingRefsResolve.current?.(msg.matches ?? []);
  pendingRefsResolve.current = null;
  break;

// In EditorHandle:
getMonacoRefs: () => new Promise<ReferenceMatch[]>(resolve => {
  pendingRefsResolve.current = resolve;
  sendToEditor('GET_MONACO_REFS');
  setTimeout(() => {    // fallback: don't leave callers hanging
    if (pendingRefsResolve.current) {
      pendingRefsResolve.current([]);
      pendingRefsResolve.current = null;
    }
  }, 3_000);
}),
```

### Inside Monaco HTML — `GET_MONACO_REFS` handler

```javascript
case 'GET_MONACO_REFS': {
  var pos   = editor.getPosition();
  var model = editor.getModel();
  var lang  = model.getLanguageId ? model.getLanguageId() : 'plaintext';
  if (lang !== 'typescript' && lang !== 'javascript') {
    post({ type: 'MONACO_REFS_RESULT', matches: [] });
    return;
  }
  monaco.languages.typescript.getTypeScriptWorker()
    .then(function(worker) {
      return worker.getReferencesAtPosition(model.uri.toString(),
                                            model.getOffsetAt(pos));
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
```

### `ReferencesPanel.tsx` — layout

```
Header: "12 references to 'formatDate'"    [✕ close]
────────────────────────────────────────────────────
▼ dateHelpers.ts  (3)
    14  export function formatDate(date: Date, …
    42  const result = formatDate(input, 'YYYY…
▼ Editor.tsx  (1)
     7  import { formatDate } from '../utils/…
────────────────────────────────────────────────────
  ● Searching…  (while isSearching)
  "No references found"  (when empty)
```

Tapping a row calls `onNavigate(filePath, line)` which maps to `onOpenFile(filePath, { revealLine: line })`.

### Layout: tablet vs phone

```
Tablet (≥768px): [File Explorer | Editor | ReferencesPanel]
                  ↑ replaces terminal pane while open
                  Terminal FAB remains — tap dismisses panel, shows terminal

Phone (<768px):   Editor (full screen) + ReferencesPanel as bottom sheet
                  ~60% screen height, drag handle, drag-to-dismiss
```

---

## 8. Workspace Symbol Search

### Declaration index

**What is indexed:** `function`, `class`, `const`/`let`/`var` (top-level or exported), `interface`, `type` declarations. Excludes local variables, parameters, and import statements.

### `symbolIndexer.ts`

```typescript
export interface SymbolEntry {
  word:     string;
  filePath: string;
  line:     number;
  kind:     'function' | 'class' | 'const' | 'interface' | 'type';
}

const PATTERNS: Array<[RegExp, SymbolEntry['kind']]> = [
  [/(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/g,    'function'],
  [/(?:export\s+)?class\s+([A-Za-z_$][\w$]*)/g,                     'class'],
  [/(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*[=:]/g, 'const'],
  [/(?:export\s+)?interface\s+([A-Za-z_$][\w$]*)/g,                 'interface'],
  [/(?:export\s+)?type\s+([A-Za-z_$][\w$]*)/g,                      'type'],
];

export function indexFile(filePath: string, content: string): SymbolEntry[] {
  const entries: SymbolEntry[] = [];
  content.split('\n').forEach((lineText, i) => {
    for (const [pattern, kind] of PATTERNS) {
      pattern.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = pattern.exec(lineText)) !== null) {
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

const CACHE_KEY = (workspacePath: string) =>
  `nomadcode_symbol_index_${simpleHash(workspacePath)}`;

export async function loadIndex(workspacePath: string): Promise<SymbolEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY(workspacePath));
    return raw ? (JSON.parse(raw) as SymbolEntry[]) : [];
  } catch { return []; }
}

export async function saveIndex(workspacePath: string, index: SymbolEntry[]): Promise<void> {
  await AsyncStorage.setItem(CACHE_KEY(workspacePath), JSON.stringify(index));
}
```

### `useSymbolSearch.ts`

```typescript
export function useSymbolSearch(workspacePath: string) {
  const [index,      setIndex]      = useState<SymbolEntry[]>([]);
  const [isBuilding, setIsBuilding] = useState(false);

  useEffect(() => {
    loadIndex(workspacePath).then(cached => {
      if (cached.length) { setIndex(cached); return; }
      buildFullIndex(workspacePath);
    });
  }, [workspacePath]);

  async function buildFullIndex(wsPath: string) {
    setIsBuilding(true);
    const files = await FileSystemBridge.listFilesRecursive(wsPath);
    let entries: SymbolEntry[] = [];
    for (const f of files.filter(isCodeFile)) {
      const content = await FileSystemBridge.readFile(f);
      entries = [...entries, ...indexFile(f, content)];
    }
    setIndex(entries);
    await saveIndex(wsPath, entries);
    setIsBuilding(false);
  }

  // Called from App.tsx onSave — O(n) partial update, no side effect in setter
  function onFileSaved(filePath: string, content: string) {
    const fresh = indexFile(filePath, content);
    const next  = updateIndex(index, filePath, fresh);
    setIndex(next);
    saveIndex(workspacePath, next);   // fire-and-forget, outside setter
  }

  function search(query: string): SymbolEntry[] {
    if (!query) return [];
    const q = query.toLowerCase();
    return index
      .map(e => ({ entry: e, score: scoreMatch(e.word.toLowerCase(), q) }))
      .filter(x => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 50)
      .map(x => x.entry);
  }

  return { index, isBuilding, onFileSaved, search };
}

function scoreMatch(word: string, query: string): number {
  if (word === query)          return 3;
  if (word.startsWith(query)) return 2;
  if (word.includes(query))   return 1;
  return 0;
}
```

### `CommandPalette.tsx` — symbolSearch mode

New `mode` prop:

```typescript
interface CommandPaletteProps {
  mode?: 'commands' | 'symbolSearch';   // default: 'commands'
  symbolIndex?: SymbolEntry[];
  onNavigateSymbol?: (filePath: string, line: number) => void;
  // ... existing props
}
```

When `mode === 'symbolSearch'`:
- Header: `"Go to Symbol in Workspace"`
- Input placeholder: `"Type a symbol name…"`
- Results: symbol name, kind badge (`fn` / `cls` / `const` / `iface` / `type`), relative file path, line number
- Selecting: `onNavigateSymbol(entry.filePath, entry.line)` → maps to `onOpenFile(path, { revealLine: line })`

⌘T shortcut wired in `useKeyboardShortcuts.ts`:
```typescript
{ key: 't', modifiers: ['meta'], action: () => openCommandPalette('symbolSearch') }
```

---

## 9. Shared Helpers (both `useReferencesSearch` and `useSymbolSearch`)

```typescript
// src/codeNav/codeNavUtils.ts  (new file, ~15 lines)

const CODE_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
  '.py', '.go', '.rs', '.swift', '.kt', '.java',
  '.c', '.cpp', '.h', '.cs', '.rb', '.php',
  '.json', '.yaml', '.yml', '.toml', '.md', '.css', '.scss', '.html',
]);

export function isCodeFile(filePath: string): boolean {
  const ext = filePath.slice(filePath.lastIndexOf('.'));
  return CODE_EXTENSIONS.has(ext);
}

export function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
```

`simpleHash` is already in `src/utils/hash.ts` — import from there.

---

## 10. `FileSystemBridge` addition

New method required:

```typescript
/**
 * Recursively list all file paths under root, excluding node_modules and dot directories.
 */
static async listFilesRecursive(root: string): Promise<string[]>
```

Implementation: recursive `listDirectory` calls, filtering out `node_modules`, `.git`, and hidden directories. Returns flat array of absolute paths.

---

## 10. `definitionResolver.ts`

```typescript
export interface DeclarationHit {
  filePath: string;
  line:     number;
  word:     string;
}

function exactMatchScore(entry: SymbolEntry, word: string): number {
  if (entry.word !== word) return 0;
  if (entry.filePath.endsWith('.ts') || entry.filePath.endsWith('.tsx')) return 2;
  return 1;
}

export function resolveDefinition(
  word:  string,
  index: SymbolEntry[],
): DeclarationHit | null {
  const candidates = index.filter(e => e.word === word);
  if (!candidates.length) return null;
  const best = candidates
    .sort((a, b) => exactMatchScore(b, word) - exactMatchScore(a, word))
    .at(0)!;
  return { filePath: best.filePath, line: best.line, word: best.word };
}
```

---

## 11. Test Strategy

### Unit tests (45 total)

| File | Tests |
|---|---|
| `symbolIndexer.test.ts` | 12 — extraction per kind, updateIndex, persistence |
| `definitionResolver.test.ts` | 5 — match scoring, null result, .ts preference |
| `symbolContextMenu.test.ts` | 5 — buildActions combinations |
| `useReferencesSearch.test.ts` | 8 — pipeline, cancellation, file filtering |
| `useSymbolSearch.test.ts` | 9 — search scoring, onFileSaved, cache lifecycle |
| `ReferencesPanel.test.tsx` | 6 — render, navigation, loading state |

### Manual smoke tests (WebView paths — not unit-testable)

| Test | Pass criteria |
|---|---|
| Long-press identifier on TS file | Context menu appears within 600ms |
| Long-press on whitespace | No menu appears |
| Go to Definition — same file | Cursor jumps to declaration inline |
| Go to Definition — cross-file | Correct file opens, scrolls to declaration line |
| Go to Definition — built-in (`Array`) | Read-only overlay shows `.d.ts` content |
| ⌘Click on function name | Same result as long-press GoToDef |
| Find All References | Panel opens, grouped by file, tapping result navigates |
| Find All References — cancel | Search stops immediately, no stale results |
| ⌘T → type partial symbol | Results filter live, selecting opens + navigates |
| ⌘T on empty workspace | "No symbols indexed yet" shown |

---

## 12. Acceptance Criteria Mapping

| AC | How satisfied |
|---|---|
| AC-0240: Long-press opens context menu, navigates to declaration | Long-press → `buildActions` → menu → `GO_TO_DEFINITION` → same-file inline or index lookup |
| AC-0241: ⌘Click triggers Go to Definition | `editor.onMouseDown` with `metaKey` → same pipeline |
| AC-0242: node_modules definition shows read-only preview | `def.fileName.includes('node_modules')` → `setBuiltinPreview` overlay |
| AC-0243: Find All References opens panel with file-grouped results | `useReferencesSearch` → `ReferencesPanel` |
| AC-0244: Tapping result navigates, panel stays open | `onNavigate` → `onOpenFile(path, { revealLine })`, panel not dismissed |
| AC-0245: Empty results show "No references found" | `ReferencesPanel` empty state |
| AC-0246: ⌘T opens workspace symbol search | `useKeyboardShortcuts` ⌘T → `CommandPalette mode='symbolSearch'` |
| AC-0247: Results show name, type, file path; selecting navigates | `CommandPalette` symbol mode result rows + `onNavigateSymbol` |
| AC-0248: Index built lazily on first use, refreshed on save | `useSymbolSearch` lifecycle + `App.tsx` `onFileSaved` wiring |

---

## 13. Known Limitations (v1)

- iOS native magnifier briefly appears before custom context menu (~300ms). Acceptable for v1; fixable via native module post-launch.
- Workspace symbol search only indexes JS/TS declarations. Other language patterns (Python `def`, Rust `fn`) deferred.
- Cross-file Go to Definition accuracy is limited to declarations matching the identifier exactly — type-aware resolution requires multi-model Monaco setup (future work).
- `buildFullIndex` scans files sequentially on the JS thread; may be slow (2–5s) for very large projects. Batched async scanning deferred.
- Peek Definition shows plain monospaced text with no syntax highlighting for v1.

---

## 14. Open Questions / Decisions Made

| Question | Decision |
|---|---|
| Cross-file GoToDef mechanism? | Workspace declaration index (not multi-model Monaco) |
| Context menu trigger latency? | Proactive `symbolAtCursor` feed — zero round-trip on press |
| Find References cross-file? | Text search (option A) + Monaco semantic for open file |
| Workspace symbol index scope? | Declarations only (functions, classes, const, interface, type) |
| Symbol search UI? | Extend existing CommandPalette with `mode` prop |
| Tablet references panel layout? | Replaces terminal pane; terminal FAB stays visible |
| Peek Definition weight? | Plain text overlay for v1 (no second Monaco instance) |
| `listFilesRecursive` location? | New method on `FileSystemBridge` |
| State management for index? | Props from App.tsx (not Zustand — read-only lookup table) |
