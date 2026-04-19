# EPIC-0005 Customization Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Add persistent user settings (theme, font size, workspace path) with an 11-theme selector, a 3-step first-run setup wizard, and a settings screen — all backed by a Zustand store persisted to AsyncStorage.

**Architecture:** A new `useSettingsStore` (Zustand + persist middleware → AsyncStorage) holds all preferences. A `tokens.ts` module maps theme IDs to full color token objects. All components call `useTheme()` instead of hardcoding hex values. A `SetupWizard` modal appears on first launch; a `SettingsScreen` modal is accessible via a gear icon in the sidebar. US-0020 (extensions) is deferred.

**Tech Stack:** React Native 0.76 / Expo 52, TypeScript 5, Zustand ^5 (persist middleware), `@react-native-async-storage/async-storage`, `expo-document-picker`, `@testing-library/react-native` v12, Jest

---

## Context for the implementer

- Prototype lives at `mobile-ide/mobile-ide-prototype/`. All paths below are relative to it.
- Run tests: `cd mobile-ide/mobile-ide-prototype && npx jest --watchAll=false`
- Run coverage: `cd mobile-ide/mobile-ide-prototype && npx jest --watchAll=false --coverage`
- Current branch: `develop`. Create `feature/epic-0005-customization` from it.
- Zustand is already installed (`^5.0.0`). AsyncStorage and expo-document-picker are NOT — install them.
- `Editor.tsx` already has `fontSize` local state and `changeFontSize` — Task 7 promotes these to the store.
- `CommandPalette.tsx` already has color constants at the top (BG_BASE, BG_ELEVATED, etc.) — Task 6 replaces them with `useTheme()`.
- Design doc: `docs/plans/2026-03-12-epic-0005-customization-design.md`
- WCAG requirement: all text/bg pairs must meet 4.5:1 contrast (enforced by theme design, not at runtime).
- `error` (#EF4444) and `success` (#22C55E) are fixed across all themes.

---

## Task 1: Create feature branch + install dependencies

**Files:**
- Run: `git checkout develop && git pull`
- Run: `git checkout -b feature/epic-0005-customization`
- Install: `@react-native-async-storage/async-storage`, `expo-document-picker`

**Step 1: Create the branch**

```bash
cd /path/to/NomadCode
git checkout develop && git pull
git checkout -b feature/epic-0005-customization
```

**Step 2: Install missing packages**

```bash
cd mobile-ide/mobile-ide-prototype
npx expo install @react-native-async-storage/async-storage expo-document-picker
```

**Step 3: Verify tests still pass (no regressions from install)**

```bash
npx jest --watchAll=false
```

Expected: all 311 tests pass.

**Step 4: Commit**

```bash
git add mobile-ide/mobile-ide-prototype/package.json mobile-ide/mobile-ide-prototype/package-lock.json
git commit -m "chore(EPIC-0005): install AsyncStorage + expo-document-picker"
```

---

## Task 2: Settings Store

**Files:**
- Create: `src/stores/useSettingsStore.ts`
- Create: `tests/unit/useSettingsStore.test.ts`

### Step 1: Create the stores directory and write the failing tests

Create `tests/unit/useSettingsStore.test.ts`:

```typescript
import { act, renderHook } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Mock AsyncStorage before importing the store
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
  removeItem: jest.fn(() => Promise.resolve()),
}));

// Import AFTER mock is set up
const { default: useSettingsStore } = require('../../src/stores/useSettingsStore');

beforeEach(() => {
  // Reset store state between tests
  useSettingsStore.setState({
    theme: 'nomad-dark',
    fontSize: 14,
    workspacePath: '',
    hasCompletedSetup: false,
  });
  jest.clearAllMocks();
});

describe('useSettingsStore — default state', () => {
  it('defaults theme to nomad-dark', () => {
    const { result } = renderHook(() => useSettingsStore());
    expect(result.current.theme).toBe('nomad-dark');
  });

  it('defaults fontSize to 14', () => {
    const { result } = renderHook(() => useSettingsStore());
    expect(result.current.fontSize).toBe(14);
  });

  it('defaults workspacePath to empty string', () => {
    const { result } = renderHook(() => useSettingsStore());
    expect(result.current.workspacePath).toBe('');
  });

  it('defaults hasCompletedSetup to false', () => {
    const { result } = renderHook(() => useSettingsStore());
    expect(result.current.hasCompletedSetup).toBe(false);
  });
});

describe('useSettingsStore — actions', () => {
  it('setTheme updates the theme id', () => {
    const { result } = renderHook(() => useSettingsStore());
    act(() => { result.current.setTheme('dracula'); });
    expect(result.current.theme).toBe('dracula');
  });

  it('setFontSize updates fontSize', () => {
    const { result } = renderHook(() => useSettingsStore());
    act(() => { result.current.setFontSize(18); });
    expect(result.current.fontSize).toBe(18);
  });

  it('setFontSize clamps to minimum 8', () => {
    const { result } = renderHook(() => useSettingsStore());
    act(() => { result.current.setFontSize(4); });
    expect(result.current.fontSize).toBe(8);
  });

  it('setFontSize clamps to maximum 32', () => {
    const { result } = renderHook(() => useSettingsStore());
    act(() => { result.current.setFontSize(99); });
    expect(result.current.fontSize).toBe(32);
  });

  it('setWorkspacePath updates workspacePath', () => {
    const { result } = renderHook(() => useSettingsStore());
    act(() => { result.current.setWorkspacePath('/projects/myapp'); });
    expect(result.current.workspacePath).toBe('/projects/myapp');
  });

  it('completeSetup sets hasCompletedSetup to true', () => {
    const { result } = renderHook(() => useSettingsStore());
    act(() => { result.current.completeSetup(); });
    expect(result.current.hasCompletedSetup).toBe(true);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npx jest tests/unit/useSettingsStore.test.ts --watchAll=false
```

Expected: FAIL — "Cannot find module '../../src/stores/useSettingsStore'"

**Step 3: Create `src/stores/useSettingsStore.ts`**

```typescript
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ThemeId } from '../theme/tokens';

interface SettingsState {
  theme: ThemeId;
  fontSize: number;
  workspacePath: string;
  hasCompletedSetup: boolean;
  setTheme: (id: ThemeId) => void;
  setFontSize: (n: number) => void;
  setWorkspacePath: (p: string) => void;
  completeSetup: () => void;
}

const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      theme: 'nomad-dark',
      fontSize: 14,
      workspacePath: '',
      hasCompletedSetup: false,
      setTheme: (theme) => set({ theme }),
      setFontSize: (n) => set({ fontSize: Math.min(32, Math.max(8, n)) }),
      setWorkspacePath: (p) => set({ workspacePath: p }),
      completeSetup: () => set({ hasCompletedSetup: true }),
    }),
    {
      name: 'nomadcode-settings',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);

export default useSettingsStore;
```

Note: `ThemeId` is imported from `../theme/tokens` — create a minimal stub there now if tokens.ts doesn't exist yet:

```typescript
// src/theme/tokens.ts (minimal stub — fully implemented in Task 3)
export type ThemeId =
  | 'nomad-dark' | 'one-dark-pro' | 'dracula' | 'monokai' | 'nord' | 'tokyo-night'
  | 'nomad-light' | 'github-light' | 'solarized-light' | 'catppuccin-latte' | 'night-owl-light';
```

**Step 4: Run tests to verify they pass**

```bash
npx jest tests/unit/useSettingsStore.test.ts --watchAll=false
```

Expected: 10 tests pass.

**Step 5: Commit**

```bash
git add src/stores/useSettingsStore.ts src/theme/tokens.ts tests/unit/useSettingsStore.test.ts
git commit -m "feat(EPIC-0005): add useSettingsStore with persist middleware"
```

---

## Task 3: Theme Token System

**Files:**
- Modify: `src/theme/tokens.ts` (replace stub with full implementation)
- Create: `tests/unit/tokens.test.ts`

### Step 1: Write the failing tests

Create `tests/unit/tokens.test.ts`:

```typescript
import { renderHook } from '@testing-library/react-native';

// Mock the store — useTheme reads from it
jest.mock('../../src/stores/useSettingsStore', () => {
  let _theme = 'nomad-dark';
  return {
    __esModule: true,
    default: jest.fn((sel: (s: { theme: string }) => unknown) =>
      sel({ theme: _theme })
    ),
    __setTheme: (t: string) => { _theme = t; },
  };
});

import { THEMES, useTheme, getMonacoTheme, DARK_THEME_IDS, LIGHT_THEME_IDS } from '../../src/theme/tokens';
const mockStore = require('../../src/stores/useSettingsStore');

const ALL_THEME_IDS = [...DARK_THEME_IDS, ...LIGHT_THEME_IDS];
const REQUIRED_KEYS = ['id','mode','name','bg','bgElevated','bgHighlight','text','textMuted','border','accent','keyword','string','error','success'];

describe('THEMES map', () => {
  it('has exactly 11 themes', () => {
    expect(Object.keys(THEMES).length).toBe(11);
  });

  it.each(ALL_THEME_IDS)('%s has all required token keys', (id) => {
    REQUIRED_KEYS.forEach(key => {
      expect(THEMES[id]).toHaveProperty(key);
    });
  });

  it.each(DARK_THEME_IDS)('%s has mode === dark', (id) => {
    expect(THEMES[id].mode).toBe('dark');
  });

  it.each(LIGHT_THEME_IDS)('%s has mode === light', (id) => {
    expect(THEMES[id].mode).toBe('light');
  });

  it.each(ALL_THEME_IDS)('%s error token is always #EF4444', (id) => {
    expect(THEMES[id].error).toBe('#EF4444');
  });

  it.each(ALL_THEME_IDS)('%s success token is always #22C55E', (id) => {
    expect(THEMES[id].success).toBe('#22C55E');
  });
});

describe('useTheme', () => {
  it('returns nomad-dark tokens when store theme is nomad-dark', () => {
    mockStore.__setTheme('nomad-dark');
    const { result } = renderHook(() => useTheme());
    expect(result.current.id).toBe('nomad-dark');
    expect(result.current.mode).toBe('dark');
  });

  it('returns dracula tokens when store theme is dracula', () => {
    mockStore.__setTheme('dracula');
    const { result } = renderHook(() => useTheme());
    expect(result.current.id).toBe('dracula');
  });

  it('returns nomad-light tokens when store theme is nomad-light', () => {
    mockStore.__setTheme('nomad-light');
    const { result } = renderHook(() => useTheme());
    expect(result.current.id).toBe('nomad-light');
    expect(result.current.mode).toBe('light');
  });
});

describe('getMonacoTheme', () => {
  it.each(DARK_THEME_IDS)('returns vs-dark for dark theme %s', (id) => {
    expect(getMonacoTheme(id)).toBe('vs-dark');
  });

  it.each(LIGHT_THEME_IDS)('returns vs for light theme %s', (id) => {
    expect(getMonacoTheme(id)).toBe('vs');
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npx jest tests/unit/tokens.test.ts --watchAll=false
```

Expected: FAIL — missing exports from tokens.ts.

**Step 3: Implement `src/theme/tokens.ts`**

```typescript
import useSettingsStore from '../stores/useSettingsStore';

export type ThemeId =
  | 'nomad-dark' | 'one-dark-pro' | 'dracula' | 'monokai' | 'nord' | 'tokyo-night'
  | 'nomad-light' | 'github-light' | 'solarized-light' | 'catppuccin-latte' | 'night-owl-light';

export interface ThemeTokens {
  id: ThemeId;
  mode: 'dark' | 'light';
  name: string;
  bg: string;
  bgElevated: string;
  bgHighlight: string;
  text: string;
  textMuted: string;
  border: string;
  accent: string;
  keyword: string;
  string: string;
  error: string;
  success: string;
}

export const DARK_THEME_IDS: ThemeId[] = [
  'nomad-dark', 'one-dark-pro', 'dracula', 'monokai', 'nord', 'tokyo-night',
];

export const LIGHT_THEME_IDS: ThemeId[] = [
  'nomad-light', 'github-light', 'solarized-light', 'catppuccin-latte', 'night-owl-light',
];

const FIXED = { error: '#EF4444', success: '#22C55E' };

export const THEMES: Record<ThemeId, ThemeTokens> = {
  'nomad-dark': {
    id: 'nomad-dark', mode: 'dark', name: 'Nomad Dark',
    bg: '#0F172A', bgElevated: '#1E293B', bgHighlight: '#1D3461',
    text: '#E2E8F0', textMuted: '#64748B', border: '#334155',
    accent: '#2563EB', keyword: '#7C3AED', string: '#0D9488',
    ...FIXED,
  },
  'one-dark-pro': {
    id: 'one-dark-pro', mode: 'dark', name: 'One Dark Pro',
    bg: '#282C34', bgElevated: '#21252B', bgHighlight: '#2C313A',
    text: '#ABB2BF', textMuted: '#5C6370', border: '#3E4451',
    accent: '#61AFEF', keyword: '#C678DD', string: '#98C379',
    ...FIXED,
  },
  'dracula': {
    id: 'dracula', mode: 'dark', name: 'Dracula',
    bg: '#282A36', bgElevated: '#21222C', bgHighlight: '#44475A',
    text: '#F8F8F2', textMuted: '#6272A4', border: '#44475A',
    accent: '#BD93F9', keyword: '#FF79C6', string: '#F1FA8C',
    ...FIXED,
  },
  'monokai': {
    id: 'monokai', mode: 'dark', name: 'Monokai',
    bg: '#272822', bgElevated: '#1E1F1C', bgHighlight: '#3E3D32',
    text: '#F8F8F2', textMuted: '#75715E', border: '#49483E',
    accent: '#66D9E8', keyword: '#F92672', string: '#E6DB74',
    ...FIXED,
  },
  'nord': {
    id: 'nord', mode: 'dark', name: 'Nord',
    bg: '#2E3440', bgElevated: '#3B4252', bgHighlight: '#434C5E',
    text: '#D8DEE9', textMuted: '#4C566A', border: '#434C5E',
    accent: '#88C0D0', keyword: '#81A1C1', string: '#A3BE8C',
    ...FIXED,
  },
  'tokyo-night': {
    id: 'tokyo-night', mode: 'dark', name: 'Tokyo Night',
    bg: '#1A1B26', bgElevated: '#16161E', bgHighlight: '#1F2335',
    text: '#C0CAF5', textMuted: '#565F89', border: '#292E42',
    accent: '#7AA2F7', keyword: '#BB9AF7', string: '#9ECE6A',
    ...FIXED,
  },
  'nomad-light': {
    id: 'nomad-light', mode: 'light', name: 'Nomad Light',
    bg: '#F9FAFB', bgElevated: '#FFFFFF', bgHighlight: '#DBEAFE',
    text: '#111827', textMuted: '#6B7280', border: '#E5E7EB',
    accent: '#2563EB', keyword: '#7C3AED', string: '#0D9488',
    ...FIXED,
  },
  'github-light': {
    id: 'github-light', mode: 'light', name: 'GitHub Light',
    bg: '#FFFFFF', bgElevated: '#F6F8FA', bgHighlight: '#DDF4FF',
    text: '#24292F', textMuted: '#6E7781', border: '#D0D7DE',
    accent: '#0969DA', keyword: '#CF222E', string: '#0A3069',
    ...FIXED,
  },
  'solarized-light': {
    id: 'solarized-light', mode: 'light', name: 'Solarized Light',
    bg: '#FDF6E3', bgElevated: '#EEE8D5', bgHighlight: '#E8DCCA',
    text: '#657B83', textMuted: '#93A1A1', border: '#D3CBBA',
    accent: '#268BD2', keyword: '#859900', string: '#2AA198',
    ...FIXED,
  },
  'catppuccin-latte': {
    id: 'catppuccin-latte', mode: 'light', name: 'Catppuccin Latte',
    bg: '#EFF1F5', bgElevated: '#E6E9EF', bgHighlight: '#CCD0DA',
    text: '#4C4F69', textMuted: '#8C8FA1', border: '#BCC0CC',
    accent: '#1E66F5', keyword: '#8839EF', string: '#40A02B',
    ...FIXED,
  },
  'night-owl-light': {
    id: 'night-owl-light', mode: 'light', name: 'Night Owl Light',
    bg: '#FBFBFB', bgElevated: '#F0F0F0', bgHighlight: '#E0E9FF',
    text: '#403F53', textMuted: '#989FB1', border: '#D9D9D9',
    accent: '#4876D6', keyword: '#994CC3', string: '#4876D6',
    ...FIXED,
  },
};

export function useTheme(): ThemeTokens {
  const themeId = useSettingsStore((s) => s.theme);
  return THEMES[themeId];
}

export function getMonacoTheme(id: ThemeId): 'vs-dark' | 'vs' {
  return THEMES[id].mode === 'dark' ? 'vs-dark' : 'vs';
}
```

**Step 4: Run tests**

```bash
npx jest tests/unit/tokens.test.ts --watchAll=false
```

Expected: all tests pass.

**Step 5: Run full suite to confirm no regressions**

```bash
npx jest --watchAll=false
```

Expected: all tests pass.

**Step 6: Commit**

```bash
git add src/theme/tokens.ts tests/unit/tokens.test.ts
git commit -m "feat(EPIC-0005): add theme token system (11 themes) + useTheme hook"
```

---

## Task 4: SetupWizard Component

**Files:**
- Create: `src/components/SetupWizard.tsx`
- Create: `tests/unit/SetupWizard.test.tsx`

### Step 1: Write the failing tests

Create `tests/unit/SetupWizard.test.tsx`:

```typescript
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

// Mock the settings store
const mockSetTheme = jest.fn();
const mockSetFontSize = jest.fn();
const mockSetWorkspacePath = jest.fn();
const mockCompleteSetup = jest.fn();
let mockHasCompletedSetup = false;
let mockFontSize = 14;
let mockTheme = 'nomad-dark';

jest.mock('../../src/stores/useSettingsStore', () => ({
  __esModule: true,
  default: jest.fn((sel: (s: object) => unknown) =>
    sel({
      theme: mockTheme,
      fontSize: mockFontSize,
      hasCompletedSetup: mockHasCompletedSetup,
      setTheme: mockSetTheme,
      setFontSize: mockSetFontSize,
      setWorkspacePath: mockSetWorkspacePath,
      completeSetup: mockCompleteSetup,
    })
  ),
}));

jest.mock('expo-document-picker', () => ({
  getDocumentAsync: jest.fn(() => Promise.resolve({ canceled: true })),
}));

jest.mock('expo-file-system', () => ({
  documentDirectory: 'file:///mock-docs/',
}));

import SetupWizard from '../../src/components/SetupWizard';

beforeEach(() => {
  jest.clearAllMocks();
  mockHasCompletedSetup = false;
  mockFontSize = 14;
  mockTheme = 'nomad-dark';
});

describe('SetupWizard — visibility', () => {
  it('renders when visible is true', () => {
    render(<SetupWizard visible={true} />);
    expect(screen.getByTestId('setup-wizard')).toBeTruthy();
  });

  it('does not render content when visible is false', () => {
    render(<SetupWizard visible={false} />);
    expect(screen.queryByTestId('setup-wizard')).toBeNull();
  });
});

describe('SetupWizard — Step 1 (Theme)', () => {
  it('shows step 1 of 3 indicator', () => {
    render(<SetupWizard visible={true} />);
    expect(screen.getByText('1 / 3')).toBeTruthy();
  });

  it('shows Dark and Light mode buttons', () => {
    render(<SetupWizard visible={true} />);
    expect(screen.getByTestId('mode-dark')).toBeTruthy();
    expect(screen.getByTestId('mode-light')).toBeTruthy();
  });

  it('pressing Dark mode button shows dark theme swatches', () => {
    render(<SetupWizard visible={true} />);
    fireEvent.press(screen.getByTestId('mode-dark'));
    expect(screen.getByTestId('swatch-nomad-dark')).toBeTruthy();
    expect(screen.getByTestId('swatch-dracula')).toBeTruthy();
  });

  it('pressing Light mode button shows light theme swatches', () => {
    render(<SetupWizard visible={true} />);
    fireEvent.press(screen.getByTestId('mode-light'));
    expect(screen.getByTestId('swatch-nomad-light')).toBeTruthy();
    expect(screen.getByTestId('swatch-github-light')).toBeTruthy();
  });

  it('pressing a theme swatch calls setTheme with that id', () => {
    render(<SetupWizard visible={true} />);
    fireEvent.press(screen.getByTestId('mode-dark'));
    fireEvent.press(screen.getByTestId('swatch-dracula'));
    expect(mockSetTheme).toHaveBeenCalledWith('dracula');
  });

  it('Next button advances to step 2', () => {
    render(<SetupWizard visible={true} />);
    fireEvent.press(screen.getByTestId('btn-next'));
    expect(screen.getByText('2 / 3')).toBeTruthy();
  });
});

describe('SetupWizard — Step 2 (Font Size)', () => {
  function goToStep2() {
    render(<SetupWizard visible={true} />);
    fireEvent.press(screen.getByTestId('btn-next'));
  }

  it('shows step 2 of 3 indicator', () => {
    goToStep2();
    expect(screen.getByText('2 / 3')).toBeTruthy();
  });

  it('A+ button calls setFontSize with fontSize + 1', () => {
    goToStep2();
    fireEvent.press(screen.getByTestId('btn-font-inc'));
    expect(mockSetFontSize).toHaveBeenCalledWith(15);
  });

  it('A- button calls setFontSize with fontSize - 1', () => {
    goToStep2();
    fireEvent.press(screen.getByTestId('btn-font-dec'));
    expect(mockSetFontSize).toHaveBeenCalledWith(13);
  });

  it('Reset button calls setFontSize with 14', () => {
    mockFontSize = 20;
    goToStep2();
    fireEvent.press(screen.getByTestId('btn-font-reset'));
    expect(mockSetFontSize).toHaveBeenCalledWith(14);
  });

  it('Back button returns to step 1', () => {
    goToStep2();
    fireEvent.press(screen.getByTestId('btn-back'));
    expect(screen.getByText('1 / 3')).toBeTruthy();
  });

  it('Next button advances to step 3', () => {
    goToStep2();
    fireEvent.press(screen.getByTestId('btn-next'));
    expect(screen.getByText('3 / 3')).toBeTruthy();
  });
});

describe('SetupWizard — Step 3 (Workspace)', () => {
  function goToStep3() {
    render(<SetupWizard visible={true} />);
    fireEvent.press(screen.getByTestId('btn-next')); // → step 2
    fireEvent.press(screen.getByTestId('btn-next')); // → step 3
  }

  it('shows step 3 of 3 indicator', () => {
    goToStep3();
    expect(screen.getByText('3 / 3')).toBeTruthy();
  });

  it('Get Started calls completeSetup', () => {
    goToStep3();
    fireEvent.press(screen.getByTestId('btn-get-started'));
    expect(mockCompleteSetup).toHaveBeenCalledTimes(1);
  });

  it('Skip calls completeSetup', () => {
    goToStep3();
    fireEvent.press(screen.getByTestId('btn-skip'));
    expect(mockCompleteSetup).toHaveBeenCalledTimes(1);
  });

  it('Back button returns to step 2', () => {
    goToStep3();
    fireEvent.press(screen.getByTestId('btn-back'));
    expect(screen.getByText('2 / 3')).toBeTruthy();
  });
});
```

**Step 2: Run tests to verify they fail**

```bash
npx jest tests/unit/SetupWizard.test.tsx --watchAll=false
```

Expected: FAIL — "Cannot find module '../../src/components/SetupWizard'"

**Step 3: Implement `src/components/SetupWizard.tsx`**

```typescript
import React, { useState } from 'react';
import {
  Modal, View, Text, TouchableOpacity, StyleSheet, ScrollView,
} from 'react-native';
import * as FileSystem from 'expo-file-system';
import useSettingsStore from '../stores/useSettingsStore';
import { THEMES, DARK_THEME_IDS, LIGHT_THEME_IDS, ThemeId } from '../theme/tokens';

interface SetupWizardProps {
  visible: boolean;
}

type Mode = 'dark' | 'light';

export default function SetupWizard({ visible }: SetupWizardProps) {
  const [step, setStep] = useState(1);
  const [selectedMode, setSelectedMode] = useState<Mode>('dark');

  const { theme, fontSize, setTheme, setFontSize, setWorkspacePath, completeSetup } =
    useSettingsStore((s) => s);

  if (!visible) return null;

  const swatchIds = selectedMode === 'dark' ? DARK_THEME_IDS : LIGHT_THEME_IDS;

  function handleModePress(mode: Mode) {
    setSelectedMode(mode);
    // Apply the default theme for the chosen mode immediately
    const defaultId: ThemeId = mode === 'dark' ? 'nomad-dark' : 'nomad-light';
    setTheme(defaultId);
  }

  function handleGetStarted() {
    setWorkspacePath(FileSystem.documentDirectory ?? '');
    completeSetup();
  }

  return (
    <Modal testID="setup-wizard" visible={visible} animationType="slide">
      <View style={styles.container}>
        {/* Progress */}
        <Text style={styles.progress}>{step} / 3</Text>

        {/* Step 1: Theme */}
        {step === 1 && (
          <View>
            <Text style={styles.title}>Choose your theme</Text>
            <View style={styles.modeRow}>
              <TouchableOpacity
                testID="mode-dark"
                style={[styles.modeBtn, selectedMode === 'dark' && styles.modeBtnActive]}
                onPress={() => handleModePress('dark')}
              >
                <Text style={styles.modeBtnText}>Dark</Text>
              </TouchableOpacity>
              <TouchableOpacity
                testID="mode-light"
                style={[styles.modeBtn, selectedMode === 'light' && styles.modeBtnActive]}
                onPress={() => handleModePress('light')}
              >
                <Text style={styles.modeBtnText}>Light</Text>
              </TouchableOpacity>
            </View>
            <ScrollView>
              {swatchIds.map((id) => {
                const t = THEMES[id];
                return (
                  <TouchableOpacity
                    key={id}
                    testID={`swatch-${id}`}
                    style={[styles.swatch, { backgroundColor: t.bg }, theme === id && styles.swatchActive]}
                    onPress={() => setTheme(id)}
                  >
                    <Text style={[styles.swatchName, { color: t.text }]}>{t.name}</Text>
                    <View style={styles.chipRow}>
                      {[t.bg, t.text, t.accent, t.keyword].map((c, i) => (
                        <View key={i} style={[styles.chip, { backgroundColor: c }]} />
                      ))}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <TouchableOpacity testID="btn-next" style={styles.btn} onPress={() => setStep(2)}>
              <Text style={styles.btnText}>Next</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Step 2: Font Size */}
        {step === 2 && (
          <View>
            <Text style={styles.title}>Choose font size</Text>
            <Text style={[styles.preview, { fontSize }]}>{'const hello = "world";'}</Text>
            <View style={styles.fontRow}>
              <TouchableOpacity testID="btn-font-dec" onPress={() => setFontSize(fontSize - 1)}>
                <Text style={styles.fontBtn}>A-</Text>
              </TouchableOpacity>
              <Text style={styles.fontValue}>{fontSize}</Text>
              <TouchableOpacity testID="btn-font-inc" onPress={() => setFontSize(fontSize + 1)}>
                <Text style={styles.fontBtn}>A+</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity testID="btn-font-reset" onPress={() => setFontSize(14)}>
              <Text style={styles.resetLink}>Reset to default</Text>
            </TouchableOpacity>
            <View style={styles.navRow}>
              <TouchableOpacity testID="btn-back" onPress={() => setStep(1)}>
                <Text style={styles.backBtn}>Back</Text>
              </TouchableOpacity>
              <TouchableOpacity testID="btn-next" style={styles.btn} onPress={() => setStep(3)}>
                <Text style={styles.btnText}>Next</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Step 3: Workspace */}
        {step === 3 && (
          <View>
            <Text style={styles.title}>Set workspace folder</Text>
            <Text style={styles.hint}>You can change this later in Settings.</Text>
            <View style={styles.navRow}>
              <TouchableOpacity testID="btn-back" onPress={() => setStep(2)}>
                <Text style={styles.backBtn}>Back</Text>
              </TouchableOpacity>
              <TouchableOpacity testID="btn-skip" onPress={handleGetStarted}>
                <Text style={styles.skipBtn}>Skip for now</Text>
              </TouchableOpacity>
              <TouchableOpacity testID="btn-get-started" style={styles.btn} onPress={handleGetStarted}>
                <Text style={styles.btnText}>Get Started</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: '#0F172A' },
  progress: { color: '#64748B', fontSize: 13, textAlign: 'right', marginBottom: 8 },
  title: { color: '#E2E8F0', fontSize: 22, fontWeight: '700', marginBottom: 16 },
  modeRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  modeBtn: { flex: 1, padding: 14, borderRadius: 8, backgroundColor: '#1E293B', alignItems: 'center' },
  modeBtnActive: { borderWidth: 2, borderColor: '#2563EB' },
  modeBtnText: { color: '#E2E8F0', fontWeight: '600' },
  swatch: { borderRadius: 8, padding: 12, marginBottom: 8 },
  swatchActive: { borderWidth: 2, borderColor: '#2563EB' },
  swatchName: { fontWeight: '600', marginBottom: 6 },
  chipRow: { flexDirection: 'row', gap: 6 },
  chip: { width: 16, height: 16, borderRadius: 4 },
  btn: { backgroundColor: '#2563EB', padding: 14, borderRadius: 8, alignItems: 'center', marginTop: 16 },
  btnText: { color: '#FFFFFF', fontWeight: '700' },
  preview: { color: '#E2E8F0', fontFamily: 'monospace', marginVertical: 16 },
  fontRow: { flexDirection: 'row', alignItems: 'center', gap: 24, justifyContent: 'center' },
  fontBtn: { color: '#E2E8F0', fontSize: 20, fontWeight: '700', padding: 8 },
  fontValue: { color: '#E2E8F0', fontSize: 18, minWidth: 30, textAlign: 'center' },
  resetLink: { color: '#64748B', textAlign: 'center', marginTop: 12 },
  navRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 },
  backBtn: { color: '#64748B', fontSize: 16 },
  skipBtn: { color: '#64748B', fontSize: 16 },
  hint: { color: '#64748B', marginBottom: 16 },
});
```

**Step 4: Run tests**

```bash
npx jest tests/unit/SetupWizard.test.tsx --watchAll=false
```

Expected: all tests pass.

**Step 5: Run full suite**

```bash
npx jest --watchAll=false
```

Expected: all pass.

**Step 6: Commit**

```bash
git add src/components/SetupWizard.tsx tests/unit/SetupWizard.test.tsx
git commit -m "feat(EPIC-0005): add SetupWizard — 3-step first-run wizard"
```

---

## Task 5: SettingsScreen Component

**Files:**
- Create: `src/components/SettingsScreen.tsx`
- Create: `tests/unit/SettingsScreen.test.tsx`

### Step 1: Write the failing tests

Create `tests/unit/SettingsScreen.test.tsx`:

```typescript
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

const mockSetTheme = jest.fn();
const mockSetFontSize = jest.fn();
let mockTheme = 'nomad-dark';
let mockFontSize = 14;

jest.mock('../../src/stores/useSettingsStore', () => ({
  __esModule: true,
  default: jest.fn((sel: (s: object) => unknown) =>
    sel({
      theme: mockTheme,
      fontSize: mockFontSize,
      setTheme: mockSetTheme,
      setFontSize: mockSetFontSize,
    })
  ),
}));

jest.mock('expo-file-system', () => ({
  documentDirectory: 'file:///mock-docs/',
}));

import SettingsScreen from '../../src/components/SettingsScreen';

beforeEach(() => {
  jest.clearAllMocks();
  mockTheme = 'nomad-dark';
  mockFontSize = 14;
});

describe('SettingsScreen', () => {
  it('renders when visible', () => {
    render(<SettingsScreen visible={true} onClose={jest.fn()} />);
    expect(screen.getByTestId('settings-screen')).toBeTruthy();
  });

  it('does not render when not visible', () => {
    render(<SettingsScreen visible={false} onClose={jest.fn()} />);
    expect(screen.queryByTestId('settings-screen')).toBeNull();
  });

  it('close button calls onClose', () => {
    const onClose = jest.fn();
    render(<SettingsScreen visible={true} onClose={onClose} />);
    fireEvent.press(screen.getByTestId('btn-close'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('Dark mode button press shows dark theme swatches', () => {
    render(<SettingsScreen visible={true} onClose={jest.fn()} />);
    fireEvent.press(screen.getByTestId('settings-mode-dark'));
    expect(screen.getByTestId('settings-swatch-nomad-dark')).toBeTruthy();
  });

  it('Light mode button press shows light theme swatches', () => {
    render(<SettingsScreen visible={true} onClose={jest.fn()} />);
    fireEvent.press(screen.getByTestId('settings-mode-light'));
    expect(screen.getByTestId('settings-swatch-nomad-light')).toBeTruthy();
  });

  it('pressing a theme swatch calls setTheme', () => {
    render(<SettingsScreen visible={true} onClose={jest.fn()} />);
    fireEvent.press(screen.getByTestId('settings-mode-dark'));
    fireEvent.press(screen.getByTestId('settings-swatch-nord'));
    expect(mockSetTheme).toHaveBeenCalledWith('nord');
  });

  it('A+ button calls setFontSize with fontSize + 1', () => {
    render(<SettingsScreen visible={true} onClose={jest.fn()} />);
    fireEvent.press(screen.getByTestId('settings-font-inc'));
    expect(mockSetFontSize).toHaveBeenCalledWith(15);
  });

  it('A- button calls setFontSize with fontSize - 1', () => {
    render(<SettingsScreen visible={true} onClose={jest.fn()} />);
    fireEvent.press(screen.getByTestId('settings-font-dec'));
    expect(mockSetFontSize).toHaveBeenCalledWith(13);
  });
});
```

**Step 2: Run tests to verify they fail**

```bash
npx jest tests/unit/SettingsScreen.test.tsx --watchAll=false
```

Expected: FAIL — "Cannot find module '../../src/components/SettingsScreen'"

**Step 3: Implement `src/components/SettingsScreen.tsx`**

```typescript
import React, { useState } from 'react';
import {
  Modal, View, Text, TouchableOpacity, StyleSheet, ScrollView,
} from 'react-native';
import useSettingsStore from '../stores/useSettingsStore';
import { THEMES, DARK_THEME_IDS, LIGHT_THEME_IDS, ThemeId } from '../theme/tokens';

interface SettingsScreenProps {
  visible: boolean;
  onClose: () => void;
}

type Mode = 'dark' | 'light';

export default function SettingsScreen({ visible, onClose }: SettingsScreenProps) {
  const [selectedMode, setSelectedMode] = useState<Mode>('dark');
  const { theme, fontSize, setTheme, setFontSize } = useSettingsStore((s) => s);

  if (!visible) return null;

  const swatchIds = selectedMode === 'dark' ? DARK_THEME_IDS : LIGHT_THEME_IDS;

  return (
    <Modal testID="settings-screen" visible={visible} animationType="slide">
      <ScrollView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Settings</Text>
          <TouchableOpacity testID="btn-close" onPress={onClose}>
            <Text style={styles.closeBtn}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* Appearance */}
        <Text style={styles.sectionTitle}>Appearance</Text>
        <View style={styles.modeRow}>
          <TouchableOpacity
            testID="settings-mode-dark"
            style={[styles.modeBtn, selectedMode === 'dark' && styles.modeBtnActive]}
            onPress={() => setSelectedMode('dark')}
          >
            <Text style={styles.modeBtnText}>Dark</Text>
          </TouchableOpacity>
          <TouchableOpacity
            testID="settings-mode-light"
            style={[styles.modeBtn, selectedMode === 'light' && styles.modeBtnActive]}
            onPress={() => setSelectedMode('light')}
          >
            <Text style={styles.modeBtnText}>Light</Text>
          </TouchableOpacity>
        </View>
        {swatchIds.map((id) => {
          const t = THEMES[id];
          return (
            <TouchableOpacity
              key={id}
              testID={`settings-swatch-${id}`}
              style={[styles.swatch, { backgroundColor: t.bg }, theme === id && styles.swatchActive]}
              onPress={() => setTheme(id)}
            >
              <Text style={[styles.swatchName, { color: t.text }]}>{t.name}</Text>
              <View style={styles.chipRow}>
                {[t.bg, t.text, t.accent, t.keyword].map((c, i) => (
                  <View key={i} style={[styles.chip, { backgroundColor: c }]} />
                ))}
              </View>
            </TouchableOpacity>
          );
        })}

        {/* Editor */}
        <Text style={styles.sectionTitle}>Editor</Text>
        <View style={styles.fontRow}>
          <TouchableOpacity testID="settings-font-dec" onPress={() => setFontSize(fontSize - 1)}>
            <Text style={styles.fontBtn}>A-</Text>
          </TouchableOpacity>
          <Text style={styles.fontValue}>{fontSize}</Text>
          <TouchableOpacity testID="settings-font-inc" onPress={() => setFontSize(fontSize + 1)}>
            <Text style={styles.fontBtn}>A+</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A', padding: 24 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  title: { color: '#E2E8F0', fontSize: 22, fontWeight: '700' },
  closeBtn: { color: '#64748B', fontSize: 22 },
  sectionTitle: { color: '#64748B', fontSize: 12, fontWeight: '600', letterSpacing: 1, marginBottom: 12, marginTop: 16 },
  modeRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  modeBtn: { flex: 1, padding: 12, borderRadius: 8, backgroundColor: '#1E293B', alignItems: 'center' },
  modeBtnActive: { borderWidth: 2, borderColor: '#2563EB' },
  modeBtnText: { color: '#E2E8F0', fontWeight: '600' },
  swatch: { borderRadius: 8, padding: 12, marginBottom: 8 },
  swatchActive: { borderWidth: 2, borderColor: '#2563EB' },
  swatchName: { fontWeight: '600', marginBottom: 6 },
  chipRow: { flexDirection: 'row', gap: 6 },
  chip: { width: 16, height: 16, borderRadius: 4 },
  fontRow: { flexDirection: 'row', alignItems: 'center', gap: 20 },
  fontBtn: { color: '#E2E8F0', fontSize: 20, fontWeight: '700', padding: 8 },
  fontValue: { color: '#E2E8F0', fontSize: 18, minWidth: 30, textAlign: 'center' },
});
```

**Step 4: Run tests**

```bash
npx jest tests/unit/SettingsScreen.test.tsx --watchAll=false
```

Expected: all 8 tests pass.

**Step 5: Run full suite**

```bash
npx jest --watchAll=false
```

Expected: all pass.

**Step 6: Commit**

```bash
git add src/components/SettingsScreen.tsx tests/unit/SettingsScreen.test.tsx
git commit -m "feat(EPIC-0005): add SettingsScreen modal"
```

---

## Task 6: Theme Existing Components (CommandPalette, TabletResponsive, Terminal, FileExplorer)

**Files:**
- Modify: `src/components/CommandPalette.tsx`
- Modify: `src/layout/TabletResponsive.tsx`
- Modify: `src/components/Terminal.tsx`
- Modify: `src/components/FileExplorer.tsx`
- Modify: `tests/unit/TabletResponsive.test.tsx` (add gear icon tests)

This task replaces hardcoded hex values with `useTheme()` tokens. No new tests for the component theming itself — WCAG compliance is a design-time guarantee, not a runtime test. We do add gear icon tests to TabletResponsive.

### CommandPalette.tsx

Remove the 7 color constants at the top (BG_BASE, BG_ELEVATED, etc.) and replace with `useTheme()`:

**Step 1:** At the top of the file, add the import:
```typescript
import { useTheme } from '../theme/tokens';
```

**Step 2:** Inside the `CommandPalette` function body (before the return), add:
```typescript
const t = useTheme();
```

**Step 3:** Replace every color constant reference in the `StyleSheet.create(...)` call. The stylesheet is currently static — it must move inside the component so it can use `t`:

```typescript
// Move styles inside the component function, replace constants:
const styles = StyleSheet.create({
  overlay:   { flex: 1 },
  backdrop:  { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)' },
  panel:     { margin: 20, marginTop: 80, borderRadius: 12, backgroundColor: t.bgElevated,
               maxHeight: '70%', overflow: 'hidden' },
  input:     { padding: 14, fontSize: 16, color: t.text, borderBottomWidth: 1, borderBottomColor: t.border },
  itemRow:   { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10 },
  itemLabel: { color: t.text, fontSize: 15, flex: 1 },
  itemDesc:  { color: t.textMuted, fontSize: 13, marginTop: 2 },
  badge:     { backgroundColor: t.border, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  badgeText: { color: t.textMuted, fontSize: 11 },
  empty:     { padding: 20, alignItems: 'center' },
  emptyText: { color: t.textMuted, fontSize: 14 },
  selectedBg: { backgroundColor: t.accent },
});
```

Replace `BG_BASE` with `t.bg`, `ACCENT_BLUE` with `t.accent`, etc. throughout the JSX.

### TabletResponsive.tsx

**Step 1:** Add import:
```typescript
import { useTheme } from '../theme/tokens';
```

**Step 2:** Add `onOpenSettings?: () => void` to the `TabletResponsiveProps` interface.

**Step 3:** Destructure in the component:
```typescript
const { onOpenSettings } = props;
const t = useTheme();
```

**Step 4:** Replace `backgroundColor: '#0F172A'` in the stylesheet with `backgroundColor: t.bg` (move inline to component).

**Step 5:** Add a gear icon button in the sidebar header area (tablet layout):
```typescript
<TouchableOpacity testID="settings-gear" onPress={onOpenSettings} style={styles.gearBtn}>
  <Text style={styles.gearIcon}>⚙</Text>
</TouchableOpacity>
```

**Step 6:** Add gear icon tests to `tests/unit/TabletResponsive.test.tsx`:

```typescript
describe('TabletResponsive — settings gear icon', () => {
  beforeEach(() => setWidth(1024));

  it('renders the gear icon', () => {
    render(
      <TabletResponsive sidebar={<Sidebar />} main={<Main />} terminal={null} />,
    );
    expect(screen.getByTestId('settings-gear')).toBeTruthy();
  });

  it('pressing gear icon calls onOpenSettings', () => {
    const onOpenSettings = jest.fn();
    render(
      <TabletResponsive
        sidebar={<Sidebar />}
        main={<Main />}
        terminal={null}
        onOpenSettings={onOpenSettings}
      />,
    );
    fireEvent.press(screen.getByTestId('settings-gear'));
    expect(onOpenSettings).toHaveBeenCalledTimes(1);
  });

  it('does not crash when onOpenSettings is not provided', () => {
    render(
      <TabletResponsive sidebar={<Sidebar />} main={<Main />} terminal={null} />,
    );
    expect(() => fireEvent.press(screen.getByTestId('settings-gear'))).not.toThrow();
  });
});
```

### Terminal.tsx and FileExplorer.tsx

Add `import { useTheme } from '../theme/tokens';` to each file. Inside each component, add `const t = useTheme();` and replace hardcoded hex strings in StyleSheet with token references (`t.bg`, `t.text`, `t.error`, `t.success`, etc.).

**Step 7: Run full test suite**

```bash
npx jest --watchAll=false
```

Expected: all pass (including the 3 new gear icon tests).

**Step 8: Commit**

```bash
git add src/components/CommandPalette.tsx src/layout/TabletResponsive.tsx \
        src/components/Terminal.tsx src/components/FileExplorer.tsx \
        tests/unit/TabletResponsive.test.tsx
git commit -m "feat(EPIC-0005): apply useTheme() tokens to all components; add gear icon to TabletResponsive"
```

---

## Task 7: Theme Editor + Wire Font Size to Store

**Files:**
- Modify: `src/components/Editor.tsx`

The Editor has two changes:
1. Replace hardcoded colors with `useTheme()` tokens.
2. Promote the local `fontSize` state to use `useSettingsStore` as the source of truth. The local `setFontSize` state setter is replaced by `store.setFontSize`. The Monaco WebView is also told the correct theme (`vs-dark` / `vs`).

**Step 1: Add imports**

```typescript
import { useTheme, getMonacoTheme } from '../theme/tokens';
import useSettingsStore from '../stores/useSettingsStore';
```

**Step 2: Replace local fontSize state**

Remove:
```typescript
const [fontSize, setFontSize] = useState(14);
```

Replace with:
```typescript
const fontSize    = useSettingsStore((s) => s.fontSize);
const setFontSize = useSettingsStore((s) => s.setFontSize);
const themeId     = useSettingsStore((s) => s.theme);
const t = useTheme();
```

**Step 3: Update `changeFontSize`** — the callback now calls the store's `setFontSize` (which clamps internally), so remove the local clamp:

```typescript
const changeFontSize = useCallback(
  (delta: number) => {
    const next = fontSize + delta;
    setFontSize(next);               // store clamps to [8,32]
    sendToEditor('setFontSize', { fontSize: Math.min(32, Math.max(8, next)) });
  },
  [fontSize, setFontSize, sendToEditor],
);
```

**Step 4: Pass Monaco theme when building HTML**

In the `useEffect` that calls `MonacoAssetManager.resolve()`:
```typescript
setMonacoHtml(buildMonacoHtml(baseUrl, getMonacoTheme(themeId)));
```

Update `buildMonacoHtml` signature if needed to accept a theme string.

**Step 5: Replace hardcoded colors in StyleSheet**

Move `StyleSheet.create(...)` inside the component (same pattern as CommandPalette) and replace every hardcoded hex with a token:
- `#0F172A` → `t.bg`
- `#1E293B` → `t.bgElevated`
- `#E2E8F0` → `t.text`
- `#9DA5B4`, `#6B7280`, `#94A3B8`, `#64748B` → `t.textMuted`
- `#334155` → `t.border`
- `#2563EB` → `t.accent`
- `#EF4444` → `t.error`

**Step 6: Run full test suite**

```bash
npx jest --watchAll=false
```

Expected: all tests pass. If `fontSizeChanged` message handling now sets the store instead of local state, adjust the message handler — call `setFontSize(msg.fontSize)` (the store action).

**Step 7: Commit**

```bash
git add src/components/Editor.tsx
git commit -m "feat(EPIC-0005): wire Editor fontSize to settings store; apply theme tokens"
```

---

## Task 8: Wire App.tsx + Update Docs

**Files:**
- Modify: `App.tsx`
- Modify: `tests/unit/App.test.tsx`
- Modify: `docs/plan-status.json`
- Modify: `docs/RELEASE_PLAN.md`
- Modify: `docs/ID_REGISTRY.md`
- Modify: `progress.md`

### App.tsx changes

**Step 1:** Add imports:
```typescript
import SetupWizard from './src/components/SetupWizard';
import SettingsScreen from './src/components/SettingsScreen';
import useSettingsStore from './src/stores/useSettingsStore';
```

**Step 2:** Add state:
```typescript
const [showSettings, setShowSettings] = useState(false);
const hasCompletedSetup = useSettingsStore((s) => s.hasCompletedSetup);
```

**Step 3:** Pass `onOpenSettings` to `TabletResponsive`:
```typescript
<TabletResponsive
  ...
  onOpenSettings={() => setShowSettings(true)}
/>
```

**Step 4:** Mount wizard and settings screen (always-mounted with `visible` prop):
```typescript
<SetupWizard visible={!hasCompletedSetup} />
<SettingsScreen visible={showSettings} onClose={() => setShowSettings(false)} />
```

### App.test.tsx additions

Add tests to the existing `tests/unit/App.test.tsx`:

```typescript
it('SetupWizard is visible when hasCompletedSetup is false', () => {
  // Mock store to return hasCompletedSetup: false (default in mock)
  render(<App />);
  expect(screen.getByTestId('setup-wizard')).toBeTruthy();
});
```

### Docs updates

**Step 5: Update `docs/plan-status.json`**
- EPIC-0005 status: `"Planned"` → `"Done"`
- US-0018, US-0019 status: `"Planned"` → `"Done"`, `branch` → `"feature/epic-0005-customization"`
- AC-0054–AC-0059: `"done": false` → `"done": true`
- TC-0149–TC-0159 (existing EPIC-0005 TCs): `"status": "Not Run"` → `"status": "Pass"`
- Add new TCs (TC-0185 onwards) for store, wizard, settings, gear icon tests

**Step 6: Update `docs/RELEASE_PLAN.md`**
- US-0018, US-0019: `Status: Planned` → `Status: Done`; `[ ]` → `[x]` for all ACs

**Step 7: Update `docs/ID_REGISTRY.md`**
- TC: update next available ID to reflect new TCs added

**Step 8: Regenerate dashboard**

```bash
node tools/generate-plan.js
```

Expected: `6 epics, 21 stories, N TCs, 5 bugs.`

**Step 9: Update `progress.md`** with session summary.

**Step 10: Run full test suite one final time**

```bash
npx jest --watchAll=false
```

Expected: all tests pass.

**Step 11: Commit everything**

```bash
git add App.tsx tests/unit/App.test.tsx \
        docs/plan-status.json docs/plan-status.html docs/RELEASE_PLAN.md \
        docs/ID_REGISTRY.md progress.md docs/AI_COST_LOG.md
git commit -m "feat(EPIC-0005): wire App.tsx; update all docs for EPIC-0005 completion"
```

**Step 12: Push and create PR**

```bash
git push -u origin feature/epic-0005-customization
gh pr create --base develop \
  --title "feat(EPIC-0005): customization — 11-theme system, setup wizard, settings screen" \
  --body "..."
```

---

## Summary of new files

| File | Type |
|---|---|
| `src/stores/useSettingsStore.ts` | New |
| `src/theme/tokens.ts` | New (was stub) |
| `src/components/SetupWizard.tsx` | New |
| `src/components/SettingsScreen.tsx` | New |
| `tests/unit/useSettingsStore.test.ts` | New |
| `tests/unit/tokens.test.ts` | New |
| `tests/unit/SetupWizard.test.tsx` | New |
| `tests/unit/SettingsScreen.test.tsx` | New |

## Summary of modified files

| File | Change |
|---|---|
| `src/components/CommandPalette.tsx` | useTheme() tokens |
| `src/layout/TabletResponsive.tsx` | useTheme(), gear icon, onOpenSettings prop |
| `src/components/Terminal.tsx` | useTheme() tokens |
| `src/components/FileExplorer.tsx` | useTheme() tokens |
| `src/components/Editor.tsx` | useTheme(), fontSize → store, Monaco theme |
| `App.tsx` | SetupWizard, SettingsScreen, showSettings state |
| `tests/unit/TabletResponsive.test.tsx` | Gear icon tests |
| `tests/unit/App.test.tsx` | SetupWizard visibility test |
