/**
 * Unit tests — useGitStore
 */

import useGitStore from '../../src/stores/useGitStore';

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
