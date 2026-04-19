/**
 * Git UI state (branch, busy flags, clone progress) — Zustand per PROJECT.md.
 */

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
