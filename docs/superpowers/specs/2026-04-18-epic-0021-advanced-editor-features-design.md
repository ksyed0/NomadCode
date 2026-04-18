# EPIC-0021: Advanced Editor Features — Design Spec

**Date:** 2026-04-18  
**Status:** Approved  
**Stories:** US-0073 · US-0074 · US-0075 · US-0076 · US-0077 · US-0078  
**Release target:** v1.1  

---

## 1. Overview

Six features that close the most critical VS Code / Cursor gaps for tablet developers using NomadCode. All six ship together in one branch. No new npm packages are introduced; no new EPICs are required.

| Story | Feature | Priority |
|---|---|---|
| US-0073 | Search & Replace across files | P0 |
| US-0074 | Hardware keyboard shortcuts | P0 |
| US-0075 | Code folding | P1 |
| US-0076 | Auto-format on save (Prettier) | P1 |
| US-0077 | Breadcrumb navigation | P2 |
| US-0078 | Snippets | P2 |

---

## 2. Architecture

Six stories touch four distinct layers. No layer is introduced from scratch — all are extensions of existing patterns.

```
┌─────────────────────────────────────────────────────────────┐
│  Native Layer (new)                                          │
│  ios/KeyboardShortcuts.swift       UIKeyCommand → RCTEventEmitter │
│  android/.../com/nomadcode/mobileide/KeyboardShortcutsModule.kt  │
│  android/.../com/nomadcode/mobileide/KeyboardShortcutsPackage.kt │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│  JS Hooks & Utilities (new)                                  │
│  src/hooks/useKeyboardShortcuts.ts                          │
│  src/hooks/useReplace.ts           extends useSearch        │
│  src/utils/replaceEngine.ts        write-to-files logic     │
│  src/utils/symbolExtractor.ts      regex symbol finder      │
│  src/utils/builtinSnippets.ts      static snippet catalogue │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│  React Components (modified / new)                           │
│  src/components/GlobalSearch.tsx   + Replace tab            │
│  src/components/Breadcrumb.tsx     new tappable bar         │
│  src/components/Editor.tsx         fold state, breadcrumb,  │
│                                    format-on-save           │
│  src/components/SettingsScreen.tsx + format toggle, snippets│
│  src/components/KeyboardShortcutsSheet.tsx  new help modal  │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│  Monaco WebView Bundle  (buildMonacoHtml modifications)      │
│  + Prettier standalone + 6 language plugins (inlined)       │
│  + folding: true, showFoldingControls: 'always'             │
│  + Snippet CompletionItemProvider registration              │
│  + BREADCRUMB_UPDATE message on cursor move (debounced)     │
│  + SAVE_VIEW_STATE / RESTORE_VIEW_STATE message handlers    │
│  + FORMAT / FORMAT_COMPLETE message handlers                │
└─────────────────────────────────────────────────────────────┘
```

**Store changes:**

- `useSettingsStore` — add `formatOnSave: boolean` (default `false`), `snippets: SnippetDefinition[]` (default `[]`)
- `EditorTab` interface (`src/components/Editor.tsx`) — add `viewState?: string` (Monaco serialised view state)

---

## 3. Search & Replace (US-0073)

### UI

Tab-switched panel — `mode: 'search' | 'replace'` state at the top of `GlobalSearch`:

```
┌──────────────────────────────────────┐
│  [SEARCH]  [REPLACE]                 │
├──────────────────────────────────────┤
│  🔍 Search...          [Aa] [.*] [W] │
│  → Replace with...                   │  (replace mode only)
│    "oldName" → "newName"             │  (live regex preview)
├──────────────────────────────────────┤
│  3 files · 12 matches  [Replace All] │
│  ▾ src/App.tsx                        │
│    ☑  line 42 · oldName              │
│    ☑  line 87 · oldName              │
│  ▾ src/Editor.tsx                    │
│    ☐  line 14 · oldName              │  (unchecked = excluded)
└──────────────────────────────────────┘
```

