# NomadCode — Manual Feature & Test Plan

**Product:** NomadCode Mobile IDE
**Version:** 0.1
**Platform:** iOS Simulator (iPad Pro 13-inch M5) · Android APK (sideloaded)
**Last Updated:** 2026-03-26

---

## How to Use This Document

Each test case follows this format:

| Field | Meaning |
|-------|---------|
| **ID** | Unique test ID (e.g. `MT-001`) |
| **Feature** | Component or area under test |
| **Precondition** | State required before starting |
| **Steps** | Numbered actions to perform |
| **Expected** | What should happen |
| **Pass / Fail** | Tester marks outcome |
| **Notes** | Known limits, workarounds, open bugs |

**Rating key:** ✅ Pass · ❌ Fail · ⚠️ Partial · 🚫 Blocked · — Not tested

---

## 1. First-Run Setup Wizard

### MT-001 — Wizard appears on first launch

| | |
|---|---|
| **Precondition** | Fresh install or cleared AsyncStorage |
| **Steps** | 1. Launch the app |
| **Expected** | Setup Wizard modal appears over a dark backdrop. Progress shows "1 / 3". |
| **Pass / Fail** | — |

---

### MT-002 — Step 1: Theme selection

| | |
|---|---|
| **Precondition** | Wizard open at Step 1 |
| **Steps** | 1. Tap the **Light** toggle — verify background switches to light colours. 2. Tap the **Dark** toggle — verify background switches to dark. 3. Tap each colour swatch — verify the active swatch shows a selection ring. 4. Tap **Next**. |
| **Expected** | Toggle and swatches respond immediately. Progress advances to "2 / 3". |
| **Pass / Fail** | — |

---

### MT-003 — Step 2: Font size

| | |
|---|---|
| **Precondition** | Wizard at Step 2 |
| **Steps** | 1. Tap **A+** repeatedly until size = 32 — verify A+ becomes disabled. 2. Tap **A−** repeatedly until size = 8 — verify A− becomes disabled. 3. Tap **Reset** — verify size returns to default (14). 4. Tap **Next**. |
| **Expected** | Preview text changes size live. Buttons clamp at bounds (8 / 32). Reset restores default. |
| **Pass / Fail** | — |

---

### MT-004 — Step 3: Workspace path + completion

| | |
|---|---|
| **Precondition** | Wizard at Step 3 |
| **Steps** | 1. Tap **Skip** — verify wizard closes and main IDE opens. **OR** 1. Clear the path field and tap **Get Started** — verify default workspace is used. 2. Type a custom path and tap **Get Started** — verify wizard closes. |
| **Expected** | IDE launches. Wizard does not reappear on subsequent launches. |
| **Pass / Fail** | — |
| **Notes** | Path existence is not validated at this step. |

---

### MT-005 — Back navigation in wizard

| | |
|---|---|
| **Precondition** | Wizard open at Step 2 or 3 |
| **Steps** | 1. Tap **Back** from Step 2 — verify Step 1 appears, progress shows "1 / 3". 2. Tap **Back** from Step 3 — verify Step 2 appears. |
| **Expected** | Navigation moves backwards; previously chosen values are preserved. |
| **Pass / Fail** | — |

---

## 2. Layout & Responsiveness

### MT-006 — Tablet three-pane layout (iPad ≥ 768 pt wide)

| | |
|---|---|
| **Precondition** | App running on iPad Pro simulator (landscape) |
| **Steps** | 1. Observe the default layout. |
| **Expected** | Three panels visible side-by-side: File Explorer (left, ~260 pt) · Editor (centre, flex) · Terminal strip (bottom). |
| **Pass / Fail** | — |

---

### MT-007 — Terminal resize handle

| | |
|---|---|
| **Precondition** | Tablet layout, terminal visible |
| **Steps** | 1. Drag the thin resize handle (hairline above terminal) **upward** — verify terminal grows. 2. Drag it **downward** — verify terminal shrinks. 3. Drag to extreme top — verify terminal clamps at 400 pt. 4. Drag to extreme bottom — verify terminal clamps at 120 pt. |
| **Expected** | Terminal height adjusts smoothly within 120–400 pt. Does not snap or jump. |
| **Pass / Fail** | — |

---

### MT-008 — Swipe down to open command palette

