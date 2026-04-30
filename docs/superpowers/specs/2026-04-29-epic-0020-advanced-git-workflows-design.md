# Design Spec: EPIC-0020 — Advanced Git Workflows

**Date:** 2026-04-29
**Branch:** `feature/epic-0020-advanced-git-workflows`
**Epic:** EPIC-0020
**Stories:** US-0068, US-0069, US-0070, US-0071, US-0072
**Dependencies:** EPIC-0008 (isomorphic-git bridge, done)

---

## Overview

Five stories completing professional git workflow on mobile:

| Story | Feature | Priority |
|---|---|---|
| US-0068 | Branch create/switch — bottom sheet picker | P0 |
| US-0069 | Merge conflict resolution — inline hunk editor | P0 |
| US-0070 | Git gutter indicators in Monaco | P1 |
| US-0071 | Stash management (soft stash via AsyncStorage) | P1 |
| US-0072 | Git blame annotations | P2 |

---

## Architecture Diagram

```
App.tsx
├── BranchPickerSheet          (US-0068) — modal overlay
├── GitPanel
│   ├── → BranchPickerSheet    (US-0068) — opened via "Switch Branch" button
│   ├── ConflictEditor         (US-0069) — full-screen modal per conflict file
│   └── Stash section          (US-0071) — "Stash Changes" + stash list
├── Editor
│   ├── Gutter decorations     (US-0070) — refreshed on save
│   └── Blame decorations      (US-0072) — toggled via toolbar
└── FileExplorer
    └── Conflict badge         (US-0069) — ⚡ on conflicted files

src/git/
├── gitBridge.ts               (US-0068 checkout, US-0069 hasConflicts+stage,
│                                US-0070 readHeadFile, US-0072 blame)
├── conflictParser.ts          (US-0069) — pure parse + apply
├── gutterDiff.ts              (US-0070) — pure line diff
└── stashStore.ts              (US-0071) — AsyncStorage-backed stash

src/utils/MonacoAssetManager.ts
└── SET_GUTTER_DECORATIONS     (US-0070)
    CLEAR_GUTTER_DECORATIONS   (US-0070)
    SET_BLAME_DECORATIONS      (US-0072)
    CLEAR_BLAME_DECORATIONS    (US-0072)
```

---

## US-0068 — Branch Create/Switch UI

### Design Decision
Bottom sheet (Option B): tablet → centred `Modal` (480px wide), phone → full-width anchored to bottom. Consistent with `GitCloneModal`/`GitDiffModal` pattern. Matches AC-0208 ("bottom sheet on phone, sidebar section on tablet").

### New Component: `src/components/BranchPickerSheet.tsx`

**Props:**
```ts
interface BranchPickerSheetProps {
  visible: boolean;
  onClose: () => void;
  currentBranch: string;
  repoDir: string;
  onBranchSelected: (branch: string) => void;
}
```

**Behaviour:**
- On `visible` → true: calls `GitBridge.branches(repoDir)`, splits into local vs `origin/*` remote
- Search `TextInput` filters both lists case-insensitively
- `SectionList` with LOCAL / REMOTE section headers
- Tapping a branch row: calls `GitBridge.checkout(repoDir, branch)` → `onBranchSelected(branch)` → `onClose()`
- Active branch row highlighted with accent colour + `✓` prefix
- "New branch" row at bottom: expands inline `TextInput` + "Create" button → `GitBridge.createBranch(repoDir, name, true)` → `onBranchSelected(name)` → `onClose()`
- Loading spinner during checkout; error `Alert` on failure
- Tablet: `Modal` with `maxWidth: 480`, `alignSelf: 'center'`, `borderRadius: 12`. Phone: `justifyContent: 'flex-end'`, `borderRadius: 12 12 0 0`

**Changes to `GitPanel.tsx`:**
- Remove inline "Branches" section (TextInput + branch rows)
- Add `[branchPickerVisible, setBranchPickerVisible]` state
- "Switch Branch" button opens the sheet
- `BranchPickerSheet` rendered outside the `ScrollView`