### `useReplace.ts`

Wraps `useSearch` and adds:

```typescript
interface UseReplaceReturn extends UseSearchReturn {
  replaceQuery: string;
  setReplaceQuery: (q: string) => void;
  excludedMatches: Set<string>;        // key: `${filePath}:${line}:${start}`
  toggleExclude: (key: string) => void;
  replacePreview: string;              // live "old → new" preview string
  replaceAll: () => Promise<{ filesChanged: number; matchesReplaced: number }>;
}
```

### `replaceEngine.ts`

```typescript
async function replaceInFiles(
  results: FileSearchResult[],
  pattern: RegExp,           // from existing buildPattern()
  replacement: string,       // supports $1 capture groups via JS String.replace
  excluded: Set<string>,
  bridge: FileSystemBridge,
): Promise<{ filesChanged: number; matchesReplaced: number }>
```

Algorithm: read each file once → apply `content.replace(pattern, replacement)` with per-match position guard for excluded entries → write back via `FileSystemBridge.writeFile` only if content changed. Regex capture groups (`$1`, `$2`) are native to JS `String.replace` — no extra implementation needed.

### Acceptance criteria mapping

| AC | Satisfied by |
|---|---|
| AC-0222 Replace All writes all matching files | `replaceEngine.replaceInFiles` |
| AC-0223 Preview with per-match exclusion checkboxes | checkbox state in `useReplace.excludedMatches` |
| AC-0224 Regex capture group support + live preview | JS `String.replace` + `replacePreview` computed field |

---

## 4. Hardware Keyboard Shortcuts (US-0074)

### Native modules

**iOS — `ios/KeyboardShortcuts.swift`**

Registers `UIKeyCommand` entries on the root `UIViewController`. On activation fires `RCTEventEmitter` event `onShortcut: { key: String, modifiers: [String] }`.

**Android — `android/app/src/main/java/com/nomadcode/mobileide/KeyboardShortcutsModule.kt`**

Overrides `dispatchKeyEvent` on `MainActivity`. Detects modifier key combinations and fires the same `onShortcut` event shape. Registered via `KeyboardShortcutsPackage.kt`.

### `useKeyboardShortcuts.ts`

```typescript
interface ShortcutDefinition {
  key: string;
  modifiers: ('cmd' | 'shift' | 'alt' | 'ctrl')[];
  label: string;   // shown in help sheet
  action: () => void;
}

function useKeyboardShortcuts(shortcuts: ShortcutDefinition[]): void
```

Subscribes to native `onShortcut` event, matches against the registered list, calls the corresponding action. Cleans up subscription on unmount.

### Registered shortcuts (wired in `App.tsx`)

| Shortcut | Action | Label |
|---|---|---|
| ⌘S | Save current file | Save File |
| ⌘⇧S | Save all dirty files | Save All |
| ⌘` | Toggle terminal panel | Toggle Terminal |
| ⌘N | Create new untitled file | New File |
| ⌘P | Open Command Palette | Command Palette |
| ⌘/ | Open keyboard shortcuts sheet | Keyboard Shortcuts |

All actions are existing `useCallback` references in `App.tsx` — the hook is a pure event router.

### `KeyboardShortcutsSheet.tsx`

Bottom sheet (phone) / centered modal (tablet) listing all registered shortcuts in a two-column table. Opened via ⌘/ or the "Keyboard Shortcuts" Command Palette entry. The shortcut list is derived from the registered `ShortcutDefinition[]` array — no separate config.

### Acceptance criteria mapping

| AC | Satisfied by |
|---|---|
| AC-0225 ⌘S saves; ⌘⇧S saves all | `useKeyboardShortcuts` + existing save handlers |
| AC-0226 ⌘` opens/focuses terminal | `useKeyboardShortcuts` + existing `terminalVisible` toggle |
| AC-0227 ⌘N new file; ⌘P palette; help sheet | `useKeyboardShortcuts` + `KeyboardShortcutsSheet` |