| | |
|---|---|
| **Precondition** | Tablet layout, command palette closed |
| **Steps** | 1. Place finger at the very top edge of the editor pane. 2. Swipe **downward** with moderate speed. |
| **Expected** | Command Palette opens. A slow/short swipe should NOT trigger it (requires dy > 40 pt and vy > 0.3). |
| **Pass / Fail** | — |

---

### MT-009 — Settings panel opens

| | |
|---|---|
| **Precondition** | App on main screen |
| **Steps** | 1. Tap the ⚙ (gear) button (bottom-right area of layout). |
| **Expected** | Settings screen slides/appears. |
| **Pass / Fail** | — |

---

## 3. File Explorer

### MT-010 — Initial file tree load

| | |
|---|---|
| **Precondition** | App launched, workspace has at least one file or folder |
| **Steps** | 1. Observe the left sidebar. |
| **Expected** | Spinner appears briefly, then file tree renders. Directories appear before files. Both sorted alphabetically within their groups. |
| **Pass / Fail** | — |

---

### MT-011 — Expand and collapse directories

| | |
|---|---|
| **Precondition** | File tree has at least one directory |
| **Steps** | 1. Tap a directory row with a **▸** arrow — verify it expands (▾) and shows children. 2. Tap the same row again — verify it collapses (▸). |
| **Expected** | Expand/collapse toggles without full tree reload. Children indented correctly. Empty directories show "(empty)". |
| **Pass / Fail** | — |

---

### MT-012 — Open file in editor

| | |
|---|---|
| **Precondition** | File tree visible with at least one file |
| **Steps** | 1. Tap any file in the tree. |
| **Expected** | File opens in a new tab in the editor. Tab shows the filename. Editor displays file content with appropriate syntax highlighting. |
| **Pass / Fail** | — |

---

### MT-013 — Create new file (+ button)

| | |
|---|---|
| **Precondition** | File explorer sidebar visible |
| **Steps** | 1. Tap the **+** button in the explorer header. 2. Type a filename (e.g. `hello.ts`). 3. Tap **Confirm**. |
| **Expected** | File appears in the tree. A new empty tab opens in the editor. |
| **Pass / Fail** | — |

---

### MT-014 — Create new file (empty name blocked)

| | |
|---|---|
| **Precondition** | New file modal open |
| **Steps** | 1. Leave the name field blank. 2. Observe the Confirm button. |
| **Expected** | **Confirm** button is visually disabled and cannot be tapped. |
| **Pass / Fail** | — |

---

### MT-015 — Create new folder

| | |
|---|---|
| **Precondition** | File explorer visible |
| **Steps** | 1. Tap the **⊞** (folder) button in the header. 2. Enter a folder name (e.g. `src`). 3. Tap **Confirm**. |
| **Expected** | New directory appears in the tree with a ▸ expansion arrow. |
| **Pass / Fail** | — |

---

### MT-016 — Long-press context menu

| | |
|---|---|
| **Precondition** | At least one file exists |
| **Steps** | 1. Long-press any file or directory row. |
| **Expected** | Context menu appears with options: **New File**, **New Folder**, **Rename**, **Move to…**, **Delete**. |
| **Pass / Fail** | — |

---

### MT-017 — Rename via context menu

| | |
|---|---|
| **Precondition** | Context menu open on a file |
| **Steps** | 1. Tap **Rename**. 2. Clear the field and enter a new name. 3. Tap **Confirm**. |
| **Expected** | File is renamed in the tree. If the file was open in a tab, the tab title updates. |
| **Pass / Fail** | — |

---

### MT-018 — Delete via context menu

| | |
|---|---|
| **Precondition** | Context menu open on a file |
| **Steps** | 1. Tap **Delete**. 2. Observe the confirmation alert. 3. Tap **Delete** in the alert. |
| **Expected** | File is removed from the tree. If it was open in a tab, the tab closes. |
| **Pass / Fail** | — |

---

### MT-019 — Delete — cancel

| | |
|---|---|
| **Precondition** | Delete confirmation alert shown |
| **Steps** | 1. Tap **Cancel** in the alert. |
| **Expected** | File is NOT deleted. Tree unchanged. |
| **Pass / Fail** | — |

---

### MT-020 — Move file to another folder

