/**
 * useAuthStore — GitHub authentication state.
 *
 * PAT path:  signInWithToken(token) → validate via GitHub API → store in keychain
 * OAuth path: signInWithOAuth() — added in Task 5
 * Restore:   hydrate() called in App.tsx on mount
 */

import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'github_token';
const GITHUB_API_USER = 'https://api.github.com/user';

interface AuthState {
  token: string | null;
  username: string | null;
  avatarUrl: string | null;
  isLoading: boolean;
  error: string | null;
  signInWithToken: (token: string) => Promise<void>;
  signOut: () => Promise<void>;
  hydrate: () => Promise<void>;
}

async function fetchGitHubUser(token: string): Promise<{ login: string; avatar_url: string }> {
  const res = await fetch(GITHUB_API_USER, {
    headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github+json' },
  });
  if (!res.ok) {
    const err = new Error(`GitHub API returned ${res.status}`);
    (err as Error & { status?: number }).status = res.status;
    throw err;
  }
  const data: unknown = await res.json();
  if (
    typeof data !== 'object' ||
    data === null ||
    typeof (data as Record<string, unknown>).login !== 'string' ||
    typeof (data as Record<string, unknown>).avatar_url !== 'string'
  ) {
    throw new Error('Unexpected response shape from GitHub API.');
  }
  return data as { login: string; avatar_url: string };
}

const useAuthStore = create<AuthState>()((set) => ({
  token: null,
  username: null,
  avatarUrl: null,
  isLoading: false,
  error: null,

  signInWithToken: async (token: string) => {
    set({ isLoading: true, error: null });
    try {
      const user = await fetchGitHubUser(token);
      await SecureStore.setItemAsync(TOKEN_KEY, token);
      set({ token, username: user.login, avatarUrl: user.avatar_url, isLoading: false });
    } catch (err) {
      const status = err instanceof Error && 'status' in err
        ? (err as Error & { status?: number }).status
        : undefined;
      const isAuthError = status === 401 || status === 403;
      const message = isAuthError
        ? 'Token is invalid or lacks required permissions.'
        : 'Could not reach GitHub. Check your connection.';
      set({ isLoading: false, error: message });
    }
  },

  signOut: async () => {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    set({ token: null, username: null, avatarUrl: null, error: null, isLoading: false });
  },

  hydrate: async () => {
    const token = await SecureStore.getItemAsync(TOKEN_KEY);
    if (!token) return;
    set({ isLoading: true });
    try {
      const user = await fetchGitHubUser(token);
      set({ token, username: user.login, avatarUrl: user.avatar_url, isLoading: false });
    } catch (err) {
      // Keep token for offline case; clear it if revoked (401/403)
      const status = err instanceof Error && 'status' in err
        ? (err as Error & { status?: number }).status
        : undefined;
      if (status === 401 || status === 403) {
        await SecureStore.deleteItemAsync(TOKEN_KEY);
        set({ token: null, username: null, avatarUrl: null, isLoading: false });
      } else {
        // Offline or transient error — keep token but leave username/avatar null
        set({ token, isLoading: false });
      }
    }
  },
}));

export default useAuthStore;
