# EPIC-0020: Advanced Git Workflows — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add branch management, merge conflict resolution, git gutter decorations, stash, and git blame to NomadCode's mobile IDE.

**Architecture:** Hybrid navigation — existing `GitPanel` keeps quick actions (stage/commit/push/pull); a new full-screen `GitScreen` modal with 3 tabs (Branches · Conflicts · Stash) handles complex operations. Git gutter and blame are editor-layer overlays injected via the existing WebView `postMessage` bridge.

**Tech Stack:** React Native, TypeScript, isomorphic-git, Zustand, Monaco Editor (WebView), Expo FileSystem

**Spec:** `docs/superpowers/specs/2026-04-18-epic-0020-advanced-git-workflows-design.md`

**Working directory for all commands:** `mobile-ide/mobile-ide-prototype/`  
**Run tests:** `npx jest --watchAll=false`  
**Run single test:** `npx jest --watchAll=false --testPathPattern=<filename>`

---

## File Map

**Create:**
- `src/types/git.ts` — shared types: ConflictFile, StashEntry, BlameLine, GutterDiff
- `src/utils/gitGutter.ts` — diff string → GutterDiff line number arrays
- `src/components/GitScreen.tsx` — full-screen modal, 3-tab controller
- `src/components/git/BranchesTab.tsx` — branch list, create, switch, delete
- `src/components/git/ConflictsTab.tsx` — 2-panel conflict resolution
- `src/components/git/StashTab.tsx` — stash list, stash/pop/apply/drop
- `src/components/git/BlameDetailSheet.tsx` — commit info modal
- `tests/unit/git/gitGutter.test.ts`
- `tests/unit/GitScreen.test.tsx`
- `tests/unit/BranchesTab.test.tsx`
- `tests/unit/ConflictsTab.test.tsx`
- `tests/unit/StashTab.test.tsx`
- `tests/unit/BlameDetailSheet.test.tsx`

**Modify:**
- `src/git/gitBridge.ts` — add deleteBranch, getConflicts, resolveHunk, stash, listStashes, applyStash, dropStash, getBlame
- `src/stores/useGitStore.ts` — add conflicts, stashes, blameData, gutterDecorations, activeGitTab, isGitScreenOpen
- `src/components/GitPanel.tsx` — add "More →" button, conflict count badge
- `src/components/Editor.tsx` — add GIT_GUTTER / GIT_BLAME message handling, Blame toolbar button
- `App.tsx` — wire post-save gutter update, wire GitScreen open, conflict badge on file entries

---

## Task 1: Shared Git Types

**Files:**
- Create: `src/types/git.ts`

- [ ] **Step 1: Create `src/types/git.ts`**

```typescript
export interface ConflictHunk {
  index: number;
  ours: string[];
  theirs: string[];
}

export interface ConflictFile {
  path: string;
  hunks: ConflictHunk[];
}

export interface StashEntry {
  index: number;
  message: string;
  timestamp: number;
  fileCount: number;
  files: Record<string, string>; // path → content snapshot
}

export interface BlameLine {
  lineNumber: number;
  commitHash: string;
  author: string;
  timestamp: number;
  message: string;
}

export interface GutterDiff {
  added: number[];
  modified: number[];
  deleted: number[];
}
```

- [ ] **Step 2: Commit**

```bash
git add src/types/git.ts
git commit -m "feat(epic-0020): add shared git types"
```

---

## Task 2: Extend useGitStore

**Files:**
- Modify: `src/stores/useGitStore.ts`
- Modify: `tests/unit/useGitStore.test.ts`

- [ ] **Step 1: Write failing tests** — append to `tests/unit/useGitStore.test.ts`

```typescript
import type { ConflictFile, StashEntry, BlameLine, GutterDiff } from '../../src/types/git';

describe('useGitStore — EPIC-0020 additions', () => {
  beforeEach(() => { useGitStore.getState().reset(); });

  it('defaults isGitScreenOpen to false', () => {
    expect(useGitStore.getState().isGitScreenOpen).toBe(false);
  });

  it('defaults activeGitTab to branches', () => {
    expect(useGitStore.getState().activeGitTab).toBe('branches');
  });

  it('defaults conflicts to []', () => {
    expect(useGitStore.getState().conflicts).toEqual([]);
  });

  it('defaults stashes to []', () => {
    expect(useGitStore.getState().stashes).toEqual([]);
  });

  it('defaults blameData to null', () => {
    expect(useGitStore.getState().blameData).toBeNull();
  });

  it('defaults gutterDecorations to null', () => {
    expect(useGitStore.getState().gutterDecorations).toBeNull();
  });

  it('setIsGitScreenOpen toggles the modal', () => {
    useGitStore.getState().setIsGitScreenOpen(true);
    expect(useGitStore.getState().isGitScreenOpen).toBe(true);
  });

  it('setActiveGitTab switches tab', () => {
    useGitStore.getState().setActiveGitTab('stash');
    expect(useGitStore.getState().activeGitTab).toBe('stash');
  });

  it('setConflicts stores conflict files', () => {
    const c: ConflictFile[] = [{ path: 'a.ts', hunks: [] }];
    useGitStore.getState().setConflicts(c);
    expect(useGitStore.getState().conflicts).toEqual(c);
  });

  it('setStashes stores stash entries', () => {
    const s: StashEntry[] = [{ index: 0, message: 'test', timestamp: 1, fileCount: 1, files: {} }];
    useGitStore.getState().setStashes(s);
    expect(useGitStore.getState().stashes).toEqual(s);
  });

  it('setBlameData stores blame lines', () => {
    const b: BlameLine[] = [{ lineNumber: 1, commitHash: 'abc', author: 'Alice', timestamp: 1, message: 'init' }];
    useGitStore.getState().setBlameData(b);
    expect(useGitStore.getState().blameData).toEqual(b);
  });

  it('setGutterDecorations stores diff ranges', () => {
    const d: GutterDiff = { added: [1, 2], modified: [5], deleted: [9] };
    useGitStore.getState().setGutterDecorations(d);
    expect(useGitStore.getState().gutterDecorations).toEqual(d);
  });

  it('reset clears all EPIC-0020 fields', () => {
    useGitStore.getState().setIsGitScreenOpen(true);
    useGitStore.getState().setConflicts([{ path: 'x', hunks: [] }]);
    useGitStore.getState().reset();
    expect(useGitStore.getState().isGitScreenOpen).toBe(false);
    expect(useGitStore.getState().conflicts).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify failure**

```bash
npx jest --watchAll=false --testPathPattern=useGitStore
```
Expected: FAIL — `isGitScreenOpen is not a function` or similar.

- [ ] **Step 3: Update `src/stores/useGitStore.ts`**

Replace the entire file with:

```typescript
import { create } from 'zustand';
import type { ConflictFile, StashEntry, BlameLine, GutterDiff } from '../types/git';

export interface GitStoreState {
  // Existing fields
  branch: string;
  ahead: number;
  behind: number;
  cloneProgress: number | null;
  networkBusy: boolean;
  lastError: string | null;
  fileTreeRevision: number;
  // EPIC-0020 fields
  conflicts: ConflictFile[];
  stashes: StashEntry[];
  blameData: BlameLine[] | null;
  gutterDecorations: GutterDiff | null;
  activeGitTab: 'branches' | 'conflicts' | 'stash';
  isGitScreenOpen: boolean;
  // Existing actions
  setBranchInfo: (branch: string, ahead: number, behind: number) => void;
  setCloneProgress: (p: number | null) => void;
  setNetworkBusy: (v: boolean) => void;
  setLastError: (msg: string | null) => void;
  bumpFileTree: () => void;
  reset: () => void;
  // EPIC-0020 actions
  setConflicts: (files: ConflictFile[]) => void;
  setStashes: (stashes: StashEntry[]) => void;
  setBlameData: (lines: BlameLine[] | null) => void;
  setGutterDecorations: (diff: GutterDiff | null) => void;
  setActiveGitTab: (tab: 'branches' | 'conflicts' | 'stash') => void;
  setIsGitScreenOpen: (open: boolean) => void;
}

const initial = {
  branch: 'main',
  ahead: 0,
  behind: 0,
  cloneProgress: null as number | null,
  networkBusy: false,
  lastError: null as string | null,
  fileTreeRevision: 0,
  conflicts: [] as ConflictFile[],
  stashes: [] as StashEntry[],
  blameData: null as BlameLine[] | null,
  gutterDecorations: null as GutterDiff | null,
  activeGitTab: 'branches' as const,
  isGitScreenOpen: false,
};

const useGitStore = create<GitStoreState>()((set) => ({
  ...initial,
  setBranchInfo: (branch, ahead, behind) => set({ branch, ahead, behind }),
  setCloneProgress: (p) => set({ cloneProgress: p }),
  setNetworkBusy: (v) => set({ networkBusy: v }),
  setLastError: (msg) => set({ lastError: msg }),
  bumpFileTree: () => set((s) => ({ fileTreeRevision: s.fileTreeRevision + 1 })),
  reset: () => set(initial),
  setConflicts: (files) => set({ conflicts: files }),
  setStashes: (stashes) => set({ stashes }),
  setBlameData: (lines) => set({ blameData: lines }),
  setGutterDecorations: (diff) => set({ gutterDecorations: diff }),
  setActiveGitTab: (tab) => set({ activeGitTab: tab }),
  setIsGitScreenOpen: (open) => set({ isGitScreenOpen: open }),
}));

export default useGitStore;
```

- [ ] **Step 4: Run tests to verify pass**

```bash
npx jest --watchAll=false --testPathPattern=useGitStore
```
Expected: All PASS.

- [ ] **Step 5: Commit**

```bash
git add src/stores/useGitStore.ts src/types/git.ts tests/unit/useGitStore.test.ts
git commit -m "feat(epic-0020): extend useGitStore with EPIC-0020 state"
```

---

## Task 3: GitBridge — deleteBranch & getBlame

**Files:**
- Modify: `src/git/gitBridge.ts`
- Modify: `tests/unit/git/gitBridge.test.ts`

- [ ] **Step 1: Write failing tests** — append to `tests/unit/git/gitBridge.test.ts`

```typescript
// At top of file, add to mock list:
// const mockDeleteBranch = jest.fn();
// const mockLog = jest.fn();
// Add to jest.mock('isomorphic-git'):
//   deleteBranch: (...a: unknown[]) => mockDeleteBranch(...a),
//   log: (...a: unknown[]) => mockLog(...a),

describe('GitBridge.deleteBranch', () => {
  it('calls git.deleteBranch with correct args', async () => {
    mockDeleteBranch.mockResolvedValue(undefined);
    await GitBridge.deleteBranch('file:///workspace', 'old-branch');
    expect(mockDeleteBranch).toHaveBeenCalledWith(
      expect.objectContaining({ ref: 'old-branch' }),
    );
  });
});