| | |
|---|---|
| **Precondition** | At least one file and one directory exist |
| **Steps** | 1. Long-press a file → **Move to…**. 2. In the picker, tap a target directory. 3. Confirm. |
| **Expected** | File disappears from its original location and appears inside the target directory. |
| **Pass / Fail** | — |

---

### MT-021 — Move — cannot move into self or descendant

| | |
|---|---|
| **Precondition** | Move picker open on a directory |
| **Steps** | 1. Observe the source directory in the picker list. |
| **Expected** | Source directory (and any of its descendants) is visually disabled (greyed out / reduced opacity) and cannot be selected. |
| **Pass / Fail** | — |

---

## 4. Editor

### MT-022 — Empty state

| | |
|---|---|
| **Precondition** | No files are open |
| **Steps** | 1. Close all open tabs (if any). |
| **Expected** | Editor area shows "No files open" with a hint message. No tab bar visible. |
| **Pass / Fail** | — |

---

### MT-023 — Tab bar: open multiple files

| | |
|---|---|
| **Precondition** | At least three files exist |
| **Steps** | 1. Open File A — verify one tab appears. 2. Open File B — verify two tabs. 3. Open File C — verify three tabs. 4. Tap File A tab — verify editor switches to File A's content. |
| **Expected** | Active tab highlighted. Tab bar scrolls horizontally when tabs overflow. |
| **Pass / Fail** | — |

---

### MT-024 — Tab dirty indicator

| | |
|---|---|
| **Precondition** | A file is open in a tab |
| **Steps** | 1. Type any character in the editor. |
| **Expected** | Tab title shows a **●** dot before the filename. |
| **Pass / Fail** | — |

---

### MT-025 — Save file (removes dirty indicator)

| | |
|---|---|
| **Precondition** | File has unsaved changes (dirty tab) |
| **Steps** | 1. Trigger save — via toolbar or command palette "File: Save". |
| **Expected** | **●** dot disappears from the tab. File content persists (reopen to verify). |
| **Pass / Fail** | — |

---

### MT-026 — Close tab

| | |
|---|---|
| **Precondition** | Multiple tabs open |
| **Steps** | 1. Tap the **✕** on any non-active tab. 2. Repeat for the active tab. |
| **Expected** | Tab closes. If the active tab was closed, focus moves to the nearest remaining tab (or empty state if last). |
| **Pass / Fail** | — |

---

### MT-027 — Syntax highlighting per language

| | |
|---|---|
| **Precondition** | App running |
| **Steps** | 1. Open a `.ts` file — verify TypeScript highlighting. 2. Open a `.json` file — verify JSON highlighting. 3. Open a `.md` file — verify Markdown highlighting. |
| **Expected** | Each file type renders with distinct token colours. |
| **Pass / Fail** | — |

---

### MT-028 — Path breadcrumb

| | |
|---|---|
| **Precondition** | A file nested in a subdirectory is open |
| **Steps** | 1. Observe below the tab bar. |
| **Expected** | Full file path displayed (e.g. `/src/utils/helper.ts`). |
| **Pass / Fail** | — |

---

### MT-029 — Font size: A+ / A− toolbar buttons

| | |
|---|---|
| **Precondition** | Editor open with a file |
| **Steps** | 1. Tap **A+** in the editor toolbar — verify text grows. 2. Tap **A−** — verify text shrinks. 3. Keep tapping A+ past 32 — verify it stops increasing. 4. Keep tapping A− past 8 — verify it stops decreasing. |
| **Expected** | Font size changes immediately. Bounds clamped at 8 and 32. |
| **Pass / Fail** | — |

---

### MT-030 — Pinch to zoom

| | |
|---|---|
| **Precondition** | Editor open, physical device or simulator with multi-touch support |
| **Steps** | 1. Pinch outward (spread) on editor — verify font grows. 2. Pinch inward on editor — verify font shrinks. |
| **Expected** | Font size adjusts smoothly. Clamps at 8/32. |
| **Pass / Fail** | — |

---

### MT-031 — Undo / Redo

| | |
|---|---|
| **Precondition** | Editor open, some text typed |
| **Steps** | 1. Type "Hello World" in the editor. 2. Tap **Undo** in toolbar — verify last typed text is removed. 3. Tap **Redo** — verify text is restored. |
| **Expected** | Undo/Redo operate on Monaco's internal history. |
| **Pass / Fail** | — |

---

### MT-032 — Find & Replace toolbar