---

## 5. Code Folding (US-0075)

### Monaco configuration

Two option changes in `buildMonacoHtml()`:

```javascript
monaco.editor.create(container, {
  folding: true,
  showFoldingControls: 'always', // 'mouseover' doesn't work on touch
});
```

Monaco detects all foldable regions (functions, classes, blocks, `// #region` comments) for all supported languages automatically.

### Command Palette actions

Two new messages via `sendToWebView`:

```typescript
{ type: 'FOLD_ALL' }   // editor.getAction('editor.foldAll').run()
{ type: 'UNFOLD_ALL' } // editor.getAction('editor.unfoldAll').run()
```

Two new Command Palette entries: `"Editor: Fold All"` and `"Editor: Unfold All"`. No toolbar buttons.

### Fold state persistence

`EditorTab` (`src/components/Editor.tsx`) gains `viewState?: string`. Tab-switch cycle:

```
Switch away  → WebView posts SAVE_VIEW_STATE { viewState: editor.saveViewState() }
             → App.tsx stores viewState in EditorTab for that tab's path

Switch back  → Editor sends SET_CONTENT (existing)
             → then sends RESTORE_VIEW_STATE { viewState } if EditorTab.viewState present
             → editor.restoreViewState(JSON.parse(viewState))
```

`editor.saveViewState()` captures cursor position, scroll offset, and folded regions in a single JSON blob.

### Acceptance criteria mapping

| AC | Satisfied by |
|---|---|
| AC-0228 Gutter chevrons for all foldable regions | `folding: true` + `showFoldingControls: 'always'` |
| AC-0229 Fold All / Unfold All in Command Palette | `FOLD_ALL` / `UNFOLD_ALL` messages |
| AC-0230 Fold state persists per tab within session | `EditorTab.viewState` + `SAVE/RESTORE_VIEW_STATE` |

---

## 6. Auto-Format on Save (US-0076)

### Prettier in the Monaco bundle

`buildMonacoHtml()` inlines Prettier standalone + six language plugins (no CDN, offline-first):

```javascript
import prettier   from 'prettier/standalone';
import pluginBabel      from 'prettier/plugins/babel';      // JS, JSX, JSON
import pluginTypescript from 'prettier/plugins/typescript'; // TS, TSX
import pluginCss        from 'prettier/plugins/postcss';    // CSS, SCSS
import pluginHtml       from 'prettier/plugins/html';       // HTML
import pluginMarkdown   from 'prettier/plugins/markdown';   // Markdown
import pluginEstree     from 'prettier/plugins/estree';     // required by babel
```

`PARSER_MAP` inside the bundle maps Monaco language IDs to Prettier parser names:

```javascript
const PARSER_MAP = {
  typescript: 'typescript', javascript: 'babel',
  css: 'css', html: 'html', markdown: 'markdown', json: 'json',
};
```

### Format flow

On `FORMAT` message (or ⌘S when `formatOnSave` is `true`):

1. `content = editor.getValue()`
2. `parser = PARSER_MAP[editor.getModel().getLanguageId()]` — skip if absent
3. `formatted = await prettier.format(content, { parser, plugins, ...projectConfig })`
4. If `formatted === content` → no-op (avoid spurious dirty flag)
5. `editor.executeEdits('prettier', [{ range: fullRange, text: formatted }])` — preserves undo history
6. Post `FORMAT_COMPLETE` to native

### Prettier config resolution (AC-0233)

On `SET_CWD`, native sends `READ_PRETTIER_CONFIG`. `App.tsx` looks for `.prettierrc`, `.prettierrc.json`, or `prettier.config.js` in the workspace root via `FileSystemBridge`. Result sent back as `PRETTIER_CONFIG { config }` and stored in WebView for all subsequent format calls. Missing config → Prettier defaults.

