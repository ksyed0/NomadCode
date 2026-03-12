# BUGS.md — NomadCode Issue Tracker

> Log all detected bugs, audit findings, and known issues here.
> Format: `[STATUS]` = `OPEN`, `IN_PROGRESS`, or `FIXED`

---

## EPIC-0004 — Command Palette (detected 2026-03-12)

### CP-1 — `onRequestClose` fires first command on Android back [OPEN]

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

### CP-2 — Backdrop press does not close the palette [OPEN]

**Severity:** Medium
**File:** `mobile-ide/mobile-ide-prototype/src/components/CommandPalette.tsx` line 81
**Description:**
`onPress={() => Keyboard.dismiss()}` — tapping outside the panel hides the keyboard but
leaves the palette modal visible. Users who expect tapping the backdrop to close the overlay
(standard mobile UX) are stuck.

**Root cause:** Same API flaw as CP-1. No `onClose` callback; component can't signal close.

**Fix:** Change backdrop `onPress` to call `onClose()` (which also dismisses keyboard in parent).

---

### CP-3 — AC-0046, AC-0048, AC-0053 have no explicit tests [OPEN]

**Severity:** Low
**File:** `mobile-ide/mobile-ide-prototype/tests/unit/CommandPalette.test.tsx`
**Description:**
Three acceptance criteria lack named tests:
- AC-0046: `autoFocus` on mount — no test verifying the prop is set
- AC-0048: Backdrop dismisses keyboard — no test for backdrop press behavior
- AC-0053: No empty badge — no test verifying commands without `shortcut` render no badge

**Fix:** Add explicit tests for each AC as part of the test suite rebuild.

---

### CP-4 — Lines 79–83 of CommandPalette.tsx are uncovered [OPEN]

**Severity:** Low
**File:** `mobile-ide/mobile-ide-prototype/src/components/CommandPalette.tsx` lines 79–83
**Description:**
Coverage report shows `onRequestClose` callback and backdrop `onPress` are never exercised
by the test suite. This means the CP-1 bug could not have been caught by tests.

**Fix:** Covered by CP-1 and CP-2 fixes + new tests.

---

### CP-5 — No swipe gesture trigger [OPEN]

**Severity:** Low (spec requirement, not crash)
**File:** `mobile-ide/mobile-ide-prototype/src/layout/TabletResponsive.tsx`
**Description:**
The spec (EPIC-0004) states the palette must be "accessible by gesture or Cmd+P for
keyboard-free power workflows." Currently the only trigger is the FAB button. No
`PanResponder` swipe-down gesture exists.

**Fix:** Add `PanResponder` swipe zone at top of the editor main pane in `TabletResponsive`.