**Changes to `App.tsx`:**
- Status bar branch chip (`<Text>`) → `<Pressable>` setting `branchPickerVisible: true`
- `BranchPickerSheet` rendered at root level
- On `onBranchSelected`: refresh git status

### Acceptance Criteria Coverage
- **AC-0207** — "New Branch" action in picker, creates via `isomorphic-git` ✓
- **AC-0208** — Bottom sheet (phone) / centred modal (tablet) ✓
- **AC-0209** — Branch name in status bar updates immediately after switch ✓

### Testing
`tests/unit/BranchPickerSheet.test.tsx`:
- Renders with mock branch list (local + remote sections)
- Search input filters correctly
- Tap local branch → `GitBridge.checkout` called, `onBranchSelected` fired
- New branch flow: expand input, type name, press Create → `GitBridge.createBranch` called
- Checkout failure → `Alert` shown
- Width ≥ 768 → centred modal layout; width < 768 → bottom-anchored layout

---

## US-0069 — Merge Conflict Resolution

### Design Decision
Inline conflict hunks (Option C): file renders normally; conflict markers replaced by two stacked coloured blocks (OURS / THEIRS) with per-hunk Accept buttons. Works at all screen sizes. No base panel (rarely needed in practice).

### New Utility: `src/git/conflictParser.ts`

```ts
export interface ConflictHunk {
  pre: string[];       // lines before <<<<<<< marker
  ours: string[];      // lines between <<<<<<< and =======
  theirs: string[];    // lines between ======= and >>>>>>>
  choice: 'ours' | 'theirs' | 'both' | null;
}

export interface ConflictFile {
  hasConflicts: boolean;
  hunks: ConflictHunk[];
}

export function parseConflicts(content: string): ConflictFile
export function applyResolution(file: ConflictFile): string
```

`parseConflicts` splits on `<<<<<<<`, `=======`, `>>>>>>>` markers. The `pre` of each hunk includes all lines since the previous hunk's `>>>>>>>`. `applyResolution` joins: pre-lines + (ours lines if choice is 'ours' or 'both') + (theirs lines if choice is 'theirs' or 'both').

### New Component: `src/components/ConflictEditor.tsx`

**Props:**
```ts
interface ConflictEditorProps {
  filePath: string;
  repoDir: string;
  onResolved: () => void;
  onClose: () => void;
}
```

**Behaviour:**
- Reads file via `FileSystemBridge.readFile(filePath)`, parses with `parseConflicts()`
- `ScrollView` rendering:
  - Normal lines: plain `<Text>` in monospace, themed colour
  - Conflict hunk: two stacked `<View>` blocks:
    - OURS: teal-tinted background (`t.bgHighlight`), teal label, ours lines
    - THEIRS: amber-tinted background (`#78350F22`), amber label, theirs lines
  - Accept row below each hunk: "Ours" | "Theirs" | "Both" buttons (44pt touch targets)
  - Accepted hunks: chosen content only, ✓ badge, muted styling
- Header: filename, conflict count (`2 of 5 unresolved`), Prev/Next navigation
- Footer: "Mark Resolved & Stage" button (enabled only when all hunks resolved)
  - Calls `applyResolution()` → `FileSystemBridge.writeFile()` → `GitBridge.stage(repoDir, filePath)` → `onResolved()`
- Rendered as full-screen `Modal` from `GitPanel`

**Changes to `gitBridge.ts`:**
```ts
async hasConflicts(dir: string, filepath: string): Promise<boolean>
// Reads file content, returns true if '<<<<<<< ' marker present
```

**Changes to `GitPanel.tsx`:**
- After loading git status, call `hasConflicts` for each modified file
- Conflicted files show `⚡` conflict badge (amber) in the file row
- Tapping a conflicted file opens `ConflictEditor` modal
- On `onResolved`: refresh git status, clear conflict badge

**Changes to `FileExplorer.tsx`:**
- Accept optional `conflictedPaths?: Set<string>` prop and `onOpenConflict?: (filePath: string) => void` prop
- Files in this set show an amber `⚡` badge alongside the file type badge
- Tapping a conflicted file calls `onOpenConflict(filePath)` instead of `onFileOpen` — `App.tsx` wires this to open `ConflictEditor` (AC-0210 requires tapping opens the resolution view)