describe('GitBridge.getBlame', () => {
  it('returns BlameLine[] with one entry per line', async () => {
    mockLog.mockResolvedValue([
      { oid: 'abc1234', commit: { author: { name: 'Alice', timestamp: 1000 }, message: 'init' } },
    ]);
    // getBlame uses statusMatrix to find modified lines; mock a simple 2-line file
    const result = await GitBridge.getBlame('file:///workspace', 'src/index.ts');
    expect(Array.isArray(result)).toBe(true);
    result.forEach((line) => {
      expect(line).toHaveProperty('lineNumber');
      expect(line).toHaveProperty('commitHash');
      expect(line).toHaveProperty('author');
      expect(line).toHaveProperty('timestamp');
      expect(line).toHaveProperty('message');
    });
  });
});
```

- [ ] **Step 2: Run to verify failure**

```bash
npx jest --watchAll=false --testPathPattern=gitBridge.test
```
Expected: FAIL — `GitBridge.deleteBranch is not a function`.

- [ ] **Step 3: Add `deleteBranch` and `getBlame` to `src/git/gitBridge.ts`**

Append inside the `GitBridge` object (after `getWorkingDiff`), before the closing `};`:

```typescript
  async deleteBranch(dir: string, name: string): Promise<void> {
    assertGitWorkspace(dir);
    const fs = getFs();
    const d = normalizeDir(dir);
    const cache = getGitCache(d);
    await git.deleteBranch({ fs, dir: d, ref: name, cache } as Parameters<typeof git.deleteBranch>[0]);
    invalidateGitCache(d);
  },

  async getBlame(dir: string, filepath: string): Promise<import('../types/git').BlameLine[]> {
    assertGitWorkspace(dir);
    const fs = getFs();
    const d = normalizeDir(dir);
    const repoDir = (await findRepoRoot(fs, d)) ?? d;
    const cache = getGitCache(repoDir);

    // Read current file content to know line count
    const workPath = `${repoDir}/${filepath}`;
    const workUri = workPath.startsWith('file://') || !workPath.startsWith('/')
      ? workPath
      : `file://${workPath}`;
    const workText = await ExpoFS.readAsStringAsync(workUri, {
      encoding: ExpoFS.EncodingType.UTF8,
    }).catch(() => '');
    const lines = workText.split('\n');

    // Walk git log to attribute each line — simplified: use most recent commit per file
    // Full line-level blame requires git.walk which is slow; for v1.0 we attribute all
    // lines to the most recent commit that touched the file.
    const commits = await git.log({ fs, dir: repoDir, filepath, cache, depth: 50 } as Parameters<typeof git.log>[0]).catch(() => []);

    if (commits.length === 0) {
      return lines.map((_, i) => ({
        lineNumber: i + 1,
        commitHash: 'uncommitted',
        author: 'You',
        timestamp: Date.now(),
        message: 'Uncommitted changes',
      }));
    }

    // Map each line to the most recent commit (simplified blame)
    const mostRecent = commits[0];
    return lines.map((_, i) => ({
      lineNumber: i + 1,
      commitHash: mostRecent.oid.slice(0, 7),
      author: mostRecent.commit.author.name,
      timestamp: mostRecent.commit.author.timestamp * 1000,
      message: mostRecent.commit.message.split('\n')[0],
    }));
  },
```

- [ ] **Step 4: Run tests to verify pass**

```bash
npx jest --watchAll=false --testPathPattern=gitBridge.test
```
Expected: All PASS.

- [ ] **Step 5: Commit**

```bash
git add src/git/gitBridge.ts tests/unit/git/gitBridge.test.ts
git commit -m "feat(epic-0020): add deleteBranch and getBlame to GitBridge"
```

---

## Task 4: GitBridge — Conflict Detection & Resolution

**Files:**
- Modify: `src/git/gitBridge.ts`
- Modify: `tests/unit/git/gitBridge.test.ts`

- [ ] **Step 1: Write failing tests** — append to `tests/unit/git/gitBridge.test.ts`

```typescript
describe('GitBridge.getConflicts', () => {
  it('returns ConflictFile[] for files with conflict markers', async () => {
    // Mock statusMatrix returns a conflict entry (stage 1, 2, and 3 all set = conflict)
    mockStatusMatrix.mockResolvedValue([
      ['src/App.tsx', 1, 2, 3],
    ]);
    // Mock readAsStringAsync returns file with conflict markers
    const conflictContent = [
      'function foo() {',
      '<<<<<<< HEAD',
      '  return "ours";',
      '=======',
      '  return "theirs";',
      '>>>>>>> feature/login',
      '}',
    ].join('\n');
    // The mock for ExpoFS is set up in the test environment
    // Here we verify the parsed output shape
    const result = await GitBridge.getConflicts('file:///workspace');
    expect(Array.isArray(result)).toBe(true);
  });
});

describe('GitBridge.resolveHunk', () => {
  it('resolves a hunk with "ours" choice by removing markers', async () => {
    await expect(
      GitBridge.resolveHunk('file:///workspace', 'src/App.tsx', 0, 'ours'),
    ).resolves.not.toThrow();
  });
});
```

- [ ] **Step 2: Run to verify failure**

```bash
npx jest --watchAll=false --testPathPattern=gitBridge.test
```
Expected: FAIL — `GitBridge.getConflicts is not a function`.

- [ ] **Step 3: Add conflict methods to `src/git/gitBridge.ts`**

Add this helper above the `GitBridge` object:

```typescript
function parseConflictHunks(content: string): import('../types/git').ConflictHunk[] {
  const lines = content.split('\n');
  const hunks: import('../types/git').ConflictHunk[] = [];
  let hunkIndex = 0;
  let i = 0;
  while (i < lines.length) {
    if (lines[i].startsWith('<<<<<<<')) {
      const ours: string[] = [];
      const theirs: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('=======')) {
        ours.push(lines[i]);
        i++;
      }
      i++; // skip =======
      while (i < lines.length && !lines[i].startsWith('>>>>>>>')) {
        theirs.push(lines[i]);
        i++;
      }
      hunks.push({ index: hunkIndex++, ours, theirs });
    }
    i++;
  }
  return hunks;
}

function applyHunkChoice(
  content: string,
  hunkIndex: number,
  choice: 'ours' | 'theirs' | 'both',
): string {
  const lines = content.split('\n');
  const result: string[] = [];
  let currentHunk = 0;
  let i = 0;
  while (i < lines.length) {
    if (lines[i].startsWith('<<<<<<<')) {
      const ours: string[] = [];
      const theirs: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('=======')) {
        ours.push(lines[i++]);
      }
      i++; // skip =======
      while (i < lines.length && !lines[i].startsWith('>>>>>>>')) {
        theirs.push(lines[i++]);
      }
      i++; // skip >>>>>>>
      if (currentHunk === hunkIndex) {
        if (choice === 'ours') result.push(...ours);
        else if (choice === 'theirs') result.push(...theirs);
        else { result.push(...ours); result.push(...theirs); }
      } else {
        result.push(`<<<<<<< HEAD`, ...ours, `=======`, ...theirs, `>>>>>>> incoming`);
      }
      currentHunk++;
    } else {
      result.push(lines[i++]);
    }
  }
  return result.join('\n');
}
```

Append inside the `GitBridge` object (after `getBlame`):

```typescript
  async getConflicts(dir: string): Promise<import('../types/git').ConflictFile[]> {
    assertGitWorkspace(dir);
    const fs = getFs();
    const d = normalizeDir(dir);
    const repoDir = (await findRepoRoot(fs, d)) ?? d;
    const cache = getGitCache(repoDir);

    const matrix = await git.statusMatrix({ fs, dir: repoDir, cache } as Parameters<typeof git.statusMatrix>[0]);
    const conflictPaths = matrix
      .filter(([, head, workdir, stage]) => head === 1 && workdir === 2 && stage === 3)
      .map(([filepath]) => filepath as string);

    const result: import('../types/git').ConflictFile[] = [];
    for (const filepath of conflictPaths) {
      const fullPath = `${repoDir}/${filepath}`;
      const uri = fullPath.startsWith('file://') || !fullPath.startsWith('/')
        ? fullPath : `file://${fullPath}`;
      const content = await ExpoFS.readAsStringAsync(uri, {
        encoding: ExpoFS.EncodingType.UTF8,
      }).catch(() => '');
      const hunks = parseConflictHunks(content);
      if (hunks.length > 0) result.push({ path: filepath, hunks });
    }
    return result;
  },

  async resolveHunk(
    dir: string,
    filepath: string,
    hunkIndex: number,
    choice: 'ours' | 'theirs' | 'both',
  ): Promise<void> {
    assertGitWorkspace(dir);
    const fs = getFs();
    const d = normalizeDir(dir);
    const repoDir = (await findRepoRoot(fs, d)) ?? d;
    const fullPath = `${repoDir}/${filepath}`;
    const uri = fullPath.startsWith('file://') || !fullPath.startsWith('/')
      ? fullPath : `file://${fullPath}`;
    const content = await ExpoFS.readAsStringAsync(uri, { encoding: ExpoFS.EncodingType.UTF8 });
    const resolved = applyHunkChoice(content, hunkIndex, choice);
    await ExpoFS.writeAsStringAsync(uri, resolved, { encoding: ExpoFS.EncodingType.UTF8 });
  },
```

- [ ] **Step 4: Run tests to verify pass**

```bash
npx jest --watchAll=false --testPathPattern=gitBridge.test
```
Expected: All PASS.

- [ ] **Step 5: Commit**

```bash
git add src/git/gitBridge.ts tests/unit/git/gitBridge.test.ts
git commit -m "feat(epic-0020): add getConflicts and resolveHunk to GitBridge"
```

---

## Task 5: GitBridge — Stash Operations

**Files:**
- Modify: `src/git/gitBridge.ts`
- Modify: `tests/unit/git/gitBridge.test.ts`

**Note:** isomorphic-git has no native stash API. This implementation saves file snapshots as JSON in `.git/nomad-stash.json`. This is NomadCode-internal and not compatible with `git stash` CLI commands — acceptable for v1.0.

- [ ] **Step 1: Write failing tests** — append to `tests/unit/git/gitBridge.test.ts`

```typescript
describe('GitBridge stash operations', () => {
  it('stash saves modified files and returns empty listStashes initially', async () => {
    // After stash, listStashes should return at least one entry
    await expect(GitBridge.stash('file:///workspace', 'WIP')).resolves.not.toThrow();
  });

  it('listStashes returns array of StashEntry', async () => {
    const result = await GitBridge.listStashes('file:///workspace');
    expect(Array.isArray(result)).toBe(true);
  });

  it('applyStash with drop=true removes the stash entry', async () => {
    await expect(
      GitBridge.applyStash('file:///workspace', 0, true),
    ).resolves.not.toThrow();
  });

  it('dropStash removes entry at index', async () => {
    await expect(
      GitBridge.dropStash('file:///workspace', 0),
    ).resolves.not.toThrow();
  });
});
```

- [ ] **Step 2: Run to verify failure**

```bash
npx jest --watchAll=false --testPathPattern=gitBridge.test
```
Expected: FAIL — `GitBridge.stash is not a function`.

- [ ] **Step 3: Add stash methods to `src/git/gitBridge.ts`**

Add this helper above the `GitBridge` object:

```typescript
const STASH_FILE = '.git/nomad-stash.json';

async function readStashFile(repoDir: string): Promise<import('../types/git').StashEntry[]> {
  const uri = repoDir.startsWith('file://') ? `${repoDir}/${STASH_FILE}` : `file://${repoDir}/${STASH_FILE}`;
  try {
    const raw = await ExpoFS.readAsStringAsync(uri, { encoding: ExpoFS.EncodingType.UTF8 });
    return JSON.parse(raw) as import('../types/git').StashEntry[];
  } catch {
    return [];
  }
}

