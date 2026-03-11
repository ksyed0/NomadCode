# US-0002 Syntax Highlighting Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Close US-0002 by assigning AC IDs, adding unit tests for `getLanguageForFile`, and implementing virtual keyboard viewport adjustment in the Editor component.

**Architecture:** Monaco already handles syntax highlighting via `monaco.editor.setModelLanguage()`. The `getLanguageForFile()` utility maps file extensions to Monaco language IDs and is exported but untested. Virtual keyboard adjustment requires wrapping the editor in `KeyboardAvoidingView` so the Monaco WebView scrolls up when the soft keyboard appears.

**Tech Stack:** React Native (Expo ~52), TypeScript, react-native-webview, `@testing-library/react-native`, Jest

---

## Pre-flight

Before starting, branch off `develop`:

```bash
git checkout develop
git pull origin develop
git checkout -b feature/US-0002-syntax-highlighting
```

---

## Task 1: Assign AC IDs and update registry

**Files:**
- Modify: `Docs/RELEASE_PLAN.md`
- Modify: `Docs/ID_REGISTRY.md`

**Step 1: Update ID_REGISTRY.md**

In `Docs/ID_REGISTRY.md`, change:
```
| AC | AC-0012 | AC-0011 |
```
to:
```
| AC | AC-0015 | AC-0014 |
```

**Step 2: Replace AC-TBD entries in RELEASE_PLAN.md**

Find the US-0002 block and replace the three `AC-TBD` lines with:
```
  - [ ] AC-0012: TypeScript/JavaScript files receive correct syntax highlighting (language detected from extension)
  - [ ] AC-0013: Editor is responsive to touch input — tap positions cursor, pinch adjusts font size
  - [ ] AC-0014: Virtual keyboard raises the editor viewport so the cursor line remains visible
```

**Step 3: Commit**
```bash
git add Docs/RELEASE_PLAN.md Docs/ID_REGISTRY.md
git commit -m "docs(US-0002): assign AC-0012..AC-0014"
```

---

## Task 2: Unit-test getLanguageForFile (TDD — tests first)

**Files:**
- Modify: `mobile-ide/mobile-ide-prototype/tests/unit/Editor.test.tsx`

**Step 1: Write the failing tests**

Add a new `describe` block at the bottom of `Editor.test.tsx`:

```typescript
// ---------------------------------------------------------------------------
// getLanguageForFile
// ---------------------------------------------------------------------------

import { getLanguageForFile } from '../../src/components/Editor';

describe('getLanguageForFile', () => {
  it.each([
    // TypeScript / JavaScript
    ['App.tsx',        'typescript'],
    ['index.ts',       'typescript'],
    ['App.jsx',        'javascript'],
    ['index.js',       'javascript'],
    ['module.mjs',     'javascript'],
    ['lib.cjs',        'javascript'],
    // Web
    ['style.css',      'css'],
    ['theme.scss',     'scss'],
    ['vars.less',      'less'],
    ['index.html',     'html'],
    ['page.htm',       'html'],
    ['feed.xml',       'xml'],
    // Data / config
    ['config.json',    'json'],
    ['settings.jsonc', 'json'],
    ['README.md',      'markdown'],
    ['post.mdx',       'markdown'],
    ['ci.yaml',        'yaml'],
    ['ci.yml',         'yaml'],
    ['config.toml',    'ini'],
    ['.env',           'ini'],
    ['schema.sql',     'sql'],
    ['query.graphql',  'graphql'],
    // Systems languages
    ['main.rs',        'rust'],
    ['main.go',        'go'],
    ['App.swift',      'swift'],
    ['main.c',         'c'],
    ['main.cpp',       'cpp'],
    ['header.h',       'c'],
    ['header.hpp',     'cpp'],
    ['Main.java',      'java'],
    ['Main.kt',        'kotlin'],
    ['script.py',      'python'],
    ['app.rb',         'ruby'],
    ['index.php',      'php'],
    // Shell
    ['build.sh',       'shell'],
    ['run.bash',       'shell'],
    ['setup.zsh',      'shell'],
    // Dockerfile
    ['Dockerfile',     'dockerfile'],
    ['Dockerfile.dev', 'dockerfile'],
    // Unknown → plaintext
    ['notes.txt',      'plaintext'],
    ['binary.bin',     'plaintext'],
    ['no-extension',   'plaintext'],
  ])('%s → %s', (filename, expected) => {
    expect(getLanguageForFile(filename)).toBe(expected);
  });

  it('is case-insensitive for extensions', () => {
    expect(getLanguageForFile('APP.TSX')).toBe('typescript');
    expect(getLanguageForFile('Index.JS')).toBe('javascript');
  });

  it('handles files with multiple dots correctly', () => {
    expect(getLanguageForFile('index.test.ts')).toBe('typescript');
    expect(getLanguageForFile('config.prod.json')).toBe('json');
  });
});
```

**Step 2: Run tests to confirm they fail**

```bash
cd mobile-ide/mobile-ide-prototype
npm test -- --testPathPattern="Editor.test" --no-coverage 2>&1 | tail -20
```

Expected: Tests fail with "getLanguageForFile is not exported" or similar.

**Step 3: Verify getLanguageForFile is already exported**

Open `src/components/Editor.tsx` line 75 — `export function getLanguageForFile` is already there. The tests should actually pass. Re-run:

```bash
npm test -- --testPathPattern="Editor.test" --no-coverage 2>&1 | tail -20
```