### Acceptance Criteria Coverage
- **AC-0210** — Conflict badge in FileExplorer; tapping opens ConflictEditor via `onOpenConflict` ✓
- **AC-0211** — Accept Ours / Accept Theirs / Accept Both per hunk ✓
- **AC-0212** — "Mark Resolved & Stage" when all resolved; badge clears ✓

### Testing
`tests/unit/conflictParser.test.ts` (20+ cases):
- Single conflict, multiple conflicts, no conflicts
- Accept Ours produces ours lines only
- Accept Theirs produces theirs lines only
- Accept Both produces ours + theirs concatenated
- Pre-hunk context lines preserved
- Trailing lines after last hunk preserved

`tests/unit/ConflictEditor.test.tsx`:
- Renders OURS/THEIRS blocks for each hunk
- Tapping "Ours" sets choice, re-renders accepted state
- "Mark Resolved & Stage" disabled until all hunks resolved
- On stage success: `onResolved` called

---

## US-0070 — Git Gutter Indicators

### New Utility: `src/git/gutterDiff.ts`

```ts
export type GutterType = 'added' | 'modified' | 'deleted';
export interface GutterLine { lineNumber: number; type: GutterType; }

export function computeGutterLines(
  headContent: string,
  workingContent: string
): GutterLine[]
```

Uses a line-level Myers diff. `added` = line present in working, absent in HEAD. `modified` = line changed. `deleted` = synthetic entry at the line where deletion occurred (for the gutter triangle). Returns empty array if contents are identical.

**Changes to `gitBridge.ts`:**
```ts
async readHeadFile(dir: string, filepath: string): Promise<string | null>
// Uses resolveRef('HEAD') + readBlob(oid, filepath). Returns null for untracked files.
```

**Changes to `src/utils/MonacoAssetManager.ts`:**

New message handlers:
- `SET_GUTTER_DECORATIONS`: receives `GutterLine[]`, converts to `IModelDeltaDecoration[]`
  - `added` → `glyphMarginClassName: 'gutter-added'` (green `▌` left bar via CSS)
  - `modified` → `glyphMarginClassName: 'gutter-modified'` (amber `▌`)
  - `deleted` → `afterContentClassName: 'gutter-deleted'` (red `▾` triangle)
  - Applied via `editor.deltaDecorations(prevDecorationIds, newDecorations)` — stores returned IDs for next replace
- `CLEAR_GUTTER_DECORATIONS`: calls `editor.deltaDecorations(prevDecorationIds, [])`

CSS injected into Monaco HTML:
```css
.gutter-added { background: #22C55E; width: 3px !important; margin-left: 3px; }
.gutter-modified { background: #D97706; width: 3px !important; margin-left: 3px; }
.gutter-deleted::after { content: '▾'; color: #EF4444; font-size: 10px; }
```

**Changes to `Editor.tsx`:**
Adds `setGutterDecorations(lines: GutterLine[])` to `EditorHandle` via `useImperativeHandle`. Sends `SET_GUTTER_DECORATIONS` message to Monaco WebView.

**Changes to `App.tsx`:**
After a successful `onSave(filePath, content)`, if `gitStatus?.repoDir` is set:
1. Compute `relativePath` by stripping `repoDir + '/'` prefix from `filePath` (same pattern used in `getWorkingDiff`)
2. `GitBridge.readHeadFile(repoDir, relativePath)` (fire-and-forget, no await blocking save)
3. If null → `editorRef.current?.setGutterDecorations([])` (clear for untracked)
4. If string → `computeGutterLines(headContent, content)` → `setGutterDecorations(lines)`

### Acceptance Criteria Coverage
- **AC-0213** — Added (green), modified (amber), deleted (red triangle) gutter marks ✓
- **AC-0214** — Updates within 500ms of save (fire-and-forget after save completes) ✓
- **AC-0215** — Tapping gutter indicator: deferred to follow-up (inline diff popup requires Monaco touch event bridge, out of scope for this session)

> **Note on AC-0215:** The inline diff popup on gutter tap requires wiring Monaco's `onMouseDown` event through the WebView bridge — non-trivial and lower value than the other stories. Marking AC-0215 as deferred; the gutter visual indicator (AC-0213/0214) ships in this epic.

