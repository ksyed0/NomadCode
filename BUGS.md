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

---

## Simulator / Device (detected 2026-03-17)

### BUG-0009 / SIM-1 — iPhone simulator crashes on `SetupWizard` modal presentation [OPEN]

**Severity:** Medium
**File:** `mobile-ide/mobile-ide-prototype/src/components/SetupWizard.tsx`
**Description:**
Running the app via Expo Go on an iPhone simulator crashes within ~10 seconds of launch.
After Zustand store hydration, the `SetupWizard` `Modal` becomes visible; iOS 16+ throws a
`SIGABRT` in `-[UIViewController __supportedInterfaceOrientations]` during modal presentation
on a landscape-locked app. iPad handles this correctly.

**Root cause:** iOS 16+ throws when a modal is presented inside a landscape-locked app on
iPhone. The app enforces landscape orientation globally; iPhones do not support landscape-only
modals in the same way iPads do.

**Fix:** Gate `SetupWizard` to iPad only, or conditionally allow portrait on iPhone before
presenting the modal. Needs investigation.

---

---

## EPIC-0003 — Terminal (detected 2026-03-20, code review)

### BUG-0010 / TERM-1 — `node` command exposes `window.ReactNativeWebView` to user scripts [FIXED]

**Severity:** High
**File:** `mobile-ide/mobile-ide-prototype/src/terminal/bundle/index.ts`
**Description:**
The `node` command evaluated user JS with `new Function('console', 'require', code)`, which
shadowed `console` and `require` but left the full WebView global scope accessible, including
`window.ReactNativeWebView`. A malicious script could forge arbitrary `FILE_WRITE`/`FILE_READ`
messages directly to the native bridge, bypassing all dispatch guards.

**Root cause:** `new Function` only masks names that are explicitly declared as parameters;
globals like `window` remain fully accessible.

**Fix:** Proxy `window.ReactNativeWebView` to `undefined` inside the `node` sandbox scope.

---

### BUG-0011 / TERM-2 — Silent `undefined` spread in `FileBridge.handleMessage` for unknown message types [FIXED]

**Severity:** High
**File:** `mobile-ide/mobile-ide-prototype/src/terminal/FileBridge.ts`
**Description:**
When the WebView sent a message with an unrecognised type, `useTerminalBridge` passed it to
`FileBridge.handleMessage`, whose `switch` fell through without assigning `fileResult`.
Spreading `undefined` produced a `FILE_RESULT` with no `result`/`error` fields; `vfsRead`
silently resolved to `''` instead of rejecting.

**Root cause:** No guard for unrecognised message types before the `FileBridge.handleMessage` call.

**Fix:** Add an early-return guard for unknown types in `useTerminalBridge` before dispatching.

---

### BUG-0012 / TERM-3 — `resolvePath` does not normalise `..` segments [FIXED]

**Severity:** Medium
**File:** `mobile-ide/mobile-ide-prototype/src/terminal/bundle/index.ts`
**Description:**
`resolvePath` concatenated path segments without resolving `..`. Running `cd ..` then `pwd`
produced `/foo/bar/..` — an unnormalised path that compounded with subsequent operations,
causing `isomorphic-git` string-comparison and `pwd` output to be incorrect.

**Root cause:** Expo FileSystem resolves `..` at the OS level but isomorphic-git uses string
comparison on paths; unnormalised strings broke git operations silently.

**Fix:** Run result through a POSIX-style `..` resolver after joining segments.

---

### BUG-0013 / TERM-4 — TypeScript strict-mode implicit `any` errors in terminal dispatcher [FIXED]

**Severity:** Medium
**File:** `mobile-ide/mobile-ide-prototype/src/terminal/bundle/index.ts`
**Description:**
`tsc --noEmit` reported `TS7031`/`TS7006` implicit `any` on `statusMatrix` destructuring and
the `git.log` callback parameter.

**Root cause:** Destructure pattern lacked explicit type annotations.

**Fix:** Add explicit type annotations to `statusMatrix` row destructure and `git.log` commit
callback parameter.

---

### BUG-0014 / TERM-5 — `npm run` depth guard has no test coverage [FIXED]

**Severity:** Low
**File:** `mobile-ide/mobile-ide-prototype/tests/unit/dispatch.test.ts`
**Description:**
The npm recursion depth guard (fires after 5 levels) was implemented but no test verified its
behaviour. TC-0342/TC-0343 were absent from `dispatch.test.ts`.

**Root cause:** Depth-guard test cases were skipped during the Task 5 implementation pass.

**Fix:** Add TC-0342/TC-0343 covering the depth guard trigger and error message.

---

### BUG-0020 / TERM-7 — `App.tsx` wires deprecated `Terminal` stub instead of `TerminalWebView` [FIXED]

**Severity:** High
**File:** `mobile-ide/mobile-ide-prototype/App.tsx`
**Description:**
`App.tsx` imported `Terminal` from `./src/components/Terminal` (a deprecated stub marked
`@deprecated` since `TerminalWebView` was written). The stub had no VFS bridge, no git, and
no `touch` support; all unrecognised commands returned `bash: [command]: command not found`.

**Root cause:** The import was never updated when `TerminalWebView` replaced the stub.

**Fix:** Change the `App.tsx` import to use `TerminalWebView` and pass the required props.

---

### BUG-0021 / TERM-8 — `git status` throws "Cannot read properties of undefined (reading 'bind')" [FIXED]

