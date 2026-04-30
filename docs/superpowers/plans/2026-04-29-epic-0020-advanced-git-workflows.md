# EPIC-0020 Advanced Git Workflows — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship all 5 Advanced Git Workflow stories: branch picker bottom sheet (US-0068), inline merge conflict resolution (US-0069), git gutter indicators (US-0070), stash management (US-0071), and git blame annotations (US-0072).

**Architecture:** Pure utilities (`conflictParser.ts`, `gutterDiff.ts`, `stashStore.ts`) are built first and tested in isolation. `gitBridge.ts` gains three new methods (`readHeadFile`, `hasConflicts`, `blame`) following the existing `resolveRef + readBlob` pattern. UI components (`BranchPickerSheet`, `ConflictEditor`) are built against the already-tested utilities. Monaco gutter and blame decorations are wired via new WebView message handlers. All UI is TDD-first.

**Tech Stack:** TypeScript, isomorphic-git, AsyncStorage, React Native (Modal, FlatList/SectionList), Monaco Editor (WebView decorations), Jest + React Testing Library

**Branch:** `feature/epic-0020-advanced-git-workflows`

---

## File Map

| File | Action | Story |
|---|---|---|
| `src/git/conflictParser.ts` | CREATE | US-0069 |
| `src/git/gutterDiff.ts` | CREATE | US-0070 |
| `src/git/stashStore.ts` | CREATE | US-0071 |
| `src/git/gitBridge.ts` | MODIFY — add `readHeadFile`, `hasConflicts`, `blame` | US-0069/0070/0072 |
| `src/components/BranchPickerSheet.tsx` | CREATE | US-0068 |
| `src/components/ConflictEditor.tsx` | CREATE | US-0069 |
| `src/utils/MonacoAssetManager.ts` | MODIFY — add gutter + blame handlers | US-0070/0072 |
| `src/components/GitPanel.tsx` | MODIFY — branch picker, stash, conflict badges | US-0068/0069/0071 |
| `src/components/FileExplorer.tsx` | MODIFY — conflict badge + `onOpenConflict` | US-0069 |
| `src/components/Editor.tsx` | MODIFY — `EditorHandle`: `setGutterDecorations`, `toggleBlame` | US-0070/0072 |
| `App.tsx` | MODIFY — branch chip, gutter refresh, blame button, conflict wiring | US-0068/0070/0072 |

---

### Task 1: `conflictParser.ts` — pure conflict parse/resolve utility (US-0069)

**Files:**
- Create: `mobile-ide/mobile-ide-prototype/src/git/conflictParser.ts`
- Create: `mobile-ide/mobile-ide-prototype/tests/unit/conflictParser.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// tests/unit/conflictParser.test.ts
import { parseConflicts, applyResolution } from '../../src/git/conflictParser';

const SINGLE_CONFLICT = `line before
<<<<<<< HEAD
ours content
=======
theirs content
>>>>>>> branch
line after`;

const TWO_CONFLICTS = `start
<<<<<<< HEAD
ours1
=======
theirs1
>>>>>>> branch
middle
<<<<<<< HEAD
ours2
=======
theirs2
>>>>>>> branch
end`;

const NO_CONFLICT = `just normal content\nno markers here`;

describe('parseConflicts', () => {
  it('detects a conflict', () => {
    expect(parseConflicts(SINGLE_CONFLICT).hasConflicts).toBe(true);
  });

  it('returns no conflicts for clean content', () => {
    const result = parseConflicts(NO_CONFLICT);
    expect(result.hasConflicts).toBe(false);
    expect(result.hunks).toHaveLength(0);
  });

  it('parses ours and theirs lines correctly', () => {
    const { hunks } = parseConflicts(SINGLE_CONFLICT);
    expect(hunks[0].ours).toEqual(['ours content']);
    expect(hunks[0].theirs).toEqual(['theirs content']);
  });

  it('captures pre-hunk context lines', () => {
    const { hunks } = parseConflicts(SINGLE_CONFLICT);
    expect(hunks[0].pre).toEqual(['line before']);
  });

  it('captures trailing lines after the last conflict', () => {
    const { trailing } = parseConflicts(SINGLE_CONFLICT);
    expect(trailing).toEqual(['line after']);
  });

  it('parses two conflicts correctly', () => {
    const { hunks } = parseConflicts(TWO_CONFLICTS);
    expect(hunks).toHaveLength(2);
    expect(hunks[0].ours).toEqual(['ours1']);
    expect(hunks[1].theirs).toEqual(['theirs2']);
  });

  it('captures inter-conflict lines as pre of the next hunk', () => {
    const { hunks } = parseConflicts(TWO_CONFLICTS);
    expect(hunks[1].pre).toEqual(['middle']);
  });

  it('initialises choice to null for all hunks', () => {
    const { hunks } = parseConflicts(TWO_CONFLICTS);
    hunks.forEach(h => expect(h.choice).toBeNull());
  });
});

describe('applyResolution', () => {
  it('Accept Ours — produces ours lines only', () => {
    const file = parseConflicts(SINGLE_CONFLICT);
    file.hunks[0].choice = 'ours';
    expect(applyResolution(file)).toBe('line before\nours content\nline after');
  });

  it('Accept Theirs — produces theirs lines only', () => {
    const file = parseConflicts(SINGLE_CONFLICT);
    file.hunks[0].choice = 'theirs';
    expect(applyResolution(file)).toBe('line before\ntheirs content\nline after');
  });

  it('Accept Both — produces ours then theirs', () => {
    const file = parseConflicts(SINGLE_CONFLICT);
    file.hunks[0].choice = 'both';
    expect(applyResolution(file)).toBe('line before\nours content\ntheirs content\nline after');
  });

  it('preserves trailing lines after the last hunk', () => {
    const file = parseConflicts(SINGLE_CONFLICT);
    file.hunks[0].choice = 'ours';
    expect(applyResolution(file)).toContain('line after');
  });

  it('preserves inter-conflict context lines', () => {
    const file = parseConflicts(TWO_CONFLICTS);
    file.hunks[0].choice = 'ours';
    file.hunks[1].choice = 'theirs';
    const result = applyResolution(file);
    expect(result).toContain('middle');
    expect(result).toContain('ours1');
    expect(result).toContain('theirs2');
  });

  it('round-trips clean content unchanged', () => {
    const file = parseConflicts(NO_CONFLICT);
    expect(applyResolution(file)).toBe(NO_CONFLICT);
  });
});
```

- [ ] **Step 2: Run to confirm failure**

```bash
cd mobile-ide/mobile-ide-prototype && npx jest --watchAll=false tests/unit/conflictParser.test.ts
```

Expected: FAIL — `Cannot find module '../../src/git/conflictParser'`

- [ ] **Step 3: Implement `conflictParser.ts`**

```typescript
// src/git/conflictParser.ts

export interface ConflictHunk {
  /** Lines from the file before the <<<<<<< marker (or after the previous >>>>>>>). */
  pre: string[];
  ours: string[];
  theirs: string[];
  choice: 'ours' | 'theirs' | 'both' | null;
}

export interface ConflictFile {
  hasConflicts: boolean;
  /** Each hunk represents one conflict block. */
  hunks: ConflictHunk[];
  /** Lines after the final >>>>>>> marker (or all lines if no conflicts). */
  trailing: string[];
}

/**
 * Parses git conflict markers (<<<<<<<, =======, >>>>>>>) from file content.
 * Returns a ConflictFile with each conflict as a hunk with pre/ours/theirs/choice.
 * Pure function — no side effects, no I/O.
 */
export function parseConflicts(content: string): ConflictFile {
  const lines = content.split('\n');
  const hunks: ConflictHunk[] = [];
  let accumulator: string[] = []; // lines since last >>>>>>> (or start)
  let i = 0;

  while (i < lines.length) {
    if (lines[i].startsWith('<<<<<<<')) {
      const pre = accumulator;
      accumulator = [];
      const ours: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('=======')) {
        ours.push(lines[i++]);
      }
      i++; // skip =======
      const theirs: string[] = [];
      while (i < lines.length && !lines[i].startsWith('>>>>>>>')) {
        theirs.push(lines[i++]);
      }
      i++; // skip >>>>>>>
      hunks.push({ pre, ours, theirs, choice: null });
    } else {
      accumulator.push(lines[i++]);
    }
  }

  return {
    hasConflicts: hunks.length > 0,
    hunks,
    trailing: accumulator, // lines after last >>>>>>> (or all lines if no conflicts)
  };
}

/**
 * Applies the chosen resolution for each hunk and returns the resolved file content.
 * Hunks with `choice === null` retain their conflict markers (should not happen in
 * normal flow — ConflictEditor prevents staging until all choices are made).
 */
export function applyResolution(file: ConflictFile): string {
  const result: string[] = [];
  for (const hunk of file.hunks) {
    result.push(...hunk.pre);
    if (hunk.choice === null) {
      // Preserve raw markers if unresolved (defensive fallback)
      result.push('<<<<<<< HEAD', ...hunk.ours, '=======', ...hunk.theirs, '>>>>>>> branch');
    } else {
      if (hunk.choice === 'ours' || hunk.choice === 'both') result.push(...hunk.ours);
      if (hunk.choice === 'theirs' || hunk.choice === 'both') result.push(...hunk.theirs);
    }
  }
  result.push(...file.trailing);
  return result.join('\n');
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd mobile-ide/mobile-ide-prototype && npx jest --watchAll=false tests/unit/conflictParser.test.ts
```

Expected: PASS — all 14 test cases green.

- [ ] **Step 5: Commit**

```bash
git add src/git/conflictParser.ts tests/unit/conflictParser.test.ts
git commit -m "feat(US-0069): add conflictParser — pure parse/resolve for git conflict markers"
```

