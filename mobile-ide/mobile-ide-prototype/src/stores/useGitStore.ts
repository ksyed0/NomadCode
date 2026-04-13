/**
 * Git UI state (branch, busy flags, clone progress) — Zustand per PROJECT.md.
 */

import { create } from 'zustand';

export interface GitStoreState {
  branch: string;
  ahead: number;
  behind: number;
  cloneProgress: number | null;
  networkBusy: boolean;
  lastError: string | null;
  fileTreeRevision: number;
  setBranchInfo: (branch: string, ahead: number, behind: number) => void;
  setCloneProgress: (p: number | null) => void;
  setNetworkBusy: (v: boolean) => void;
  setLastError: (msg: string | null) => void;
  bumpFileTree: () => void;
  reset: () => void;
}

const initial = {
  branch: 'main',
  ahead: 0,
  behind: 0,
  cloneProgress: null as number | null,
  networkBusy: false,
  lastError: null as string | null,
  fileTreeRevision: 0,
};

const useGitStore = create<GitStoreState>()((set) => ({
  ...initial,
  setBranchInfo: (branch, ahead, behind) => set({ branch, ahead, behind }),
  setCloneProgress: (p) => set({ cloneProgress: p }),
  setNetworkBusy: (v) => set({ networkBusy: v }),
  setLastError: (msg) => set({ lastError: msg }),
  bumpFileTree: () => set((s) => ({ fileTreeRevision: s.fileTreeRevision + 1 })),
  reset: () => set(initial),
}));

export default useGitStore;
