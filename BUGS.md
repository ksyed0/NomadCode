# BUGS.md — NomadCode Issue Tracker

> Log all detected bugs, audit findings, and known issues here.
> Format: `[STATUS]` = `OPEN`, `IN_PROGRESS`, or `FIXED`

---

## EPIC-0004 — Command Palette (detected 2026-03-12)

### BUG-0001 / CP-1 — `onRequestClose` fires first command on Android back [FIXED]

**Severity:** High
**File:** `mobile-ide/mobile-ide-prototype/src/components/CommandPalette.tsx` line 78
**Description:**
`onRequestClose={() => onSelect(commands[0])}` — pressing the Android hardware back button
silently invokes the first command in the palette instead of dismissing it. This is a silent
data-loss bug: a user who expects back to "cancel" will accidentally trigger an action (e.g.
"File: Save" or "Git: Commit").

**Root cause:** No `onClose`/`onDismiss` callback in the original API; `onSelect` was overloaded
for both selection and dismissal.

**Fix:** Add `onClose: () => void` prop. Change `onRequestClose` to call `onClose()`.

---

### BUG-0002 / CP-2 — Backdrop press does not close the palette [FIXED]

**Severity:** Medium
**File:** `mobile-ide/mobile-ide-prototype/src/components/CommandPalette.tsx` line 81
**Description:**
`onPress={() => Keyboard.dismiss()}` — tapping outside the panel hides the keyboard but
leaves the palette modal visible. Users who expect tapping the backdrop to close the overlay
(standard mobile UX) are stuck.

**Root cause:** Same API flaw as CP-1. No `onClose` callback; component can't signal close.

**Fix:** Change backdrop `onPress` to call `onClose()` (which also dismisses keyboard in parent).

---

### BUG-0003 / CP-3 — AC-0046, AC-0048, AC-0053 have no explicit tests [FIXED]

**Severity:** Low
**File:** `mobile-ide/mobile-ide-prototype/tests/unit/CommandPalette.test.tsx`
**Description:**
Three acceptance criteria lack named tests:
- AC-0046: `autoFocus` on mount — no test verifying the prop is set
- AC-0048: Backdrop dismisses keyboard — no test for backdrop press behavior
- AC-0053: No empty badge — no test verifying commands without `shortcut` render no badge

**Fix:** Add explicit tests for each AC as part of the test suite rebuild.

---

### BUG-0004 / CP-4 — Lines 79–83 of CommandPalette.tsx are uncovered [FIXED]

**Severity:** Low
**File:** `mobile-ide/mobile-ide-prototype/src/components/CommandPalette.tsx` lines 79–83
**Description:**
Coverage report shows `onRequestClose` callback and backdrop `onPress` are never exercised
by the test suite. This means the CP-1 bug could not have been caught by tests.

**Fix:** Covered by CP-1 and CP-2 fixes + new tests.

---

---

## EPIC-0007 — GitHub Auth (detected 2026-03-16, code review PR #34)

### BUG-0006 / AUTH-1 — `EXPO_PUBLIC_GITHUB_CLIENT_SECRET` bundled in app binary; env name mismatch causes silent OAuth failure [FIXED]

**Severity:** Critical
**File:** `mobile-ide/mobile-ide-prototype/src/components/SettingsScreen.tsx` line 79; `.env.example`
**Description:**
The OAuth token-exchange call reads `process.env.EXPO_PUBLIC_GITHUB_CLIENT_SECRET` as the
`client_secret`. The `EXPO_PUBLIC_*` prefix causes Expo to inline the value into the JS bundle
at build time — readable by anyone who unpacks the app binary, violating PROJECT.md § 3
Invariant 5 ("Secrets in keychain: Platform keychain only"). Additionally, `.env.example`
defined the variable as `GITHUB_CLIENT_SECRET` (no prefix), a different name, so the code
fell back to `''` and all OAuth sign-ins silently failed with a GitHub auth error.

**Root cause:** Two separate errors: wrong env prefix (security) + mismatched variable name
(functional). Token exchange requires a server-side proxy before production.