| | |
|---|---|
| **Precondition** | File with repeated text open |
| **Steps** | 1. Tap **Find** in the mobile toolbar — verify Monaco's find widget opens. 2. Type a search term — verify matches highlighted. |
| **Expected** | Monaco find bar appears inline in the editor. |
| **Pass / Fail** | — |

---

### MT-033 — Comment/Uncomment

| | |
|---|---|
| **Precondition** | A `.ts` or `.js` file open, cursor on a code line |
| **Steps** | 1. Tap **Comment** in toolbar — verify `//` prepended. 2. Tap again — verify `//` removed. |
| **Expected** | Line comment toggled correctly. |
| **Pass / Fail** | — |

---

### MT-034 — Indent / Dedent

| | |
|---|---|
| **Precondition** | File open, cursor on a line |
| **Steps** | 1. Tap **→ Indent** — verify line indented by one level. 2. Tap **← Dedent** — verify indentation removed. |
| **Expected** | Indentation changes by one tab stop. |
| **Pass / Fail** | — |

---

### MT-035 — Markdown preview

| | |
|---|---|
| **Precondition** | A `.md` file is open |
| **Steps** | 1. Tap the **Preview** toggle in the toolbar. |
| **Expected** | Split view appears: raw Markdown on left, rendered HTML on right. Headings, bold, italics, code blocks render correctly. |
| **Pass / Fail** | — |
| **Notes** | Requires network access for CDN rendering (marked.js). Offline rendering not yet available. |

---

### MT-036 — JSON preview

| | |
|---|---|
| **Precondition** | A `.json` file is open |
| **Steps** | 1. Tap **Preview** toggle. |
| **Expected** | Interactive JSON tree view renders showing keys/values in an expandable structure. |
| **Pass / Fail** | — |

---

### MT-037 — Multi-cursor mode

| | |
|---|---|
| **Precondition** | Editor open with content |
| **Steps** | 1. Tap the multi-cursor icon in the toolbar — verify overlay activates. 2. Tap two different locations in the editor — verify cursors appear at both. 3. Tap **✕** badge to exit multi-cursor mode. |
| **Expected** | Multiple cursors active. Typing inserts at all cursor positions simultaneously. Exit clears extra cursors. |
| **Pass / Fail** | — |

---

## 5. Terminal

### MT-038 — Terminal toggle (FAB)

| | |
|---|---|
| **Precondition** | Main IDE screen |
| **Steps** | 1. Tap the terminal FAB button (bottom-right area). |
| **Expected** | Terminal panel shows/hides with each tap. |
| **Pass / Fail** | — |

---

### MT-039 — Terminal loads without error

| | |
|---|---|
| **Precondition** | Terminal toggled visible |
| **Steps** | 1. Observe the terminal panel. |
| **Expected** | xterm.js shell prompt appears within a few seconds. No "Terminal failed to load" error overlay. |
| **Pass / Fail** | — |

---

### MT-040 — Terminal restart on error

| | |
|---|---|
| **Precondition** | Terminal in error state (force by disabling network and reloading if needed) |
| **Steps** | 1. Tap the **Restart** button in the error overlay. |
| **Expected** | Terminal WebView reloads. Shell prompt appears. Previous session output cleared. |
| **Pass / Fail** | — |

---

### MT-041 — Terminal working directory sync

| | |
|---|---|
| **Precondition** | Terminal visible, a file in a subdirectory was opened |
| **Steps** | 1. Open a file in `/src/components/`. 2. Open the terminal. 3. Run `pwd`. |
| **Expected** | Terminal CWD matches the workspace root (or the directory of the open file, depending on implementation). |
| **Pass / Fail** | — |

---

### MT-042 — Terminal resize updates columns

| | |
|---|---|
| **Precondition** | Terminal visible |
| **Steps** | 1. Drag the resize handle to make terminal taller. 2. Observe terminal output. |
| **Expected** | Terminal content reflows to fill the new dimensions without truncation. |
| **Pass / Fail** | — |

---

## 6. Command Palette

### MT-043 — Open command palette (FAB)

| | |
|---|---|
| **Precondition** | Main screen visible |
| **Steps** | 1. Tap the command palette FAB (⌘ icon). |
| **Expected** | Command palette modal fades in, search input is auto-focused, full command list shown. |
| **Pass / Fail** | — |

---

