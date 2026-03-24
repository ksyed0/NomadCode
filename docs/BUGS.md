# BUGS.md — NomadCode Bug Tracker (Plan Visualizer Source)

> Machine-readable format consumed by `tools/lib/parse-bugs.js`.
> Human-readable extended notes are in the root `BUGS.md`.

BUG-0001: onRequestClose fires first command on Android back (CP-1)
Severity: High
Related Story: US-0015
Related Task:
Steps to Reproduce:
  1. Open CommandPalette
  2. Press Android hardware back button
Expected: Palette closes without side effects
Actual: First command in the list is silently invoked
Status: Fixed
Fix Branch: feature/epic-0004-command-palette
Lesson Encoded: No

BUG-0002: Backdrop press does not close the palette (CP-2)
Severity: Medium
Related Story: US-0015
Related Task:
Steps to Reproduce:
  1. Open CommandPalette
  2. Tap outside the panel (backdrop area)
Expected: Palette closes
Actual: Keyboard dismisses but palette remains visible
Status: Fixed
Fix Branch: feature/epic-0004-command-palette
Lesson Encoded: No

BUG-0003: AC-0046, AC-0048, AC-0053 had no explicit tests (CP-3)
Severity: Low
Related Story: US-0015
Related Task:
Steps to Reproduce:
  1. Review CommandPalette test file before EPIC-0004 rebuild
Expected: All ACs have named test cases
Actual: Three ACs (auto-focus, backdrop dismiss, no-badge) lacked direct tests
Status: Fixed
Fix Branch: feature/epic-0004-command-palette
Lesson Encoded: No

BUG-0004: Lines 79-83 of CommandPalette.tsx were uncovered by tests (CP-4)
Severity: Low
Related Story: US-0015
Related Task:
Steps to Reproduce:
  1. Run test coverage before EPIC-0004 rebuild
Expected: onRequestClose and backdrop onPress covered
Actual: Both callbacks shown as uncovered in report
Status: Fixed
Fix Branch: feature/epic-0004-command-palette
Lesson Encoded: No

BUG-0006: EXPO_PUBLIC_GITHUB_CLIENT_SECRET bundled in app binary; env name mismatch (AUTH-1)
Severity: Critical
Related Story: US-0022
Related Task:
Steps to Reproduce:
  1. Build the Expo app with EXPO_PUBLIC_GITHUB_CLIENT_SECRET set in .env
  2. Unpack the JS bundle — client_secret is readable in plain text
  3. OR follow .env.example (GITHUB_CLIENT_SECRET) — OAuth silently fails with empty secret
Expected: Client secret stays server-side; OAuth sign-in works
Actual: Secret bundled into binary; or OAuth silently fails due to env name mismatch
Status: Fixed
Fix Branch: feature/epic-0007-auth
Lesson Encoded: No

BUG-0007: useAutoDiscovery('https://github.com') always returns null — OAuth button non-functional (AUTH-2)
Severity: High
Related Story: US-0022
Related Task:
Steps to Reproduce:
  1. Open SettingsScreen and press "Sign in with GitHub"
Expected: Browser opens to GitHub OAuth authorization page
Actual: Nothing happens — request is null because GitHub has no OIDC discovery document
Status: Fixed
Fix Branch: feature/epic-0007-auth
Lesson Encoded: No

BUG-0008: Empty catch block in exchangeCode silently discards all OAuth errors (AUTH-3)
Severity: Medium
Related Story: US-0022
Related Task:
Steps to Reproduce:
  1. Trigger OAuth flow on a device with no network
  2. Complete authorization — app receives auth code but token exchange fetch throws
Expected: User sees an error message
Actual: Error silently swallowed; no feedback shown; authError never set
Status: Fixed
Fix Branch: feature/epic-0007-auth
Lesson Encoded: No

BUG-0009: Landscape-locked app crashes on iPhone simulator when SetupWizard Modal is presented (SIM-1)
Severity: Medium
Related Story:
Related Task:
Steps to Reproduce:
  1. Run app via Expo Go on iPhone simulator (any iPhone model)
  2. Wait ~10 seconds for Zustand store to hydrate
  3. SetupWizard Modal becomes visible