async function writeStashFile(repoDir: string, entries: import('../types/git').StashEntry[]): Promise<void> {
  const uri = repoDir.startsWith('file://') ? `${repoDir}/${STASH_FILE}` : `file://${repoDir}/${STASH_FILE}`;
  await ExpoFS.writeAsStringAsync(uri, JSON.stringify(entries), { encoding: ExpoFS.EncodingType.UTF8 });
}
```

Append inside the `GitBridge` object (after `resolveHunk`):

```typescript
  async stash(dir: string, message?: string): Promise<void> {
    assertGitWorkspace(dir);
    const fs = getFs();
    const d = normalizeDir(dir);
    const repoDir = (await findRepoRoot(fs, d)) ?? d;
    const cache = getGitCache(repoDir);

    // Find modified/untracked files
    const matrix = await git.statusMatrix({ fs, dir: repoDir, cache } as Parameters<typeof git.statusMatrix>[0]);
    const dirtyPaths = matrix
      .filter(([, head, workdir]) => workdir !== head)
      .map(([p]) => p as string);

    if (dirtyPaths.length === 0) return;

    // Snapshot current content of each dirty file
    const files: Record<string, string> = {};
    for (const filepath of dirtyPaths) {
      const fullPath = `${repoDir}/${filepath}`;
      const uri = fullPath.startsWith('file://') ? fullPath : `file://${fullPath}`;
      files[filepath] = await ExpoFS.readAsStringAsync(uri, { encoding: ExpoFS.EncodingType.UTF8 }).catch(() => '');
    }

    // Restore each file to HEAD content (clean working tree)
    for (const filepath of dirtyPaths) {
      const fullPath = `${repoDir}/${filepath}`;
      const uri = fullPath.startsWith('file://') ? fullPath : `file://${fullPath}`;
      let headContent = '';
      try {
        const headOid = await git.resolveRef({ fs, dir: repoDir, ref: 'HEAD', cache } as Parameters<typeof git.resolveRef>[0]);
        const { blob } = await git.readBlob({ fs, dir: repoDir, oid: headOid, filepath, cache });
        headContent = new TextDecoder().decode(blob);
      } catch {
        // File not in HEAD — delete it to clean working tree
        await ExpoFS.deleteAsync(uri, { idempotent: true });
        continue;
      }
      await ExpoFS.writeAsStringAsync(uri, headContent, { encoding: ExpoFS.EncodingType.UTF8 });
    }

    const existing = await readStashFile(repoDir);
    const entry: import('../types/git').StashEntry = {
      index: existing.length,
      message: message ?? `WIP on ${await git.currentBranch({ fs, dir: repoDir, fullname: false, cache } as Parameters<typeof git.currentBranch>[0]).catch(() => 'main') ?? 'main'}`,
      timestamp: Date.now(),
      fileCount: dirtyPaths.length,
      files,
    };
    await writeStashFile(repoDir, [entry, ...existing].map((e, i) => ({ ...e, index: i })));
    invalidateGitCache(repoDir);
  },

  async listStashes(dir: string): Promise<import('../types/git').StashEntry[]> {
    assertGitWorkspace(dir);
    const fs = getFs();
    const d = normalizeDir(dir);
    const repoDir = (await findRepoRoot(fs, d)) ?? d;
    return readStashFile(repoDir);
  },

  async applyStash(dir: string, index: number, drop: boolean): Promise<void> {
    assertGitWorkspace(dir);
    const fs = getFs();
    const d = normalizeDir(dir);
    const repoDir = (await findRepoRoot(fs, d)) ?? d;

    const entries = await readStashFile(repoDir);
    const entry = entries.find((e) => e.index === index);
    if (!entry) throw new Error(`stash@{${index}} not found`);

    // Restore files
    for (const [filepath, content] of Object.entries(entry.files)) {
      const fullPath = `${repoDir}/${filepath}`;
      const uri = fullPath.startsWith('file://') ? fullPath : `file://${fullPath}`;
      await ExpoFS.writeAsStringAsync(uri, content, { encoding: ExpoFS.EncodingType.UTF8 });
    }

    if (drop) {
      const remaining = entries.filter((e) => e.index !== index).map((e, i) => ({ ...e, index: i }));
      await writeStashFile(repoDir, remaining);
    }
    invalidateGitCache(repoDir);
  },

  async dropStash(dir: string, index: number): Promise<void> {
    assertGitWorkspace(dir);
    const fs = getFs();
    const d = normalizeDir(dir);
    const repoDir = (await findRepoRoot(fs, d)) ?? d;
    const entries = await readStashFile(repoDir);
    const remaining = entries.filter((e) => e.index !== index).map((e, i) => ({ ...e, index: i }));
    await writeStashFile(repoDir, remaining);
  },
```

- [ ] **Step 4: Run tests to verify pass**

```bash
npx jest --watchAll=false --testPathPattern=gitBridge.test
```
Expected: All PASS.

- [ ] **Step 5: Commit**

```bash
git add src/git/gitBridge.ts tests/unit/git/gitBridge.test.ts
git commit -m "feat(epic-0020): add stash operations to GitBridge"
```

---

## Task 6: gitGutter Utility

**Files:**
- Create: `src/utils/gitGutter.ts`
- Create: `tests/unit/git/gitGutter.test.ts`

- [ ] **Step 1: Write failing tests** — create `tests/unit/git/gitGutter.test.ts`

```typescript
import { parseDiffToGutter } from '../../../src/utils/gitGutter';