### MT-044 — Filter commands by typing

| | |
|---|---|
| **Precondition** | Command palette open |
| **Steps** | 1. Type "file" — verify list filters to file-related commands. 2. Type "xyzzy" — verify "No commands found" appears. 3. Clear the field — verify all commands return. |
| **Expected** | Filter is case-insensitive, searches both label and description. |
| **Pass / Fail** | — |

---

### MT-045 — Keyboard navigation

| | |
|---|---|
| **Precondition** | Command palette open with a hardware keyboard (Bluetooth or simulator) |
| **Steps** | 1. Press **↓** — verify second item highlighted. 2. Press **↓** multiple times past end — verify selection stays on last item. 3. Press **↑** — verify selection moves up. 4. Press **Return** — verify highlighted command executes and palette closes. |
| **Expected** | Navigation wraps/clamps correctly. Return fires the command. |
| **Pass / Fail** | — |

---

### MT-046 — Dismiss via backdrop tap

| | |
|---|---|
| **Precondition** | Command palette open |
| **Steps** | 1. Tap the semi-transparent backdrop area outside the palette panel. |
| **Expected** | Palette closes. No command executed. |
| **Pass / Fail** | — |

---

### MT-047 — Execute "File: New File" from palette

| | |
|---|---|
| **Precondition** | Command palette open |
| **Steps** | 1. Type "new file". 2. Tap the result or press Return. |
| **Expected** | Palette closes, new file modal opens in File Explorer. |
| **Pass / Fail** | — |

---

### MT-048 — Execute "Terminal: Toggle" from palette

| | |
|---|---|
| **Precondition** | Command palette open, terminal hidden |
| **Steps** | 1. Search and execute **Terminal: Toggle**. |
| **Expected** | Terminal becomes visible. |
| **Pass / Fail** | — |

---

## 7. Settings Screen

### MT-049 — GitHub sign in with PAT

| | |
|---|---|
| **Precondition** | Settings screen open, not signed in to GitHub |
| **Steps** | 1. Toggle **Use Personal Access Token**. 2. Enter a valid GitHub PAT with `repo` scope. 3. Tap **Connect**. |
| **Expected** | Loading indicator shown. On success: username and "Connected" status appear. PAT input hidden. |
| **Pass / Fail** | — |

---

### MT-050 — GitHub sign in with invalid token

| | |
|---|---|
| **Precondition** | Settings, PAT mode active |
| **Steps** | 1. Enter an invalid token (e.g. `bad_token_123`). 2. Tap **Connect**. |
| **Expected** | Error message appears below the button: "Invalid token or insufficient permissions". User can retry. |
| **Pass / Fail** | — |

---

### MT-051 — GitHub sign out

| | |
|---|---|
| **Precondition** | Signed in to GitHub |
| **Steps** | 1. Tap **Sign Out** in Settings. |
| **Expected** | Username and "Connected" badge disappear. Sign-in controls reappear. |
| **Pass / Fail** | — |

---

### MT-052 — Theme change in settings

| | |
|---|---|
| **Precondition** | Settings screen open |
| **Steps** | 1. Tap **Light** mode toggle — verify IDE background switches to light. 2. Tap a colour swatch — verify accent colours update. |
| **Expected** | Changes apply immediately (no Save button needed). Persist after closing Settings and reopening. |
| **Pass / Fail** | — |

---

### MT-053 — Install a custom extension

| | |
|---|---|
| **Precondition** | Settings → Extensions section |
| **Steps** | 1. Enter an extension name (e.g. `Word Counter`). 2. Paste simple JS source: `vscode.window.showInformationMessage('Hello from Word Counter!');` 3. Tap **Install**. |
| **Expected** | Extension appears in the installed list with name and version. |
| **Pass / Fail** | — |
| **Notes** | Extension source is injected raw; syntax errors will silently fail at runtime. |

---

### MT-054 — Remove an extension

| | |
|---|---|
| **Precondition** | At least one extension installed |
| **Steps** | 1. Tap **Remove** next to the extension. |
| **Expected** | Extension disappears from the list immediately. |
| **Pass / Fail** | — |

---

### MT-055 — Install button disabled when fields empty

| | |
|---|---|
| **Precondition** | Extensions section, both fields empty |
| **Steps** | 1. Leave name empty, add source — observe Install button. 2. Add name, leave source empty — observe Install button. |
| **Expected** | Install button is disabled (not tappable) until both name and source have content. |
| **Pass / Fail** | — |

