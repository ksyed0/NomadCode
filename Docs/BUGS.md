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