Expected: Modal opens normally
Actual: SIGABRT crash in -[UIViewController __supportedInterfaceOrientations] during modal presentation
Root Cause: iOS 16+ throws when a modal is presented in a landscape-locked app on iPhone; iPads handle this correctly
Status: Open
Fix Branch:
Lesson Encoded: No

BUG-0005: No swipe gesture trigger for command palette (CP-5)
Severity: Low
Related Story: US-0015
Related Task:
Steps to Reproduce:
  1. Attempt to open palette via downward swipe on editor pane
Expected: Palette opens
Actual: No swipe handler existed; only FAB button worked
Status: Fixed
Fix Branch: feature/epic-0004-command-palette
Lesson Encoded: No

BUG-0010: node command exposes window.ReactNativeWebView to user scripts (TERM-1)
Severity: High
Related Story: US-0052
Related Task:
Steps to Reproduce:
  1. Write a JS file containing: window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'FILE_WRITE', requestId: 'x', path: '/sensitive', content: 'injected' }))
  2. Run: node /hack.js in terminal
Expected: User script cannot access native bridge
Actual: Script can forge arbitrary FILE_WRITE/FILE_READ messages directly to the native bridge, bypassing all dispatch() guards
Root Cause: new Function('console', 'require', code) shadows console and require but leaves full WebView global scope accessible including window.ReactNativeWebView
Status: Fixed
Fix Branch: feature/epic-0003-terminal
Lesson Encoded: No

BUG-0011: Silent undefined spread in FileBridge.handleMessage for unknown message types (TERM-2)
Severity: High
Related Story: US-0052
Related Task:
Steps to Reproduce:
  1. WebView sends a message with an unrecognised type (e.g. future protocol extension or malformed data)
  2. useTerminalBridge passes it to FileBridge.handleMessage
Expected: Error logged, message dropped safely
Actual: switch falls through with fileResult unassigned; spread of undefined produces FILE_RESULT with no result/error fields; vfsRead silently resolves to '' instead of rejecting
Root Cause: No guard for unrecognised message types before FileBridge.handleMessage call in useTerminalBridge
Status: Fixed
Fix Branch: feature/epic-0003-terminal
Lesson Encoded: No

BUG-0012: resolvePath does not normalise .. segments (TERM-3)
Severity: Medium
Related Story: US-0050
Related Task:
Steps to Reproduce:
  1. cd .. in terminal
  2. Run pwd
Expected: /foo (parent directory)
Actual: /foo/bar/.. (unnormalised path compounds with subsequent operations)
Root Cause: resolvePath concatenates segments without resolving .. — Expo FileSystem handles it at OS level but isomorphic-git string-comparison logic and pwd output are incorrect
Status: Fixed
Fix Branch: feature/epic-0003-terminal
Lesson Encoded: No

BUG-0013: TypeScript strict-mode implicit any errors in terminal dispatcher (TERM-4)
Severity: Medium
Related Story: US-0052
Related Task:
Steps to Reproduce:
  1. Run tsc --noEmit in mobile-ide/mobile-ide-prototype
Expected: No type errors
Actual: TS7031/TS7006 implicit any on statusMatrix destructuring and git.log callback parameter in src/terminal/bundle/index.ts
Root Cause: Destructure pattern lacks explicit type annotation on statusMatrix row and git.log commit parameter
Status: Fixed
Fix Branch: feature/epic-0003-terminal
Lesson Encoded: No

BUG-0014: npm run depth guard has no test coverage (TERM-5)
Severity: Low
Related Story: US-0053
Related Task:
Steps to Reproduce:
  1. Write package.json with: { "scripts": { "loop": "npm run loop" } }
  2. Run: npm run loop
Expected: Error after 5 levels of recursion with clear message
Actual: Behavior is correct (depth guard fires) but no test verifies this — confirmed by absence of TC-0342/TC-0343 in dispatch.test.ts
Root Cause: Depth guard test case skipped in Task 5 implementation
Status: Fixed
Fix Branch: feature/epic-0003-terminal
Lesson Encoded: No