### Testing
`tests/unit/gutterDiff.test.ts`:
- Added lines, modified lines, deleted lines, mixed, no diff, empty files

Updated `tests/unit/MonacoAssetManager.test.ts`:
- `SET_GUTTER_DECORATIONS` message triggers `deltaDecorations` with correct class names
- `CLEAR_GUTTER_DECORATIONS` triggers `deltaDecorations(prevIds, [])`

---

## US-0071 — Stash Management

### Constraint
isomorphic-git has no native `git stash` command. NomadCode implements a **soft stash** in AsyncStorage — functionally equivalent for mobile use (stash within a session) but not compatible with native `git stash` format. UI labels the feature "Stash" without implying git-native format.

### New File: `src/git/stashStore.ts`

```ts
export interface StashEntry {
  id: string;           // uuid
  repoDir: string;
  message: string;
  timestamp: number;
  files: { path: string; content: string }[];
}

export async function stash(repoDir: string, message?: string): Promise<void>
// 1. Get list of modified (unstaged) files from GitBridge.status()
// 2. Read each file's current content via FileSystemBridge.readFile()
// 3. Restore each file to HEAD content via GitBridge.readHeadFile() + FileSystemBridge.writeFile()
// 4. Save StashEntry to AsyncStorage key `nomadcode_stash_${repoDir}`
// Untracked files (no HEAD version) are excluded with a console.warn

export async function stashList(repoDir: string): Promise<StashEntry[]>
// Returns entries for this repoDir, sorted newest-first

export async function stashPop(repoDir: string, id: string): Promise<void>
// Applies entry (writes files) + removes from AsyncStorage

export async function stashApply(repoDir: string, id: string): Promise<void>
// Applies entry (writes files), keeps in AsyncStorage
```

**Changes to `GitPanel.tsx`:**

New "Stash" section below the commit message area:
- "Stash Changes" button: disabled if no modified unstaged files; tapping opens an inline `TextInput` row for an optional message + a "Confirm Stash" button (avoids `Alert.prompt` which is iOS-only); refreshes status on success
- Stash list: shows entries with relative timestamp and message; each row has "Pop" and "Apply" action buttons
- Error Alert on stash/pop/apply failure

### Acceptance Criteria Coverage
- **AC-0216** — "Stash Changes" stashes all unstaged modifications ✓
- **AC-0217** — Stash list with Pop + Apply per entry ✓
- **AC-0218** — Pop/Apply updates working tree + refreshes gutter indicators ✓

### Testing
`tests/unit/stashStore.test.ts`:
- `stash()` saves file contents to AsyncStorage
- `stash()` reverts files to HEAD content
- Untracked files excluded from stash
- `stashPop()` restores files + removes entry
- `stashApply()` restores files + keeps entry
- `stashList()` returns newest-first, filtered by repoDir
- Empty stash list returns `[]`

---

## US-0072 — Git Blame Annotations

### New Method in `gitBridge.ts`

```ts
export interface BlameLine {
  lineNumber: number;
  commitHash: string;     // short (7 chars)
  author: string;
  timestamp: number;      // unix ms
  message: string;        // first line only
}

async blame(dir: string, filepath: string): Promise<BlameLine[]>
```

**Algorithm:**
1. `git.log({ filepath })` → ordered commit list for this file
2. For each consecutive commit pair (newer, older): read both blobs, run line diff
3. Build `lineBlame: Map<number, Commit>` — each line mapped to the most recent commit that touched it
4. Lines unchanged since first commit get the oldest commit
5. Timeout guard: abort after 2 seconds, return partial result with a `console.warn`

Performance note: acceptable for typical mobile use (<500 lines, <100 commits). Large files will be slow; the loading indicator communicates this.

**Changes to `src/utils/MonacoAssetManager.ts`:**

New message handlers:
- `SET_BLAME_DECORATIONS`: receives `BlameLine[]`. For each line, sets a `after` inline decoration:
  ```
  ⬤ a3f9c2 · Kamal · 3 days ago
  ```
  Styled with `textMuted` colour, monospace font, right-aligned via `margin-left: auto`. Uses `editor.deltaDecorations`.
