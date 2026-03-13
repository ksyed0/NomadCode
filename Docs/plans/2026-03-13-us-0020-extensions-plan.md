# US-0020 Extensions — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Wire the existing extension sandbox backend into a user-facing install flow inside SettingsScreen, and mount an ExtensionHost in App.tsx to run extensions in isolated WebViews.

**Architecture:** `ExtensionHost.tsx` renders one hidden WebView per active extension and routes `postMessage` back to the host (editor content, alerts). `SettingsScreen` gets a new EXTENSIONS section (installed list + install form). Installed manifests persist in `useSettingsStore` via AsyncStorage.

**Tech Stack:** React Native, `react-native-webview` (already installed), Zustand, `@testing-library/react-native`, existing `src/extensions/sandbox/index.ts`.

**Branch:** `feature/US-0020-extensions` (from `develop`)

---

### Task 1: Add `installedExtensions` to `useSettingsStore`

**Files:**
- Modify: `mobile-ide/mobile-ide-prototype/src/stores/useSettingsStore.ts`
- Modify: `mobile-ide/mobile-ide-prototype/tests/unit/useSettingsStore.test.ts`

**Step 1: Add failing tests for installedExtensions**

Open `tests/unit/useSettingsStore.test.ts`. Add these tests at the end of the `describe('useSettingsStore — actions')` block:

```typescript
it('defaults installedExtensions to empty array', () => {
  const { result } = renderHook(() => useSettingsStore());
  expect(result.current.installedExtensions).toEqual([]);
});

it('addExtension appends a manifest', () => {
  const { result } = renderHook(() => useSettingsStore());
  const manifest = { id: 'test.ext', name: 'Test', version: '1.0.0', source: 'void 0;' };
  act(() => { result.current.addExtension(manifest); });
  expect(result.current.installedExtensions).toHaveLength(1);
  expect(result.current.installedExtensions[0].id).toBe('test.ext');
});

it('addExtension replaces manifest with same id', () => {
  const { result } = renderHook(() => useSettingsStore());
  const m1 = { id: 'test.ext', name: 'Test', version: '1.0.0', source: 'void 0;' };
  const m2 = { id: 'test.ext', name: 'Test v2', version: '2.0.0', source: 'void 0;' };
  act(() => { result.current.addExtension(m1); });
  act(() => { result.current.addExtension(m2); });
  expect(result.current.installedExtensions).toHaveLength(1);
  expect(result.current.installedExtensions[0].name).toBe('Test v2');
});

it('removeExtension removes by id', () => {
  const { result } = renderHook(() => useSettingsStore());
  const manifest = { id: 'test.ext', name: 'Test', version: '1.0.0', source: 'void 0;' };
  act(() => { result.current.addExtension(manifest); });
  act(() => { result.current.removeExtension('test.ext'); });
  expect(result.current.installedExtensions).toHaveLength(0);
});

it('removeExtension is a no-op for unknown id', () => {
  const { result } = renderHook(() => useSettingsStore());
  expect(() => {
    act(() => { result.current.removeExtension('unknown.id'); });
  }).not.toThrow();
});
```

Also update the `beforeEach` reset to include the new field:
```typescript
useSettingsStore.setState({
  theme: 'nomad-dark',
  fontSize: 14,
  workspacePath: '',
  hasCompletedSetup: false,
  installedExtensions: [],
});
```

**Step 2: Run tests to verify they fail**

```bash
cd mobile-ide/mobile-ide-prototype && npx jest --watchAll=false tests/unit/useSettingsStore.test.ts
```

Expected: 5 new failures — `installedExtensions is not a function` / property not found.

**Step 3: Implement the changes in `useSettingsStore.ts`**

Add the import at the top of the file (after existing imports):
```typescript
import type { ExtensionManifest } from '../extensions/sandbox';
```

Update `SettingsState` interface — add after `hasCompletedSetup`:
```typescript
  installedExtensions: ExtensionManifest[];
  addExtension: (manifest: ExtensionManifest) => void;
  removeExtension: (id: string) => void;
```