### Settings toggle (AC-0232)

`useSettingsStore.formatOnSave: boolean` (default `false`). Settings screen gains a "Format on Save" toggle row. `App.tsx` passes `formatOnSave` to `Editor` → included in `SET_OPTIONS` message on mount and on change. "Format Document" Command Palette entry sends `FORMAT` unconditionally regardless of toggle.

### Acceptance criteria mapping

| AC | Satisfied by |
|---|---|
| AC-0231 Prettier runs on save for JS/TS/JSON/CSS/HTML/MD | `PARSER_MAP` + `FORMAT` message handler |
| AC-0232 Format on save toggleable; Format Document always available | `formatOnSave` setting + Command Palette entry |
| AC-0233 Prettier config read from workspace root | `READ_PRETTIER_CONFIG` → `PRETTIER_CONFIG` message flow |

---

## 7. Breadcrumb Navigation (US-0077)

### `symbolExtractor.ts`

Lightweight regex extractor — runs in the WebView JS context, debounced 150ms on cursor move:

```typescript
const SYMBOL_PATTERNS: RegExp[] = [
  /^(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s+(\w+)/m,
  /^(?:export\s+)?(?:abstract\s+)?class\s+(\w+)/m,
  /^(?:export\s+)?const\s+(\w+)\s*=\s*(?:async\s+)?\(/m,
  /^def\s+(\w+)/m,       // Python
  /^fn\s+(\w+)/m,        // Rust
  /^func\s+(\w+)/m,      // Go / Swift
];

function getCurrentSymbol(content: string, cursorLine: number): string | null
// Slices content to cursor line, returns last matching symbol name, or null
```

### `Breadcrumb.tsx` — replaces existing path bar

```typescript
interface BreadcrumbProps {
  segments: string[];          // path segments from active tab path
  symbol: string | null;       // current symbol from extractor
  onSegmentPress: (index: number, parentPath: string) => void;
}
```

Renders as a horizontal scrolling `ScrollView` of tappable `Text` segments separated by ` › `. The symbol segment (if present) is shown in accent colour and is read-only (no tap). Replaces the current `editor-path-breadcrumb` `Text` element in `Editor.tsx`.

### Sibling picker

Tapping a path segment at index `i` calls `FileSystemBridge.listDirectory(parentPath)` and shows a `FlatList` dropdown anchored below the breadcrumb bar listing sibling files and directories. Tapping an entry fires `onNavigate(fullPath, 0, 0, 0)` — the same callback used by `GlobalSearch`. Picker dismisses on outside tap using the backdrop pattern from `CommandPalette`.

### Message flow

```
Cursor move in Monaco (debounced 150ms)
  → symbolExtractor.getCurrentSymbol(content, cursorLine)
  → WebView posts BREADCRUMB_UPDATE { symbol: string | null }
  → Editor.tsx setState({ symbol })
  → Breadcrumb re-renders within one animation frame (AC-0236)
```

Path segments derived from `activeTab.path` prop — no bridge message needed.

### Acceptance criteria mapping

| AC | Satisfied by |
|---|---|
| AC-0234 Breadcrumb shows path segments + current symbol | `Breadcrumb.tsx` with `segments` + `symbol` props |
| AC-0235 Tapping segment shows sibling picker + navigates | Sibling picker → `onNavigate` callback |
| AC-0236 Updates within one animation frame of cursor move | Debounced `BREADCRUMB_UPDATE` → `setState` |

---

## 8. Snippets (US-0078)

### Data model

```typescript
interface SnippetDefinition {
  prefix: string;               // trigger e.g. 'clg'
  body: string;                 // expansion with tab stops e.g. 'console.log($1)'
  description: string;          // shown in autocomplete
  language: string | 'all';     // Monaco language ID or 'all'
}
```

