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

---

## EPIC-0003 — Terminal AC Completion / PR #45 Review (detected 2026-03-25)

### BUG-0024 / SEC-1 — `android/app/debug.keystore` committed to version control [OPEN]

**Severity:** High
**File:** `mobile-ide/mobile-ide-prototype/android/app/debug.keystore`
**Description:**
A binary Android debug keystore (private key material) was committed to the repo in PR #45 as
part of the native project scaffolding. CLAUDE.md § 9 explicitly prohibits committing secrets or
key material to version control. Standard Expo/React Native practice is to gitignore `*.keystore`.

**Root cause:** `expo prebuild` generated the full `android/` directory including the debug keystore,
and the generated `.gitignore` inside `android/` did not exclude it.

**Fix:** Add `*.keystore` to `mobile-ide/mobile-ide-prototype/android/.gitignore`, then remove the
committed keystore with `git rm --cached android/app/debug.keystore` and commit the removal.

---

### BUG-0025 / TERM-11 — `getToken()` has no reject path or timeout — `git push`/`git clone` hang forever [OPEN]

**Severity:** High
**File:** `mobile-ide/mobile-ide-prototype/src/terminal/bundle/index.ts` (~line 159)
**Description:**
`getToken()` creates a `Promise` with only a `resolve` callback and no `reject`. All other VFS
bridge helpers (`vfsRead`, `vfsWrite`, etc.) use `(resolve, reject)` pairs with error handling.
If the React Native side never sends `TOKEN_RESULT` (app backgrounded, bridge crash, or terminal
WebView hidden — the same `injectJavaScript`-on-hidden-WebView failure documented in BUG-0022),
the `git push` or `git clone` operation awaits forever, freezing the terminal permanently. The
`pendingRequests` map entry also leaks.

**Root cause:** `TOKEN_RESULT` message handling added in PR #45 without mirroring the reject/timeout
pattern used by all other pending-request handlers. This is the same class of bug as BUG-0022
(terminal hidden → `injectJavaScript` silently dropped).

**Fix:** Add a `reject` arm and a `setTimeout`-based timeout (e.g., 30 s) with `Promise.race`,
matching the pattern of the VFS helpers. Clean up the `pendingRequests` entry in both paths.

---

### BUG-0026 / TERM-12 — `git status` reports newly-staged files as `??` (untracked) instead of `A ` (added) [OPEN]

**Severity:** High
**File:** `mobile-ide/mobile-ide-prototype/src/terminal/bundle/index.ts` (lines 198–201)
**Description:**
The `statusMatrix` evaluation checks `head === 0 && workdir === 2` (no `stage` guard) before the
more-specific `head === 0 && workdir === 2 && stage === 2` check. isomorphic-git returns the tuple
`[path, 0, 2, 2]` for a newly staged file (`git add newfile`). The broad condition on line 198
matches first and returns `?? newfile`, making the `A  newfile` branch on line 201 unreachable.
Any user who runs `git add <file>` then `git status` will see the file reported as untracked.

**Root cause:** Condition ordering error introduced in the initial git-status implementation
(commit `17d2b1b`); the more-specific tuple must be checked first.

**Fix:** Swap order — check `(head === 0 && workdir === 2 && stage === 2)` → `A ` before
`(head === 0 && workdir === 2)` → `??`.

---

### BUG-0027 / TERM-13 — `git init` failure is misreported as "not a git repository" [OPEN]

**Severity:** Medium
**File:** `mobile-ide/mobile-ide-prototype/src/terminal/bundle/index.ts` (~lines 242–312)
**Description:**
The `case 'init'` block shares the same outer `try/catch` as all other git subcommands. The catch
block converts any error containing `ENOENT`, `is not readable`, `readAsStringAsync`, or
`readDirectoryAsync` into the "not a git repository — run `git init`" message. If `git init`
itself throws one of those errors (e.g., the VFS cannot create the `.git/objects` directory due
to an invalid `cwd`), the user sees the paradoxical message "not a git repository — run `git init`"
immediately after typing `git init`. The root cause is silently swallowed.

**Root cause:** PR #45 added `git init` handling (commit `ebe295e`) without giving it its own
inner try/catch to isolate init-specific failures from the generic "not a repo" fallback.

**Fix:** Wrap the `case 'init'` block in its own try/catch (or check `subcommand !== 'init'` before
applying the "not a git repository" message in the outer catch).

---

### BUG-0028 / TERM-14 — ENOENT error masking too broad — corrupted repos return wrong diagnostic [OPEN]

**Severity:** Medium
**File:** `mobile-ide/mobile-ide-prototype/src/terminal/bundle/index.ts` (~lines 299–309)
**Description:**
The catch block in the git dispatcher matches `is not readable`, `readAsStringAsync`, and
`readDirectoryAsync` as signals for "not a git repository". These strings are too broad — Expo
FileSystem can emit them for any locked, corrupted, or permission-denied file inside a valid repo
(e.g., a corrupted `.git/index`). A valid repo with a corrupted index would incorrectly tell the
user "not a git repository — run `git init`", which is both wrong and destructive.

**Root cause:** Strings added in commit `2658c62` to paper over emulator-specific error messages
without scoping them to `.git`-path lookups.

