# EPIC-0020: Advanced Git Workflows — Design Spec

**Date:** 2026-04-18  
**Epic:** EPIC-0020  
**Release Target:** v1.0 GA  
**Status:** Approved — ready for implementation planning  

---

## Overview

EPIC-0020 adds five advanced git workflow features to NomadCode:

| Story | Feature | Priority |
|---|---|---|
| US-0068 | Branch create/switch UI | P0 |
| US-0069 | Merge conflict resolution | P0 |
| US-0070 | Git gutter indicators | P1 |
| US-0071 | Stash management | P1 |
| US-0072 | Git blame overlay | P2 |

---

## Navigation Model: Hybrid

Quick git actions (stage, unstage, commit, push, pull) stay in the existing **GitPanel** modal. Complex operations get a new dedicated **GitScreen** full-screen view.

**Entry points into GitScreen:**
- Status bar branch pill → GitScreen (Branches tab)
- GitPanel "More →" button → GitScreen (last active tab)
- Conflict badge on a file in the File Explorer → GitScreen (Conflicts tab)
- Editor toolbar "Blame" toggle → blame overlay (not GitScreen)

---

## New Files

```
src/components/GitScreen.tsx               — full-screen modal, 3-tab controller
src/components/git/BranchesTab.tsx         — branch list, create, switch, delete (US-0068)
src/components/git/ConflictsTab.tsx        — 2-panel conflict resolution (US-0069)
src/components/git/StashTab.tsx            — stash list, stash/pop/apply/drop (US-0071)
src/components/git/BlameDetailSheet.tsx    — compact modal: commit info + View Diff (US-0072)
src/utils/gitGutter.ts                     — diff → Monaco decoration ranges (US-0070 + US-0072)
```

## Modified Files

```
src/git/gitBridge.ts        — add stash, blame, conflict, deleteBranch methods
src/stores/useGitStore.ts   — add conflicts, stashes, blameData, gutterDecorations, activeGitTab
src/components/GitPanel.tsx — add "More →" button, conflict count badge
App.tsx                     — wire post-save hook → gitGutter → WebView postMessage
```

---

## Section 1: GitScreen (Tab Controller)

`GitScreen` is a full-screen `Modal` (React Native) with a 3-tab header: **Branches · Conflicts · Stash**.

- Tabs are rendered by `activeGitTab` in `useGitStore`
- Conflicts tab shows a red badge with count when `conflicts.length > 0`
- Opened via `useGitStore.setIsGitScreenOpen(true)` + `setActiveGitTab(tab)`
- Dismissible via back button or swipe-down gesture

---

## Section 2: BranchesTab (US-0068)

**Layout:**
- Text input + "Create" button at the top — creates and checks out the new branch
- "LOCAL BRANCHES" section — lists all local branches
  - Current branch: highlighted blue, shows ahead/behind commit counts (↑n ↓n)
  - Other branches: "Switch" and "Delete" action buttons per row
- "REMOTE BRANCHES" section — lists remote-tracking branches with "Checkout" button (creates local tracking branch)

**On phone (<768px):** GitScreen opens as a bottom sheet (slides up from bottom, 80% height).  
**On tablet (≥768px):** GitScreen opens as a centred full-screen modal.

**GitBridge method used:** `createBranch`, `checkout`, `branches`, `deleteBranch` (new)

---

## Section 3: ConflictsTab (US-0069)

**Conflict detection:** `gitBridge.getConflicts()` reads the git index via `statusMatrix` and identifies files with conflict markers (`<<<<<<< / ======= / >>>>>>>`). Parses each file into `ConflictHunk[]`.

**Layout:**
- Warning banner: "N files with conflicts — resolve all before committing"
- File list: each conflicted file shows filename + hunk count; tapping selects it for resolution
- 2-panel diff view for the selected file's active hunk:
  - Left panel: **OURS** (current branch) — blue header, green highlight on changed lines
  - Right panel: **THEIRS** (incoming) — red header, red highlight on changed lines
  - Three buttons per hunk: **Accept Ours** / **Accept Theirs** / **Accept Both**
- Progress tracker: "hunk X of N resolved" per file
- Once all hunks resolved: **"Stage File"** button appears — calls `gitBridge.add()` and clears conflict badge

**Resolution logic:** Accepting a choice replaces the conflict markers in the file with the chosen content and writes the file via `FileSystemBridge.writeFile()`.

---

## Section 4: StashTab (US-0071)

**Layout:**
- Optional message input + **"Stash"** button — stashes all unstaged modifications
- Stash list: each entry shows index (`stash@{N}`), optional message, file count, relative timestamp
- Per stash: **Pop** (apply + drop), **Apply** (apply, keep stash), **Drop** (delete without applying)
- Empty state: "No stashes — use Stash to save work in progress"

