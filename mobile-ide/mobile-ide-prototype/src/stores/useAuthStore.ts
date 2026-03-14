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
  if (!res.ok) throw new Error(`GitHub API returned ${res.status}`);
  return res.json() as Promise<{ login: string; avatar_url: string }>;
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
      const isNetworkError = err instanceof Error && (
        err.message.toLowerCase().includes('network') ||
        err.message.toLowerCase().includes('fetch') ||
        err.message.toLowerCase().includes('offline') ||
        err.message.toLowerCase().includes('reach')
      );
      const message = isNetworkError
        ? 'Could not reach GitHub. Check your connection.'
        : 'Token is invalid or lacks required permissions.';
      set({ isLoading: false, error: message });
    }
  },

  signOut: async () => {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    set({ token: null, username: null, avatarUrl: null, error: null });
  },

  hydrate: async () => {
    const token = await SecureStore.getItemAsync(TOKEN_KEY);
    if (!token) return;
    try {
      const user = await fetchGitHubUser(token);
      set({ token, username: user.login, avatarUrl: user.avatar_url });
    } catch {
      // Offline or API error — keep token but leave username/avatar null
      set({ token });
    }
  },
}));

export default useAuthStore;