Stored in `useSettingsStore.snippets: SnippetDefinition[]` (default `[]`), persisted via AsyncStorage.

### Built-in snippets — `builtinSnippets.ts`

Static constant, never persisted:

| Prefix | Body | Language |
|---|---|---|
| `clg` | `console.log($1)` | all |
| `afn` | `const $1 = ($2) => {\n\t$3\n}` | javascript |
| `rfc` | React functional component scaffold | typescriptreact |
| `uef` | `useEffect(() => {\n\t$1\n}, [$2])` | all |
| `ust` | `const [$1, set$2] = useState($3)` | all |
| `def` | `def $1($2):\n\t$3` | python |
| `cls` | Python class scaffold | python |
| `ifmain` | `if __name__ == '__main__':\n\t$1` | python |
| `fn` | `fn $1($2) -> $3 {\n\t$4\n}` | rust |
| `impl` | `impl $1 {\n\t$2\n}` | rust |
| `pr` | `fmt.Println($1)` | go |
| `func` | `func $1($2) $3 {\n\t$4\n}` | go |

### Monaco registration

On `SET_OPTIONS`, the WebView receives the merged list (`builtinSnippets` + `userSnippets` filtered to current language + `'all'`). A `CompletionItemProvider` is registered per active language:

```javascript
monaco.languages.registerCompletionItemProvider(languageId, {
  provideCompletionItems: () => ({
    suggestions: snippets.map(s => ({
      label: s.prefix,
      kind: monaco.languages.CompletionItemKind.Snippet,
      documentation: s.description,
      insertText: s.body,
      insertTextRules:
        monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
    }))
  })
});
```

Monaco handles tab stop navigation (`$1`, `$2`, `${1:default}`) natively via `InsertAsSnippet`.

### Settings UI

A "Snippets" section in `SettingsScreen`:
- `FlatList` of user-defined snippets (prefix + description) with swipe-to-delete
- "Add Snippet" button → modal form (prefix, body textarea, language picker, description)
- Built-in snippets shown read-only below the user list for discoverability

### Acceptance criteria mapping

| AC | Satisfied by |
|---|---|
| AC-0237 Built-in snippets for JS/TS, Python, React | `builtinSnippets.ts` constant |
| AC-0238 User-defined snippets with tab stops in Settings | `useSettingsStore.snippets` + Settings UI |
| AC-0239 Snippets appear in Monaco autocomplete with snippet icon | `CompletionItemKind.Snippet` + `InsertAsSnippet` |

> **Note on Prettier:** `prettier` is already a dev-dependency via US-0054 (terminal bundle). We import `prettier/standalone` and its plugins into the Monaco bundle — no new package.json entry needed.

---

## 9. Testing Strategy

### Unit tests (Jest / RNTL)

| Test file | Coverage focus |
|---|---|
| `replaceEngine.test.ts` | Plain text replace, regex, capture groups, excluded matches, multi-file, unchanged files skipped |
| `symbolExtractor.test.ts` | JS function, arrow fn, class, Python def, Rust fn, Go func, cursor above any symbol → null |
| `useReplace.test.ts` | toggleExclude, replaceAll calls engine with correct args, mode switching |
| `GlobalSearch.test.tsx` | SEARCH/REPLACE tabs render, replace input hidden in search mode, checkbox toggling, Replace All fires handler |
| `Breadcrumb.test.tsx` | Renders path segments, symbol shown in accent when non-null, onSegmentPress called with correct index, sibling picker mounts/dismisses |
| `useKeyboardShortcuts.test.ts` | Correct action fires per shortcut, no-op for unregistered combos, cleanup on unmount |
| `KeyboardShortcutsSheet.test.tsx` | All registered shortcuts rendered, closes on ✕ |
| `builtinSnippets.test.ts` | All entries have prefix/body/description/language, no duplicate prefixes per language |
| `Editor.test.tsx` (extend) | SAVE_VIEW_STATE updates EditorBuffer.viewState, RESTORE_VIEW_STATE dispatched on tab switch when viewState present, FORMAT sent on save when formatOnSave=true, FORMAT not sent when formatOnSave=false |
| `SettingsScreen.test.tsx` (extend) | Format on Save toggle updates store, Snippets section renders, Add Snippet modal form fields |