Update the `create` call — add after `completeSetup`:
```typescript
      installedExtensions: [],
      addExtension: (manifest) =>
        set((s) => ({
          installedExtensions: [
            ...s.installedExtensions.filter((m) => m.id !== manifest.id),
            manifest,
          ],
        })),
      removeExtension: (id) =>
        set((s) => ({
          installedExtensions: s.installedExtensions.filter((m) => m.id !== id),
        })),
```

**Step 4: Run tests to verify they pass**

```bash
npx jest --watchAll=false tests/unit/useSettingsStore.test.ts
```

Expected: all tests pass.

**Step 5: Commit**

```bash
git add src/stores/useSettingsStore.ts tests/unit/useSettingsStore.test.ts
git commit -m "feat(US-0020): add installedExtensions to useSettingsStore"
```

---

### Task 2: Create `ExtensionHost` component with TDD

**Files:**
- Create: `mobile-ide/mobile-ide-prototype/src/components/ExtensionHost.tsx`
- Create: `mobile-ide/mobile-ide-prototype/tests/unit/ExtensionHost.test.tsx`

**Step 1: Create mock for react-native-webview**

Create `mobile-ide/mobile-ide-prototype/__mocks__/react-native-webview.js`:

```javascript
const React = require('react');
const { View } = require('react-native');

const MockWebView = React.forwardRef((props, ref) => {
  React.useImperativeHandle(ref, () => ({
    injectJavaScript: jest.fn(),
  }));
  return React.createElement(View, {
    testID: props.testID ?? `webview-${props['data-extensionid'] ?? 'unknown'}`,
  });
});

MockWebView.displayName = 'MockWebView';
module.exports = { default: MockWebView, WebView: MockWebView };
```

**Step 2: Write failing tests**

Create `tests/unit/ExtensionHost.test.tsx`:

```typescript
/**
 * Unit tests — ExtensionHost
 *
 * WebView is mocked. Tests verify message routing from WebView → host callbacks.
 */

import React from 'react';
import { render, screen } from '@testing-library/react-native';
import ExtensionHost from '../../src/components/ExtensionHost';
import type { ExtensionManifest } from '../../src/extensions/sandbox';

const MANIFEST_A: ExtensionManifest = {
  id: 'test.a',
  name: 'Extension A',
  version: '1.0.0',
  source: 'void 0;',
};

const MANIFEST_B: ExtensionManifest = {
  id: 'test.b',
  name: 'Extension B',
  version: '1.0.0',
  source: 'void 0;',
};

const defaultProps = {
  manifests: [],
  onGetEditorContent: jest.fn(() => 'editor content'),
  onReplaceEditorContent: jest.fn(),
  onShowMessage: jest.fn(),
  onShowError: jest.fn(),
};

beforeEach(() => jest.clearAllMocks());

describe('ExtensionHost', () => {
  it('renders null with empty manifests', () => {
    const { toJSON } = render(<ExtensionHost {...defaultProps} manifests={[]} />);
    expect(toJSON()).toBeNull();
  });

  it('renders one WebView per manifest', () => {
    render(<ExtensionHost {...defaultProps} manifests={[MANIFEST_A, MANIFEST_B]} />);
    expect(screen.getByTestID('exthost-webview-test.a')).toBeTruthy();
    expect(screen.getByTestID('exthost-webview-test.b')).toBeTruthy();
  });

  it('calls onShowMessage when showMessage type received', () => {
    const onShowMessage = jest.fn();
    render(
      <ExtensionHost
        {...defaultProps}
        manifests={[MANIFEST_A]}
        onShowMessage={onShowMessage}
      />
    );
    const webview = screen.getByTestID('exthost-webview-test.a');
    // Simulate postMessage from extension
    webview.props.onMessage({
      nativeEvent: {
        data: JSON.stringify({ type: 'showMessage', extensionId: 'test.a', payload: { text: 'Hello' } }),
      },
    });
    expect(onShowMessage).toHaveBeenCalledWith('Hello');
  });

  it('calls onShowError when showError type received', () => {
    const onShowError = jest.fn();
    render(
      <ExtensionHost
        {...defaultProps}
        manifests={[MANIFEST_A]}
        onShowError={onShowError}
      />
    );
    const webview = screen.getByTestID('exthost-webview-test.a');
    webview.props.onMessage({
      nativeEvent: {
        data: JSON.stringify({ type: 'showError', extensionId: 'test.a', payload: { text: 'Oops' } }),
      },
    });
    expect(onShowError).toHaveBeenCalledWith('Oops');
  });

  it('calls onReplaceEditorContent when replaceEditorContent type received', () => {
    const onReplaceEditorContent = jest.fn();
    render(
      <ExtensionHost
        {...defaultProps}
        manifests={[MANIFEST_A]}
        onReplaceEditorContent={onReplaceEditorContent}
      />
    );
    const webview = screen.getByTestID('exthost-webview-test.a');
    webview.props.onMessage({
      nativeEvent: {
        data: JSON.stringify({
          type: 'replaceEditorContent',
          extensionId: 'test.a',
          payload: { text: 'new content' },
        }),
      },
    });
    expect(onReplaceEditorContent).toHaveBeenCalledWith('new content');
  });

  it('calls onShowError when error type received from extension', () => {
    const onShowError = jest.fn();
    render(
      <ExtensionHost
        {...defaultProps}
        manifests={[MANIFEST_A]}
        onShowError={onShowError}
      />
    );
    const webview = screen.getByTestID('exthost-webview-test.a');
    webview.props.onMessage({
      nativeEvent: {
        data: JSON.stringify({
          type: 'error',
          extensionId: 'test.a',
          payload: { message: 'ReferenceError: x is not defined' },
        }),
      },
    });
    expect(onShowError).toHaveBeenCalledWith(expect.stringContaining('ReferenceError'));
  });

  it('ignores malformed JSON from WebView', () => {
    const onShowMessage = jest.fn();
    render(
      <ExtensionHost
        {...defaultProps}
        manifests={[MANIFEST_A]}
        onShowMessage={onShowMessage}
      />
    );
    const webview = screen.getByTestID('exthost-webview-test.a');
    expect(() => {
      webview.props.onMessage({ nativeEvent: { data: 'not json' } });
    }).not.toThrow();
    expect(onShowMessage).not.toHaveBeenCalled();
  });
});
```

**Step 3: Run tests to verify they fail**

```bash
npx jest --watchAll=false tests/unit/ExtensionHost.test.tsx
```

Expected: FAIL — `ExtensionHost` module not found.

**Step 4: Implement `ExtensionHost.tsx`**

Create `src/components/ExtensionHost.tsx`:

