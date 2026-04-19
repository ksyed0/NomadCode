# EPIC-0004 Command Palette — Design Document

**Date:** 2026-03-12
**Epic:** EPIC-0004
**Branch:** `feature/epic-0004-command-palette`
**Status:** Approved for implementation

---

## 1. Summary

Full audit and rebuild of the `CommandPalette` component to fix a root API flaw, add a
swipe-gesture trigger, add keyboard up/down navigation, and achieve explicit test coverage
for all 8 acceptance criteria.

---

## 2. Audit Findings

| # | Issue | Severity |
|---|---|---|
| CP-1 | `onRequestClose={() => onSelect(commands[0])}` — Android back silently fires the first command | **Bug** |
| CP-2 | No `onClose` callback — backdrop press only dismisses keyboard, doesn't close the palette | API flaw |
| CP-3 | AC-0046, AC-0048, AC-0053 have no explicit tests | Test gap |
| CP-4 | Lines 79–83 uncovered (backdrop press + back button handler) | Coverage gap |
| CP-5 | No swipe-down gesture trigger (required by spec) | Missing feature |
| CP-6 | No keyboard up/down navigation (power user UX) | Enhancement |

---

## 3. Component API

```typescript
interface CommandPaletteProps {
  visible: boolean;                    // replaces conditional render in parent
  commands: Command[];
  onClose: () => void;                 // dismiss without selecting
  onSelect: (cmd: Command) => void;    // select and dismiss (parent handles close)
  placeholder?: string;
}
```

**`App.tsx` change:** Replace `{showPalette && <CommandPalette .../>}` with:
```tsx
<CommandPalette
  visible={showPalette}
  onClose={() => setShowPalette(false)}
  commands={paletteCommands}
  onSelect={handlePaletteSelect}
/>
```

---

## 4. Architecture

### Gesture Trigger
A transparent `PanResponder` zone (~40pt tall, full-width) at the top of the `main` editor
pane in `TabletResponsive`. A downward swipe (`dy > 40, vy > 0.3`) calls an
`onOpenPalette?: () => void` prop threaded down from `App`.

### Keyboard Navigation
`selectedIndex` state (default `0`) tracks the highlighted row.

| Key | Action |
|-----|--------|
| Arrow down | `Math.min(selectedIndex + 1, filtered.length - 1)` |
| Arrow up | `Math.max(selectedIndex - 1, 0)` |
| Enter | `handleSelect(filtered[selectedIndex])` |

Selected item renders with `backgroundColor: '#2563EB'` (Nomad Blue) highlight.

`selectedIndex` resets to `0` whenever the query string changes.

### Back / Dismiss
- `onRequestClose` → `onClose()` (Android back = dismiss, not select)
- Backdrop press → `onClose()` (full close, keyboard dismissed first)

---

## 5. Test Plan (~22 tests)

### AC Tests
| AC | Test |
|---|---|
| AC-0046 | `auto-focuses the TextInput on mount` |
| AC-0047 | `renders all commands when query is empty` |
| AC-0048 | `backdrop press calls onClose` |
| AC-0049 | `filters by label (case-insensitive)`, `filters by description`, `matches partial substrings`, `shows all when query cleared` |
| AC-0050 | `shows "No commands found" when nothing matches` |
| AC-0051 | `Enter selects first filtered result`, `does not call onSelect on Enter when no match` |
| AC-0052 | `renders shortcut badge when command has shortcut` |
| AC-0053 | `renders no badge for commands without shortcut` |

### New Tests
- `onRequestClose calls onClose, not onSelect` (bug fix verification)
- `arrow down moves selection to next item`
- `arrow up moves selection to previous item`
- `selected item renders with highlight style`
- `swipe gesture zone calls onOpenPalette on downward swipe`
- `renders with empty command list without crashing`

### Edge Case Tests
- `gesture zone calls onOpenPalette even when command list is empty`
- `query change resets selectedIndex to 0`
- `up-arrow on first item does not go below 0`
- `selecting a command calls onSelect but not onClose`

---

## 6. Files to Modify

| File | Change |
|---|---|
| `src/components/CommandPalette.tsx` | Full rebuild: `visible`+`onClose` API, keyboard nav, fix back handler |
| `src/layout/TabletResponsive.tsx` | Add `onOpenPalette?: () => void` prop + PanResponder swipe zone |
| `App.tsx` | Switch to `visible`/`onClose` pattern, pass `onOpenPalette` |
| `tests/unit/CommandPalette.test.tsx` | Rebuild to cover all 8 ACs + new tests (~22 total) |
| `tests/unit/TabletResponsive.test.tsx` | Add swipe gesture tests |
| `docs/plan-status.json` | Mark all EPIC-0004 ACs done |
| `docs/RELEASE_PLAN.md` | Mark all EPIC-0004 ACs checked |
| `docs/ID_REGISTRY.md` | Update TC sequence |
| `progress.md` | Update session state |

---

## 7. Out of Scope

- Persistent "recent commands" history
- Command categories / grouping
- Fuzzy matching algorithm (current `includes` is sufficient for the ACs)
- Hardware keyboard shortcut detection (Cmd+P) — requires native module