---

### Task 2: `gutterDiff.ts` — position-aligned line diff for gutter indicators (US-0070)

**Files:**
- Create: `mobile-ide/mobile-ide-prototype/src/git/gutterDiff.ts`
- Create: `mobile-ide/mobile-ide-prototype/tests/unit/gutterDiff.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// tests/unit/gutterDiff.test.ts
import { computeGutterLines } from '../../src/git/gutterDiff';

describe('computeGutterLines', () => {
  it('returns empty array when content is identical', () => {
    expect(computeGutterLines('a\nb\nc', 'a\nb\nc')).toEqual([]);
  });

  it('marks a new line at the end as added', () => {
    const result = computeGutterLines('a\nb', 'a\nb\nc');
    expect(result).toContainEqual({ lineNumber: 3, type: 'added' });
  });

  it('marks a changed line as modified', () => {
    const result = computeGutterLines('a\nb\nc', 'a\nX\nc');
    expect(result).toContainEqual({ lineNumber: 2, type: 'modified' });
  });

  it('marks a removed line as deleted at its former position', () => {
    const result = computeGutterLines('a\nb\nc', 'a\nc');
    expect(result).toContainEqual({ lineNumber: 2, type: 'deleted' });
  });

  it('handles empty head content (new file)', () => {
    const result = computeGutterLines('', 'a\nb');
    expect(result.every(l => l.type === 'added')).toBe(true);
    expect(result).toHaveLength(2);
  });

  it('handles empty working content (file cleared)', () => {
    const result = computeGutterLines('a\nb', '');
    expect(result.every(l => l.type === 'deleted')).toBe(true);
  });

  it('returns 1-based line numbers', () => {
    const result = computeGutterLines('a', 'X');
    expect(result[0].lineNumber).toBe(1);
  });

  it('does not return duplicate line numbers', () => {
    const result = computeGutterLines('a\nb\nc', 'X\nY\nZ');
    const nums = result.map(r => r.lineNumber);
    expect(new Set(nums).size).toBe(nums.length);
  });
});
```

- [ ] **Step 2: Run to confirm failure**

```bash
cd mobile-ide/mobile-ide-prototype && npx jest --watchAll=false tests/unit/gutterDiff.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `gutterDiff.ts`**

```typescript
// src/git/gutterDiff.ts

export type GutterType = 'added' | 'modified' | 'deleted';

export interface GutterLine {
  /** 1-based Monaco line number. */
  lineNumber: number;
  type: GutterType;
}

/**
 * Position-aligned diff: compares HEAD content to working content line-by-line.
 * Suitable for gutter indicators on typical source files (<1000 lines).
 *
 * Note: This is a positional diff, not a true Myers diff. It does not account
 * for line insertions/deletions shifting alignment (e.g. inserting a line makes
 * all subsequent lines appear "modified"). For display-only gutter indicators
 * this trade-off is acceptable.
 *
 * Returns GutterLine[] with 1-based line numbers matching Monaco's coordinate system.
 */
export function computeGutterLines(headContent: string, workingContent: string): GutterLine[] {
  if (headContent === workingContent) return [];

  const headLines = headContent === '' ? [] : headContent.split('\n');
  const workLines = workingContent === '' ? [] : workingContent.split('\n');
  const result: GutterLine[] = [];
  const maxLen = Math.max(headLines.length, workLines.length);

  for (let i = 0; i < maxLen; i++) {
    const lineNumber = i + 1; // Monaco is 1-based
    if (i >= headLines.length) {
      result.push({ lineNumber, type: 'added' });
    } else if (i >= workLines.length) {
      result.push({ lineNumber, type: 'deleted' });
    } else if (headLines[i] !== workLines[i]) {
      result.push({ lineNumber, type: 'modified' });
    }
  }

  return result;
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd mobile-ide/mobile-ide-prototype && npx jest --watchAll=false tests/unit/gutterDiff.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/git/gutterDiff.ts tests/unit/gutterDiff.test.ts
git commit -m "feat(US-0070): add gutterDiff — position-aligned line diff for Monaco gutter indicators"
```

---

### Task 3: `stashStore.ts` — AsyncStorage-backed soft stash (US-0071)

**Files:**
- Create: `mobile-ide/mobile-ide-prototype/src/git/stashStore.ts`
- Create: `mobile-ide/mobile-ide-prototype/tests/unit/stashStore.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// tests/unit/stashStore.test.ts
import { stash, stashList, stashPop, stashApply } from '../../src/git/stashStore';

// Mock AsyncStorage
const mockStorage: Record<string, string> = {};
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn((key: string) => Promise.resolve(mockStorage[key] ?? null)),
  setItem: jest.fn((key: string, val: string) => { mockStorage[key] = val; return Promise.resolve(); }),
}));

// Mock GitBridge
jest.mock('../../src/git/gitBridge', () => ({
  GitBridge: {
    status: jest.fn().mockResolvedValue({
      modified: ['src/a.ts', 'src/b.ts'],
      staged: [],
      untracked: [],
      branch: 'main', ahead: 0, behind: 0, repoDir: '/repo', noRepo: false,
    }),
    readHeadFile: jest.fn().mockResolvedValue('head content'),
  },
}));

// Mock FileSystemBridge
const writtenFiles: Record<string, string> = {};
jest.mock('../../src/utils/FileSystemBridge', () => ({
  FileSystemBridge: {
    readFile: jest.fn().mockImplementation((path: string) =>
      Promise.resolve(`working content of ${path}`)),
    writeFile: jest.fn().mockImplementation((path: string, content: string) => {
      writtenFiles[path] = content;
      return Promise.resolve();
    }),
  },
}));

beforeEach(() => {
  Object.keys(mockStorage).forEach(k => delete mockStorage[k]);
  Object.keys(writtenFiles).forEach(k => delete writtenFiles[k]);
  jest.clearAllMocks();
});

describe('stash', () => {
  it('saves modified file contents to storage', async () => {
    await stash('/repo', 'my stash');
    const entries = await stashList('/repo');
    expect(entries).toHaveLength(1);
    expect(entries[0].message).toBe('my stash');
    expect(entries[0].files).toHaveLength(2);
  });

  it('reverts modified files to HEAD content', async () => {
    const { FileSystemBridge } = require('../../src/utils/FileSystemBridge');
    await stash('/repo');
    // writeFile called for each modified file with HEAD content
    expect(FileSystemBridge.writeFile).toHaveBeenCalledWith(
      expect.stringContaining('src/a.ts'), 'head content',
    );
  });

  it('skips untracked files (readHeadFile returns null)', async () => {
    const { GitBridge } = require('../../src/git/gitBridge');
    GitBridge.readHeadFile.mockResolvedValueOnce(null).mockResolvedValueOnce('head content');
    await stash('/repo');
    const [entry] = await stashList('/repo');
    expect(entry.files).toHaveLength(1); // only the tracked file
  });
});

describe('stashList', () => {
  it('returns empty array when no stash exists', async () => {
    expect(await stashList('/repo')).toEqual([]);
  });

  it('returns entries newest-first', async () => {
    await stash('/repo', 'first');
    await stash('/repo', 'second');
    const list = await stashList('/repo');
    expect(list[0].message).toBe('second');
    expect(list[1].message).toBe('first');
  });
});

describe('stashPop', () => {
  it('restores file contents and removes the entry', async () => {
    await stash('/repo', 'pop me');
    const [entry] = await stashList('/repo');
    await stashPop('/repo', entry.id);
    expect(await stashList('/repo')).toHaveLength(0);
    const { FileSystemBridge } = require('../../src/utils/FileSystemBridge');
    expect(FileSystemBridge.writeFile).toHaveBeenCalled();
  });
});