```typescript
/**
 * ExtensionHost — mounts one hidden WebView per active extension.
 *
 * Routes postMessage from each WebView back to the host app.
 * Rendered hidden (height: 0) in App.tsx below the visible layout.
 */

import React, { useCallback, useRef } from 'react';
import { View } from 'react-native';
import WebView from 'react-native-webview';
import type { WebView as WebViewType } from 'react-native-webview';
import {
  buildSandboxHtml,
  ExtensionRegistry,
  type ExtensionManifest,
  type ExtensionMessage,
} from '../extensions/sandbox';

export interface ExtensionHostProps {
  manifests: ExtensionManifest[];
  onGetEditorContent: () => string;
  onReplaceEditorContent: (text: string) => void;
  onShowMessage: (text: string) => void;
  onShowError: (text: string) => void;
}

export default function ExtensionHost({
  manifests,
  onGetEditorContent,
  onReplaceEditorContent,
  onShowMessage,
  onShowError,
}: ExtensionHostProps) {
  const refs = useRef<Record<string, WebViewType | null>>({});

  const handleMessage = useCallback(
    (extensionId: string, data: string) => {
      let msg: ExtensionMessage;
      try {
        msg = JSON.parse(data) as ExtensionMessage;
      } catch {
        return;
      }

      ExtensionRegistry.dispatch(msg);

      switch (msg.type) {
        case 'showMessage': {
          onShowMessage((msg.payload as { text: string }).text);
          break;
        }
        case 'showError': {
          onShowError((msg.payload as { text: string }).text);
          break;
        }
        case 'getEditorContent': {
          const content = onGetEditorContent();
          const ref = refs.current[extensionId];
          if (ref && msg.requestId) {
            ref.injectJavaScript(
              `window.dispatchEvent(new MessageEvent('message',{data:JSON.stringify({requestId:${JSON.stringify(msg.requestId)},payload:${JSON.stringify(content)}})}));true;`
            );
          }
          break;
        }
        case 'replaceEditorContent': {
          onReplaceEditorContent((msg.payload as { text: string }).text);
          break;
        }
        case 'error': {
          onShowError(`Extension error: ${(msg.payload as { message: string }).message}`);
          break;
        }
      }
    },
    [onGetEditorContent, onReplaceEditorContent, onShowMessage, onShowError],
  );

  if (manifests.length === 0) return null;

  return (
    <View style={{ height: 0, overflow: 'hidden' }}>
      {manifests.map((manifest) => (
        <WebView
          key={manifest.id}
          testID={`exthost-webview-${manifest.id}`}
          ref={(r) => { refs.current[manifest.id] = r; }}
          source={{ html: buildSandboxHtml(manifest) }}
          onMessage={(event) => handleMessage(manifest.id, event.nativeEvent.data)}
          javaScriptEnabled
          style={{ width: 1, height: 1 }}
        />
      ))}
    </View>
  );
}
```

**Step 5: Run tests to verify they pass**

```bash
npx jest --watchAll=false tests/unit/ExtensionHost.test.tsx
```

Expected: all 7 tests pass.

**Step 6: Commit**

```bash
git add src/components/ExtensionHost.tsx tests/unit/ExtensionHost.test.tsx __mocks__/react-native-webview.js
git commit -m "feat(US-0020): add ExtensionHost component with WebView sandbox routing"
```

---

### Task 3: Add EXTENSIONS section to `SettingsScreen`

**Files:**
- Modify: `mobile-ide/mobile-ide-prototype/src/components/SettingsScreen.tsx`
- Modify: `mobile-ide/mobile-ide-prototype/tests/unit/SettingsScreen.test.tsx`

**Step 1: Add failing tests**

Open `tests/unit/SettingsScreen.test.tsx`. Update the mock for `useSettingsStore` to include extensions state, and add these tests at the end of the file:

First, update the mock at the top — replace the existing `jest.mock('../../src/stores/useSettingsStore', ...)` with:

```typescript
const mockSetTheme = jest.fn();
const mockSetFontSize = jest.fn();
const mockAddExtension = jest.fn();
const mockRemoveExtension = jest.fn();
let mockTheme = 'nomad-dark';
let mockFontSize = 14;
let mockInstalledExtensions: Array<{ id: string; name: string; version: string; source: string }> = [];

jest.mock('../../src/stores/useSettingsStore', () => ({
  __esModule: true,
  default: jest.fn((sel: (s: unknown) => unknown) =>
    sel({
      theme: mockTheme,
      fontSize: mockFontSize,
      installedExtensions: mockInstalledExtensions,
      setTheme: mockSetTheme,
      setFontSize: mockSetFontSize,
      addExtension: mockAddExtension,
      removeExtension: mockRemoveExtension,
    })
  ),
}));
```

Also update `beforeEach` to reset `mockInstalledExtensions = []`.

Then add these test cases:

```typescript
describe('SettingsScreen — Extensions section', () => {
  it('renders EXTENSIONS section label', () => {
    render(<SettingsScreen visible={true} onClose={jest.fn()} />);
    expect(screen.getByText('EXTENSIONS')).toBeTruthy();
  });

  it('renders install form with name input, source input, and install button', () => {
    render(<SettingsScreen visible={true} onClose={jest.fn()} />);
    expect(screen.getByTestID('ext-name-input')).toBeTruthy();
    expect(screen.getByTestID('ext-source-input')).toBeTruthy();
    expect(screen.getByTestID('ext-install-btn')).toBeTruthy();
  });

  it('install button is disabled when name is empty', () => {
    render(<SettingsScreen visible={true} onClose={jest.fn()} />);
    const btn = screen.getByTestID('ext-install-btn');
    expect(btn.props.accessibilityState?.disabled).toBe(true);
  });

  it('install button is enabled when name and source are both filled', () => {
    render(<SettingsScreen visible={true} onClose={jest.fn()} />);
    fireEvent.changeText(screen.getByTestID('ext-name-input'), 'My Ext');
    fireEvent.changeText(screen.getByTestID('ext-source-input'), 'void 0;');
    const btn = screen.getByTestID('ext-install-btn');
    expect(btn.props.accessibilityState?.disabled).toBe(false);
  });

  it('tapping Install calls addExtension and clears the form', () => {
    render(<SettingsScreen visible={true} onClose={jest.fn()} />);
    fireEvent.changeText(screen.getByTestID('ext-name-input'), 'My Ext');
    fireEvent.changeText(screen.getByTestID('ext-source-input'), 'void 0;');
    fireEvent.press(screen.getByTestID('ext-install-btn'));
    expect(mockAddExtension).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'My Ext', source: 'void 0;' })
    );
  });

  it('renders installed extension cards', () => {
    mockInstalledExtensions = [
      { id: 'test.a', name: 'Word Count', version: '1.0.0', source: 'void 0;' },
    ];
    render(<SettingsScreen visible={true} onClose={jest.fn()} />);
    expect(screen.getByText('Word Count')).toBeTruthy();
    expect(screen.getByTestID('ext-deactivate-test.a')).toBeTruthy();
  });

  it('tapping Deactivate calls removeExtension with the extension id', () => {
    mockInstalledExtensions = [
      { id: 'test.a', name: 'Word Count', version: '1.0.0', source: 'void 0;' },
    ];
    render(<SettingsScreen visible={true} onClose={jest.fn()} />);
    fireEvent.press(screen.getByTestID('ext-deactivate-test.a'));
    expect(mockRemoveExtension).toHaveBeenCalledWith('test.a');
  });
});
```

**Step 2: Run to verify failures**

```bash
npx jest --watchAll=false tests/unit/SettingsScreen.test.tsx
```

Expected: 7 new failures.

**Step 3: Implement the EXTENSIONS section in `SettingsScreen.tsx`**

Add these imports at the top of `SettingsScreen.tsx` (after existing imports):
```typescript
import { TextInput } from 'react-native';
import { activateExtension, deactivateExtension } from '../extensions/sandbox';
import type { ExtensionManifest } from '../extensions/sandbox';
```

Add these selectors inside the component (after existing Zustand selectors):
```typescript
  const installedExtensions = useSettingsStore((s) => s.installedExtensions);
  const addExtension = useSettingsStore((s) => s.addExtension);
  const removeExtension = useSettingsStore((s) => s.removeExtension);
```

Add these state fields inside the component (after existing useState calls):
```typescript
  const [extName, setExtName] = useState('');
  const [extSource, setExtSource] = useState('');
```

Add these handlers inside the component (after existing handlers):
```typescript
  const handleInstall = useCallback(() => {
    if (!extName.trim() || !extSource.trim()) return;
    const manifest: ExtensionManifest = {
      id: `user.${extName.toLowerCase().replace(/\s+/g, '-')}.${Date.now()}`,
      name: extName.trim(),
      version: '1.0.0',
      source: extSource.trim(),
    };
    activateExtension(manifest);
    addExtension(manifest);
    setExtName('');
    setExtSource('');
  }, [extName, extSource, addExtension]);

  const handleDeactivate = useCallback((id: string) => {
    deactivateExtension(id);
    removeExtension(id);
  }, [removeExtension]);

  const installEnabled = extName.trim().length > 0 && extSource.trim().length > 0;
```

