# EPIC-0005 Customization — Design Document

**Date:** 2026-03-12
**Epic:** EPIC-0005
**Branch:** `feature/epic-0005-customization`
**Status:** Approved for implementation

---

## 1. Summary

Implement light/dark theme selection with 11 popular IDE themes, persistent user settings via
Zustand + AsyncStorage, a 3-step first-run setup wizard, and a Settings screen. Font size
controls are already implemented in `Editor.tsx` — this epic promotes them to the canonical
settings store and adds the Settings screen entry point.

US-0020 (Extension Installation) is deferred to a future epic.

---

## 2. Scope

| Story | Description | Status |
|---|---|---|
| US-0018 | Light/dark theme toggle with multi-theme selector | In scope |
| US-0019 | Font size A+/A- controls | In scope (already partly built — needs store wiring + tests) |
| US-0020 | Extension installation | **Deferred** |

---

## 3. Settings Store

**File:** `src/stores/useSettingsStore.ts`

```typescript
interface SettingsState {
  theme: ThemeId;              // default: 'nomad-dark'
  fontSize: number;            // 8–32, default: 14
  workspacePath: string;       // default: ''
  hasCompletedSetup: boolean;  // default: false
  setTheme: (id: ThemeId) => void;
  setFontSize: (n: number) => void;         // clamps to [8, 32]
  setWorkspacePath: (p: string) => void;
  completeSetup: () => void;
}
```

Persisted via Zustand `persist` middleware to AsyncStorage under key `nomadcode-settings`.

---

## 4. Theme Token System

**File:** `src/theme/tokens.ts`

```typescript
type ThemeId =
  | 'nomad-dark' | 'one-dark-pro' | 'dracula' | 'monokai' | 'nord' | 'tokyo-night'
  | 'nomad-light' | 'github-light' | 'solarized-light' | 'catppuccin-latte' | 'night-owl-light';

interface ThemeTokens {
  id: ThemeId;
  mode: 'dark' | 'light';
  name: string;
  bg: string;           // main background
  bgElevated: string;   // panels, modals, sidebar
  bgHighlight: string;  // selected row, hover state
  text: string;         // primary text
  textMuted: string;    // labels, placeholders, comments
  border: string;       // dividers, input borders
  accent: string;       // primary accent (blue equivalent)
  keyword: string;      // syntax: keywords
  string: string;       // syntax: strings
  error: string;        // fixed: #EF4444 (Coral) — same across all themes
  success: string;      // fixed: #22C55E (Sage) — same across all themes
}

export function useTheme(): ThemeTokens;  // reads from useSettingsStore
```

### Dark Themes

| ID | Name | bg | bgElevated | text | accent | keyword | string |
|---|---|---|---|---|---|---|---|
| `nomad-dark` | Nomad Dark | `#0F172A` | `#1E293B` | `#E2E8F0` | `#2563EB` | `#7C3AED` | `#0D9488` |
| `one-dark-pro` | One Dark Pro | `#282C34` | `#21252B` | `#ABB2BF` | `#61AFEF` | `#C678DD` | `#98C379` |
| `dracula` | Dracula | `#282A36` | `#21222C` | `#F8F8F2` | `#BD93F9` | `#FF79C6` | `#F1FA8C` |
| `monokai` | Monokai | `#272822` | `#1E1F1C` | `#F8F8F2` | `#66D9E8` | `#F92672` | `#E6DB74` |
| `nord` | Nord | `#2E3440` | `#3B4252` | `#D8DEE9` | `#88C0D0` | `#81A1C1` | `#A3BE8C` |
| `tokyo-night` | Tokyo Night | `#1A1B26` | `#16161E` | `#C0CAF5` | `#7AA2F7` | `#BB9AF7` | `#9ECE6A` |

### Light Themes

| ID | Name | bg | bgElevated | text | accent | keyword | string |
|---|---|---|---|---|---|---|---|
| `nomad-light` | Nomad Light | `#F9FAFB` | `#FFFFFF` | `#111827` | `#2563EB` | `#7C3AED` | `#0D9488` |
| `github-light` | GitHub Light | `#FFFFFF` | `#F6F8FA` | `#24292F` | `#0969DA` | `#CF222E` | `#0A3069` |
| `solarized-light` | Solarized Light | `#FDF6E3` | `#EEE8D5` | `#657B83` | `#268BD2` | `#859900` | `#2AA198` |
| `catppuccin-latte` | Catppuccin Latte | `#EFF1F5` | `#E6E9EF` | `#4C4F69` | `#1E66F5` | `#8839EF` | `#40A02B` |
| `night-owl-light` | Night Owl Light | `#FBFBFB` | `#F0F0F0` | `#403F53` | `#4876D6` | `#994CC3` | `#4876D6` |

### Fixed tokens (all themes)
- `error`: `#EF4444` (Coral)
- `success`: `#22C55E` (Sage)
- `bgHighlight`: 10% opacity of `accent` (computed)
- `border`: midpoint between `bg` and `bgElevated` (computed per theme)

### Monaco theme mapping
- All dark theme IDs → Monaco `theme: 'vs-dark'`
- All light theme IDs → Monaco `theme: 'vs'`

---

## 5. Setup Wizard

**File:** `src/components/SetupWizard.tsx`

Mounted in `App.tsx` as `<SetupWizard visible={!hasCompletedSetup} />`.