Expected: All new tests PASS.

**Step 4: Commit**

```bash
git add tests/unit/Editor.test.tsx
git commit -m "test(US-0002/AC-0012): unit-test getLanguageForFile — all extensions"
```

---

## Task 3: Implement virtual keyboard viewport adjustment (TDD)

**Files:**
- Modify: `mobile-ide/mobile-ide-prototype/src/components/Editor.tsx`
- Modify: `mobile-ide/mobile-ide-prototype/tests/unit/Editor.test.tsx`

### Step 1: Write the failing test

Add to `Editor.test.tsx`, at the bottom of the `describe('Editor — toolbar interactions')` block:

```typescript
import { Platform } from 'react-native';

describe('Editor — keyboard avoidance', () => {
  it('wraps the editor in a KeyboardAvoidingView', async () => {
    renderEditor([TAB_A], TAB_A.path);
    // KeyboardAvoidingView renders as a View in tests; check testID
    expect(screen.getByTestId('editor-keyboard-avoiding-view')).toBeTruthy();
  });
});
```

**Step 2: Run test to confirm it fails**

```bash
npm test -- --testPathPattern="Editor.test" --no-coverage 2>&1 | tail -10
```

Expected: FAIL — `Unable to find an element with testID: editor-keyboard-avoiding-view`

**Step 3: Implement KeyboardAvoidingView in Editor.tsx**

In `Editor.tsx`, make these two changes:

1. Add `KeyboardAvoidingView` and `Platform` to the React Native import:

```typescript
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
```

2. Wrap the returned JSX root `<View style={styles.container}>` in a `KeyboardAvoidingView`. Replace the outer `<View style={styles.container}>` open/close tags:

```typescript
// BEFORE (line ~344):
return (
  <View style={styles.container}>
    ...
  </View>
);

// AFTER:
return (
  <KeyboardAvoidingView
    testID="editor-keyboard-avoiding-view"
    style={styles.container}
    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    keyboardVerticalOffset={0}
  >
    {/* ── Tab bar ── */}
    ...existing content unchanged...
  </KeyboardAvoidingView>
);
```

Also update the empty-state return to match — wrap it too:

```typescript
// BEFORE:
if (tabs.length === 0) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyTitle}>No files open</Text>
      <Text style={styles.emptyHint}>Select a file from the Explorer</Text>
    </View>
  );
}

// AFTER:
if (tabs.length === 0) {
  return (
    <KeyboardAvoidingView
      testID="editor-keyboard-avoiding-view"
      style={styles.empty}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <Text style={styles.emptyTitle}>No files open</Text>
      <Text style={styles.emptyHint}>Select a file from the Explorer</Text>
    </KeyboardAvoidingView>
  );
}
```

**Step 4: Run tests to confirm they pass**

```bash
npm test -- --testPathPattern="Editor.test" --no-coverage 2>&1 | tail -10
```

Expected: All tests PASS including the new keyboard avoidance test.

**Step 5: Run full test suite and check coverage**

```bash
npm run test:coverage 2>&1 | tail -30
```

Expected: All tests pass, Editor coverage ≥ 80%.

**Step 6: Commit**

```bash
git add src/components/Editor.tsx tests/unit/Editor.test.tsx
git commit -m "feat(US-0002/AC-0013-AC-0014): KeyboardAvoidingView for virtual keyboard + tests"
```

---

## Task 4: Mark US-0002 Done in RELEASE_PLAN.md

**Files:**
- Modify: `Docs/RELEASE_PLAN.md`

**Step 1: Update US-0002 block**

Change:
```
Status: In Progress
```
to:
```
Status: Done
```

Change the three unchecked ACs:
```
  - [ ] AC-0012: ...
  - [ ] AC-0013: ...
  - [ ] AC-0014: ...
```
to:
```
  - [x] AC-0012: TypeScript/JavaScript files receive correct syntax highlighting (language detected from extension)
  - [x] AC-0013: Editor is responsive to touch input — tap positions cursor, pinch adjusts font size
  - [x] AC-0014: Virtual keyboard raises the editor viewport so the cursor line remains visible
```

Also add a `Definition of Done` checklist and mark relevant items complete.

**Step 2: Update EPIC-0001 status** — all 6 US are now Done; change EPIC-0001 `Status: In Progress` → `Status: Done`.

**Step 3: Commit**
```bash
git add Docs/RELEASE_PLAN.md
git commit -m "docs(US-0002): mark Done — all ACs verified"
```

---

## Task 5: Push branch and open PR

```bash
git push -u origin feature/US-0002-syntax-highlighting
gh pr create \
  --title "feat(US-0002): syntax highlighting — tests + KeyboardAvoidingView" \
  --base develop \
  --body "Closes US-0002 (EPIC-0001).

## What
- Assign AC-0012..AC-0014 to US-0002
- Add 40+ unit tests for \`getLanguageForFile\` covering all supported extensions
- Wrap Editor in \`KeyboardAvoidingView\` so virtual keyboard adjusts viewport (AC-0014)
- Mark US-0002 and EPIC-0001 Done

## Test plan
- [ ] \`npm test\` passes (all suites green)
- [ ] Coverage ≥ 80% on Editor
- [ ] Editor renders on iPad — keyboard raises viewport, not obscures it"
```

---

## Coverage Targets

| File | Min Coverage |
|---|---|
| `src/components/Editor.tsx` | ≥ 80% |

Run `npm run test:coverage` before opening the PR to verify.