---

## 8. Git Status Bar

### MT-056 — Git status display

| | |
|---|---|
| **Precondition** | App running |
| **Steps** | 1. Observe the status bar at the top of the screen. |
| **Expected** | Git branch name displayed (e.g. `main`). A modified/untracked file count badge shown if applicable. |
| **Pass / Fail** | — |
| **Notes** | Git operations are stubs — branch/status values may be placeholder data until isomorphic-git is integrated. |

---

### MT-057 — Dirty file warning before commit

| | |
|---|---|
| **Precondition** | A file has unsaved changes |
| **Steps** | 1. Attempt a commit via the status bar commit button. |
| **Expected** | Alert appears warning that the current file has unsaved changes. Offers to save or cancel. |
| **Pass / Fail** | — |

---

## 9. Monaco Offline Cache

### MT-058 — Editor loads when online (CDN fallback)

| | |
|---|---|
| **Precondition** | Device has network access, no local Monaco cache |
| **Steps** | 1. Open any file. 2. Observe the editor loading. |
| **Expected** | Editor loads within a few seconds via CDN. No error message. |
| **Pass / Fail** | — |

---

### MT-059 — Editor shows offline notice when network unavailable

| | |
|---|---|
| **Precondition** | Device offline, no Monaco cache |
| **Steps** | 1. Disable network (Airplane Mode). 2. Open any file. |
| **Expected** | Editor area shows "offline" notice or loading spinner that eventually times out with a friendly message. |
| **Pass / Fail** | — |

---

## 10. Persistence & State Restoration

### MT-060 — Settings persist across restarts

| | |
|---|---|
| **Precondition** | App running |
| **Steps** | 1. Change theme to Light. 2. Set font size to 20. 3. Kill and relaunch the app. |
| **Expected** | Light theme and font size 20 are restored on relaunch. |
| **Pass / Fail** | — |

---

### MT-061 — Setup wizard does not reappear after completion

| | |
|---|---|
| **Precondition** | Setup wizard previously completed |
| **Steps** | 1. Kill and relaunch the app. |
| **Expected** | Main IDE opens directly. Setup wizard is not shown. |
| **Pass / Fail** | — |

---

## 11. Accessibility

### MT-062 — Touch target sizes

| | |
|---|---|
| **Precondition** | App running on iPad |
| **Steps** | 1. Attempt to tap each toolbar button, FAB, and tab close (✕). |
| **Expected** | All interactive elements are easily tappable without precision. Minimum 44×44 pt touch area (iOS HIG). |
| **Pass / Fail** | — |

---

### MT-063 — Text contrast (light theme)

| | |
|---|---|
| **Precondition** | Light theme active |
| **Steps** | 1. Visually inspect body text, labels, and tab titles against their backgrounds. |
| **Expected** | All text/background pairs meet WCAG 4.5:1 contrast ratio (normal text). |
| **Pass / Fail** | — |

---

### MT-064 — Text contrast (dark theme)

| | |
|---|---|
| **Precondition** | Dark theme active |
| **Steps** | 1. Visually inspect body text, labels, and tab titles against their backgrounds. |
| **Expected** | All text/background pairs meet WCAG 4.5:1 contrast ratio. |
| **Pass / Fail** | — |

---

## Known Limitations (Not Tested Here)

| Area | Limitation |
|------|-----------|
| Git operations | All stub — clone, commit, push, pull, status not functional yet |
| Monaco offline | Full offline bundle not yet distributed; CDN required |
| AI features | AI_HOOK placeholders present; no AI integration yet |
| Cloud sync | CLOUD_HOOK placeholders present; no sync backend yet |
| Extensions — WASM | Extensions are JS-only; no WASM support yet |
| iOS IPA on device | Requires paid Apple Developer Program ($99/yr) for distribution |
| Android Play Store | Release APK uses debug keystore; production keystore needed for store upload |
| GitHub OAuth | client_secret bundled in app binary — dev only; needs server proxy for production |

---

## Test Run Record

| Run # | Date | Tester | Platform | Build | Pass | Fail | Blocked | Notes |
|-------|------|--------|----------|-------|------|------|---------|-------|
| 1 | | | | 0.1 | | | | |
