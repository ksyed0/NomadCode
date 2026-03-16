/**
 * Unit tests — useAuthStore
 *
 * expo-secure-store and fetch are mocked.
 * Coverage: initial state, signInWithToken (valid/invalid), signOut, hydrate.
 */

import { act, renderHook } from '@testing-library/react-native';

// Mock expo-secure-store before importing the store
const mockSecureStore: Record<string, string> = {};
jest.mock('expo-secure-store', () => ({
  setItemAsync: jest.fn((key: string, value: string) => {
    mockSecureStore[key] = value;
    return Promise.resolve();
  }),
  getItemAsync: jest.fn((key: string) => Promise.resolve(mockSecureStore[key] ?? null)),
  deleteItemAsync: jest.fn((key: string) => {
    delete mockSecureStore[key];
    return Promise.resolve();
  }),
}));

import useAuthStore from '../../src/stores/useAuthStore';

// Mock global fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

function mockGitHubUser() {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({ login: 'testuser', avatar_url: 'https://example.com/avatar.png' }),
  });
}

function mockGitHubUserFail() {
  mockFetch.mockResolvedValueOnce({ ok: false, status: 401 });
}

beforeEach(() => {
  jest.clearAllMocks();
  Object.keys(mockSecureStore).forEach((k) => delete mockSecureStore[k]);
  useAuthStore.setState({
    token: null,
    username: null,
    avatarUrl: null,
    isLoading: false,
    error: null,
  });
});

describe('useAuthStore — initial state', () => {
  it('starts with no token', () => {
    const { result } = renderHook(() => useAuthStore());
    expect(result.current.token).toBeNull();
  });

  it('starts with no username', () => {
    const { result } = renderHook(() => useAuthStore());
    expect(result.current.username).toBeNull();
  });

  it('starts with no error', () => {
    const { result } = renderHook(() => useAuthStore());
    expect(result.current.error).toBeNull();
  });
});

describe('useAuthStore — signInWithToken (PAT)', () => {
  it('stores token and populates username on valid token', async () => {
    mockGitHubUser();
    const { result } = renderHook(() => useAuthStore());
    await act(async () => { await result.current.signInWithToken('ghp_valid'); });
    expect(result.current.token).toBe('ghp_valid');
    expect(result.current.username).toBe('testuser');
    expect(result.current.avatarUrl).toBe('https://example.com/avatar.png');
    expect(result.current.error).toBeNull();
  });

  it('persists token to SecureStore', async () => {
    mockGitHubUser();
    const { result } = renderHook(() => useAuthStore());
    await act(async () => { await result.current.signInWithToken('ghp_valid'); });
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const SecureStore = require('expo-secure-store');
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('github_token', 'ghp_valid');
  });

  it('sets error and does not store token on invalid token', async () => {
    mockGitHubUserFail();
    const { result } = renderHook(() => useAuthStore());
    await act(async () => { await result.current.signInWithToken('ghp_bad'); });
    expect(result.current.token).toBeNull();
    expect(result.current.error).toBeTruthy();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const SecureStore = require('expo-secure-store');
    expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
  });

  it('sets error on network failure', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));
    const { result } = renderHook(() => useAuthStore());
    await act(async () => { await result.current.signInWithToken('ghp_x'); });
    expect(result.current.token).toBeNull();
    expect(result.current.error).toContain('Could not reach GitHub');
  });

  it('shows auth error message on 401', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 401 });
    const { result } = renderHook(() => useAuthStore());
    await act(async () => { await result.current.signInWithToken('ghp_bad'); });
    expect(result.current.error).toBe('Token is invalid or lacks required permissions.');
  });
});

describe('useAuthStore — signOut', () => {
  it('clears token, username, and avatarUrl', async () => {
    mockGitHubUser();
    const { result } = renderHook(() => useAuthStore());
    await act(async () => { await result.current.signInWithToken('ghp_valid'); });
    await act(async () => { await result.current.signOut(); });
    expect(result.current.token).toBeNull();
    expect(result.current.username).toBeNull();
    expect(result.current.avatarUrl).toBeNull();
  });

  it('deletes token from SecureStore on sign out', async () => {
    mockGitHubUser();
    const { result } = renderHook(() => useAuthStore());
    await act(async () => { await result.current.signInWithToken('ghp_valid'); });
    await act(async () => { await result.current.signOut(); });
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const SecureStore = require('expo-secure-store');
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('github_token');
  });
});

describe('useAuthStore — hydrate', () => {
  it('restores session from SecureStore on hydrate', async () => {
    mockSecureStore['github_token'] = 'ghp_stored';
    mockGitHubUser();
    const { result } = renderHook(() => useAuthStore());
    await act(async () => { await result.current.hydrate(); });
    expect(result.current.token).toBe('ghp_stored');
    expect(result.current.username).toBe('testuser');
  });

  it('leaves signed-out state when no token in SecureStore', async () => {
    const { result } = renderHook(() => useAuthStore());
    await act(async () => { await result.current.hydrate(); });
    expect(result.current.token).toBeNull();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('preserves token but leaves username null when GitHub API fails during hydrate', async () => {
    mockSecureStore['github_token'] = 'ghp_stored';
    mockFetch.mockRejectedValueOnce(new Error('offline'));
    const { result } = renderHook(() => useAuthStore());
    await act(async () => { await result.current.hydrate(); });
    // Token is kept (don't force sign-out for offline hydrate)
    expect(result.current.token).toBe('ghp_stored');
    expect(result.current.username).toBeNull();
  });

  it('clears token from state and SecureStore when stored token returns 401 during hydrate', async () => {
    mockSecureStore['github_token'] = 'ghp_revoked';
    mockFetch.mockResolvedValueOnce({ ok: false, status: 401 });
    const { result } = renderHook(() => useAuthStore());
    await act(async () => { await result.current.hydrate(); });
    expect(result.current.token).toBeNull();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const SecureStore = require('expo-secure-store');
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('github_token');
  });
});