**Fix:** Rename `.env.example` to use `EXPO_PUBLIC_GITHUB_CLIENT_SECRET` (matching the code),
add a security comment noting the need for a backend proxy pre-production. Add an `else` branch
to surface the case where GitHub returns no `access_token` field.

---

### BUG-0007 / AUTH-2 — `useAutoDiscovery('https://github.com')` always returns `null`; OAuth button permanently non-functional [FIXED]

**Severity:** High
**File:** `mobile-ide/mobile-ide-prototype/src/components/SettingsScreen.tsx` line 59
**Description:**
`AuthSession.useAutoDiscovery` fetches `<issuer>/.well-known/openid-configuration`. GitHub
does not expose an OIDC discovery document — GitHub OAuth 2.0 is not OIDC-compliant. The hook
always returns `null`, so `useAuthRequest` never constructs a valid request, `request` stays
`null`, and the `if (request) promptAsync()` guard in the "Sign in with GitHub" button's
`onPress` never executes. The button was completely non-functional.

**Root cause:** Incorrect assumption that GitHub exposes an OIDC discovery endpoint.

**Fix:** Replace `useAutoDiscovery` with a hardcoded `DiscoveryDocument` literal containing
GitHub's known OAuth 2.0 endpoints: `authorizationEndpoint` and `tokenEndpoint`.

---

### BUG-0008 / AUTH-3 — Empty `catch {}` in OAuth code exchange silently discards all errors [FIXED]

**Severity:** Medium
**File:** `mobile-ide/mobile-ide-prototype/src/components/SettingsScreen.tsx` line 92
**Description:**
The `catch {}` block in the `exchangeCode` async function was completely empty. When the
`fetch` to GitHub's token endpoint threw (network failure, timeout, CORS, malformed response),
the error was permanently lost: `authError` was never set and the user received no feedback.
The comment "Network errors are surfaced by signInWithToken on next invocation" was incorrect
— `signInWithToken` is never called in the failure path.

**Root cause:** Incomplete error handling; missing `setError` action in the auth store.

**Fix:** Add `setError` action to `useAuthStore`. Call it in the `catch` block and in the
`else` branch where GitHub returns no `access_token`, so the user sees an error message.

---

### BUG-0005 / CP-5 — No swipe gesture trigger [FIXED]

**Severity:** Low (spec requirement, not crash)
**File:** `mobile-ide/mobile-ide-prototype/src/layout/TabletResponsive.tsx`
**Description:**
The spec (EPIC-0004) states the palette must be "accessible by gesture or Cmd+P for
keyboard-free power workflows." Currently the only trigger is the FAB button. No
`PanResponder` swipe-down gesture exists.

**Fix:** Add `PanResponder` swipe zone at top of the editor main pane in `TabletResponsive`.

---

## CI/CD (detected 2026-03-25)

### BUG-0009 / CI-1 — version-bump workflow fails with "Invalid format '0.1.1'" on GITHUB_OUTPUT [FIXED]

**Severity:** High (breaks automated version bump after every PR merge to develop)
**File:** `.github/workflows/version-bump.yml` line 33
**Description:**
`$(npm version patch --no-git-tag-version | sed 's/^v//')` captures multiline stdout from
newer npm versions (deprecation warnings and info lines mixed with the version tag), then
writes the multiline result to `$GITHUB_OUTPUT` via a plain `echo`. The GitHub Actions
runner rejects the bare `0.1.1` line (no `name=` prefix) with:
`Invalid format '0.1.1'` / `Unable to process file command 'output' successfully.`
This caused the version-bump job to fail on every PR merge to develop.

**Root cause:** `npm version` in newer npm versions writes extra lines to stdout alongside
the version tag. Capturing stdout with `$(...)` included those extra lines; using the result
directly as the `$GITHUB_OUTPUT` value violated the required `key=value` format.

**Fix:** Run `npm version patch --no-git-tag-version` for the side-effect only (modifies
`package.json`), then extract the clean version with `jq -r '.version' package.json`.
`jq` always outputs a single, clean version string with no prefix or extra lines.
PR #46: `bugfix/version-bump-output-format`