**isomorphic-git has no native stash API.** Implementation strategy:
1. **Stash:** Compute working-tree diff → write diff content to a commit object under `.git/refs/stash` as a linked list of stash commits (matching git's native stash format) → run `checkout -- .` to clean working tree.
2. **Pop/Apply:** Read stash commit diff → apply patch to working tree files → if Pop, drop the stash ref entry.
3. **Drop:** Remove the stash ref entry and rewrite the linked list.

This matches git's native stash format so stashes created in NomadCode are readable by desktop git clients.

---

## Section 5: Git Gutter (US-0070)

Git gutter decorations are always active when a repo is open. They update within 500ms of every file save.

**Data flow:**
```
File save (App.tsx)
  └→ gitBridge.getWorkingDiff(repoDir, filePath)   ← already cached, fast
  └→ gitGutter.parseDiff(diff)
       returns: { added: number[], modified: number[], deleted: number[] }
  └→ webViewRef.postMessage({ type: 'GIT_GUTTER', data })
  └→ Monaco WebView receives message
       editor.deltaDecorations([], decorations)
         added[]    → CSS class 'gutter-added'    (green left border, 3px)
         modified[] → CSS class 'gutter-modified' (amber left border, 3px)
         deleted[]  → CSS class 'gutter-deleted'  (red downward triangle via ::after pseudo)
```

**Tapping a gutter indicator** (AC-0215): The WebView sends a `GUTTER_TAP` message back to React Native with the line number. App.tsx shows a compact inline diff popup (reuses `GitDiffModal` scoped to that hunk) with a **Revert Hunk** action that reads the HEAD blob for that file via `gitBridge.getWorkingDiff` and writes the original lines back via `FileSystemBridge.writeFile()`.

---

## Section 6: Git Blame (US-0072)

Blame is an **editor overlay**, not a GitScreen tab. It is toggled via a "👤 Blame" button in the editor toolbar.

**When enabled:**
- `gitBridge.getBlame(repoDir, filePath)` returns `BlameLine[]` for the active file
- Results injected into Monaco via `postMessage({ type: 'GIT_BLAME', lines: BlameLine[] })`
- Monaco WebView renders a blame gutter column (160px wide) to the left of line numbers, showing commit hash (7 chars), author name, and relative timestamp per line
- Lines from the same commit are visually grouped (same colour, no repeated header)

**Tapping a blame annotation:** WebView sends `BLAME_TAP` with `commitHash` → App.tsx opens `BlameDetailSheet` modal showing full commit message, author, date, and "View Diff" link (opens `GitDiffModal` for that commit).

**Performance:** `getBlame` is computed once per file open while blame is on; re-runs on save. Files >2000 lines show a loading skeleton while blame computes.

---

## Section 7: useGitStore Additions

```typescript
// New state fields
conflicts: ConflictFile[]             // [] when no active merge conflict
stashes: StashEntry[]                 // populated lazily when Stash tab opens
blameData: BlameLine[] | null         // null = blame off
gutterDecorations: GutterDiff | null  // { added, modified, deleted } line number arrays
activeGitTab: 'branches' | 'conflicts' | 'stash'
isGitScreenOpen: boolean

// New actions
setConflicts(files: ConflictFile[]): void
setStashes(stashes: StashEntry[]): void
setBlameData(lines: BlameLine[] | null): void
setGutterDecorations(diff: GutterDiff | null): void
setActiveGitTab(tab): void
setIsGitScreenOpen(open: boolean): void
```

---

## Section 8: GitBridge New Methods

```typescript
// Branch
deleteBranch(repoDir: string, name: string): Promise<void>

// Conflict resolution
getConflicts(repoDir: string): Promise<ConflictFile[]>
resolveHunk(repoDir: string, filePath: string, hunkIndex: number, choice: 'ours' | 'theirs' | 'both'): Promise<void>

// Stash
stash(repoDir: string, message?: string): Promise<void>
listStashes(repoDir: string): Promise<StashEntry[]>
applyStash(repoDir: string, index: number, drop: boolean): Promise<void>
dropStash(repoDir: string, index: number): Promise<void>

// Blame
getBlame(repoDir: string, filePath: string): Promise<BlameLine[]>
```

---

## Section 9: Testing Plan

Each new module has unit tests following the existing `tests/unit/` pattern. Minimum 80% coverage.

| Test file | Coverage target |
|---|---|
| `GitScreen.test.tsx` | Tab switching, badge counts, open/close, entry point routing |
| `BranchesTab.test.tsx` | Create/switch/delete branch, ahead-behind display, remote checkout |
| `ConflictsTab.test.tsx` | Hunk rendering, accept ours/theirs/both, stage after full resolution, empty state |
| `StashTab.test.tsx` | Stash/pop/apply/drop, empty state, message input |
| `BlameDetailSheet.test.tsx` | Renders commit hash/author/date, View Diff callback |
| `gitGutter.test.ts` | diff string → `{ added, modified, deleted }` ranges |
| `gitBridge.test.ts` | Extend existing — stash linked-list, blame line parsing, conflict marker detection |

---

## Constraints & Notes

- **isomorphic-git stash:** No native API. Implement using git's stash commit format (two-parent commit: one for the index, one for the working tree) so stashes are compatible with desktop git.
- **Monaco WebView:** All editor decorations (gutter, blame) use the existing `postMessage` bridge. No new native modules required.
- **Phone layout:** GitScreen uses `Modal` with `presentationStyle="pageSheet"` on iOS (slides up) and a full-screen `Modal` on Android.
- **Conflict badge:** The File Explorer shows a `⚠` badge on conflicted files (reuses the existing file entry component — add `isConflicted` prop).
- **Ahead/behind in status bar:** Already stored in `useGitStore` but not yet displayed. BranchesTab will be the first surface to show it; the status bar pill will also be updated to show `↑n ↓n` alongside the branch name.