**Fix:** Scope the ENOENT checks to paths that contain `.git/` (check `err.message` includes both
`.git` and the file operation string), or catch only the specific isomorphic-git error codes
(`NotFoundError`, `MissingParameterError`) rather than string-matching Expo FileSystem messages.

---

### BUG-0029 / DASH-1 — Plan visualizer dashboard not updated since 2026-03-13 [OPEN]

**Severity:** Low
**File:** `plan-visualizer.config.json` (line 8), `.github/workflows/plan-visualizer.yml`
**Description:**
The plan visualizer CI workflow has not regenerated the dashboard since 2026-03-13 for three
compounding reasons:
1. All active development is on `feature/EPIC-0003-terminal-ac-completion`; the workflow only
   triggers on pushes to `main` or `develop`, so it never fires while work stays on the feature branch.
2. `plan-visualizer.config.json` has `"outputDir": "Docs"` (capital D). On the Linux CI runner
   (case-sensitive filesystem), the generator writes to `Docs/` but the Pages upload step reads
   from `./docs`, so even when CI does run the output is never deployed.
3. The generator has not been re-run locally and committed since 2026-03-13.

**Fix:**
- Change `"outputDir": "Docs"` → `"outputDir": "docs"` in `plan-visualizer.config.json`
- Run `node tools/generate-plan.js` and commit `docs/plan-status.html` + `docs/plan-status.json`
- Merge to `develop` so CI can maintain future updates automatically

---

## CI/CD (detected 2026-03-25)

### BUG-0030 / CI-1 — version-bump workflow fails with "Invalid format '0.1.1'" on GITHUB_OUTPUT [FIXED]

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

---

## Plan Visualizer / Tooling (detected 2026-03-25)

### BUG-0031 / TOOL-1 — `capture-cost.js` Stop hook records zero tokens and cost for every session [IN_PROGRESS]

**Severity:** Medium (cost tracking non-functional; all AI spend shown as $0.00 in the dashboard)
**File:** `tools/capture-cost.js`, `.claude/settings.json` (Stop hook)
**Description:**
The Stop hook runs `capture-cost.js` on every session end and appends a row to
`docs/AI_COST_LOG.md`. Every row produced by the hook shows `0 | 0 | 0 | 0.0000` for
tokens and cost. Confirmed via debug logs: the hook executes but receives `{ session_id,
stop_hook_active }` only — Claude Code 50.18.2 does not include `cost_usd` or `usage`
fields in the Stop hook stdin payload.

The seed rows at the top of `AI_COST_LOG.md` (e.g. `sess_prot0_001`, $0.84) are
manually entered — no real per-session cost has ever been captured by the hook.

**Root cause:** Claude Code's Stop hook payload did not include cost/token data in
version 50.18.2. The `capture-cost.js` script was written expecting those fields.

**Partial fix applied (2026-03-27, Claude Code 2.1.85):**
- Zero-cost rows are now tagged `[NO_DATA]` in the Session ID column so they are
  visually distinguishable from real entries.
- Raw Stop-hook stdin is saved to `docs/capture-cost-debug.json` on every invocation.
  After this session ends, inspect that file to verify whether 2.1.85 includes
  `cost_usd` / `usage` in the payload.  If it does, no further code changes are needed
  and this bug can be marked FIXED.
- `buildRow()` logic extracted and covered by 13 unit tests
  (`tests/unit/capture-cost.test.js`).
- `docs/capture-cost-debug.json` added to `.gitignore`.

**Remaining action:**
Check `docs/capture-cost-debug.json` after the next session end.  If the payload
contains `cost_usd` / `usage`, mark this bug FIXED.  If still missing, implement the
`stats-cache.json` diff approach (see options below).

**Fix options (if payload still missing data):**
1. **Read from `~/.claude/stats-cache.json`** — contains daily token aggregates by
   model; could be diffed between session start and stop to approximate session cost.
2. **Open an upstream issue** in the plan-visualizer parent project requesting that
   `capture-cost.js` document the minimum Claude Code version required.

---

### BUG-0032 / TOOL-2 — `docs/LESSONS.md` missing — plan visualizer Lessons tab always empty [FIXED]

**Severity:** Low (dashboard Lessons tab renders "No lessons logged yet" instead of project lessons)
**File:** `docs/LESSONS.md` (absent), `plan-visualizer.config.json`
**Description:**
`tools/generate-plan.js` reads `docs/LESSONS.md` to populate the Lessons tab in the plan
visualizer dashboard. The file was never created and was not listed in
`plan-visualizer.config.json` (relying on the hardcoded default path). `readFile()` returns
`''` for missing files, so `parseLessons('')` returns `[]` → "No lessons logged yet." The
Lessons tab has been empty since the plan visualizer was introduced.

**Root cause:** `LESSONS.md` was never created as part of the plan visualizer setup, and no
session had captured lessons in the expected format.

**Fix:** Created `docs/LESSONS.md` with 4 seed lessons from recent sessions:
- L-0001: `npm version` stdout is multiline in newer npm
- L-0002: debug.keystore must be gitignored before `expo prebuild`
- L-0003: `injectJavaScript` silently dropped on hidden WebViews
- L-0004: double-stringify required when passing JSON through `injectJavaScript`
Also added explicit `"lessons": "docs/LESSONS.md"` to `plan-visualizer.config.json`.

---