### Step 1 — Theme
- Two large tap cards: **Dark** / **Light** (mode selector)
- Tapping a mode filters the theme grid below and applies live preview
- Theme grid: scrollable rows of swatches, each showing theme name + 4 color chips (bg, text, accent, keyword)
- Tapping a swatch calls `setTheme(id)` immediately

### Step 2 — Font Size
- Code snippet preview at current font size
- A- and A+ buttons call `setFontSize(fontSize ± 1)` (clamped 8–32)
- "Reset to default" resets to 14
- Current size displayed between buttons

### Step 3 — Workspace
- Text input pre-filled with `FileSystem.documentDirectory`
- "Browse" button opens directory picker
- "Get Started" calls `completeSetup()` → sets `hasCompletedSetup: true` → modal closes
- "Skip for now" also calls `completeSetup()` with `documentDirectory` default

### Navigation
- Progress indicator: `1 / 3`, `2 / 3`, `3 / 3`
- Back button on steps 2 and 3
- No skip on steps 1 or 2 (choices are fast); skip only on step 3

---

## 6. Settings Screen

**File:** `src/components/SettingsScreen.tsx`

Opened via gear icon (`⚙`) added to the sidebar header in `TabletResponsive`.
`TabletResponsive` gains `onOpenSettings?: () => void` prop (same pattern as `onOpenPalette`).
`App.tsx` controls visibility with `showSettings` state.

### Sections

**Appearance**
- Mode segmented control: Dark / Light (filters theme grid)
- Theme grid: same swatch grid as wizard

**Editor**
- Font size row: A- / `{fontSize}` / A+ (calls `setFontSize`)

**Workspace**
- Working directory: current path + tap to browse/change

Changes apply immediately and persist. `✕` closes the modal. No Save button.

---

## 7. Component Updates

All hardcoded hex values replaced with `useTheme()` token references:

| Component | Changes |
|---|---|
| `src/components/CommandPalette.tsx` | Replace all color constants with `t.bg`, `t.bgElevated`, `t.text`, etc. |
| `src/layout/TabletResponsive.tsx` | Replace `#0F172A`; add gear icon + `onOpenSettings` prop |
| `src/components/Editor.tsx` | Replace StyleSheet colors; pass `monacoTheme` to WebView; font size controls become store pass-throughs |
| `src/components/FileExplorer.tsx` | Replace hardcoded colors |
| `src/components/Terminal.tsx` | Replace hardcoded colors |
| `App.tsx` | Root background; mount `SetupWizard` + `SettingsScreen`; `showSettings` state |

---

## 8. Test Plan (~30 tests)

### `useSettingsStore`
- Default state: `theme === 'nomad-dark'`, `fontSize === 14`, `hasCompletedSetup === false`
- `setTheme` updates theme ID
- `setFontSize` clamps to 8–32
- `completeSetup` sets `hasCompletedSetup: true`
- AsyncStorage mock verifies persistence is called

### `tokens.ts`
- `useTheme()` returns dark tokens for each of the 6 dark theme IDs
- `useTheme()` returns light tokens for each of the 5 light theme IDs
- `error` and `success` are identical across all 11 themes
- All themes have all required token keys

### `SetupWizard`
- Renders when `hasCompletedSetup === false`
- Does not render when `hasCompletedSetup === true`
- Step 1: tapping Dark filters to dark theme swatches
- Step 1: tapping a theme swatch calls `setTheme`
- Step 2: A+ increments fontSize; A- decrements; clamps at 8 and 32
- Step 2: "Reset to default" sets fontSize to 14
- Step 3: "Get Started" calls `completeSetup`
- Step 3: "Skip" calls `completeSetup`
- Back navigation returns to previous step

### `SettingsScreen`
- Renders when visible
- Theme swatch press calls `setTheme`
- A+ / A- call `setFontSize`
- `✕` press calls `onClose`

### `TabletResponsive`
- Gear icon renders
- Gear icon press calls `onOpenSettings`

---

## 9. Files to Create / Modify

| File | Change |
|---|---|
| `src/stores/useSettingsStore.ts` | **Create** — Zustand store with persist |
| `src/theme/tokens.ts` | **Create** — 11 theme token maps + `useTheme()` |
| `src/components/SetupWizard.tsx` | **Create** — 3-step first-run wizard |
| `src/components/SettingsScreen.tsx` | **Create** — settings modal |
| `src/components/CommandPalette.tsx` | **Modify** — replace hardcoded colors |
| `src/layout/TabletResponsive.tsx` | **Modify** — replace color, add gear icon + prop |
| `src/components/Editor.tsx` | **Modify** — replace colors, Monaco theme, store wiring |
| `src/components/FileExplorer.tsx` | **Modify** — replace hardcoded colors |
| `src/components/Terminal.tsx` | **Modify** — replace hardcoded colors |
| `App.tsx` | **Modify** — mount wizard + settings, showSettings state |
| `tests/unit/useSettingsStore.test.ts` | **Create** |
| `tests/unit/tokens.test.ts` | **Create** |
| `tests/unit/SetupWizard.test.tsx` | **Create** |
| `tests/unit/SettingsScreen.test.tsx` | **Create** |
| `tests/unit/TabletResponsive.test.tsx` | **Modify** — add gear icon tests |

---

## 10. Out of Scope

- US-0020 Extension Installation (deferred to next epic)
- System dark mode detection (`Appearance.getColorScheme`) — manual only for now
- Per-language syntax theme overrides
- Custom theme creation / import
- Theme export or sharing