- `CLEAR_BLAME_DECORATIONS`: removes all blame decorations.

**Changes to `Editor.tsx`:**
- New `toggleBlame()` method on `EditorHandle`
- Internal `blameActive: boolean` ref tracks toggle state
- First call: fire `GitBridge.blame()` (async), show loading spinner in toolbar, on resolve → `SET_BLAME_DECORATIONS`
- Second call: `CLEAR_BLAME_DECORATIONS`, clear spinner
- Blame data cached in `useRef` until file changes (tab switch clears it)

**Changes to `App.tsx`:**
- "Toggle Blame" toolbar button (annotate icon), visible only when git repo detected + file open
- Calls `editorRef.current?.toggleBlame()`

### Acceptance Criteria Coverage
- **AC-0219** — "Toggle Blame" overlays commit hash, author, timestamp per line ✓
- **AC-0220** — Tapping annotation: deferred (requires touch event on Monaco decoration — same complexity as AC-0215 gutter tap). Visual overlay ships; tap-to-detail deferred.
- **AC-0221** — Blame loads async; loading skeleton (spinner in toolbar) while computing ✓

> **Note on AC-0220:** Opening a detail sheet from tapping a blame inline decoration requires wiring Monaco's decoration click events through the WebView bridge, same as AC-0215. Deferred to a follow-up alongside the gutter tap detail.

### Testing
`tests/unit/gitBridge.blame.test.ts`:
- Mock `git.log` + `readBlob` for a 3-line file with 2 commits
- Verify each line maps to the correct most-recent commit
- Unchanged lines map to oldest commit

Updated `tests/unit/MonacoAssetManager.test.ts`:
- `SET_BLAME_DECORATIONS` produces correct `after` decoration text format
- `CLEAR_BLAME_DECORATIONS` removes decorations

---

## File Change Manifest

| File | Change | Stories |
|---|---|---|
| `src/components/BranchPickerSheet.tsx` | **NEW** | US-0068 |
| `src/components/ConflictEditor.tsx` | **NEW** | US-0069 |
| `src/git/conflictParser.ts` | **NEW** | US-0069 |
| `src/git/gutterDiff.ts` | **NEW** | US-0070 |
| `src/git/stashStore.ts` | **NEW** | US-0071 |
| `src/git/gitBridge.ts` | `hasConflicts`, `readHeadFile`, `blame` methods | US-0069/0070/0072 |
| `src/utils/MonacoAssetManager.ts` | Gutter + blame message handlers + CSS | US-0070/0072 |
| `src/components/GitPanel.tsx` | Remove inline branch section; add stash section; conflict badges | US-0068/0069/0071 |
| `src/components/FileExplorer.tsx` | `conflictedPaths` prop + conflict badge | US-0069 |
| `src/components/Editor.tsx` | `setGutterDecorations`, `toggleBlame` on `EditorHandle` | US-0070/0072 |
| `App.tsx` | Branch chip → Pressable; gutter refresh on save; blame button | US-0068/0070/0072 |
| `tests/unit/BranchPickerSheet.test.tsx` | **NEW** | US-0068 |
| `tests/unit/conflictParser.test.ts` | **NEW** | US-0069 |
| `tests/unit/ConflictEditor.test.tsx` | **NEW** | US-0069 |
| `tests/unit/gutterDiff.test.ts` | **NEW** | US-0070 |
| `tests/unit/stashStore.test.ts` | **NEW** | US-0071 |
| `tests/unit/gitBridge.blame.test.ts` | **NEW** | US-0072 |
| `tests/unit/GitPanel.test.tsx` | Update for branch picker + stash + conflict rows | US-0068/0069/0071 |
| `tests/unit/MonacoAssetManager.test.ts` | Gutter + blame message handler tests | US-0070/0072 |

---

## Deferred Items

| AC | Reason |
|---|---|
| AC-0215 (gutter tap → inline diff popup) | Requires Monaco `onMouseDown` WebView bridge — follow-up |
| AC-0220 (blame tap → detail sheet) | Same WebView touch bridge requirement — follow-up |