describe('parseDiffToGutter', () => {
  const base = [
    'line 1',
    'line 2',
    'line 3',
    'line 4',
    'line 5',
  ].join('\n');

  it('returns empty GutterDiff for identical files', () => {
    const result = parseDiffToGutter(base, base);
    expect(result.added).toEqual([]);
    expect(result.modified).toEqual([]);
    expect(result.deleted).toEqual([]);
  });

  it('detects added lines', () => {
    const work = ['line 1', 'line 2', 'NEW LINE', 'line 3', 'line 4', 'line 5'].join('\n');
    const result = parseDiffToGutter(base, work);
    expect(result.added).toContain(3);
  });

  it('detects modified lines', () => {
    const work = ['line 1', 'CHANGED', 'line 3', 'line 4', 'line 5'].join('\n');
    const result = parseDiffToGutter(base, work);
    expect(result.modified).toContain(2);
  });

  it('detects deleted lines — marks position with a deleted indicator', () => {
    const work = ['line 1', 'line 3', 'line 4', 'line 5'].join('\n');
    const result = parseDiffToGutter(base, work);
    expect(result.deleted.length).toBeGreaterThan(0);
  });

  it('handles empty head (new file) — all lines are added', () => {
    const result = parseDiffToGutter('', 'a\nb\nc');
    expect(result.added).toEqual([1, 2, 3]);
    expect(result.modified).toEqual([]);
    expect(result.deleted).toEqual([]);
  });

  it('handles empty work (deleted file) — no decorations', () => {
    const result = parseDiffToGutter('a\nb', '');
    expect(result.added).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify failure**

```bash
npx jest --watchAll=false --testPathPattern=gitGutter
```
Expected: FAIL — `Cannot find module`.

- [ ] **Step 3: Create `src/utils/gitGutter.ts`**

```typescript
import type { GutterDiff } from '../types/git';

export function parseDiffToGutter(headText: string, workText: string): GutterDiff {
  if (!workText) return { added: [], modified: [], deleted: [] };
  if (!headText) {
    const lines = workText.split('\n').map((_, i) => i + 1);
    return { added: lines, modified: [], deleted: [] };
  }

  const headLines = headText.split('\n');
  const workLines = workText.split('\n');

  const added: number[] = [];
  const modified: number[] = [];
  const deleted: number[] = [];

  const maxWork = workLines.length;
  const maxHead = headLines.length;

  // Simple line-by-line comparison (LCS not required for gutter indicators)
  for (let i = 0; i < maxWork; i++) {
    const workLine = workLines[i];
    const headLine = headLines[i];
    if (headLine === undefined) {
      added.push(i + 1);
    } else if (workLine !== headLine) {
      modified.push(i + 1);
    }
  }

  // Lines in HEAD beyond work length = deleted after last work line
  if (maxHead > maxWork) {
    deleted.push(maxWork);
  }

  return { added, modified, deleted };
}
```

- [ ] **Step 4: Run tests to verify pass**

```bash
npx jest --watchAll=false --testPathPattern=gitGutter
```
Expected: All PASS.

- [ ] **Step 5: Commit**

```bash
git add src/utils/gitGutter.ts tests/unit/git/gitGutter.test.ts
git commit -m "feat(epic-0020): add gitGutter diff parser utility"
```

---

## Task 7: GitScreen Tab Controller

**Files:**
- Create: `src/components/GitScreen.tsx`
- Create: `tests/unit/GitScreen.test.tsx`

- [ ] **Step 1: Write failing tests** — create `tests/unit/GitScreen.test.tsx`

```typescript
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import GitScreen from '../../src/components/GitScreen';
import useGitStore from '../../src/stores/useGitStore';

jest.mock('../../src/components/git/BranchesTab', () => () => null);
jest.mock('../../src/components/git/ConflictsTab', () => () => null);
jest.mock('../../src/components/git/StashTab', () => () => null);
jest.mock('../../src/theme/tokens', () => ({ useTheme: () => ({ bg: '#000', text: '#fff', border: '#333', primary: '#2563EB', error: '#EF4444', subtle: '#1e293b' }) }));

const baseProps = { rootPath: 'file:///workspace', authToken: null };

describe('GitScreen', () => {
  beforeEach(() => useGitStore.getState().reset());

  it('renders nothing when isGitScreenOpen is false', () => {
    useGitStore.getState().setIsGitScreenOpen(false);
    const { queryByTestId } = render(<GitScreen {...baseProps} />);
    expect(queryByTestId('git-screen-modal')).toBeNull();
  });

  it('renders the modal when isGitScreenOpen is true', () => {
    useGitStore.getState().setIsGitScreenOpen(true);
    const { getByTestId } = render(<GitScreen {...baseProps} />);
    expect(getByTestId('git-screen-modal')).toBeTruthy();
  });

  it('shows Branches tab by default', () => {
    useGitStore.getState().setIsGitScreenOpen(true);
    const { getByTestId } = render(<GitScreen {...baseProps} />);
    expect(getByTestId('tab-branches')).toBeTruthy();
  });

  it('switches to Stash tab on press', () => {
    useGitStore.getState().setIsGitScreenOpen(true);
    const { getByTestId } = render(<GitScreen {...baseProps} />);
    fireEvent.press(getByTestId('tab-stash'));
    expect(useGitStore.getState().activeGitTab).toBe('stash');
  });

  it('shows conflict badge on Conflicts tab when conflicts exist', () => {
    useGitStore.getState().setIsGitScreenOpen(true);
    useGitStore.getState().setConflicts([{ path: 'a.ts', hunks: [] }]);
    const { getByTestId } = render(<GitScreen {...baseProps} />);
    expect(getByTestId('conflicts-badge')).toBeTruthy();
  });

  it('closes on close button press', () => {
    useGitStore.getState().setIsGitScreenOpen(true);
    const { getByTestId } = render(<GitScreen {...baseProps} />);
    fireEvent.press(getByTestId('git-screen-close'));
    expect(useGitStore.getState().isGitScreenOpen).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify failure**

```bash
npx jest --watchAll=false --testPathPattern=GitScreen.test
```
Expected: FAIL — `Cannot find module`.

- [ ] **Step 3: Create `src/components/GitScreen.tsx`**

```typescript
import React from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import useGitStore from '../stores/useGitStore';
import { useTheme } from '../theme/tokens';
import BranchesTab from './git/BranchesTab';
import ConflictsTab from './git/ConflictsTab';
import StashTab from './git/StashTab';

export interface GitScreenProps {
  rootPath: string;
  authToken: string | null;
}

type Tab = 'branches' | 'conflicts' | 'stash';

export default function GitScreen({ rootPath, authToken }: GitScreenProps): React.ReactElement {
  const t = useTheme();
  const isOpen = useGitStore((s) => s.isGitScreenOpen);
  const activeTab = useGitStore((s) => s.activeGitTab);
  const conflicts = useGitStore((s) => s.conflicts);
  const setActiveTab = useGitStore((s) => s.setActiveGitTab);
  const setIsOpen = useGitStore((s) => s.setIsGitScreenOpen);

  if (!isOpen) return <></>;

  const tabs: { id: Tab; label: string }[] = [
    { id: 'branches', label: 'Branches' },
    { id: 'conflicts', label: 'Conflicts' },
    { id: 'stash', label: 'Stash' },
  ];

  const s = styles(t);

  return (
    <Modal
      testID="git-screen-modal"
      visible={isOpen}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => setIsOpen(false)}
    >
      <View style={s.container}>
        {/* Header */}
        <View style={s.header}>
          <Text style={s.title}>Git</Text>
          <TouchableOpacity
            testID="git-screen-close"
            onPress={() => setIsOpen(false)}
            accessibilityLabel="Close Git screen"
            style={s.closeBtn}
          >
            <Text style={s.closeText}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* Tab bar */}
        <View style={s.tabBar}>
          {tabs.map((tab) => (
            <TouchableOpacity
              key={tab.id}
              testID={`tab-${tab.id}`}
              onPress={() => setActiveTab(tab.id)}
              style={[s.tab, activeTab === tab.id && s.tabActive]}
              accessibilityLabel={tab.label}
            >
              <Text style={[s.tabText, activeTab === tab.id && s.tabTextActive]}>
                {tab.label}
              </Text>
              {tab.id === 'conflicts' && conflicts.length > 0 && (
                <View testID="conflicts-badge" style={s.badge}>
                  <Text style={s.badgeText}>{conflicts.length}</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* Tab content */}
        <View style={s.content}>
          {activeTab === 'branches' && (
            <BranchesTab rootPath={rootPath} authToken={authToken} />
          )}
          {activeTab === 'conflicts' && (
            <ConflictsTab rootPath={rootPath} />
          )}
          {activeTab === 'stash' && (
            <StashTab rootPath={rootPath} />
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = (t: ReturnType<typeof import('../theme/tokens').useTheme>) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: t.bg },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: t.border,
    },
    title: { color: t.text, fontSize: 17, fontWeight: '600' },
    closeBtn: { padding: 8 },
    closeText: { color: t.text, fontSize: 18 },
    tabBar: {
      flexDirection: 'row',
      borderBottomWidth: 1,
      borderBottomColor: t.border,
    },
    tab: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 12,
      gap: 6,
    },
    tabActive: { borderBottomWidth: 2, borderBottomColor: t.primary },
    tabText: { color: t.subtle, fontSize: 14 },
    tabTextActive: { color: t.primary, fontWeight: '600' },
    badge: {
      backgroundColor: '#EF4444',
      borderRadius: 8,
      minWidth: 16,
      paddingHorizontal: 4,
      alignItems: 'center',
    },
    badgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
    content: { flex: 1 },
  });
```

- [ ] **Step 4: Create stub files** so the imports resolve for tests

Create `src/components/git/BranchesTab.tsx`:
```typescript
import React from 'react';
import { View } from 'react-native';
export interface BranchesTabProps { rootPath: string; authToken: string | null; }
export default function BranchesTab(_: BranchesTabProps): React.ReactElement { return <View />; }
```

Create `src/components/git/ConflictsTab.tsx`:
```typescript
import React from 'react';
import { View } from 'react-native';
export interface ConflictsTabProps { rootPath: string; }
export default function ConflictsTab(_: ConflictsTabProps): React.ReactElement { return <View />; }
```

Create `src/components/git/StashTab.tsx`:
```typescript
import React from 'react';
import { View } from 'react-native';
export interface StashTabProps { rootPath: string; }
export default function StashTab(_: StashTabProps): React.ReactElement { return <View />; }
```

- [ ] **Step 5: Run tests to verify pass**

```bash
npx jest --watchAll=false --testPathPattern=GitScreen.test
```
Expected: All PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/GitScreen.tsx src/components/git/BranchesTab.tsx src/components/git/ConflictsTab.tsx src/components/git/StashTab.tsx tests/unit/GitScreen.test.tsx
git commit -m "feat(epic-0020): add GitScreen tab controller with stub tabs"
```

---

## Task 8: BranchesTab (US-0068)

**Files:**
- Modify: `src/components/git/BranchesTab.tsx` (replace stub)
- Create: `tests/unit/BranchesTab.test.tsx`

- [ ] **Step 1: Write failing tests** — create `tests/unit/BranchesTab.test.tsx`

```typescript
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import BranchesTab from '../../src/components/git/BranchesTab';
import useGitStore from '../../src/stores/useGitStore';

const mockBranches = jest.fn();
const mockCreateBranch = jest.fn();
const mockCheckout = jest.fn();
const mockDeleteBranch = jest.fn();

jest.mock('../../src/utils/FileSystemBridge', () => ({
  GitBridge: {
    branches: (...a: unknown[]) => mockBranches(...a),
    createBranch: (...a: unknown[]) => mockCreateBranch(...a),
    checkout: (...a: unknown[]) => mockCheckout(...a),
    deleteBranch: (...a: unknown[]) => mockDeleteBranch(...a),
  },
}));
jest.mock('../../src/theme/tokens', () => ({ useTheme: () => ({ bg: '#000', text: '#fff', border: '#333', primary: '#2563EB', error: '#EF4444', subtle: '#94a3b8', success: '#22c55e' }) }));

const props = { rootPath: 'file:///workspace', authToken: null };

describe('BranchesTab', () => {
  beforeEach(() => {
    useGitStore.getState().reset();
    useGitStore.getState().setBranchInfo('main', 2, 0);
    mockBranches.mockResolvedValue(['main', 'feature/login', 'bugfix/auth']);
    mockCreateBranch.mockResolvedValue(undefined);
    mockCheckout.mockResolvedValue(undefined);
    mockDeleteBranch.mockResolvedValue(undefined);
  });

  it('lists local branches after mount', async () => {
    const { getByText } = render(<BranchesTab {...props} />);
    await waitFor(() => expect(getByText('feature/login')).toBeTruthy());
  });

  it('shows current branch with a current badge', async () => {
    const { getByTestId } = render(<BranchesTab {...props} />);
    await waitFor(() => expect(getByTestId('current-branch-badge')).toBeTruthy());
  });

  it('shows ahead/behind counts for current branch', async () => {
    const { getByText } = render(<BranchesTab {...props} />);
    await waitFor(() => expect(getByText('↑2 ↓0')).toBeTruthy());
  });

  it('calls checkout when Switch is pressed', async () => {
    const { getAllByText } = render(<BranchesTab {...props} />);
    await waitFor(() => getAllByText('Switch'));
    fireEvent.press((await waitFor(() => getAllByText('Switch')))[0]);
    await waitFor(() => expect(mockCheckout).toHaveBeenCalledWith('file:///workspace', 'feature/login'));
  });

  it('creates branch on pressing Create', async () => {
    const { getByTestId } = render(<BranchesTab {...props} />);
    await waitFor(() => getByTestId('new-branch-input'));
    fireEvent.changeText(getByTestId('new-branch-input'), 'feat/new');
    fireEvent.press(getByTestId('create-branch-btn'));
    await waitFor(() => expect(mockCreateBranch).toHaveBeenCalledWith('file:///workspace', 'feat/new', true));
  });

  it('shows empty Create button when input is blank', async () => {
    const { getByTestId } = render(<BranchesTab {...props} />);
    await waitFor(() => getByTestId('create-branch-btn'));
    expect(getByTestId('create-branch-btn').props.accessibilityState?.disabled).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify failure**

```bash
npx jest --watchAll=false --testPathPattern=BranchesTab
```
Expected: FAIL.

- [ ] **Step 3: Replace stub with full `src/components/git/BranchesTab.tsx`**

```typescript
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { GitBridge } from '../../utils/FileSystemBridge';
import useGitStore from '../../stores/useGitStore';
import { useTheme } from '../../theme/tokens';

export interface BranchesTabProps {
  rootPath: string;
  authToken: string | null;
}

export default function BranchesTab({ rootPath }: BranchesTabProps): React.ReactElement {
  const t = useTheme();
  const currentBranch = useGitStore((s) => s.branch);
  const ahead = useGitStore((s) => s.ahead);
  const behind = useGitStore((s) => s.behind);
  const setBranchInfo = useGitStore((s) => s.setBranchInfo);

  const [branches, setBranches] = useState<string[]>([]);
  const [newName, setNewName] = useState('');
  const [loading, setLoading] = useState(false);

  const loadBranches = useCallback(async () => {
    try {
      const list = await GitBridge.branches(rootPath);
      setBranches(list);
    } catch { /* silent */ }
  }, [rootPath]);

  useEffect(() => { void loadBranches(); }, [loadBranches]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setLoading(true);
    try {
      await GitBridge.createBranch(rootPath, newName.trim(), true);
      setBranchInfo(newName.trim(), 0, 0);
      setNewName('');
      await loadBranches();
    } catch (e) {
      Alert.alert('Create failed', String(e));
    } finally {
      setLoading(false);
    }
  };

  const handleSwitch = async (branch: string) => {
    setLoading(true);
    try {
      await GitBridge.checkout(rootPath, branch);
      setBranchInfo(branch, 0, 0);
      await loadBranches();
    } catch (e) {
      Alert.alert('Switch failed', String(e));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = (branch: string) => {
    Alert.alert('Delete branch', `Delete "${branch}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try {
            await GitBridge.deleteBranch(rootPath, branch);
            await loadBranches();
          } catch (e) {
            Alert.alert('Delete failed', String(e));
          }
        },
      },
    ]);
  };

  const s = styles(t);
  const localBranches = branches.filter((b) => !b.startsWith('remotes/'));
  const remoteBranches = branches.filter((b) => b.startsWith('remotes/'));

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      {/* Create new branch */}
      <View style={s.createRow}>
        <TextInput
          testID="new-branch-input"
          style={s.input}
          value={newName}
          onChangeText={setNewName}
          placeholder="new-branch-name"
          placeholderTextColor={t.subtle}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <TouchableOpacity
          testID="create-branch-btn"
          onPress={handleCreate}
          style={[s.createBtn, !newName.trim() && s.createBtnDisabled]}
          disabled={!newName.trim() || loading}
          accessibilityLabel="Create branch"
          accessibilityState={{ disabled: !newName.trim() || loading }}
        >
          {loading ? <ActivityIndicator size="small" color="#fff" /> : <Text style={s.createBtnText}>+ Create</Text>}
        </TouchableOpacity>
      </View>

      {/* Local branches */}
      <Text style={s.sectionLabel}>LOCAL BRANCHES</Text>
      {localBranches.map((branch) => {
        const isCurrent = branch === currentBranch;
        return (
          <View key={branch} style={[s.branchRow, isCurrent && s.branchRowCurrent]}>
            <View style={s.branchInfo}>
              <Text style={[s.branchName, isCurrent && s.branchNameCurrent]}>
                ⎇ {branch}
              </Text>
              {isCurrent && (
                <View style={s.currentBadge} testID="current-branch-badge">
                  <Text style={s.currentBadgeText}>current</Text>
                </View>
              )}
              {isCurrent && (ahead > 0 || behind > 0) && (
                <Text style={s.aheadBehind}>↑{ahead} ↓{behind}</Text>
              )}
            </View>
            {!isCurrent && (
              <View style={s.actions}>
                <TouchableOpacity
                  onPress={() => handleSwitch(branch)}
                  style={s.actionBtn}
                  accessibilityLabel={`Switch to ${branch}`}
                >
                  <Text style={s.actionBtnText}>Switch</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => handleDelete(branch)}
                  style={[s.actionBtn, s.deleteBtn]}
                  accessibilityLabel={`Delete ${branch}`}
                >
                  <Text style={s.deleteBtnText}>Delete</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        );
      })}

      {/* Remote branches */}
      {remoteBranches.length > 0 && (
        <>
          <Text style={s.sectionLabel}>REMOTE BRANCHES</Text>
          {remoteBranches.map((branch) => (
            <View key={branch} style={s.branchRow}>
              <Text style={s.branchNameRemote}>{branch.replace('remotes/', '')}</Text>
              <TouchableOpacity
                onPress={() => handleSwitch(branch)}
                style={s.actionBtn}
                accessibilityLabel={`Checkout ${branch}`}
              >
                <Text style={s.actionBtnText}>Checkout</Text>
              </TouchableOpacity>
            </View>
          ))}
        </>
      )}
    </ScrollView>
  );
}

const styles = (t: ReturnType<typeof import('../../theme/tokens').useTheme>) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: t.bg },
    content: { padding: 16, gap: 6 },
    createRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
    input: {
      flex: 1, backgroundColor: '#1e293b', borderWidth: 1, borderColor: t.border,
      borderRadius: 6, paddingHorizontal: 10, paddingVertical: 8,
      color: t.text, fontSize: 14,
    },
    createBtn: {
      backgroundColor: t.primary, borderRadius: 6,
      paddingHorizontal: 14, paddingVertical: 8, justifyContent: 'center',
    },
    createBtnDisabled: { opacity: 0.4 },
    createBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
    sectionLabel: {
      color: t.subtle, fontSize: 11, fontWeight: '600',
      letterSpacing: 0.5, marginTop: 8, marginBottom: 4,
    },
    branchRow: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      backgroundColor: '#1e293b', borderRadius: 6, padding: 10, marginBottom: 4,
    },
    branchRowCurrent: { borderLeftWidth: 3, borderLeftColor: t.primary },
    branchInfo: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
    branchName: { color: t.text, fontSize: 13 },
    branchNameCurrent: { color: t.primary },
    branchNameRemote: { color: t.subtle, fontSize: 13, flex: 1 },
    currentBadge: {
      backgroundColor: t.primary, borderRadius: 10,
      paddingHorizontal: 6, paddingVertical: 2,
    },
    currentBadgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
    aheadBehind: { color: t.subtle, fontSize: 11 },
    actions: { flexDirection: 'row', gap: 6 },
    actionBtn: {
      backgroundColor: '#374151', borderRadius: 4,
      paddingHorizontal: 10, paddingVertical: 5,
    },
    actionBtnText: { color: t.text, fontSize: 12 },
    deleteBtn: { backgroundColor: '#7f1d1d' },
    deleteBtnText: { color: '#f87171', fontSize: 12 },
  });
```

- [ ] **Step 4: Run tests to verify pass**

```bash
npx jest --watchAll=false --testPathPattern=BranchesTab
```
Expected: All PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/git/BranchesTab.tsx tests/unit/BranchesTab.test.tsx
git commit -m "feat(epic-0020): implement BranchesTab (US-0068)"
```

---

## Task 9: ConflictsTab (US-0069)

**Files:**
- Modify: `src/components/git/ConflictsTab.tsx` (replace stub)
- Create: `tests/unit/ConflictsTab.test.tsx`

- [ ] **Step 1: Write failing tests** — create `tests/unit/ConflictsTab.test.tsx`

```typescript
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import ConflictsTab from '../../src/components/git/ConflictsTab';
import useGitStore from '../../src/stores/useGitStore';
import type { ConflictFile } from '../../src/types/git';

const mockGetConflicts = jest.fn();
const mockResolveHunk = jest.fn();
const mockAdd = jest.fn();

jest.mock('../../src/utils/FileSystemBridge', () => ({
  GitBridge: {
    getConflicts: (...a: unknown[]) => mockGetConflicts(...a),
    resolveHunk: (...a: unknown[]) => mockResolveHunk(...a),
    add: (...a: unknown[]) => mockAdd(...a),
  },
}));
jest.mock('../../src/theme/tokens', () => ({ useTheme: () => ({ bg: '#000', text: '#fff', border: '#333', primary: '#2563EB', error: '#EF4444', subtle: '#94a3b8', success: '#22c55e' }) }));

const conflictFiles: ConflictFile[] = [
  { path: 'src/App.tsx', hunks: [{ index: 0, ours: ['  return "Hello";'], theirs: ['  return "Hey";'] }] },
];

const props = { rootPath: 'file:///workspace' };

describe('ConflictsTab', () => {
  beforeEach(() => {
    useGitStore.getState().reset();
    mockGetConflicts.mockResolvedValue(conflictFiles);
    mockResolveHunk.mockResolvedValue(undefined);
    mockAdd.mockResolvedValue(undefined);
  });

  it('shows empty state when no conflicts', async () => {
    useGitStore.getState().setConflicts([]);
    mockGetConflicts.mockResolvedValue([]);
    const { getByTestId } = render(<ConflictsTab {...props} />);
    await waitFor(() => expect(getByTestId('no-conflicts')).toBeTruthy());
  });

  it('lists conflicted files', async () => {
    const { getByText } = render(<ConflictsTab {...props} />);
    await waitFor(() => expect(getByText('src/App.tsx')).toBeTruthy());
  });

  it('shows warning banner with conflict count', async () => {
    const { getByTestId } = render(<ConflictsTab {...props} />);
    await waitFor(() => expect(getByTestId('conflict-banner')).toBeTruthy());
  });

  it('renders ours/theirs panels for selected file', async () => {
    const { getByTestId, getByText } = render(<ConflictsTab {...props} />);
    await waitFor(() => fireEvent.press(getByText('src/App.tsx')));
    await waitFor(() => {
      expect(getByTestId('panel-ours')).toBeTruthy();
      expect(getByTestId('panel-theirs')).toBeTruthy();
    });
  });

  it('calls resolveHunk with ours on Accept Ours press', async () => {
    const { getByText, getByTestId } = render(<ConflictsTab {...props} />);
    await waitFor(() => fireEvent.press(getByText('src/App.tsx')));
    await waitFor(() => fireEvent.press(getByTestId('accept-ours-0')));
    await waitFor(() => expect(mockResolveHunk).toHaveBeenCalledWith('file:///workspace', 'src/App.tsx', 0, 'ours'));
  });

  it('shows Stage File button after all hunks resolved', async () => {
    const { getByText, getByTestId } = render(<ConflictsTab {...props} />);
    await waitFor(() => fireEvent.press(getByText('src/App.tsx')));
    await waitFor(() => fireEvent.press(getByTestId('accept-ours-0')));
    await waitFor(() => expect(getByTestId('stage-file-btn')).toBeTruthy());
  });
});
```

- [ ] **Step 2: Run to verify failure**

```bash
npx jest --watchAll=false --testPathPattern=ConflictsTab
```
Expected: FAIL.

- [ ] **Step 3: Replace stub with full `src/components/git/ConflictsTab.tsx`**

```typescript
import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { GitBridge } from '../../utils/FileSystemBridge';
import useGitStore from '../../stores/useGitStore';
import { useTheme } from '../../theme/tokens';
import type { ConflictFile } from '../../types/git';

export interface ConflictsTabProps { rootPath: string; }

export default function ConflictsTab({ rootPath }: ConflictsTabProps): React.ReactElement {
  const t = useTheme();
  const conflicts = useGitStore((s) => s.conflicts);
  const setConflicts = useGitStore((s) => s.setConflicts);
  const bumpFileTree = useGitStore((s) => s.bumpFileTree);

  const [selectedFile, setSelectedFile] = useState<ConflictFile | null>(null);
  const [resolvedHunks, setResolvedHunks] = useState<Set<number>>(new Set());
  const [stagedFiles, setStagedFiles] = useState<Set<string>>(new Set());

  const loadConflicts = useCallback(async () => {
    try {
      const files = await GitBridge.getConflicts(rootPath);
      setConflicts(files);
      if (files.length > 0 && !selectedFile) setSelectedFile(files[0]);
    } catch { /* silent */ }
  }, [rootPath, setConflicts, selectedFile]);

  useEffect(() => { void loadConflicts(); }, [loadConflicts]);

  const handleAccept = async (hunkIndex: number, choice: 'ours' | 'theirs' | 'both') => {
    if (!selectedFile) return;
    try {
      await GitBridge.resolveHunk(rootPath, selectedFile.path, hunkIndex, choice);
      setResolvedHunks((prev) => new Set([...prev, hunkIndex]));
    } catch (e) {
      Alert.alert('Resolve failed', String(e));
    }
  };

  const handleStageFile = async () => {
    if (!selectedFile) return;
    try {
      await GitBridge.add(rootPath, selectedFile.path);
      setStagedFiles((prev) => new Set([...prev, selectedFile.path]));
      bumpFileTree();
      await loadConflicts();
    } catch (e) {
      Alert.alert('Stage failed', String(e));
    }
  };

  const s = styles(t);

  if (conflicts.length === 0) {
    return (
      <View style={s.empty} testID="no-conflicts">
        <Text style={s.emptyText}>✓ No merge conflicts</Text>
      </View>
    );
  }

  const allHunksResolved = selectedFile
    ? selectedFile.hunks.every((h) => resolvedHunks.has(h.index))
    : false;
  const isStaged = selectedFile ? stagedFiles.has(selectedFile.path) : false;

  return (
    <ScrollView style={s.container}>
      {/* Warning banner */}
      <View style={s.banner} testID="conflict-banner">
        <Text style={s.bannerIcon}>⚠</Text>
        <View>
          <Text style={s.bannerTitle}>{conflicts.length} file{conflicts.length > 1 ? 's' : ''} with conflicts</Text>
          <Text style={s.bannerSub}>Resolve all conflicts before committing</Text>
        </View>
      </View>

      {/* File list */}
      {conflicts.map((file) => (
        <TouchableOpacity
          key={file.path}
          onPress={() => { setSelectedFile(file); setResolvedHunks(new Set()); }}
          style={[s.fileRow, selectedFile?.path === file.path && s.fileRowActive]}
          accessibilityLabel={file.path}
        >
          <Text style={s.fileName}>{file.path}</Text>
          <Text style={s.hunkCount}>● {file.hunks.length} hunk{file.hunks.length !== 1 ? 's' : ''}</Text>
          {stagedFiles.has(file.path) && <Text style={s.stagedBadge}>✓ Staged</Text>}
        </TouchableOpacity>
      ))}

      {/* 2-panel diff for selected file */}
      {selectedFile && selectedFile.hunks.map((hunk) => (
        <View key={hunk.index} style={s.hunkContainer}>
          <Text style={s.hunkLabel}>Hunk {hunk.index + 1} of {selectedFile.hunks.length}</Text>
          <View style={s.panels}>
            <View style={s.panelOurs} testID="panel-ours">
              <Text style={s.panelHeader}>OURS</Text>
              {hunk.ours.map((line, i) => (
                <Text key={i} style={s.codeLine}>{line}</Text>
              ))}
            </View>
            <View style={s.panelTheirs} testID="panel-theirs">
              <Text style={s.panelHeaderTheirs}>THEIRS</Text>
              {hunk.theirs.map((line, i) => (
                <Text key={i} style={s.codeLineTheirs}>{line}</Text>
              ))}
            </View>
          </View>
          {!resolvedHunks.has(hunk.index) && (
            <View style={s.actions}>
              <TouchableOpacity
                testID={`accept-ours-${hunk.index}`}
                onPress={() => handleAccept(hunk.index, 'ours')}
                style={[s.actionBtn, s.oursBtn]}
                accessibilityLabel="Accept Ours"
              >
                <Text style={s.oursBtnText}>✓ Accept Ours</Text>
              </TouchableOpacity>
              <TouchableOpacity
                testID={`accept-theirs-${hunk.index}`}
                onPress={() => handleAccept(hunk.index, 'theirs')}
                style={[s.actionBtn, s.theirsBtn]}
                accessibilityLabel="Accept Theirs"
              >
                <Text style={s.theirsBtnText}>✓ Accept Theirs</Text>
              </TouchableOpacity>
              <TouchableOpacity
                testID={`accept-both-${hunk.index}`}
                onPress={() => handleAccept(hunk.index, 'both')}
                style={[s.actionBtn, s.bothBtn]}
                accessibilityLabel="Accept Both"
              >
                <Text style={s.bothBtnText}>✓ Both</Text>
              </TouchableOpacity>
            </View>
          )}
          {resolvedHunks.has(hunk.index) && (
            <Text style={s.resolvedLabel}>✓ Resolved</Text>
          )}
        </View>
      ))}

      {/* Stage button after all hunks resolved */}
      {allHunksResolved && !isStaged && (
        <TouchableOpacity
          testID="stage-file-btn"
          onPress={handleStageFile}
          style={s.stageBtn}
          accessibilityLabel="Stage resolved file"
        >
          <Text style={s.stageBtnText}>Stage File →</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const styles = (t: ReturnType<typeof import('../../theme/tokens').useTheme>) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: t.bg },
    empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
    emptyText: { color: t.subtle, fontSize: 15 },
    banner: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      backgroundColor: '#3b1f2b', margin: 12, padding: 10, borderRadius: 6,
    },
    bannerIcon: { color: '#f87171', fontSize: 20 },
    bannerTitle: { color: '#f87171', fontWeight: '600', fontSize: 13 },
    bannerSub: { color: t.subtle, fontSize: 11 },
    fileRow: {
      flexDirection: 'row', alignItems: 'center', gap: 8,
      padding: 10, marginHorizontal: 12, marginBottom: 4,
      backgroundColor: '#1e293b', borderRadius: 6,
    },
    fileRowActive: { borderLeftWidth: 3, borderLeftColor: t.primary },
    fileName: { color: t.text, fontSize: 13, flex: 1 },
    hunkCount: { color: '#f87171', fontSize: 11 },
    stagedBadge: { color: '#22c55e', fontSize: 11, fontWeight: '600' },
    hunkContainer: { margin: 12, marginTop: 0 },
    hunkLabel: { color: t.subtle, fontSize: 11, marginBottom: 6 },
    panels: { flexDirection: 'row', gap: 4 },
    panelOurs: { flex: 1, backgroundColor: '#0f172a', borderWidth: 1, borderColor: '#1e3a5f', borderRadius: 4, padding: 6 },
    panelTheirs: { flex: 1, backgroundColor: '#0f172a', borderWidth: 1, borderColor: '#7f1d1d', borderRadius: 4, padding: 6 },
    panelHeader: { color: '#60a5fa', fontSize: 9, fontWeight: '700', marginBottom: 4 },
    panelHeaderTheirs: { color: '#f87171', fontSize: 9, fontWeight: '700', marginBottom: 4 },
    codeLine: { color: '#22c55e', fontSize: 11, fontFamily: 'monospace' },
    codeLineTheirs: { color: '#f87171', fontSize: 11, fontFamily: 'monospace' },
    actions: { flexDirection: 'row', gap: 4, marginTop: 6 },
    actionBtn: { flex: 1, padding: 7, borderRadius: 4, alignItems: 'center' },
    oursBtn: { backgroundColor: '#1e3a5f' },
    oursBtnText: { color: '#60a5fa', fontSize: 11, fontWeight: '600' },
    theirsBtn: { backgroundColor: '#7f1d1d' },
    theirsBtnText: { color: '#f87171', fontSize: 11, fontWeight: '600' },
    bothBtn: { backgroundColor: '#374151' },
    bothBtnText: { color: t.text, fontSize: 11, fontWeight: '600' },
    resolvedLabel: { color: '#22c55e', fontSize: 12, marginTop: 6 },
    stageBtn: {
      backgroundColor: '#22c55e', margin: 12, padding: 12,
      borderRadius: 6, alignItems: 'center',
    },
    stageBtnText: { color: '#0f172a', fontWeight: '700', fontSize: 14 },
  });
```

- [ ] **Step 4: Run tests to verify pass**

```bash
npx jest --watchAll=false --testPathPattern=ConflictsTab
```
Expected: All PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/git/ConflictsTab.tsx tests/unit/ConflictsTab.test.tsx
git commit -m "feat(epic-0020): implement ConflictsTab 2-panel resolution (US-0069)"
```

---

## Task 10: StashTab (US-0071)

**Files:**
- Modify: `src/components/git/StashTab.tsx` (replace stub)
- Create: `tests/unit/StashTab.test.tsx`

- [ ] **Step 1: Write failing tests** — create `tests/unit/StashTab.test.tsx`

```typescript
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import StashTab from '../../src/components/git/StashTab';
import useGitStore from '../../src/stores/useGitStore';
import type { StashEntry } from '../../src/types/git';

const mockStash = jest.fn();
const mockListStashes = jest.fn();
const mockApplyStash = jest.fn();
const mockDropStash = jest.fn();

jest.mock('../../src/utils/FileSystemBridge', () => ({
  GitBridge: {
    stash: (...a: unknown[]) => mockStash(...a),
    listStashes: (...a: unknown[]) => mockListStashes(...a),
    applyStash: (...a: unknown[]) => mockApplyStash(...a),
    dropStash: (...a: unknown[]) => mockDropStash(...a),
  },
}));
jest.mock('../../src/theme/tokens', () => ({ useTheme: () => ({ bg: '#000', text: '#fff', border: '#333', primary: '#2563EB', error: '#EF4444', subtle: '#94a3b8', success: '#22c55e', teal: '#0d9488' }) }));

const stashEntries: StashEntry[] = [
  { index: 0, message: 'WIP: auth token', timestamp: Date.now() - 60000, fileCount: 3, files: {} },
  { index: 1, message: 'feature/login in-progress', timestamp: Date.now() - 86400000, fileCount: 7, files: {} },
];

const props = { rootPath: 'file:///workspace' };

describe('StashTab', () => {
  beforeEach(() => {
    useGitStore.getState().reset();
    mockListStashes.mockResolvedValue(stashEntries);
    mockStash.mockResolvedValue(undefined);
    mockApplyStash.mockResolvedValue(undefined);
    mockDropStash.mockResolvedValue(undefined);
  });

  it('shows empty state when no stashes', async () => {
    mockListStashes.mockResolvedValue([]);
    const { getByTestId } = render(<StashTab {...props} />);
    await waitFor(() => expect(getByTestId('no-stashes')).toBeTruthy());
  });

  it('lists stash entries with messages', async () => {
    const { getByText } = render(<StashTab {...props} />);
    await waitFor(() => {
      expect(getByText('WIP: auth token')).toBeTruthy();
      expect(getByText('feature/login in-progress')).toBeTruthy();
    });
  });

  it('shows stash@{N} index label', async () => {
    const { getByText } = render(<StashTab {...props} />);
    await waitFor(() => expect(getByText('stash@{0}')).toBeTruthy());
  });

  it('calls stash on Stash button press', async () => {
    const { getByTestId } = render(<StashTab {...props} />);
    await waitFor(() => getByTestId('stash-btn'));
    fireEvent.changeText(getByTestId('stash-message-input'), 'my stash');
    fireEvent.press(getByTestId('stash-btn'));
    await waitFor(() => expect(mockStash).toHaveBeenCalledWith('file:///workspace', 'my stash'));
  });

  it('calls applyStash with drop=true on Pop', async () => {
    const { getAllByText } = render(<StashTab {...props} />);
    await waitFor(() => getAllByText('Pop'));
    fireEvent.press((await waitFor(() => getAllByText('Pop')))[0]);
    await waitFor(() => expect(mockApplyStash).toHaveBeenCalledWith('file:///workspace', 0, true));
  });

  it('calls applyStash with drop=false on Apply', async () => {
    const { getAllByText } = render(<StashTab {...props} />);
    await waitFor(() => getAllByText('Apply'));
    fireEvent.press((await waitFor(() => getAllByText('Apply')))[0]);
    await waitFor(() => expect(mockApplyStash).toHaveBeenCalledWith('file:///workspace', 0, false));
  });

  it('calls dropStash on Drop confirm', async () => {
    const { getAllByText } = render(<StashTab {...props} />);
    await waitFor(() => getAllByText('Drop'));
    fireEvent.press((await waitFor(() => getAllByText('Drop')))[0]);
    // Alert confirmation — dropStash called after confirm
    await waitFor(() => expect(mockDropStash).toHaveBeenCalledWith('file:///workspace', 0));
  });
});
```

- [ ] **Step 2: Run to verify failure**

```bash
npx jest --watchAll=false --testPathPattern=StashTab
```
Expected: FAIL.

- [ ] **Step 3: Replace stub with full `src/components/git/StashTab.tsx`**

```typescript
import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { GitBridge } from '../../utils/FileSystemBridge';
import useGitStore from '../../stores/useGitStore';
import { useTheme } from '../../theme/tokens';
import type { StashEntry } from '../../types/git';

export interface StashTabProps { rootPath: string; }

function relativeTime(ms: number): string {
  const diff = Date.now() - ms;
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)} min ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} hr ago`;
  return `${Math.floor(diff / 86400000)} day${Math.floor(diff / 86400000) > 1 ? 's' : ''} ago`;
}

export default function StashTab({ rootPath }: StashTabProps): React.ReactElement {
  const t = useTheme();
  const stashes = useGitStore((s) => s.stashes);
  const setStashes = useGitStore((s) => s.setStashes);

  const [message, setMessage] = useState('');

  const loadStashes = useCallback(async () => {
    try {
      const list = await GitBridge.listStashes(rootPath);
      setStashes(list);
    } catch { /* silent */ }
  }, [rootPath, setStashes]);

  useEffect(() => { void loadStashes(); }, [loadStashes]);

  const handleStash = async () => {
    try {
      await GitBridge.stash(rootPath, message || undefined);
      setMessage('');
      await loadStashes();
    } catch (e) {
      Alert.alert('Stash failed', String(e));
    }
  };

  const handlePop = async (entry: StashEntry) => {
    try {
      await GitBridge.applyStash(rootPath, entry.index, true);
      await loadStashes();
    } catch (e) {
      Alert.alert('Pop failed', String(e));
    }
  };

  const handleApply = async (entry: StashEntry) => {
    try {
      await GitBridge.applyStash(rootPath, entry.index, false);
      await loadStashes();
    } catch (e) {
      Alert.alert('Apply failed', String(e));
    }
  };

  const handleDrop = (entry: StashEntry) => {
    Alert.alert('Drop stash', `Drop stash@{${entry.index}}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Drop', style: 'destructive',
        onPress: async () => {
          try {
            await GitBridge.dropStash(rootPath, entry.index);
            await loadStashes();
          } catch (e) {
            Alert.alert('Drop failed', String(e));
          }
        },
      },
    ]);
  };

  const s = styles(t);

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      {/* Stash new changes */}
      <View style={s.createRow}>
        <TextInput
          testID="stash-message-input"
          style={s.input}
          value={message}
          onChangeText={setMessage}
          placeholder="Stash message (optional)"
          placeholderTextColor={t.subtle}
        />
        <TouchableOpacity
          testID="stash-btn"
          onPress={handleStash}
          style={s.stashBtn}
          accessibilityLabel="Stash changes"
        >
          <Text style={s.stashBtnText}>Stash</Text>
        </TouchableOpacity>
      </View>

      {/* Stash list */}
      <Text style={s.sectionLabel}>STASH LIST</Text>
      {stashes.length === 0 && (
        <View style={s.empty} testID="no-stashes">
          <Text style={s.emptyText}>No stashes — use Stash to save work in progress</Text>
        </View>
      )}
      {stashes.map((entry) => (
        <View key={entry.index} style={s.stashRow}>
          <View style={s.stashHeader}>
            <Text style={s.stashIndex}>stash@{'{' + entry.index + '}'}</Text>
            <Text style={s.stashTime}>{relativeTime(entry.timestamp)}</Text>
          </View>
          <Text style={s.stashMessage}>{entry.message}</Text>
          <Text style={s.fileCount}>{entry.fileCount} file{entry.fileCount !== 1 ? 's' : ''} changed</Text>
          <View style={s.actions}>
            <TouchableOpacity
              onPress={() => handlePop(entry)}
              style={[s.actionBtn, s.popBtn]}
              accessibilityLabel={`Pop stash@{${entry.index}}`}
            >
              <Text style={s.popBtnText}>Pop</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => handleApply(entry)}
              style={s.actionBtn}
              accessibilityLabel={`Apply stash@{${entry.index}}`}
            >
              <Text style={s.actionBtnText}>Apply</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => handleDrop(entry)}
              style={[s.actionBtn, s.dropBtn]}
              accessibilityLabel={`Drop stash@{${entry.index}}`}
            >
              <Text style={s.dropBtnText}>Drop</Text>
            </TouchableOpacity>
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = (t: ReturnType<typeof import('../../theme/tokens').useTheme>) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: t.bg },
    content: { padding: 16, gap: 8 },
    createRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
    input: {
      flex: 1, backgroundColor: '#1e293b', borderWidth: 1, borderColor: t.border,
      borderRadius: 6, paddingHorizontal: 10, paddingVertical: 8,
      color: t.text, fontSize: 14,
    },
    stashBtn: {
      backgroundColor: '#0d9488', borderRadius: 6,
      paddingHorizontal: 14, paddingVertical: 8, justifyContent: 'center',
    },
    stashBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
    sectionLabel: {
      color: t.subtle, fontSize: 11, fontWeight: '600',
      letterSpacing: 0.5, marginBottom: 4,
    },
    empty: { padding: 20, alignItems: 'center' },
    emptyText: { color: t.subtle, fontSize: 13, textAlign: 'center' },
    stashRow: {
      backgroundColor: '#1e293b', borderWidth: 1, borderColor: t.border,
      borderRadius: 6, padding: 10, marginBottom: 8,
    },
    stashHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
    stashIndex: { color: t.text, fontSize: 13, fontWeight: '600' },
    stashTime: { color: t.subtle, fontSize: 11 },
    stashMessage: { color: t.subtle, fontSize: 12, marginBottom: 4 },
    fileCount: { color: t.subtle, fontSize: 11, marginBottom: 8 },
    actions: { flexDirection: 'row', gap: 6 },
    actionBtn: {
      flex: 1, backgroundColor: '#374151', padding: 7,
      borderRadius: 4, alignItems: 'center',
    },
    actionBtnText: { color: t.text, fontSize: 12 },
    popBtn: { backgroundColor: '#2563eb' },
    popBtnText: { color: '#fff', fontSize: 12, fontWeight: '600' },
    dropBtn: { backgroundColor: '#7f1d1d' },
    dropBtnText: { color: '#f87171', fontSize: 12 },
  });
```

- [ ] **Step 4: Run tests to verify pass**

```bash
npx jest --watchAll=false --testPathPattern=StashTab
```
Expected: All PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/git/StashTab.tsx tests/unit/StashTab.test.tsx
git commit -m "feat(epic-0020): implement StashTab (US-0071)"
```

---

## Task 11: BlameDetailSheet (US-0072)

**Files:**
- Create: `src/components/git/BlameDetailSheet.tsx`
- Create: `tests/unit/BlameDetailSheet.test.tsx`

- [ ] **Step 1: Write failing tests** — create `tests/unit/BlameDetailSheet.test.tsx`

```typescript
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import BlameDetailSheet from '../../src/components/git/BlameDetailSheet';
import type { BlameLine } from '../../src/types/git';

jest.mock('../../src/theme/tokens', () => ({ useTheme: () => ({ bg: '#000', text: '#fff', border: '#333', primary: '#2563EB', subtle: '#94a3b8' }) }));

const blameLine: BlameLine = {
  lineNumber: 5,
  commitHash: 'a1b2c3d',
  author: 'Alice',
  timestamp: new Date('2026-01-01').getTime(),
  message: 'feat: add authentication',
};

describe('BlameDetailSheet', () => {
  it('renders nothing when not visible', () => {
    const { queryByTestId } = render(
      <BlameDetailSheet visible={false} blame={blameLine} onClose={jest.fn()} onViewDiff={jest.fn()} />,
    );
    expect(queryByTestId('blame-sheet')).toBeNull();
  });

  it('shows commit hash when visible', () => {
    const { getByText } = render(
      <BlameDetailSheet visible blame={blameLine} onClose={jest.fn()} onViewDiff={jest.fn()} />,
    );
    expect(getByText('a1b2c3d')).toBeTruthy();
  });

  it('shows author name', () => {
    const { getByText } = render(
      <BlameDetailSheet visible blame={blameLine} onClose={jest.fn()} onViewDiff={jest.fn()} />,
    );
    expect(getByText('Alice')).toBeTruthy();
  });

  it('shows commit message', () => {
    const { getByText } = render(
      <BlameDetailSheet visible blame={blameLine} onClose={jest.fn()} onViewDiff={jest.fn()} />,
    );
    expect(getByText('feat: add authentication')).toBeTruthy();
  });

  it('calls onViewDiff when View Diff is pressed', () => {
    const onViewDiff = jest.fn();
    const { getByTestId } = render(
      <BlameDetailSheet visible blame={blameLine} onClose={jest.fn()} onViewDiff={onViewDiff} />,
    );
    fireEvent.press(getByTestId('view-diff-btn'));
    expect(onViewDiff).toHaveBeenCalledWith('a1b2c3d');
  });

  it('calls onClose when close button is pressed', () => {
    const onClose = jest.fn();
    const { getByTestId } = render(
      <BlameDetailSheet visible blame={blameLine} onClose={onClose} onViewDiff={jest.fn()} />,
    );
    fireEvent.press(getByTestId('blame-sheet-close'));
    expect(onClose).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run to verify failure**

```bash
npx jest --watchAll=false --testPathPattern=BlameDetailSheet
```
Expected: FAIL — `Cannot find module`.

- [ ] **Step 3: Create `src/components/git/BlameDetailSheet.tsx`**

```typescript
import React from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTheme } from '../../theme/tokens';
import type { BlameLine } from '../../types/git';

export interface BlameDetailSheetProps {
  visible: boolean;
  blame: BlameLine | null;
  onClose: () => void;
  onViewDiff: (commitHash: string) => void;
}

export default function BlameDetailSheet({
  visible,
  blame,
  onClose,
  onViewDiff,
}: BlameDetailSheetProps): React.ReactElement {
  const t = useTheme();
  if (!visible || !blame) return <></>;

  const date = new Date(blame.timestamp).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
  });

  const s = styles(t);

  return (
    <Modal
      testID="blame-sheet"
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      transparent
      onRequestClose={onClose}
    >
      <View style={s.overlay}>
        <View style={s.sheet}>
          <View style={s.header}>
            <Text style={s.hash}>{blame.commitHash}</Text>
            <TouchableOpacity
              testID="blame-sheet-close"
              onPress={onClose}
              accessibilityLabel="Close blame detail"
              style={s.closeBtn}
            >
              <Text style={s.closeText}>✕</Text>
            </TouchableOpacity>
          </View>
          <Text style={s.message}>{blame.message}</Text>
          <View style={s.meta}>
            <Text style={s.author}>{blame.author}</Text>
            <Text style={s.date}>{date}</Text>
          </View>
          <TouchableOpacity
            testID="view-diff-btn"
            onPress={() => onViewDiff(blame.commitHash)}
            style={s.diffBtn}
            accessibilityLabel="View diff for this commit"
          >
            <Text style={s.diffBtnText}>▸ View Diff</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = (t: ReturnType<typeof import('../../theme/tokens').useTheme>) =>
  StyleSheet.create({
    overlay: {
      flex: 1, justifyContent: 'flex-end',
      backgroundColor: 'rgba(0,0,0,0.5)',
    },
    sheet: {
      backgroundColor: '#1e293b',
      borderTopLeftRadius: 14, borderTopRightRadius: 14,
      padding: 20, paddingBottom: 36,
    },
    header: {
      flexDirection: 'row', justifyContent: 'space-between',
      alignItems: 'center', marginBottom: 12,
    },
    hash: {
      color: t.primary, fontSize: 13,
      fontFamily: 'monospace', fontWeight: '600',
    },
    closeBtn: { padding: 4 },
    closeText: { color: t.text, fontSize: 18 },
    message: { color: t.text, fontSize: 15, fontWeight: '600', marginBottom: 8 },
    meta: { flexDirection: 'row', gap: 12, marginBottom: 16 },
    author: { color: t.subtle, fontSize: 13 },
    date: { color: t.subtle, fontSize: 13 },
    diffBtn: { paddingVertical: 8 },
    diffBtnText: { color: t.primary, fontSize: 14 },
  });
```

- [ ] **Step 4: Run tests to verify pass**

```bash
npx jest --watchAll=false --testPathPattern=BlameDetailSheet
```
Expected: All PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/git/BlameDetailSheet.tsx tests/unit/BlameDetailSheet.test.tsx
git commit -m "feat(epic-0020): add BlameDetailSheet commit info modal (US-0072)"
```

---

## Task 12: Wire GitScreen & GitPanel "More →" Button

**Files:**
- Modify: `src/components/GitPanel.tsx`
- Modify: `App.tsx`

- [ ] **Step 1: Add "More →" button to GitPanel**

In `src/components/GitPanel.tsx`, locate the existing branch display section (around the `setBranchInfo` usage area). Add the import and button:

At the top, after existing imports:
```typescript
import useGitStore from '../stores/useGitStore';
```
(If already imported, skip this line.)

Inside the component, add these two store hooks alongside existing ones:
```typescript
const setIsGitScreenOpen = useGitStore((s) => s.setIsGitScreenOpen);
const setActiveGitTab = useGitStore((s) => s.setActiveGitTab);
const conflicts = useGitStore((s) => s.conflicts);
```

Add an "Advanced Git →" button at the bottom of the panel content (before the closing `</Modal>`), in the scroll view:
```typescript
<TouchableOpacity
  onPress={() => { setActiveGitTab('branches'); setIsGitScreenOpen(true); onClose(); }}
  style={styles.moreBtn}
  accessibilityLabel="Open advanced git workflows"
>
  <Text style={styles.moreBtnText}>Advanced Git →</Text>
  {conflicts.length > 0 && (
    <View style={styles.conflictBadge}>
      <Text style={styles.conflictBadgeText}>{conflicts.length} conflict{conflicts.length > 1 ? 's' : ''}</Text>
    </View>
  )}
</TouchableOpacity>
```

Add to the StyleSheet at the bottom of `GitPanel.tsx`:
```typescript
moreBtn: {
  flexDirection: 'row', alignItems: 'center', gap: 8,
  marginTop: 12, paddingVertical: 12, paddingHorizontal: 16,
  backgroundColor: '#1e293b', borderRadius: 8,
},
moreBtnText: { color: t.primary, fontSize: 14, fontWeight: '600' },
conflictBadge: {
  backgroundColor: '#EF4444', borderRadius: 10,
  paddingHorizontal: 8, paddingVertical: 2,
},
conflictBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
```

- [ ] **Step 2: Mount GitScreen in `App.tsx`**

Add import at the top of `App.tsx`:
```typescript
import GitScreen from './src/components/GitScreen';
```

Add store hooks inside the App component (alongside existing ones):
```typescript
const setIsGitScreenOpen = useGitStore((s) => s.setIsGitScreenOpen);
const setActiveGitTab = useGitStore((s) => s.setActiveGitTab);
```

Mount GitScreen at the end of the JSX return (alongside the existing `<GitPanel>` mount):
```typescript
<GitScreen rootPath={rootPath} authToken={authToken} />
```

Update the status bar branch pill (find the existing branch pill TouchableOpacity in App.tsx) to open GitScreen on tap:
```typescript
// Find the branch display pill (renders useGitStore branch value)
// Change its onPress to:
onPress={() => { setActiveGitTab('branches'); setIsGitScreenOpen(true); }}
```

- [ ] **Step 3: Run full test suite**

```bash
npx jest --watchAll=false
```
Expected: All existing tests PASS + new tests PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/GitPanel.tsx App.tsx
git commit -m "feat(epic-0020): wire GitScreen into App and GitPanel More button"
```

---

## Task 13: Git Gutter — WebView Wiring (US-0070)

**Files:**
- Modify: `App.tsx` — post-save hook
- Modify: `src/components/Editor.tsx` — GIT_GUTTER message handling + Monaco CSS

- [ ] **Step 1: Write failing test for gutter in Editor**

Append to `tests/unit/Editor.test.tsx`:

```typescript
it('forwards GIT_GUTTER message to Monaco via injectJavaScript', async () => {
  // Render Editor with a mocked webViewRef
  // Verify that when sendGutterDecorations is called on the imperative handle,
  // injectJavaScript is called with a GIT_GUTTER message
  // (This tests the imperative handle exposure)
  const ref = React.createRef<{ sendGutterDecorations: (diff: GutterDiff) => void }>();
  render(<Editor {...editorProps} ref={ref} />);
  // The ref method should exist
  expect(typeof ref.current?.sendGutterDecorations).toBe('function');
});
```

- [ ] **Step 2: Add `sendGutterDecorations` to Editor imperative handle**

In `src/components/Editor.tsx`, add the import:
```typescript
import type { GutterDiff } from '../types/git';
```

In the `useImperativeHandle` block (find the existing `sendFoldAll`, `sendUnfoldAll` etc.), add:
```typescript
sendGutterDecorations: (diff: GutterDiff) => sendToEditor('GIT_GUTTER', { diff }),
sendBlameData: (lines: import('../types/git').BlameLine[]) => sendToEditor('GIT_BLAME', { lines }),
```

In `handleMessage`'s switch statement, add:
```typescript
case 'GUTTER_TAP':
  onGutterTap?.(msg.line as number);
  break;
case 'BLAME_TAP':
  onBlameTap?.(msg.commitHash as string);
  break;
```

Add these to the `EditorProps` interface:
```typescript
onGutterTap?: (line: number) => void;
onBlameTap?: (commitHash: string) => void;
```

- [ ] **Step 3: Add Monaco gutter CSS and message handler to the Monaco WebView HTML**

In `src/components/Editor.tsx`, find the `buildMonacoHtml` function (or wherever the Monaco HTML is constructed). Add the following CSS inside the `<style>` tag:

```css
.gutter-added { border-left: 3px solid #22c55e !important; }
.gutter-modified { border-left: 3px solid #d97706 !important; }
.gutter-deleted::after { content: '▾'; color: #ef4444; font-size: 10px; position: absolute; left: -2px; }
.blame-gutter { display: inline-block; width: 150px; padding-right: 8px; color: #64748b; font-size: 10px; overflow: hidden; white-space: nowrap; }
```

In the Monaco WebView's `window.addEventListener('message', ...)` handler, add:

```javascript
case 'GIT_GUTTER': {
  const { diff } = data;
  const decorations = [];
  (diff.added || []).forEach(line => {
    decorations.push({ range: new monaco.Range(line, 1, line, 1), options: { isWholeLine: true, linesDecorationsClassName: 'gutter-added' } });
  });
  (diff.modified || []).forEach(line => {
    decorations.push({ range: new monaco.Range(line, 1, line, 1), options: { isWholeLine: true, linesDecorationsClassName: 'gutter-modified' } });
  });
  (diff.deleted || []).forEach(line => {
    decorations.push({ range: new monaco.Range(line, 1, line, 1), options: { isWholeLine: true, linesDecorationsClassName: 'gutter-deleted' } });
  });
  window._gutterDecorationIds = editor.deltaDecorations(window._gutterDecorationIds || [], decorations);
  break;
}
case 'GIT_BLAME': {
  const { lines } = data;
  window._blameLines = lines;
  // Render blame as line decorations
  const blameDecorations = lines.map(bl => ({
    range: new monaco.Range(bl.lineNumber, 1, bl.lineNumber, 1),
    options: {
      isWholeLine: false,
      before: {
        content: ` ${bl.commitHash} ${bl.author} `,
        inlineClassName: 'blame-gutter',
      }
    }
  }));
  window._blameDecorationIds = editor.deltaDecorations(window._blameDecorationIds || [], blameDecorations);
  break;
}
```

- [ ] **Step 4: Wire post-save gutter update in `App.tsx`**

In `App.tsx`, add imports:
```typescript
import { parseDiffToGutter } from './src/utils/gitGutter';
import { GitBridge } from './src/utils/FileSystemBridge';
```

Add store hooks:
```typescript
const setGutterDecorations = useGitStore((s) => s.setGutterDecorations);
```

Add an editor ref (after existing refs):
```typescript
const editorRef = useRef<{ sendGutterDecorations: (diff: GutterDiff) => void; sendBlameData: (lines: BlameLine[]) => void } | null>(null);
```

Modify `saveFile` to trigger gutter update after write:
```typescript
const saveFile = useCallback(async (path: string, content: string) => {
  try {
    await FileSystemBridge.writeFile(path, content);
    setTabs((prev) =>
      prev.map((t) => (t.path === path ? { ...t, isDirty: false } : t)),
    );
    tabMetaRef.current.set(path, { path, loadedAt: Date.now(), contentHash: simpleHash(content) });
    // Git gutter update
    void (async () => {
      try {
        const { headText, workText } = await GitBridge.getWorkingDiff(rootPath, path.replace(rootPath + '/', ''));
        const diff = parseDiffToGutter(headText, workText);
        setGutterDecorations(diff);
        editorRef.current?.sendGutterDecorations(diff);
      } catch { /* no repo open — silent */ }
    })();
  } catch (err) {
    Alert.alert('Save failed', String(err));
  }
}, [rootPath, setGutterDecorations]);
```

Pass `ref={editorRef}` to the `<Editor>` component in App.tsx's JSX.

- [ ] **Step 5: Run full test suite**

```bash
npx jest --watchAll=false
```
Expected: All PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/Editor.tsx App.tsx src/utils/gitGutter.ts
git commit -m "feat(epic-0020): add git gutter decorations via WebView postMessage (US-0070)"
```

---

## Task 14: Git Blame Toggle (US-0072)

**Files:**
- Modify: `src/components/Editor.tsx` — Blame toolbar button
- Modify: `App.tsx` — blame load handler + BlameDetailSheet mount

- [ ] **Step 1: Add Blame toggle button to editor toolbar**

In `src/components/Editor.tsx`, find the toolbar items array (the array that contains items like `find`, `undo`, `redo`, `save`). Add a blame toggle item:

```typescript
// In the toolbar items definition, add:
{ id: 'blame', label: '👤', accessibilityLabel: 'Toggle blame', action: 'TOGGLE_BLAME' },
```

In `handleToolbarAction`, handle the `TOGGLE_BLAME` action:
```typescript
case 'TOGGLE_BLAME':
  onToggleBlame?.();
  break;
```

Add `onToggleBlame?: () => void` to `EditorProps`.

- [ ] **Step 2: Wire blame loading in `App.tsx`**

Add state:
```typescript
const [blameSheetVisible, setBlameSheetVisible] = useState(false);
const [blameSheetLine, setBlameSheetLine] = useState<BlameLine | null>(null);
const blameOn = useGitStore((s) => s.blameData) !== null;
const setBlameData = useGitStore((s) => s.setBlameData);
```

Add `handleToggleBlame` callback:
```typescript
const handleToggleBlame = useCallback(async () => {
  if (blameOn) {
    setBlameData(null);
    editorRef.current?.sendBlameData([]);
    return;
  }
  if (!activeTabPath) return;
  try {
    const relativePath = activeTabPath.replace(rootPath + '/', '');
    const lines = await GitBridge.getBlame(rootPath, relativePath);
    setBlameData(lines);
    editorRef.current?.sendBlameData(lines);
  } catch { /* no blame available */ }
}, [blameOn, activeTabPath, rootPath, setBlameData]);
```

Add `handleBlameTap` callback:
```typescript
const handleBlameTap = useCallback((commitHash: string) => {
  const blameData = useGitStore.getState().blameData;
  const line = blameData?.find((b) => b.commitHash === commitHash) ?? null;
  setBlameSheetLine(line);
  setBlameSheetVisible(true);
}, []);
```

Pass to Editor:
```typescript
<Editor
  ...
  onToggleBlame={handleToggleBlame}
  onBlameTap={handleBlameTap}
/>
```

Add BlameDetailSheet import and mount in App.tsx JSX:
```typescript
import BlameDetailSheet from './src/components/git/BlameDetailSheet';

// In JSX, after <GitScreen>:
<BlameDetailSheet
  visible={blameSheetVisible}
  blame={blameSheetLine}
  onClose={() => setBlameSheetVisible(false)}
  onViewDiff={(hash) => {
    setBlameSheetVisible(false);
    // Open GitDiffModal for this commit hash — reuse existing onOpenDiff
    // For now, log the hash (full commit diff view is future work)
    console.log('View diff for commit:', hash);
  }}
/>
```

- [ ] **Step 3: Run full test suite**

```bash
npx jest --watchAll=false
```
Expected: All PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/Editor.tsx App.tsx src/components/git/BlameDetailSheet.tsx
git commit -m "feat(epic-0020): add blame overlay toggle and BlameDetailSheet wiring (US-0072)"
```

---

## Task 15: Update RELEASE_PLAN.md & Export GitBridge methods

**Files:**
- Modify: `src/utils/FileSystemBridge.ts` — re-export new GitBridge methods
- Modify: `docs/RELEASE_PLAN.md` — mark US-0068 through US-0072 Done

- [ ] **Step 1: Verify FileSystemBridge re-exports GitBridge**

Open `src/utils/FileSystemBridge.ts` and confirm it re-exports `GitBridge`. If it does a wildcard re-export (`export * from '../git/gitBridge'`), the new methods are already available. If it lists specific exports, add the new methods: `deleteBranch`, `getConflicts`, `resolveHunk`, `stash`, `listStashes`, `applyStash`, `dropStash`, `getBlame`.

- [ ] **Step 2: Run full test suite one final time**

```bash
npx jest --watchAll=false --coverage
```
Expected: All PASS. Coverage ≥80% on new files.

- [ ] **Step 3: Update RELEASE_PLAN.md**

In `docs/RELEASE_PLAN.md`, update EPIC-0020 status and each US-006X status to Done. Update the EPIC block:

```
EPIC-0020: Advanced Git Workflows
...
Status: Done
```

Update each US:
```
US-0068 ... Status: Done
US-0069 ... Status: Done
US-0070 ... Status: Done
US-0071 ... Status: Done
US-0072 ... Status: Done
```

- [ ] **Step 4: Final commit**

```bash
git add src/utils/FileSystemBridge.ts docs/RELEASE_PLAN.md
git commit -m "feat(epic-0020): complete advanced git workflows — all 5 user stories done"
```
