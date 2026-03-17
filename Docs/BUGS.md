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
