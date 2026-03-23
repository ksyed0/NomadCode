# Design: US-0020 — Extensions (Full Install Flow)

**Date:** 2026-03-13
**Epic:** EPIC-0005 Customization
**Story:** US-0020 — As a power user, I want to install extensions, so that I can enhance the IDE with tools I need.
**ACs:** AC-0060–0063

---

## Context

The extension sandbox backend is fully implemented and tested:
- `src/extensions/sandbox/index.ts` — `buildSandboxHtml`, `ExtensionRegistry`, `activateExtension`, `deactivateExtension`, `EXAMPLE_EXTENSION`
- 19 passing unit tests in `tests/unit/ExtensionSandbox.test.ts`

All 4 ACs (AC-0060–0063) are satisfied by existing code. This story adds the user-facing UI and App.tsx wiring.

---

## Architecture

### New: `ExtensionHost.tsx`

A hidden component rendered in `App.tsx` below the visible layout. Responsibilities:
- Maintains a list of active extension WebViews (one per active extension)
- Receives `onMessage` from each WebView and routes via `ExtensionRegistry.dispatch()`
- Receives `onGetEditorContent` / `onReplaceEditorContent` callbacks from `App.tsx`
- Handles incoming messages from the host app side (response injection back into WebView)

```
App.tsx
  └── <ExtensionHost
        manifests={activeManifests}
        onGetEditorContent={getEditorContent}
        onReplaceEditorContent={replaceEditorContent}
        onShowMessage={showMessage}
      />
```

### Extended: `SettingsScreen.tsx`

New EXTENSIONS section (below EDITOR section):

**Installed extensions list** (one card per manifest):
- Name + version label
- Deactivate button (min 44pt touch target)

**Install form:**
- Name text input (single line)
- Source textarea (multiline, monospace font)
- Install button — disabled when name or source is empty
- Inline validation error if name is blank or source is blank on submit

### Extended: `App.tsx`

- Mounts `<ExtensionHost>` (always rendered, zero height, off-screen)
- Provides `getEditorContent` callback: returns `tabs.find(t => t.path === activeTabPath)?.content ?? ''`
- Provides `replaceEditorContent` callback: updates the active tab content in state
- Wires `showMessage` callback: calls `Alert.alert`

---

## Data Flow

```
User submits install form
  → activateExtension(manifest)            // registers in ExtensionRegistry
  → setInstalledExtensions([...prev, m])   // local state + persisted in useSettingsStore
  → ExtensionHost receives updated list
  → mounts new <WebView source={{ html: buildSandboxHtml(manifest) }} />

Extension sends postMessage
  → ExtensionHost.onMessage
  → ExtensionRegistry.dispatch(msg)
  → App resolves message type:
      showMessage          → Alert.alert(text)
      showError            → Alert.alert(text, '', [{style:'destructive'}])
      getEditorContent     → inject response back into WebView
      replaceEditorContent → update active tab content in state
      registerCommand      → add to command palette commands list

User taps Deactivate
  → deactivateExtension(id)
  → remove from installedExtensions state
  → ExtensionHost unmounts corresponding WebView
```

---

## Persistence

Installed extension manifests (id, name, version, source) are stored in `useSettingsStore` via Zustand + AsyncStorage. On app restart, `App.tsx` re-registers all persisted manifests.

Field: `installedExtensions: ExtensionManifest[]` added to settings store state.

---

## Error Handling

| Scenario | Handling |
|---|---|
| Extension JS throws at runtime | Sandbox try/catch fires `type: 'error'` → host `Alert.alert('Extension error', message)` |
| Install form: blank name | Inline validation error, Install button disabled |
| Install form: blank source | Inline validation error, Install button disabled |
| Deactivate non-existent extension | `deactivateExtension` is idempotent — no error |

---

## Testing Plan

| File | New Tests |
|---|---|
| `ExtensionHost.test.tsx` (new) | Renders no-op with empty list; renders one WebView per manifest; calls onShowMessage on showMessage msg; calls onGetEditorContent on getEditorContent msg; calls onReplaceEditorContent on replaceEditorContent msg |
| `SettingsScreen.test.tsx` (extend) | EXTENSIONS section renders; Install button disabled when name empty; Install button disabled when source empty; Install button enabled with both fields; install calls activateExtension; deactivate button calls deactivateExtension |
| `App.test.tsx` (extend) | ExtensionHost mounts; getEditorContent returns active tab content |

---

## Notes

- Extension JS source strings are persisted as-is in AsyncStorage. Adequate for prototype; large sources (>50KB) may be slow to hydrate — deferred concern for v1.1.
- `registerCommand` messages registered from extensions will be surfaced in the command palette in a future story (commands registered but not wired to palette in this story — palette wiring is a follow-on task).
