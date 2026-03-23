# Design: EPIC-0007 — Authentication

**Date:** 2026-03-13
**Epic:** EPIC-0007 Authentication
**Stories:** US-0022, US-0023, US-0024
**ACs:** AC-0064–0070

---

## Context

No authentication infrastructure exists. `GitBridge` in `FileSystemBridge.ts` already accepts an optional `_token` parameter on all methods (clone, push, pull) — the auth token will slot straight in once implemented.

Two credential paths are required:
- **Primary:** GitHub OAuth browser redirect via `expo-auth-session`
- **Fallback:** Personal Access Token (PAT) input

The PAT path can be fully implemented and tested without external OAuth App credentials. The OAuth path requires a registered GitHub OAuth App (`client_id`, `client_secret`, redirect URI) configured via `.env`.

**Implementation order:** PAT path first (unblocks Git immediately), OAuth path second.

---

## Architecture

### New: `useAuthStore.ts`

Zustand store at `src/stores/useAuthStore.ts`.

```typescript
interface AuthState {
  token: string | null;
  username: string | null;
  avatarUrl: string | null;
  isLoading: boolean;
  error: string | null;
}

interface AuthActions {
  signInWithToken(token: string): Promise<void>; // PAT path
  signInWithOAuth(): Promise<void>;              // OAuth path
  signOut(): Promise<void>;
  hydrate(): Promise<void>;                      // restore from keychain on app start
}
```

Token persistence: `expo-secure-store` (`SecureStore.setItemAsync` / `getItemAsync` / `deleteItemAsync`). Key: `'github_token'`.

After storing token, fetches `https://api.github.com/user` with `Authorization: token <token>` to populate `username` and `avatarUrl`.

### Extended: `SettingsScreen.tsx`

New GITHUB ACCOUNT section (inserted first, above APPEARANCE).

**Signed-out state:**
- "Sign in with GitHub" button (primary, Nomad Blue)
- "Use a Personal Access Token instead" link → reveals PAT text input + "Connect" button

**Signed-in state:**
- Avatar circle (initials fallback if no avatar URL)
- Username label
- "Sign out" button (destructive style)

### Extended: `App.tsx`

Calls `useAuthStore().hydrate()` inside a `useEffect([], [])` on mount to restore session from keychain before the IDE is shown.

### `.env.example` additions

```
GITHUB_CLIENT_ID=your_github_oauth_app_client_id
GITHUB_CLIENT_SECRET=your_github_oauth_app_client_secret
GITHUB_REDIRECT_URI=nomadcode://auth
```

---

## OAuth Flow (US-0022, AC-0064–0066)

```
User taps "Sign in with GitHub"
  → expo-auth-session opens system browser
  → GitHub OAuth authorize URL:
      https://github.com/login/oauth/authorize
      ?client_id={GITHUB_CLIENT_ID}
      &scope=repo,read:user
      &redirect_uri={GITHUB_REDIRECT_URI}
  → User authorizes
  → GitHub redirects to nomadcode://auth?code={code}
  → expo-auth-session captures code
  → Exchange code for token:
      POST https://github.com/login/oauth/access_token
      { client_id, client_secret, code }
  → Store token via SecureStore
  → GET https://api.github.com/user → populate username + avatarUrl
  → useAuthStore state updated → SettingsScreen shows signed-in view
```

## PAT Flow (US-0022 fallback, US-0023)

```
User taps "Use a Personal Access Token instead"
  → PAT input field revealed
User pastes token + taps "Connect"
  → GET https://api.github.com/user with token
  → If 200: store token, populate username/avatarUrl, show signed-in view
  → If 401/non-200: show inline error "Token is invalid or lacks required permissions"
```

## Token Storage (US-0023, AC-0067–0068)

```
signInWithToken(token):
  → await SecureStore.setItemAsync('github_token', token)
  → state.token = token

hydrate():
  → token = await SecureStore.getItemAsync('github_token')
  → if token: fetch /user, populate state
  → called in App.tsx useEffect on mount
```

## Sign-out (US-0024, AC-0069–0070)

```
User taps "Sign out"
  → await SecureStore.deleteItemAsync('github_token')
  → state = { token: null, username: null, avatarUrl: null }
  → SettingsScreen reverts to signed-out view
  → Any subsequent GitBridge call without token will throw (prompt re-auth)
```

---

## Error Handling

| Scenario | Handling |
|---|---|
| OAuth: browser closed without completing | `expo-auth-session` returns `{ type: 'cancel' }` — no action, no error shown |
| OAuth: exchange request fails (network) | `error` state set → inline error message in SettingsScreen |
| PAT: invalid token (GitHub 401) | Inline error: "Token is invalid or lacks required permissions" |
| PAT: network error | Inline error: "Could not reach GitHub. Check your connection." |
| Hydrate: no stored token | Silent — signed-out state shown |
| Hydrate: stored token but GitHub API fails | Token preserved in keychain; username/avatar shown as null (graceful degradation) |

---

## Testing Plan

| File | Tests |
|---|---|
| `useAuthStore.test.ts` (new) | Initial state; signInWithToken stores token + populates username; signInWithToken with invalid token sets error; signOut clears token + state; hydrate restores session; hydrate with no stored token leaves signed-out |
| `SettingsScreen.test.tsx` (extend) | GITHUB ACCOUNT section renders; signed-out shows OAuth button + PAT toggle; PAT input revealed on toggle; signed-in shows username + sign-out button; sign-out button calls signOut |

---

## Implementation Sequence

1. **PAT path first** (fully testable, no external deps):
   - `useAuthStore.ts` with `signInWithToken`, `signOut`, `hydrate`
   - SettingsScreen GITHUB ACCOUNT section (signed-out PAT input + signed-in view)
   - `App.tsx` hydrate on mount

2. **OAuth path second** (requires `.env` GitHub OAuth App credentials):
   - Install `expo-auth-session`
   - Add `signInWithOAuth` to `useAuthStore`
   - Wire OAuth button in SettingsScreen
   - Update `.env.example`

---

## Dependencies to Install

```bash
npx expo install expo-auth-session expo-secure-store expo-web-browser
```

`expo-secure-store` — iOS Keychain / Android Keystore (AC-0067)
`expo-auth-session` — OAuth browser redirect (AC-0064)
`expo-web-browser` — required peer of expo-auth-session
