/**
 * Unit tests — useGitStore
 */

import useGitStore from '../../src/stores/useGitStore';
import type { ConflictFile, StashEntry, BlameLine, GutterDiff } from '../../src/types/git';

describe('useGitStore', () => {
  beforeEach(() => {
    useGitStore.getState().reset();
  });

  it('setBranchInfo updates branch metadata', () => {
    useGitStore.getState().setBranchInfo('feat', 2, 1);
    expect(useGitStore.getState().branch).toBe('feat');
    expect(useGitStore.getState().ahead).toBe(2);
    expect(useGitStore.getState().behind).toBe(1);
  });

  it('setCloneProgress and setNetworkBusy toggle flags', () => {
    useGitStore.getState().setCloneProgress(0.5);
    expect(useGitStore.getState().cloneProgress).toBe(0.5);
    useGitStore.getState().setCloneProgress(null);
    expect(useGitStore.getState().cloneProgress).toBeNull();
    useGitStore.getState().setNetworkBusy(true);
    expect(useGitStore.getState().networkBusy).toBe(true);
  });

  it('setLastError stores message', () => {
    useGitStore.getState().setLastError('oops');
    expect(useGitStore.getState().lastError).toBe('oops');
  });

  it('bumpFileTree increments revision', () => {
    expect(useGitStore.getState().fileTreeRevision).toBe(0);
    useGitStore.getState().bumpFileTree();
    expect(useGitStore.getState().fileTreeRevision).toBe(1);
  });

  it('reset restores initial state', () => {
    useGitStore.getState().setBranchInfo('x', 1, 2);
    useGitStore.getState().bumpFileTree();
    useGitStore.getState().reset();
    expect(useGitStore.getState().branch).toBe('main');
    expect(useGitStore.getState().fileTreeRevision).toBe(0);
  });
});

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