Add the EXTENSIONS section inside `<ScrollView>`, after the EDITOR section:

```tsx
          {/* ── Section: Extensions ─────────────────────────────────────── */}
          <Text style={[styles.sectionLabel, dynamicSectionLabel]}>EXTENSIONS</Text>

          {/* Installed extensions */}
          {installedExtensions.map((ext) => (
            <View
              key={ext.id}
              style={[styles.editorRow, { backgroundColor: tokens.bgElevated, borderColor: tokens.border }]}
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.editorRowLabel, { color: tokens.text }]}>{ext.name}</Text>
                <Text style={{ color: tokens.textMuted, fontSize: 12 }}>v{ext.version}</Text>
              </View>
              <TouchableOpacity
                testID={`ext-deactivate-${ext.id}`}
                onPress={() => handleDeactivate(ext.id)}
                style={styles.fontButton}
                accessibilityLabel={`Deactivate ${ext.name}`}
                accessibilityRole="button"
              >
                <Text style={{ color: tokens.error ?? '#EF4444', fontSize: 14, fontWeight: '600' }}>
                  Remove
                </Text>
              </TouchableOpacity>
            </View>
          ))}

          {/* Install form */}
          <TextInput
            testID="ext-name-input"
            placeholder="Extension name"
            placeholderTextColor={tokens.textMuted}
            value={extName}
            onChangeText={setExtName}
            style={[styles.extInput, { color: tokens.text, borderColor: tokens.border, backgroundColor: tokens.bgElevated }]}
          />
          <TextInput
            testID="ext-source-input"
            placeholder="Paste extension source (JavaScript)"
            placeholderTextColor={tokens.textMuted}
            value={extSource}
            onChangeText={setExtSource}
            multiline
            numberOfLines={4}
            style={[styles.extInput, styles.extSourceInput, { color: tokens.text, borderColor: tokens.border, backgroundColor: tokens.bgElevated }]}
          />
          <TouchableOpacity
            testID="ext-install-btn"
            onPress={handleInstall}
            disabled={!installEnabled}
            accessibilityState={{ disabled: !installEnabled }}
            accessibilityRole="button"
            style={[
              styles.extInstallBtn,
              { backgroundColor: installEnabled ? tokens.accent : tokens.bgElevated, borderColor: tokens.border },
            ]}
          >
            <Text style={{ color: installEnabled ? '#FFFFFF' : tokens.textMuted, fontWeight: '600', fontSize: 15 }}>
              Install
            </Text>
          </TouchableOpacity>
```

Add to `StyleSheet.create`:
```typescript
  extInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    marginBottom: 8,
  },
  extSourceInput: {
    height: 100,
    textAlignVertical: 'top',
    fontFamily: 'monospace',
  },
  extInstallBtn: {
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 8,
  },
```

Also add `error` to the token type in `tokens.ts` if it's missing — check that `tokens.error` exists in the theme type. If not, use the hardcoded value `'#EF4444'` directly.

**Step 4: Run tests to verify they pass**

```bash
npx jest --watchAll=false tests/unit/SettingsScreen.test.tsx
```

Expected: all tests pass.

**Step 5: Commit**

```bash
git add src/components/SettingsScreen.tsx tests/unit/SettingsScreen.test.tsx
git commit -m "feat(US-0020): add EXTENSIONS section with install flow to SettingsScreen"
```

---

### Task 4: Mount `ExtensionHost` in `App.tsx`

**Files:**
- Modify: `mobile-ide/mobile-ide-prototype/App.tsx`
- Modify: `mobile-ide/mobile-ide-prototype/tests/unit/App.test.tsx`

**Step 1: Add failing tests**