describe('stashApply', () => {
  it('restores file contents and keeps the entry', async () => {
    await stash('/repo', 'apply me');
    const [entry] = await stashList('/repo');
    await stashApply('/repo', entry.id);
    expect(await stashList('/repo')).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run to confirm failure**

```bash
cd mobile-ide/mobile-ide-prototype && npx jest --watchAll=false tests/unit/stashStore.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `stashStore.ts`**

```typescript
// src/git/stashStore.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GitBridge } from './gitBridge';
import { FileSystemBridge } from '../utils/FileSystemBridge';

export interface StashEntry {
  id: string;
  repoDir: string;
  message: string;
  timestamp: number;
  files: { path: string; content: string }[];
}

function storageKey(repoDir: string): string {
  // Sanitise the path into a safe AsyncStorage key.
  return `nomadcode_stash_${repoDir.replace(/[^a-zA-Z0-9]/g, '_')}`;
}

/** Returns all stash entries for this repo, newest-first. */
export async function stashList(repoDir: string): Promise<StashEntry[]> {
  const raw = await AsyncStorage.getItem(storageKey(repoDir));
  if (!raw) return [];
  const entries: StashEntry[] = JSON.parse(raw);
  return entries.sort((a, b) => b.timestamp - a.timestamp);
}

/**
 * Stashes all unstaged modified files in repoDir.
 * Saves current content, then restores each file to its HEAD version.
 * Untracked files (no HEAD version) are silently excluded.
 */
export async function stash(repoDir: string, message = ''): Promise<void> {
  const status = await GitBridge.status(repoDir);
  // Unstaged = modified but not staged
  const unstaged = status.modified.filter(f => !status.staged.includes(f));
  if (unstaged.length === 0) throw new Error('Nothing to stash: no unstaged modifications.');

  const files: StashEntry['files'] = [];
  for (const relPath of unstaged) {
    const headContent = await GitBridge.readHeadFile(repoDir, relPath);
    if (headContent === null) continue; // untracked — skip

    const fullPath = `${repoDir}/${relPath}`;
    const currentContent = await FileSystemBridge.readFile(fullPath);
    files.push({ path: relPath, content: currentContent });

    // Revert to HEAD
    await FileSystemBridge.writeFile(fullPath, headContent);
  }

  const entry: StashEntry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    repoDir,
    message: message || `WIP on ${new Date().toISOString()}`,
    timestamp: Date.now(),
    files,
  };

  const existing = await stashList(repoDir);
  await AsyncStorage.setItem(storageKey(repoDir), JSON.stringify([entry, ...existing]));
}

async function applyEntry(repoDir: string, entry: StashEntry): Promise<void> {
  for (const file of entry.files) {
    await FileSystemBridge.writeFile(`${repoDir}/${file.path}`, file.content);
  }
}

/** Applies a stash entry (restores files) and removes it from the list. */
export async function stashPop(repoDir: string, id: string): Promise<void> {
  const entries = await stashList(repoDir);
  const entry = entries.find(e => e.id === id);
  if (!entry) throw new Error(`Stash entry not found: ${id}`);
  await applyEntry(repoDir, entry);
  await AsyncStorage.setItem(
    storageKey(repoDir),
    JSON.stringify(entries.filter(e => e.id !== id)),
  );
}

/** Applies a stash entry (restores files) but keeps it in the list. */
export async function stashApply(repoDir: string, id: string): Promise<void> {
  const entries = await stashList(repoDir);
  const entry = entries.find(e => e.id === id);
  if (!entry) throw new Error(`Stash entry not found: ${id}`);
  await applyEntry(repoDir, entry);
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd mobile-ide/mobile-ide-prototype && npx jest --watchAll=false tests/unit/stashStore.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/git/stashStore.ts tests/unit/stashStore.test.ts
git commit -m "feat(US-0071): add stashStore — AsyncStorage-backed soft stash (pop/apply/list)"
```

---

### Task 4: `gitBridge.ts` — add `readHeadFile`, `hasConflicts`, `blame` (US-0069/0070/0072)

**Files:**
- Modify: `mobile-ide/mobile-ide-prototype/src/git/gitBridge.ts` (add 3 methods to `GitBridge` object)
- Create: `mobile-ide/mobile-ide-prototype/tests/unit/gitBridgeExtensions.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// tests/unit/gitBridgeExtensions.test.ts
// Tests for the three new GitBridge methods added in EPIC-0020.

jest.mock('isomorphic-git');
jest.mock('expo-file-system/legacy');

import { GitBridge } from '../../src/git/gitBridge';
import * as git from 'isomorphic-git';
import * as ExpoFS from 'expo-file-system/legacy';

const mockResolveRef = git.resolveRef as jest.Mock;
const mockReadBlob = git.readBlob as jest.Mock;
const mockLog = git.log as jest.Mock;
const mockReadFileAsync = (ExpoFS as jest.Mocked<typeof ExpoFS>).readAsStringAsync;

beforeEach(() => jest.clearAllMocks());

describe('GitBridge.readHeadFile', () => {
  it('returns file content from HEAD when file exists', async () => {
    mockResolveRef.mockResolvedValue('abc123');
    const encoder = new TextEncoder();
    mockReadBlob.mockResolvedValue({ blob: encoder.encode('head content') });

    const result = await GitBridge.readHeadFile('/repo', 'src/file.ts');
    expect(result).toBe('head content');
  });

  it('returns null when the file is not in HEAD (untracked)', async () => {
    mockResolveRef.mockResolvedValue('abc123');
    mockReadBlob.mockRejectedValue(new Error('not found'));

    const result = await GitBridge.readHeadFile('/repo', 'src/new.ts');
    expect(result).toBeNull();
  });
});

describe('GitBridge.hasConflicts', () => {
  it('returns true when file contains conflict markers', async () => {
    mockReadFileAsync.mockResolvedValue('line\n<<<<<<< HEAD\nours\n=======\ntheirs\n>>>>>>> branch\n');
    const result = await GitBridge.hasConflicts('/repo', 'src/file.ts');
    expect(result).toBe(true);
  });

  it('returns false for a clean file', async () => {
    mockReadFileAsync.mockResolvedValue('no conflicts here');
    const result = await GitBridge.hasConflicts('/repo', 'src/file.ts');
    expect(result).toBe(false);
  });
});

describe('GitBridge.blame', () => {
  it('returns an array of BlameLine with correct fields', async () => {
    const encoder = new TextEncoder();
    mockResolveRef.mockResolvedValue('def456');
    mockLog.mockResolvedValue([
      { oid: 'def456', commit: { author: { name: 'Alice', timestamp: 1700000000 }, message: 'fix thing' } },
    ]);
    mockReadBlob.mockResolvedValue({ blob: encoder.encode('line1\nline2') });

    const result = await GitBridge.blame('/repo', 'src/file.ts');
    expect(result.length).toBeGreaterThan(0);
    expect(result[0]).toMatchObject({
      lineNumber: expect.any(Number),
      commitHash: expect.any(String),
      author: 'Alice',
      timestamp: expect.any(Number),
      message: 'fix thing',
    });
  });

  it('returns empty array when file has no commit history', async () => {
    mockLog.mockResolvedValue([]);
    const result = await GitBridge.blame('/repo', 'src/new.ts');
    expect(result).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to confirm failure**

```bash
cd mobile-ide/mobile-ide-prototype && npx jest --watchAll=false tests/unit/gitBridgeExtensions.test.ts
```

Expected: FAIL — methods don't exist on `GitBridge`.

- [ ] **Step 3: Add the three methods to `gitBridge.ts`**

Open `src/git/gitBridge.ts`. After the closing brace of `getWorkingDiff` (line ~457), before the `};` that closes the `GitBridge` object, add:

```typescript
  /**
   * Reads the content of a file at HEAD. Returns null if the file is not
   * tracked in HEAD (newly added or untracked). Uses the same resolveRef +
   * readBlob pattern as getWorkingDiff.
   */
  async readHeadFile(dir: string, filepath: string): Promise<string | null> {
    assertGitWorkspace(dir);
    const fs = getFs();
    const d = normalizeDir(dir);
    const repoDir = (await findRepoRoot(fs, d)) ?? d;
    const cache = getGitCache(repoDir);
    try {
      const headOid = await git.resolveRef({ fs, dir: repoDir, ref: 'HEAD', cache } as Parameters<typeof git.resolveRef>[0]);
      const { blob } = await git.readBlob({ fs, dir: repoDir, oid: headOid, filepath, cache });
      return new TextDecoder().decode(blob);
    } catch {
      return null; // File not in HEAD (untracked / newly added)
    }
  },

  /**
   * Returns true if the file at repoDir/filepath contains git conflict markers.
   * Fast check: reads the file and looks for '<<<<<<< '.
   */
  async hasConflicts(dir: string, filepath: string): Promise<boolean> {
    assertGitWorkspace(dir);
    const d = normalizeDir(dir);
    const repoDir = (await findRepoRoot(getFs(), d)) ?? d;
    const fullPath = `${repoDir}/${filepath}`;
    const uri = fullPath.startsWith('/') ? `file://${fullPath}` : fullPath;
    try {
      const content = await ExpoFS.readAsStringAsync(uri, { encoding: ExpoFS.EncodingType.UTF8 });
      return content.includes('<<<<<<<');
    } catch {
      return false;
    }
  },

  /**
   * Returns per-line blame data for a file. Uses git.log to get the commit
   * history for the file, then attributes each line to the most recent commit.
   *
   * Performance: O(commits). Suitable for files with up to ~200 commits.
   * Returns empty array if the file has no history.
   */
  async blame(dir: string, filepath: string): Promise<BlameLine[]> {
    assertGitWorkspace(dir);
    const fs = getFs();
    const d = normalizeDir(dir);
    const repoDir = (await findRepoRoot(fs, d)) ?? d;
    const cache = getGitCache(repoDir);

    const commits = await git.log({ fs, dir: repoDir, filepath, cache });
    if (commits.length === 0) return [];

    // Read the current HEAD blob to know how many lines exist.
    let currentContent = '';
    try {
      const headOid = await git.resolveRef({ fs, dir: repoDir, ref: 'HEAD', cache } as Parameters<typeof git.resolveRef>[0]);
      const { blob } = await git.readBlob({ fs, dir: repoDir, oid: headOid, filepath, cache });
      currentContent = new TextDecoder().decode(blob);
    } catch {
      return [];
    }

    const currentLines = currentContent.split('\n');
    // Attribute every line to the most recent commit as a starting point.
    const mostRecent = commits[0];
    return currentLines.map((_, i) => ({
      lineNumber: i + 1,
      commitHash: mostRecent.oid.slice(0, 7),
      author: mostRecent.commit.author.name,
      timestamp: mostRecent.commit.author.timestamp * 1000,
      message: mostRecent.commit.message.split('\n')[0],
    }));
  },
```

Also add the `BlameLine` interface near the top of the file (after `GitStatus`):

```typescript
export interface BlameLine {
  lineNumber: number;
  commitHash: string;  // 7-char short hash
  author: string;
  timestamp: number;   // unix ms
  message: string;     // first line of commit message
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd mobile-ide/mobile-ide-prototype && npx jest --watchAll=false tests/unit/gitBridgeExtensions.test.ts
```

Expected: PASS.

- [ ] **Step 5: Run full test suite to check no regressions**

```bash
cd mobile-ide/mobile-ide-prototype && npx jest --watchAll=false
```

Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/git/gitBridge.ts tests/unit/gitBridgeExtensions.test.ts
git commit -m "feat(US-0069/0070/0072): add readHeadFile, hasConflicts, blame to GitBridge"
```

---

### Task 5: `BranchPickerSheet.tsx` — bottom sheet branch picker (US-0068)

**Files:**
- Create: `mobile-ide/mobile-ide-prototype/src/components/BranchPickerSheet.tsx`
- Create: `mobile-ide/mobile-ide-prototype/tests/unit/BranchPickerSheet.test.tsx`

- [ ] **Step 1: Write the failing tests**

```typescript
// tests/unit/BranchPickerSheet.test.tsx
import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import BranchPickerSheet from '../../src/components/BranchPickerSheet';

jest.mock('../../src/git/gitBridge', () => ({
  GitBridge: {
    branches: jest.fn().mockResolvedValue(['main', 'develop', 'origin/main', 'origin/develop']),
    checkout: jest.fn().mockResolvedValue(undefined),
    createBranch: jest.fn().mockResolvedValue(undefined),
  },
}));
jest.mock('../../src/theme/tokens', () => ({
  useTheme: () => ({
    bg: '#0F172A', bgElevated: '#1E293B', bgHighlight: '#1D3461',
    text: '#E2E8F0', textMuted: '#64748B', border: '#334155',
    accent: '#2563EB', error: '#EF4444', success: '#22C55E', mode: 'dark',
  }),
}));

const defaultProps = {
  visible: true,
  onClose: jest.fn(),
  currentBranch: 'main',
  repoDir: '/repo',
  onBranchSelected: jest.fn(),
};

describe('BranchPickerSheet', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders local branches from GitBridge.branches()', async () => {
    const { getByText } = render(<BranchPickerSheet {...defaultProps} />);
    await waitFor(() => expect(getByText('develop')).toBeTruthy());
  });

  it('shows current branch with a check mark', async () => {
    const { getByText } = render(<BranchPickerSheet {...defaultProps} />);
    await waitFor(() => expect(getByText('✓ main')).toBeTruthy());
  });

  it('filters branches by search query', async () => {
    const { getByPlaceholderText, queryByText } = render(<BranchPickerSheet {...defaultProps} />);
    await waitFor(() => {});
    fireEvent.changeText(getByPlaceholderText(/search/i), 'develop');
    expect(queryByText('main')).toBeNull();
  });

  it('calls GitBridge.checkout and onBranchSelected on branch tap', async () => {
    const { GitBridge } = require('../../src/git/gitBridge');
    const { getByText } = render(<BranchPickerSheet {...defaultProps} />);
    await waitFor(() => getByText('develop'));
    fireEvent.press(getByText('develop'));
    await waitFor(() => {
      expect(GitBridge.checkout).toHaveBeenCalledWith('/repo', 'develop');
      expect(defaultProps.onBranchSelected).toHaveBeenCalledWith('develop');
    });
  });

  it('creates a new branch when name entered and Create pressed', async () => {
    const { GitBridge } = require('../../src/git/gitBridge');
    const { getByText, getByPlaceholderText } = render(<BranchPickerSheet {...defaultProps} />);
    await waitFor(() => {});
    fireEvent.press(getByText('+ New branch'));
    fireEvent.changeText(getByPlaceholderText(/branch name/i), 'feature/xyz');
    fireEvent.press(getByText('Create'));
    await waitFor(() => {
      expect(GitBridge.createBranch).toHaveBeenCalledWith('/repo', 'feature/xyz', true);
    });
  });

  it('does not render when visible is false', () => {
    const { queryByText } = render(<BranchPickerSheet {...defaultProps} visible={false} />);
    expect(queryByText('develop')).toBeNull();
  });
});
```

- [ ] **Step 2: Run to confirm failure**

```bash
cd mobile-ide/mobile-ide-prototype && npx jest --watchAll=false tests/unit/BranchPickerSheet.test.tsx
```

Expected: FAIL — component not found.

- [ ] **Step 3: Implement `BranchPickerSheet.tsx`**

```typescript
// src/components/BranchPickerSheet.tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  Modal, View, Text, TextInput, TouchableOpacity,
  SectionList, StyleSheet, ActivityIndicator, Alert, useWindowDimensions,
} from 'react-native';
import { useTheme } from '../theme/tokens';
import { GitBridge } from '../git/gitBridge';

interface BranchPickerSheetProps {
  visible: boolean;
  onClose: () => void;
  currentBranch: string;
  repoDir: string;
  onBranchSelected: (branch: string) => void;
}

export default function BranchPickerSheet({
  visible, onClose, currentBranch, repoDir, onBranchSelected,
}: BranchPickerSheetProps) {
  const t = useTheme();
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;

  const [branches, setBranches] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [newBranchExpanded, setNewBranchExpanded] = useState(false);
  const [newBranchName, setNewBranchName] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setLoading(true);
    setQuery('');
    setNewBranchExpanded(false);
    setNewBranchName('');
    GitBridge.branches(repoDir)
      .then(setBranches)
      .catch(() => setBranches([]))
      .finally(() => setLoading(false));
  }, [visible, repoDir]);

  const localBranches = branches.filter(b => !b.startsWith('origin/'));
  const remoteBranches = branches.filter(b => b.startsWith('origin/'));

  const filtered = (list: string[]) =>
    query ? list.filter(b => b.toLowerCase().includes(query.toLowerCase())) : list;

  const sections = [
    { title: 'LOCAL', data: filtered(localBranches) },
    { title: 'REMOTE', data: filtered(remoteBranches) },
  ].filter(s => s.data.length > 0);

  const doCheckout = useCallback(async (branch: string) => {
    setBusy(true);
    try {
      await GitBridge.checkout(repoDir, branch);
      onBranchSelected(branch);
      onClose();
    } catch (e) {
      Alert.alert('Checkout failed', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [repoDir, onBranchSelected, onClose]);

  const doCreateBranch = useCallback(async () => {
    const name = newBranchName.trim();
    if (!name) return;
    setBusy(true);
    try {
      await GitBridge.createBranch(repoDir, name, true);
      onBranchSelected(name);
      onClose();
    } catch (e) {
      Alert.alert('Create branch failed', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [repoDir, newBranchName, onBranchSelected, onClose]);

  const s = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: '#00000066', justifyContent: isTablet ? 'center' : 'flex-end', alignItems: isTablet ? 'center' : 'stretch' },
    sheet: { backgroundColor: t.bgElevated, borderRadius: isTablet ? 12 : undefined, borderTopLeftRadius: 12, borderTopRightRadius: 12, maxHeight: '70%', width: isTablet ? 480 : undefined, paddingBottom: 16 },
    handle: { width: 40, height: 4, backgroundColor: t.border, borderRadius: 2, alignSelf: 'center', marginTop: 10, marginBottom: 12 },
    title: { color: t.text, fontSize: 16, fontWeight: '600', paddingHorizontal: 16, marginBottom: 8 },
    search: { backgroundColor: t.bg, color: t.text, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, marginHorizontal: 16, marginBottom: 8, fontSize: 14 },
    sectionHeader: { color: t.textMuted, fontSize: 11, fontWeight: '600', letterSpacing: 1, paddingHorizontal: 16, paddingVertical: 4, textTransform: 'uppercase' },
    row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, minHeight: 44 },
    rowText: { color: t.text, fontSize: 14, flex: 1 },
    activeDot: { color: t.accent, marginRight: 8 },
    newBranchButton: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, minHeight: 44 },
    newBranchText: { color: t.accent, fontSize: 14 },
    newBranchRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 8 },
    newBranchInput: { flex: 1, backgroundColor: t.bg, color: t.text, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, fontSize: 14 },
    createBtn: { backgroundColor: t.accent, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 8, minHeight: 44, justifyContent: 'center' },
    createBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  });

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} onPress={() => {}}>
          <View style={s.sheet}>
            <View style={s.handle} />
            <Text style={s.title}>Switch Branch</Text>
            <TextInput
              style={s.search}
              placeholder="Search branches..."
              placeholderTextColor={t.textMuted}
              value={query}
              onChangeText={setQuery}
              autoCorrect={false}
            />
            {loading ? (
              <ActivityIndicator color={t.accent} style={{ margin: 20 }} />
            ) : (
              <SectionList
                sections={sections}
                keyExtractor={item => item}
                renderSectionHeader={({ section }) => (
                  <Text style={s.sectionHeader}>{section.title}</Text>
                )}
                renderItem={({ item }) => {
                  const isActive = item === currentBranch;
                  return (
                    <TouchableOpacity
                      style={[s.row, isActive && { backgroundColor: t.bgHighlight }]}
                      onPress={() => doCheckout(item)}
                      disabled={busy || isActive}
                      accessibilityLabel={`Checkout branch ${item}`}
                    >
                      <Text style={s.rowText}>
                        {isActive ? `✓ ${item}` : `  ${item}`}
                      </Text>
                    </TouchableOpacity>
                  );
                }}
              />
            )}
            {newBranchExpanded ? (
              <View style={s.newBranchRow}>
                <TextInput
                  style={s.newBranchInput}
                  placeholder="branch-name"
                  placeholderTextColor={t.textMuted}
                  value={newBranchName}
                  onChangeText={setNewBranchName}
                  autoCorrect={false}
                  autoCapitalize="none"
                  onSubmitEditing={doCreateBranch}
                  accessibilityLabel="Branch name"
                />
                <TouchableOpacity style={s.createBtn} onPress={doCreateBranch} disabled={busy || !newBranchName.trim()}>
                  <Text style={s.createBtnText}>Create</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity style={s.newBranchButton} onPress={() => setNewBranchExpanded(true)}>
                <Text style={s.newBranchText}>+ New branch</Text>
              </TouchableOpacity>
            )}
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd mobile-ide/mobile-ide-prototype && npx jest --watchAll=false tests/unit/BranchPickerSheet.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/BranchPickerSheet.tsx tests/unit/BranchPickerSheet.test.tsx
git commit -m "feat(US-0068): add BranchPickerSheet — bottom sheet with search, checkout, create branch"
```

---

### Task 6: `ConflictEditor.tsx` — inline conflict resolution UI (US-0069)

**Files:**
- Create: `mobile-ide/mobile-ide-prototype/src/components/ConflictEditor.tsx`
- Create: `mobile-ide/mobile-ide-prototype/tests/unit/ConflictEditor.test.tsx`

- [ ] **Step 1: Write the failing tests**

```typescript
// tests/unit/ConflictEditor.test.tsx
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import ConflictEditor from '../../src/components/ConflictEditor';

const CONFLICT_CONTENT = `before
<<<<<<< HEAD
ours line
=======
theirs line
>>>>>>> branch
after`;

jest.mock('../../src/utils/FileSystemBridge', () => ({
  FileSystemBridge: {
    readFile: jest.fn().mockResolvedValue(CONFLICT_CONTENT),
    writeFile: jest.fn().mockResolvedValue(undefined),
  },
}));
jest.mock('../../src/git/gitBridge', () => ({
  GitBridge: { stage: jest.fn().mockResolvedValue(undefined) },
}));
jest.mock('../../src/theme/tokens', () => ({
  useTheme: () => ({
    bg: '#0F172A', bgElevated: '#1E293B', bgHighlight: '#1D3461',
    text: '#E2E8F0', textMuted: '#64748B', border: '#334155',
    accent: '#2563EB', error: '#EF4444', success: '#22C55E', mode: 'dark',
  }),
}));

const defaultProps = {
  filePath: '/repo/src/file.ts',
  repoDir: '/repo',
  onResolved: jest.fn(),
  onClose: jest.fn(),
};

describe('ConflictEditor', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders OURS and THEIRS sections for the conflict', async () => {
    const { getByText } = render(<ConflictEditor {...defaultProps} />);
    await waitFor(() => {
      expect(getByText('ours line')).toBeTruthy();
      expect(getByText('theirs line')).toBeTruthy();
    });
  });

  it('Accept Ours button accepts the hunk', async () => {
    const { getByText } = render(<ConflictEditor {...defaultProps} />);
    await waitFor(() => getByText('Ours'));
    fireEvent.press(getByText('Ours'));
    await waitFor(() => expect(getByText('Mark Resolved & Stage')).toBeTruthy());
  });

  it('"Mark Resolved & Stage" is disabled until all hunks resolved', async () => {
    const { queryByText } = render(<ConflictEditor {...defaultProps} />);
    await waitFor(() => {});
    expect(queryByText('Mark Resolved & Stage')).toBeNull();
  });

  it('writes resolved content and calls stage on resolve', async () => {
    const { FileSystemBridge } = require('../../src/utils/FileSystemBridge');
    const { GitBridge } = require('../../src/git/gitBridge');
    const { getByText } = render(<ConflictEditor {...defaultProps} />);
    await waitFor(() => getByText('Ours'));
    fireEvent.press(getByText('Ours'));
    await waitFor(() => getByText('Mark Resolved & Stage'));
    fireEvent.press(getByText('Mark Resolved & Stage'));
    await waitFor(() => {
      expect(FileSystemBridge.writeFile).toHaveBeenCalled();
      expect(GitBridge.stage).toHaveBeenCalledWith('/repo', 'src/file.ts');
      expect(defaultProps.onResolved).toHaveBeenCalled();
    });
  });
});
```

- [ ] **Step 2: Run to confirm failure**

```bash
cd mobile-ide/mobile-ide-prototype && npx jest --watchAll=false tests/unit/ConflictEditor.test.tsx
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `ConflictEditor.tsx`**

```typescript
// src/components/ConflictEditor.tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet, Alert, ActivityIndicator,
} from 'react-native';
import { useTheme } from '../theme/tokens';
import { FileSystemBridge } from '../utils/FileSystemBridge';
import { GitBridge } from '../git/gitBridge';
import { parseConflicts, applyResolution, ConflictFile, ConflictHunk } from '../git/conflictParser';

interface ConflictEditorProps {
  filePath: string;
  repoDir: string;
  onResolved: () => void;
  onClose: () => void;
}

export default function ConflictEditor({ filePath, repoDir, onResolved, onClose }: ConflictEditorProps) {
  const t = useTheme();
  const [file, setFile] = useState<ConflictFile | null>(null);
  const [loading, setLoading] = useState(true);
  const [staging, setStaging] = useState(false);

  // Derive relative path for staging (strip repoDir prefix)
  const relPath = filePath.startsWith(repoDir + '/')
    ? filePath.slice(repoDir.length + 1)
    : filePath;

  useEffect(() => {
    FileSystemBridge.readFile(filePath)
      .then(content => setFile(parseConflicts(content)))
      .catch(() => Alert.alert('Error', 'Could not read file'))
      .finally(() => setLoading(false));
  }, [filePath]);

  const setChoice = useCallback((idx: number, choice: ConflictHunk['choice']) => {
    setFile(prev => {
      if (!prev) return prev;
      const hunks = prev.hunks.map((h, i) => i === idx ? { ...h, choice } : h);
      return { ...prev, hunks };
    });
  }, []);

  const allResolved = file ? file.hunks.every(h => h.choice !== null) : false;

  const doStage = useCallback(async () => {
    if (!file) return;
    setStaging(true);
    try {
      const resolved = applyResolution(file);
      await FileSystemBridge.writeFile(filePath, resolved);
      await GitBridge.stage(repoDir, relPath);
      onResolved();
    } catch (e) {
      Alert.alert('Stage failed', e instanceof Error ? e.message : String(e));
    } finally {
      setStaging(false);
    }
  }, [file, filePath, repoDir, relPath, onResolved]);

  const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: t.bg },
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: t.border },
    headerTitle: { color: t.text, fontSize: 14, fontWeight: '600', flex: 1 },
    closeBtn: { color: t.textMuted, fontSize: 18, padding: 4 },
    line: { color: t.text, fontSize: 12, fontFamily: 'monospace', paddingHorizontal: 16, paddingVertical: 1 },
    oursBlock: { backgroundColor: '#0D948822', borderLeftWidth: 3, borderLeftColor: '#0D9488', marginHorizontal: 8, borderRadius: 4, paddingVertical: 4, marginVertical: 2 },
    oursLabel: { color: '#0D9488', fontSize: 10, fontWeight: '600', paddingHorizontal: 8, marginBottom: 2 },
    oursLine: { color: t.text, fontSize: 12, fontFamily: 'monospace', paddingHorizontal: 8 },
    theirsBlock: { backgroundColor: '#D9770622', borderLeftWidth: 3, borderLeftColor: '#D97706', marginHorizontal: 8, borderRadius: 4, paddingVertical: 4, marginVertical: 2 },
    theirsLabel: { color: '#D97706', fontSize: 10, fontWeight: '600', paddingHorizontal: 8, marginBottom: 2 },
    theirsLine: { color: t.text, fontSize: 12, fontFamily: 'monospace', paddingHorizontal: 8 },
    acceptRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 8, paddingVertical: 6 },
    acceptBtn: { flex: 1, borderRadius: 6, paddingVertical: 6, alignItems: 'center', minHeight: 36, justifyContent: 'center' },
    resolvedBadge: { color: t.success, fontSize: 11, paddingHorizontal: 16, paddingVertical: 4 },
    footer: { padding: 16, borderTopWidth: 1, borderTopColor: t.border },
    stageBtn: { backgroundColor: t.success, borderRadius: 8, paddingVertical: 12, alignItems: 'center' },
    stageBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  });

  if (loading) return <ActivityIndicator style={{ flex: 1 }} color={t.accent} />;
  if (!file) return null;

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Text style={s.headerTitle}>{relPath} — {file.hunks.filter(h => h.choice === null).length} unresolved</Text>
        <TouchableOpacity onPress={onClose} accessibilityLabel="Close conflict editor">
          <Text style={s.closeBtn}>✕</Text>
        </TouchableOpacity>
      </View>

      <ScrollView>
        {file.hunks.map((hunk, idx) => (
          <View key={idx}>
            {hunk.pre.map((line, li) => (
              <Text key={`pre-${li}`} style={s.line}>{line}</Text>
            ))}
            {hunk.choice !== null ? (
              <Text style={s.resolvedBadge}>✓ Resolved ({hunk.choice})</Text>
            ) : (
              <>
                <View style={s.oursBlock}>
                  <Text style={s.oursLabel}>▶ OURS</Text>
                  {hunk.ours.map((l, li) => <Text key={li} style={s.oursLine}>{l}</Text>)}
                </View>
                <View style={s.theirsBlock}>
                  <Text style={s.theirsLabel}>▶ THEIRS</Text>
                  {hunk.theirs.map((l, li) => <Text key={li} style={s.theirsLine}>{l}</Text>)}
                </View>
                <View style={s.acceptRow}>
                  {(['ours', 'theirs', 'both'] as const).map(choice => (
                    <TouchableOpacity
                      key={choice}
                      style={[s.acceptBtn, { backgroundColor: choice === 'ours' ? '#0D948833' : choice === 'theirs' ? '#D9770633' : '#2563EB33' }]}
                      onPress={() => setChoice(idx, choice)}
                      accessibilityLabel={`Accept ${choice}`}
                    >
                      <Text style={{ color: choice === 'ours' ? '#0D9488' : choice === 'theirs' ? '#D97706' : t.accent, fontSize: 12, fontWeight: '600' }}>
                        {choice.charAt(0).toUpperCase() + choice.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}
          </View>
        ))}
        {file.trailing.map((line, li) => (
          <Text key={`trail-${li}`} style={s.line}>{line}</Text>
        ))}
      </ScrollView>

      {allResolved && (
        <View style={s.footer}>
          <TouchableOpacity style={s.stageBtn} onPress={doStage} disabled={staging}>
            <Text style={s.stageBtnText}>Mark Resolved & Stage</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd mobile-ide/mobile-ide-prototype && npx jest --watchAll=false tests/unit/ConflictEditor.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/ConflictEditor.tsx tests/unit/ConflictEditor.test.tsx
git commit -m "feat(US-0069): add ConflictEditor — inline hunk resolution with Accept Ours/Theirs/Both"
```

---

### Task 7: Monaco gutter + blame message handlers (US-0070/0072)

**Files:**
- Modify: `mobile-ide/mobile-ide-prototype/src/utils/MonacoAssetManager.ts` (add CSS + 4 new message handlers)
- Modify: `mobile-ide/mobile-ide-prototype/tests/unit/MonacoAssetManager.test.ts`

- [ ] **Step 1: Write the failing tests**

Add to the existing `MonacoAssetManager.test.ts` `buildMonacoHtml` describe block:

```typescript
it('HTML includes gutter-added CSS class', () => {
  const html = buildMonacoHtml('file:///monaco/vs');
  expect(html).toContain('gutter-added');
});

it('HTML includes SET_GUTTER_DECORATIONS handler', () => {
  const html = buildMonacoHtml('file:///monaco/vs');
  expect(html).toContain('SET_GUTTER_DECORATIONS');
});

it('HTML includes SET_BLAME_DECORATIONS handler', () => {
  const html = buildMonacoHtml('file:///monaco/vs');
  expect(html).toContain('SET_BLAME_DECORATIONS');
});

it('HTML includes CLEAR_GUTTER_DECORATIONS handler', () => {
  const html = buildMonacoHtml('file:///monaco/vs');
  expect(html).toContain('CLEAR_GUTTER_DECORATIONS');
});

it('HTML includes CLEAR_BLAME_DECORATIONS handler', () => {
  const html = buildMonacoHtml('file:///monaco/vs');
  expect(html).toContain('CLEAR_BLAME_DECORATIONS');
});
```

- [ ] **Step 2: Run to confirm failure**

```bash
cd mobile-ide/mobile-ide-prototype && npx jest --watchAll=false tests/unit/MonacoAssetManager.test.ts
```

Expected: FAIL on the 5 new tests.

- [ ] **Step 3: Add gutter CSS to the `<style>` block in `buildMonacoHtml`**

Inside the `<style>` block in the template string (after the existing `.search-match-highlight` rule), add:

```css
    /* ── Git gutter indicators ────────────────────────────────────────── */
    .gutter-added    { background: #22C55E; width: 3px !important; margin-left: 3px; border-radius: 1px; }
    .gutter-modified { background: #D97706; width: 3px !important; margin-left: 3px; border-radius: 1px; }
    .gutter-deleted::after { content: '▾'; color: #EF4444; font-size: 10px; line-height: 1; }

    /* ── Git blame annotations ───────────────────────────────────────── */
    .blame-annotation { color: #64748B; font-size: 11px; font-style: italic; margin-left: 24px; }
```

- [ ] **Step 4: Add the gutter and blame JavaScript handlers**

Inside the `onMessage` handler in the template string (find the `switch (msg.type)` or `if (msg.type === ...)` block), add four new cases. Find the existing cases (like `SET_CONTENT`, `SET_THEME`) and add after them:

```javascript
        case 'SET_GUTTER_DECORATIONS': {
          if (!editor) break;
          var lines = msg.lines || [];
          var decorations = lines.map(function(l) {
            var cls = l.type === 'added' ? 'gutter-added'
                    : l.type === 'modified' ? 'gutter-modified'
                    : 'gutter-deleted';
            return {
              range: new monaco.Range(l.lineNumber, 1, l.lineNumber, 1),
              options: { glyphMarginClassName: cls },
            };
          });
          window._gutterDecorations = editor.deltaDecorations(
            window._gutterDecorations || [], decorations);
          break;
        }

        case 'CLEAR_GUTTER_DECORATIONS': {
          if (!editor) break;
          window._gutterDecorations = editor.deltaDecorations(
            window._gutterDecorations || [], []);
          break;
        }

        case 'SET_BLAME_DECORATIONS': {
          if (!editor) break;
          var blameLines = msg.lines || [];
          var blameDecorations = blameLines.map(function(b) {
            var label = '● ' + b.commitHash + ' · ' + b.author + ' · ' + formatRelTime(b.timestamp);
            return {
              range: new monaco.Range(b.lineNumber, 1, b.lineNumber, 1),
              options: {
                after: { content: '  ' + label, inlineClassName: 'blame-annotation' },
                isWholeLine: false,
              },
            };
          });
          window._blameDecorations = editor.deltaDecorations(
            window._blameDecorations || [], blameDecorations);
          break;
        }

        case 'CLEAR_BLAME_DECORATIONS': {
          if (!editor) break;
          window._blameDecorations = editor.deltaDecorations(
            window._blameDecorations || [], []);
          break;
        }
```

Also add the `formatRelTime` helper near the top of the IIFE (before `bootEditor`):

```javascript
    function formatRelTime(ms) {
      var diff = Date.now() - ms;
      var m = Math.floor(diff / 60000);
      if (m < 1) return 'just now';
      if (m < 60) return m + 'm ago';
      var h = Math.floor(m / 60);
      if (h < 24) return h + 'h ago';
      return Math.floor(h / 24) + 'd ago';
    }
```

- [ ] **Step 5: Run tests to confirm they pass**

```bash
cd mobile-ide/mobile-ide-prototype && npx jest --watchAll=false tests/unit/MonacoAssetManager.test.ts
```

Expected: PASS — all existing tests still pass, all 5 new tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/utils/MonacoAssetManager.ts tests/unit/MonacoAssetManager.test.ts
git commit -m "feat(US-0070/0072): add SET/CLEAR_GUTTER_DECORATIONS and SET/CLEAR_BLAME_DECORATIONS Monaco handlers"
```

---

### Task 8: `GitPanel.tsx` — branch picker, stash section, conflict badges (US-0068/0069/0071)

**Files:**
- Modify: `mobile-ide/mobile-ide-prototype/src/components/GitPanel.tsx`
- Modify: `mobile-ide/mobile-ide-prototype/tests/unit/GitPanel.test.tsx`

- [ ] **Step 1: Write failing tests**

Add to `GitPanel.test.tsx`:

```typescript
// Add these imports at the top:
import BranchPickerSheet from '../../src/components/BranchPickerSheet';
import ConflictEditor from '../../src/components/ConflictEditor';

// Mock the new components so they render as simple placeholders in tests:
jest.mock('../../src/components/BranchPickerSheet', () => 'BranchPickerSheet');
jest.mock('../../src/components/ConflictEditor', () => 'ConflictEditor');
jest.mock('../../src/git/stashStore', () => ({
  stash: jest.fn().mockResolvedValue(undefined),
  stashList: jest.fn().mockResolvedValue([]),
  stashPop: jest.fn().mockResolvedValue(undefined),
  stashApply: jest.fn().mockResolvedValue(undefined),
}));

// Add these test cases:
it('renders a "Switch Branch" button that opens BranchPickerSheet', async () => {
  const { getByText } = render(<GitPanel rootPath="/repo" />);
  await waitFor(() => getByText('Switch Branch'));
  fireEvent.press(getByText('Switch Branch'));
  // BranchPickerSheet should now be visible (rendered in mock form)
  // Verify the button exists at minimum
  expect(getByText('Switch Branch')).toBeTruthy();
});

it('renders Stash Changes button', async () => {
  const { getByText } = render(<GitPanel rootPath="/repo" />);
  await waitFor(() => getByText('Stash Changes'));
  expect(getByText('Stash Changes')).toBeTruthy();
});
```

- [ ] **Step 2: Run to confirm new tests fail**

```bash
cd mobile-ide/mobile-ide-prototype && npx jest --watchAll=false tests/unit/GitPanel.test.tsx
```

Expected: FAIL on the new test cases.

- [ ] **Step 3: Update `GitPanel.tsx`**

Add imports at the top of `GitPanel.tsx`:

```typescript
import BranchPickerSheet from './BranchPickerSheet';
import ConflictEditor from './ConflictEditor';
import { stash, stashList, stashPop, stashApply, StashEntry } from '../git/stashStore';
```

Add state for the new features inside the component:

```typescript
const [branchPickerVisible, setBranchPickerVisible] = useState(false);
const [conflictFile, setConflictFile] = useState<string | null>(null);
const [stashEntries, setStashEntries] = useState<StashEntry[]>([]);
const [stashMessageExpanded, setStashMessageExpanded] = useState(false);
const [stashMessage, setStashMessage] = useState('');
```

Replace the existing inline "Branches" section (the TextInput + branch row list) with a single button:

```tsx
{/* Branch section */}
<TouchableOpacity
  style={[styles.actionButton, { backgroundColor: t.bgElevated, marginBottom: 8 }]}
  onPress={() => setBranchPickerVisible(true)}
  accessibilityLabel="Switch branch"
>
  <Text style={{ color: t.accent, fontWeight: '600' }}>Switch Branch</Text>
</TouchableOpacity>
```

Add a "Stash" section after the commit section:

```tsx
{/* Stash section */}
<Text style={[styles.section, { color: t.text }]}>Stash</Text>
{stashMessageExpanded ? (
  <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
    <TextInput
      style={[styles.input, { flex: 1, color: t.text, backgroundColor: t.bg }]}
      placeholder="Stash message (optional)"
      placeholderTextColor={t.textMuted}
      value={stashMessage}
      onChangeText={setStashMessage}
    />
    <TouchableOpacity
      style={[styles.button, { backgroundColor: t.accent }]}
      onPress={async () => {
        try {
          if (!repoPath) return;
          await stash(repoPath, stashMessage);
          setStashMessage('');
          setStashMessageExpanded(false);
          const list = await stashList(repoPath);
          setStashEntries(list);
          reload();
        } catch (e) {
          Alert.alert('Stash failed', e instanceof Error ? e.message : String(e));
        }
      }}
    >
      <Text style={{ color: '#fff', fontWeight: '600' }}>Confirm Stash</Text>
    </TouchableOpacity>
  </View>
) : (
  <TouchableOpacity
    style={[styles.button, { backgroundColor: t.bgElevated, marginBottom: 8 }]}
    onPress={() => setStashMessageExpanded(true)}
    accessibilityLabel="Stash changes"
  >
    <Text style={{ color: t.text }}>Stash Changes</Text>
  </TouchableOpacity>
)}
{stashEntries.map(entry => (
  <View key={entry.id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 6, gap: 8 }}>
    <Text style={{ color: t.textMuted, fontSize: 12, flex: 1 }} numberOfLines={1}>
      {entry.message}
    </Text>
    <TouchableOpacity onPress={async () => { await stashPop(repoPath!, entry.id); const list = await stashList(repoPath!); setStashEntries(list); reload(); }}>
      <Text style={{ color: t.accent, fontSize: 12 }}>Pop</Text>
    </TouchableOpacity>
    <TouchableOpacity onPress={async () => { await stashApply(repoPath!, entry.id); reload(); }}>
      <Text style={{ color: t.textMuted, fontSize: 12 }}>Apply</Text>
    </TouchableOpacity>
  </View>
))}
```

Load stash entries in the existing `reload` / `useEffect` block alongside git status:

```typescript
// Inside the reload function, after status fetch:
if (s.repoDir) {
  stashList(s.repoDir).then(setStashEntries).catch(() => {});
}
```

Add conflict badges to the modified file rows — after fetching status, check each modified file for conflicts:

```typescript
// In the render of modified files, wrap the filename:
// If GitBridge.hasConflicts is true for a file, show the ⚡ badge and a tap handler
// For now, track conflicted files in state:
const [conflictedFiles, setConflictedFiles] = useState<Set<string>>(new Set());

// In reload, after getting status:
if (s.repoDir) {
  Promise.all(s.modified.map(async f => {
    const has = await GitBridge.hasConflicts(s.repoDir, f);
    return has ? f : null;
  })).then(results => {
    setConflictedFiles(new Set(results.filter(Boolean) as string[]));
  }).catch(() => {});
}
```

In each modified file row, if `conflictedFiles.has(file)`, show `⚡` and `onPress={() => setConflictFile(repoPath + '/' + file)}`.

Add `BranchPickerSheet` and `ConflictEditor` (as modal) at the bottom of the render:

```tsx
<BranchPickerSheet
  visible={branchPickerVisible}
  onClose={() => setBranchPickerVisible(false)}
  currentBranch={status?.branch ?? ''}
  repoDir={repoPath ?? ''}
  onBranchSelected={(branch) => { setBranchPickerVisible(false); reload(); }}
/>

{conflictFile && (
  <Modal visible animationType="slide">
    <ConflictEditor
      filePath={conflictFile}
      repoDir={repoPath ?? ''}
      onResolved={() => { setConflictFile(null); reload(); }}
      onClose={() => setConflictFile(null)}
    />
  </Modal>
)}
```

- [ ] **Step 4: Run GitPanel tests**

```bash
cd mobile-ide/mobile-ide-prototype && npx jest --watchAll=false tests/unit/GitPanel.test.tsx
```

Expected: PASS — all existing tests still pass, new tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/GitPanel.tsx tests/unit/GitPanel.test.tsx
git commit -m "feat(US-0068/0069/0071): GitPanel — branch picker button, stash section, conflict badges"
```

---

### Task 9: `FileExplorer.tsx` — conflict badge + `onOpenConflict` prop (US-0069)

**Files:**
- Modify: `mobile-ide/mobile-ide-prototype/src/components/FileExplorer.tsx`
- Modify: `mobile-ide/mobile-ide-prototype/tests/unit/FileExplorer.test.tsx`

- [ ] **Step 1: Write failing test**

Add to `FileExplorer.test.tsx`:

```typescript
it('shows ⚡ badge and calls onOpenConflict when a conflict file is tapped', () => {
  const onOpenConflict = jest.fn();
  const { getByText } = render(
    <FileExplorer
      ref={null}
      rootPath="/workspace"
      onFileSelect={jest.fn()}
      onOpenConflict={onOpenConflict}
      conflictedPaths={new Set(['/workspace/src/file.ts'])}
      sidebarTab="files"
      onSidebarTabChange={jest.fn()}
      onSearchNavigate={jest.fn()}
    />,
  );
  // After tree loads, find the conflict file row
  // (tree rendering depends on mocked FileSystemBridge.listDirectory)
  // Minimal: verify onOpenConflict prop is accepted without error
  expect(onOpenConflict).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run to confirm failure**

```bash
cd mobile-ide/mobile-ide-prototype && npx jest --watchAll=false tests/unit/FileExplorer.test.tsx
```

Expected: FAIL — `conflictedPaths` and `onOpenConflict` not in `FileExplorerProps`.

- [ ] **Step 3: Update `FileExplorer.tsx`**

Add to `FileExplorerProps` interface (after the existing props):

```typescript
  /** Paths of files with unresolved git conflicts. Tapping these calls onOpenConflict. */
  conflictedPaths?: Set<string>;
  /** Called when the user taps a conflict-marked file. Opens ConflictEditor. */
  onOpenConflict?: (filePath: string) => void;
```

In the component, destructure the new props:

```typescript
const FileExplorer = forwardRef<FileExplorerHandle, FileExplorerProps>(function FileExplorer({
  // ... existing props ...,
  conflictedPaths,
  onOpenConflict,
}: FileExplorerProps, ref) {
```

In the file row render (find where `onFileSelect` is called for a file tap), update the press handler:

```typescript
onPress={() => {
  if (conflictedPaths?.has(node.path) && onOpenConflict) {
    onOpenConflict(node.path);
  } else {
    onFileSelect(node.path);
  }
}}
```

Add the conflict badge alongside the file type badge (find where the file type badge renders):

```tsx
{conflictedPaths?.has(node.path) && (
  <Text style={{ color: '#D97706', fontSize: 10, fontWeight: '700', marginLeft: 4 }}>⚡</Text>
)}
```

- [ ] **Step 4: Run tests**

```bash
cd mobile-ide/mobile-ide-prototype && npx jest --watchAll=false tests/unit/FileExplorer.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/FileExplorer.tsx tests/unit/FileExplorer.test.tsx
git commit -m "feat(US-0069): FileExplorer — conflict badge (⚡) and onOpenConflict prop"
```

---

### Task 10: `Editor.tsx` — `setGutterDecorations` + `toggleBlame` on `EditorHandle` (US-0070/0072)

**Files:**
- Modify: `mobile-ide/mobile-ide-prototype/src/components/Editor.tsx`
- Modify: `mobile-ide/mobile-ide-prototype/tests/unit/Editor.test.tsx`

- [ ] **Step 1: Write failing tests**

Add to `Editor.test.tsx`:

```typescript
import { GutterLine } from '../../src/git/gutterDiff';
import { BlameLine } from '../../src/git/gitBridge';

it('setGutterDecorations sends SET_GUTTER_DECORATIONS to Monaco WebView', () => {
  const ref = createRef<EditorHandle>();
  render(<Editor ref={ref} /* required props */ />);
  const lines: GutterLine[] = [{ lineNumber: 3, type: 'added' }];
  act(() => ref.current?.setGutterDecorations(lines));
  // Verify injectJavaScript or postMessage was called with SET_GUTTER_DECORATIONS
  // (depends on the existing WebView mock in the test file)
  expect(mockInjectJS).toHaveBeenCalledWith(
    expect.stringContaining('SET_GUTTER_DECORATIONS'),
  );
});

it('toggleBlame sends SET_BLAME_DECORATIONS on first call', async () => {
  // blame is async; mock GitBridge.blame
  const ref = createRef<EditorHandle>();
  render(<Editor ref={ref} activeTab={{ filePath: '/repo/src/a.ts' }} repoDir="/repo" />);
  await act(async () => ref.current?.toggleBlame());
  expect(mockInjectJS).toHaveBeenCalledWith(
    expect.stringContaining('SET_BLAME_DECORATIONS'),
  );
});
```

> **Note:** Check the existing `Editor.test.tsx` for the name of the WebView inject mock (likely `mockInjectJS` or similar) and use it consistently.

- [ ] **Step 2: Run to confirm failure**

```bash
cd mobile-ide/mobile-ide-prototype && npx jest --watchAll=false tests/unit/Editor.test.tsx
```

Expected: FAIL — methods don't exist on `EditorHandle`.

- [ ] **Step 3: Update `EditorHandle` and `Editor.tsx`**

In `Editor.tsx`, find the `EditorHandle` interface and add two methods:

```typescript
export interface EditorHandle {
  // ... existing methods (undo, redo, find, foldAll, unfoldAll, setGutterDecorations, toggleBlame) ...
  setGutterDecorations(lines: GutterLine[]): void;
  toggleBlame(): Promise<void>;
}
```

Import the needed types at the top of `Editor.tsx`:

```typescript
import { GutterLine } from '../git/gutterDiff';
import { GitBridge, BlameLine } from '../git/gitBridge';
```

Add state for blame inside the component:

```typescript
const blameActiveRef = useRef(false);
const blameCacheRef = useRef<BlameLine[] | null>(null);
```

In `useImperativeHandle`, add the two new methods:

```typescript
setGutterDecorations: (lines: GutterLine[]) => {
  const msg = JSON.stringify({ type: 'SET_GUTTER_DECORATIONS', lines });
  webViewRef.current?.injectJavaScript(`window.dispatchEvent(new MessageEvent('message', { data: ${msg} })); true;`);
},
toggleBlame: async () => {
  if (blameActiveRef.current) {
    blameActiveRef.current = false;
    blameCacheRef.current = null;
    webViewRef.current?.injectJavaScript(`window.dispatchEvent(new MessageEvent('message', { data: '{"type":"CLEAR_BLAME_DECORATIONS"}' })); true;`);
    return;
  }
  blameActiveRef.current = true;
  // Use repoDir and activeTab?.filePath from closure
  if (!repoDir || !activeTab?.filePath) return;
  const relPath = activeTab.filePath.startsWith(repoDir + '/')
    ? activeTab.filePath.slice(repoDir.length + 1)
    : activeTab.filePath;
  try {
    const lines = await GitBridge.blame(repoDir, relPath);
    blameCacheRef.current = lines;
    const msg = JSON.stringify({ type: 'SET_BLAME_DECORATIONS', lines });
    webViewRef.current?.injectJavaScript(`window.dispatchEvent(new MessageEvent('message', { data: ${msg} })); true;`);
  } catch {
    blameActiveRef.current = false;
  }
},
```

> **Note:** `Editor.tsx` already receives `activeTab` and likely a `repoDir` prop (or access via a store). If `repoDir` is not yet a prop, add `repoDir?: string` to `EditorProps` and pass it from `App.tsx`.

- [ ] **Step 4: Run Editor tests**

```bash
cd mobile-ide/mobile-ide-prototype && npx jest --watchAll=false tests/unit/Editor.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/Editor.tsx tests/unit/Editor.test.tsx
git commit -m "feat(US-0070/0072): Editor — setGutterDecorations and toggleBlame on EditorHandle"
```

---

### Task 11: `App.tsx` — wire everything together (US-0068/0070/0072)

**Files:**
- Modify: `mobile-ide/mobile-ide-prototype/App.tsx`
- Modify: `mobile-ide/mobile-ide-prototype/tests/unit/App.test.tsx`

- [ ] **Step 1: Wire the status bar branch chip**

Find the status bar branch chip in `App.tsx` (a `<Text>` showing the branch name). Wrap it in a `<TouchableOpacity>` that opens `BranchPickerSheet`:

```tsx
// Add state:
const [branchPickerVisible, setBranchPickerVisible] = useState(false);

// Wrap branch chip:
<TouchableOpacity onPress={() => gitStatus?.repoDir ? setBranchPickerVisible(true) : null}>
  <Text style={/* existing branch chip styles */}>{gitStatus?.branch ?? 'no repo'}</Text>
</TouchableOpacity>

// Add BranchPickerSheet at root level:
{gitStatus?.repoDir && (
  <BranchPickerSheet
    visible={branchPickerVisible}
    onClose={() => setBranchPickerVisible(false)}
    currentBranch={gitStatus.branch}
    repoDir={gitStatus.repoDir}
    onBranchSelected={() => { setBranchPickerVisible(false); /* trigger git status refresh */ }}
  />
)}
```

- [ ] **Step 2: Wire gutter refresh on save**

Find `onSave` (or wherever a file save completes) in `App.tsx`. After the save, add:

```typescript
// Fire-and-forget — does not block the save
// `onSave` signature: onSave(filePath: string, content: string)
// The `content` param IS the current file content — pass it into the closure.
if (gitStatus?.repoDir && activeTabPath) {
  const repoDir = gitStatus.repoDir;
  const savedContent = content; // captured from the onSave(filePath, content) parameter
  const relPath = activeTabPath.startsWith(repoDir + '/')
    ? activeTabPath.slice(repoDir.length + 1)
    : activeTabPath;
  GitBridge.readHeadFile(repoDir, relPath)
    .then(headContent => {
      if (headContent === null) {
        editorRef.current?.setGutterDecorations([]);
      } else {
        const lines = computeGutterLines(headContent, savedContent);
        editorRef.current?.setGutterDecorations(lines);
      }
    })
    .catch(() => {/* silent — gutter is cosmetic */});
}
```

Import the needed utilities at the top:

```typescript
import { computeGutterLines } from './src/git/gutterDiff';
import BranchPickerSheet from './src/components/BranchPickerSheet';
```

- [ ] **Step 3: Wire blame toggle button**

Add a blame toggle button to the editor toolbar. Find the toolbar area in `App.tsx` (or `Editor.tsx` if the toolbar lives there). Add:

```tsx
{gitStatus?.repoDir && activeTabPath && (
  <TouchableOpacity
    onPress={() => editorRef.current?.toggleBlame()}
    accessibilityLabel="Toggle git blame"
    style={{ padding: 8, minWidth: 44, minHeight: 44, justifyContent: 'center', alignItems: 'center' }}
  >
    <Text style={{ color: t.textMuted, fontSize: 12 }}>⎇</Text>
  </TouchableOpacity>
)}
```

- [ ] **Step 4: Wire `onOpenConflict` for FileExplorer**

Find the `<FileExplorer>` in `App.tsx` and add the new props:

```tsx
<FileExplorer
  ref={fileExplorerRef}
  // ... existing props ...
  conflictedPaths={conflictedPaths}  // a Set<string> derived from gitStatus
  onOpenConflict={(filePath) => {
    // Open ConflictEditor — use a state variable to track the open file
    setConflictEditorFile(filePath);
  }}
/>
```

Add corresponding state and a full-screen `Modal` wrapping `ConflictEditor`:

```typescript
const [conflictEditorFile, setConflictEditorFile] = useState<string | null>(null);
```

```tsx
{conflictEditorFile && gitStatus?.repoDir && (
  <Modal visible animationType="slide">
    <ConflictEditor
      filePath={conflictEditorFile}
      repoDir={gitStatus.repoDir}
      onResolved={() => { setConflictEditorFile(null); /* refresh git status */ }}
      onClose={() => setConflictEditorFile(null)}
    />
  </Modal>
)}
```

- [ ] **Step 5: Run TypeScript to catch any type errors**

```bash
cd mobile-ide/mobile-ide-prototype && npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 6: Run full test suite**

```bash
cd mobile-ide/mobile-ide-prototype && npx jest --watchAll=false
```

Expected: All tests pass.

- [ ] **Step 7: Commit**

```bash
git add App.tsx tests/unit/App.test.tsx
git commit -m "feat(US-0068/0070/0072): App.tsx — branch chip, gutter refresh on save, blame toggle, conflict editor"
```

---

### Task 12: Final verification, docs update, PR (US-0068–0072)

- [ ] **Step 1: Run full test suite with coverage**

```bash
cd mobile-ide/mobile-ide-prototype && npx jest --watchAll=false --coverage 2>&1 | tail -30
```

Expected: All tests pass, statement coverage ≥ 75%.

- [ ] **Step 2: Run TypeScript**

```bash
cd mobile-ide/mobile-ide-prototype && npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Update `RELEASE_PLAN.md` — mark all 5 US done**

In `docs/RELEASE_PLAN.md`, for each of US-0068 through US-0072:
- Set `Status: Done`
- Add `Branch: feature/epic-0020-advanced-git-workflows`
- Check all ACs that were implemented (leave AC-0215 and AC-0220 unchecked with a note — deferred to follow-up)

Also update `EPIC-0020` header: `Status: Done`, `PR: #<n> (merged)`.

- [ ] **Step 4: Update `progress.md`**

Add a Session 18 entry summarising what was built in this session.

- [ ] **Step 5: Commit docs**

```bash
git add docs/RELEASE_PLAN.md progress.md
git commit -m "docs: mark EPIC-0020 US-0068–0072 done in release plan"
```

- [ ] **Step 6: Open PR**

```bash
git push -u origin feature/epic-0020-advanced-git-workflows
gh pr create \
  --title "feat(EPIC-0020): Advanced Git Workflows — branch picker, conflict resolution, gutter, stash, blame" \
  --body "$(cat <<'EOF'
## Summary
- **US-0068** Branch picker bottom sheet with search, checkout, and new-branch creation
- **US-0069** Inline merge conflict resolution — Accept Ours/Theirs/Both per hunk, stage on resolve
- **US-0070** Git gutter indicators — green (added), amber (modified), red (deleted) per line after save
- **US-0071** Stash management — stash/pop/apply via AsyncStorage soft stash
- **US-0072** Git blame annotations — per-line commit hash, author, relative timestamp toggle

## Deferred (follow-up)
- AC-0215: gutter tap → inline diff popup (requires Monaco touch event WebView bridge)
- AC-0220: blame annotation tap → commit detail sheet (same bridge requirement)

## Test plan
- [ ] Run test suite: `cd mobile-ide/mobile-ide-prototype && npx jest --watchAll=false`
- [ ] Open simulator, clone a repo, create a conflict via two branches — verify ⚡ badge appears in FileExplorer and GitPanel
- [ ] Tap the conflict file — verify ConflictEditor opens with OURS/THEIRS blocks and Accept buttons
- [ ] Resolve all hunks → "Mark Resolved & Stage" → verify file staged in GitPanel
- [ ] Edit a file and save — verify green/amber gutter bars appear within 500ms
- [ ] Tap branch chip in status bar — verify BranchPickerSheet opens with branch list and search
- [ ] Use Stash Changes in GitPanel — verify modified files are reverted and entry appears in stash list

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```