### Manual smoke tests (pre-PR, added to `docs/TEST_SCRIPT_EDITOR.md`)

1. Replace "const" → "let" across a 3-file project; verify excluded matches skipped
2. ⌘S on iPad with hardware keyboard → file saves, dirty indicator clears
3. ⌘P → command palette opens; ⌘/ → shortcuts sheet opens
4. Fold All in a 200-line file → chevrons visible; switch tabs and back → fold state restored
5. Save a `.ts` file with Format on Save enabled → Prettier runs; Undo restores original
6. Type `clg` + Tab in JS file → `console.log()` expands with cursor inside parens
7. Tap a breadcrumb path segment → sibling picker shows; tap a file → navigates

---

## 10. Files Created / Modified

### New files

| Path | Purpose |
|---|---|
| `ios/KeyboardShortcuts.swift` | UIKeyCommand native module |
| `android/app/src/main/java/com/nomadcode/mobileide/KeyboardShortcutsModule.kt` | Android dispatchKeyEvent native module |
| `android/app/src/main/java/com/nomadcode/mobileide/KeyboardShortcutsPackage.kt` | RN package registration |
| `src/hooks/useKeyboardShortcuts.ts` | Unified shortcut hook |
| `src/hooks/useReplace.ts` | Replace state + replaceAll |
| `src/utils/replaceEngine.ts` | Write-to-files replace logic |
| `src/utils/symbolExtractor.ts` | Regex-based current symbol finder |
| `src/utils/builtinSnippets.ts` | Static built-in snippet catalogue |
| `src/components/Breadcrumb.tsx` | Tappable path+symbol bar |
| `src/components/KeyboardShortcutsSheet.tsx` | Shortcut help modal |
| `docs/TEST_SCRIPT_EDITOR.md` | Manual smoke test script |
| `tests/unit/replaceEngine.test.ts` | |
| `tests/unit/symbolExtractor.test.ts` | |
| `tests/unit/useReplace.test.ts` | |
| `tests/unit/Breadcrumb.test.tsx` | |
| `tests/unit/useKeyboardShortcuts.test.ts` | |
| `tests/unit/KeyboardShortcutsSheet.test.tsx` | |
| `tests/unit/builtinSnippets.test.ts` | |

### Modified files

| Path | Changes |
|---|---|
| `src/components/GlobalSearch.tsx` | + SEARCH/REPLACE tabs, replace input, checkboxes, Replace All button |
| `src/components/Editor.tsx` | + Breadcrumb bar, fold state save/restore, format-on-save trigger |
| `src/components/SettingsScreen.tsx` | + Format on Save toggle, Snippets section + Add modal |
| `src/hooks/useSearch.ts` | Minor: export `buildPattern` for use by replaceEngine |
| `src/stores/useSettingsStore.ts` | + `formatOnSave`, `snippets` fields |
| `src/components/Editor.tsx` | `EditorTab` gains `viewState?: string`; Breadcrumb replaces path bar |
| `App.tsx` | + `useKeyboardShortcuts` call with all shortcut definitions |
| `src/utils/MonacoAssetManager.ts` | + Prettier inline, fold config, snippet provider, BREADCRUMB_UPDATE, SAVE/RESTORE_VIEW_STATE, FORMAT handlers |
| `tests/unit/Editor.test.tsx` | + fold state, format-on-save tests |
| `tests/unit/GlobalSearch.test.tsx` | + replace tab, checkbox tests |
| `tests/unit/SettingsScreen.test.tsx` | + format toggle, snippets tests |