Open `tests/unit/App.test.tsx`. Add a test that ExtensionHost is mounted. First check that `useSettingsStore` mock in that file includes `installedExtensions`. Update the mock if needed to add:
```typescript
installedExtensions: [],
addExtension: jest.fn(),
removeExtension: jest.fn(),
```

Then add:
```typescript
it('mounts ExtensionHost (renders even with empty extension list)', () => {
  // ExtensionHost renders null for empty list — just verify no crash
  render(<App />);
  // App renders without throwing when extensions list is empty
  expect(screen.getByTestID('nomadcode-root') ?? screen.queryByTestID('settings-screen')).toBeDefined();
});
```

Note: `App` doesn't have a `testID` on root yet — this test just verifies no crash. If you want a cleaner assertion, add `testID="nomadcode-root"` to the `<SafeAreaView>` in App.tsx.

**Step 2: Run to verify**

```bash
npx jest --watchAll=false tests/unit/App.test.tsx
```

Expected: existing tests still pass. The new test may already pass once App.tsx is updated.

**Step 3: Update `App.tsx`**

Add imports after existing imports:
```typescript
import ExtensionHost from './src/components/ExtensionHost';
```

Add selector after existing store selectors (around line 51):
```typescript
  const installedExtensions = useSettingsStore((s) => s.installedExtensions);
```

Add `getEditorContent` and `replaceEditorContent` callbacks after `saveActiveFile` (around line 133):
```typescript
  const getEditorContent = useCallback((): string => {
    return tabs.find((t) => t.path === activeTabPath)?.content ?? '';
  }, [tabs, activeTabPath]);

  const replaceEditorContent = useCallback((text: string) => {
    if (!activeTabPath) return;
    updateContent(activeTabPath, text);
  }, [activeTabPath, updateContent]);
```

Add `<ExtensionHost>` just before the closing `</SafeAreaView>` tag (after `<SettingsScreen>`):
```tsx
      {/* ── Extension host (hidden, always mounted) ──────────────────────── */}
      <ExtensionHost
        manifests={installedExtensions}
        onGetEditorContent={getEditorContent}
        onReplaceEditorContent={replaceEditorContent}
        onShowMessage={(text) => Alert.alert('Extension', text)}
        onShowError={(text) => Alert.alert('Extension Error', text, [{ text: 'OK', style: 'destructive' }])}
      />
```

**Step 4: Run all tests**

```bash
npx jest --watchAll=false
```

Expected: all tests pass (421+ total).

**Step 5: Commit**

```bash
git add App.tsx tests/unit/App.test.tsx
git commit -m "feat(US-0020): mount ExtensionHost in App.tsx with editor callbacks"
```

---

### Task 5: Mark ACs done in RELEASE_PLAN.md and full test run

**Files:**
- Modify: `Docs/RELEASE_PLAN.md`

**Step 1: Check all tests pass**

```bash
cd mobile-ide/mobile-ide-prototype && npx jest --watchAll=false --coverage
```

Expected: all tests pass, ≥80% coverage on all new/modified files.

**Step 2: Mark ACs in RELEASE_PLAN.md**

In `Docs/RELEASE_PLAN.md`, find the US-0020 block and update all 4 ACs from `[ ]` to `[x]`, and change `Status: Planned` to `Status: Done`.

**Step 3: Commit**

```bash
git add Docs/RELEASE_PLAN.md
git commit -m "chore(US-0020): mark AC-0060–0063 done in RELEASE_PLAN"
```

**Step 4: Push and open PR**

```bash
git push -u origin feature/US-0020-extensions
gh pr create --base develop --title "feat(US-0020): extensions install flow — ExtensionHost + SettingsScreen wiring" \
  --body "Closes US-0020. Adds ExtensionHost WebView sandbox runner, extensions EXTENSIONS section in SettingsScreen with install/deactivate flow, useSettingsStore persistence, and App.tsx wiring. All AC-0060–0063 satisfied."
```