**Severity:** Medium
**File:** `mobile-ide/mobile-ide-prototype/src/terminal/bundle/index.ts`
**Description:**
`isomorphic-git`'s `bindFs()` iterates a hardcoded commands array including `readlink` and
`symlink`, calling `.bind()` on each. `gitFs.promises` was missing those two entries, so
`undefined.bind()` threw before any git operation ran.

**Root cause:** `gitFs.promises` was assembled manually and omitted `readlink`/`symlink`.

**Fix:** Add `readlink` and `symlink` stubs to `gitFs.promises`.

---

### BUG-0022 / TERM-9 — Terminal `cwd` stays at `"/"` — `ls /` returns empty, `touch` creates files at wrong path [FIXED]

**Severity:** Medium
**File:** `mobile-ide/mobile-ide-prototype/src/components/TerminalWebView.tsx`
**Description:**
`TerminalWebView` sent `SET_CWD` via `useEffect` before `webViewRef.current` was populated.
`injectJavaScript` silently dropped the message via optional chaining; `cwd` remained `"/"`.

**Root cause:** The WebView bridge is not ready at `useEffect` mount time; the message needed
to be sent after `onLoadEnd`.

**Fix:** Move the initial `SET_CWD` dispatch to an `onLoadEnd` handler.

---

### BUG-0023 / TERM-10 — `sendToWebView` injects a JS object literal; `receiveFromRN` calls `JSON.parse` — all messages silently fail [FIXED]

**Severity:** Critical
**File:** `mobile-ide/mobile-ide-prototype/src/components/TerminalWebView.tsx`
**Description:**
`sendToWebView` called `injectJavaScript(`window.receiveFromRN(${JSON.stringify(msg)})`)`,
passing a JS object literal. `receiveFromRN` immediately called `JSON.parse(msgJson)`, which
coerced the object to `"[object Object]"` → `SyntaxError` → silent catch → message dropped.
All VFS operations hung; `SET_CWD` never updated `cwd` from `"/"`.

**Root cause:** `sendToWebView` needed to double-stringify so the injected JS passes a string
literal that `JSON.parse` can parse.

**Fix:** Change to `JSON.stringify(JSON.stringify(msg))` in `sendToWebView`.

---

---

## Develop — Session 6 (detected 2026-03-25)

### BUG-0015 / ANDROID-1 — `expo-crypto` missing from `package.json` causes "App entry not found" crash on Android [FIXED]

**Severity:** Critical
**File:** `mobile-ide/mobile-ide-prototype/package.json`
**Description:**
`expo-auth-session`'s top-level import calls `requireNativeModule('ExpoCrypto')`. Because
`expo-crypto` was not in `package.json`, the native module was never compiled into the APK by
Gradle autolinking, crashing the JS bundle before `AppRegistry.registerComponent`.

**Root cause:** `expo-auth-session@~6.0.3` peer-depends on `expo-crypto`, which was omitted.

**Fix:** Add `expo-crypto@~14.0.2` to `package.json`; rebuild APK.

---

### BUG-0016 / TERM-6 — Terminal dist bundle stale — all commands return "command not found" [FIXED]

**Severity:** High
**File:** `mobile-ide/mobile-ide-prototype/src/terminal/bundle/dist/terminal.js`
**Description:**
`dist/terminal.js` was an older build containing only the command-not-found fallback.
`npm run build:terminal` had not been run after `index.ts` was updated with the full command
dispatcher, so all commands silently failed at runtime.

**Root cause:** Build artefact not regenerated after source change.

**Fix:** Run `npm run build:terminal` to rebuild `dist/terminal.html` (677 KB) from current `index.ts`.

---

### BUG-0017 / UX-1 — No visible "New File" button in `FileExplorer` header [FIXED]

**Severity:** Medium
**File:** `mobile-ide/mobile-ide-prototype/src/components/FileExplorer.tsx`
**Description:**
The only way to create a new file was a long-press context menu — completely undiscoverable
on first use. No `"+"` button or equivalent existed in the header.

**Root cause:** Header action buttons were never added; file creation relied entirely on the
context menu.

**Fix:** Add `"+"` and `"⊞"` (new folder) icon buttons to the `FileExplorer` header.

---

### BUG-0018 / UX-2 — `onFileCreate` not wired in `App.tsx` — new files do not auto-open in editor [FIXED]

**Severity:** Medium
**File:** `mobile-ide/mobile-ide-prototype/App.tsx`
**Description:**
`FileExplorer` accepted an optional `onFileCreate` prop, but `App.tsx` never passed a handler.
Files were created on disk but the editor never opened them.

**Root cause:** Prop wiring omitted; the prop was optional so it silently did nothing.

**Fix:** Pass `onFileCreate={openFile}` from `App.tsx` to `FileExplorer`.

---

### BUG-0019 / UX-3 — "File: New File" command missing from command palette [FIXED]

**Severity:** Low
**File:** `mobile-ide/mobile-ide-prototype/App.tsx`
**Description:**
Searching "new" or "file" in the command palette returned "No commands found". The palette
only had Save, Close Tab, Toggle Terminal, Git Status, and Git Commit.

**Root cause:** "File: New File" command was never registered in the palette command list.

**Fix:** Register a `"File: New File"` command that triggers `triggerNewFile` state in `App.tsx`.
