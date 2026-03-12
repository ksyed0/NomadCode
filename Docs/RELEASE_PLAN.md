# RELEASE_PLAN.md — NomadCode Release Plan

Epics, User Stories, Tasks, MVP definition, and release milestones.
All artefact IDs are permanent — never reused. Consult `Docs/ID_REGISTRY.md` before adding new artefacts.

---

## Epics

```
EPIC-0001: Code Editing
Description: Core syntax-highlighted editor with file open/save, undo/redo, multi-tab support.
Release Target: MVP (v0.1)
Status: Done
Dependencies: None

EPIC-0002: File Management
Description: File Explorer with full directory CRUD — browse, create, rename, delete, move.
Release Target: MVP (v0.1)
Status: Done
Dependencies: EPIC-0001

EPIC-0003: Terminal
Description: Integrated sandboxed terminal via Xterm.js + WASI for running build/test commands.
Release Target: Release 0.5 (Beta)
Status: Planned
Dependencies: EPIC-0001, EPIC-0002

EPIC-0004: Command Palette
Description: Fuzzy-search command palette accessible by gesture or Cmd+P for keyboard-free power workflows.
Release Target: Release 0.5 (Beta)
Status: Planned
Dependencies: EPIC-0001

EPIC-0005: Customization
Description: Light/dark themes, font size settings, and extension installation.
Release Target: Release 1.0 (GA)
Status: Planned
Dependencies: EPIC-0001, EPIC-0002, EPIC-0003, EPIC-0004

EPIC-0006: Plan Visualizer
Description: Self-updating HTML dashboard for project plan status, cost tracking, and traceability — auto-deployed to GitHub Pages.
Release Target: MVP (v0.1)
Status: Done
Dependencies: None
```

---

## User Stories

### EPIC-0001: Code Editing

```
US-0001 (EPIC-0001): As a developer, I want to open a file on my device, so that I can read and edit existing code.
Priority: High (P0)
Estimate: M
Status: Done
Branch: feature/US-0001-open-file
Acceptance Criteria:
  - [x] AC-0009: FileExplorer displays the device file tree in the sidebar
  - [x] AC-0010: Tapping a file loads its content into the editor
  - [x] AC-0011: Active file path is displayed in the editor path bar
Dependencies: None

US-0002 (EPIC-0001): As a developer, I want to edit code with syntax highlighting, so that I can read code more easily.
Priority: High (P0)
Estimate: L
Status: Done
Branch: feature/US-0002-syntax-highlighting
Acceptance Criteria:
  - [x] AC-0012: TypeScript/JavaScript files receive correct syntax highlighting (language detected from extension)
  - [x] AC-0013: Editor is responsive to touch input — tap positions cursor, pinch adjusts font size
  - [x] AC-0014: Virtual keyboard raises the editor viewport so the cursor line remains visible
Dependencies: US-0001

US-0003 (EPIC-0001): As a developer, I want to save my changes, so that my work is not lost.
Priority: High (P0)
Estimate: S
Status: Done
Acceptance Criteria:
  - [x] AC-0022: Cmd+S / toolbar Save triggers onSave with the active file path and current content
  - [x] AC-0023: After save, the dirty indicator (●) is removed from the active tab
  - [x] AC-0024: Saving a file with no changes (clean tab) calls onSave without error
Dependencies: US-0001, US-0002

US-0004 (EPIC-0001): As a developer, I want to undo and redo changes, so that I can recover from mistakes.
Priority: High (P0)
Estimate: S
Status: Done
Acceptance Criteria:
  - [x] AC-0025: Pressing the Undo toolbar button sends the undo command to Monaco without throwing
  - [x] AC-0026: Pressing the Redo toolbar button sends the redo command to Monaco without throwing
Dependencies: US-0002

US-0005 (EPIC-0001): As a developer, I want to search and replace text within a file, so that I can refactor code quickly.
Priority: Medium (P1)
Estimate: M
Status: Done
Acceptance Criteria:
  - [x] AC-0027: Pressing the Find toolbar button sends the find command to Monaco without throwing
  - [x] AC-0028: Find toolbar button is accessible via aria-label and has a minimum 44pt touch target
Dependencies: US-0002

US-0006 (EPIC-0001): As a developer, I want to view multiple files in tabs, so that I can work across files without losing context.
Priority: Medium (P1)
Estimate: M
Status: Done
Acceptance Criteria:
  - [x] AC-0029: Tab bar renders one tab per open file with correct label
  - [x] AC-0030: Tapping a tab calls onTabChange with that file's path
  - [x] AC-0031: Pressing the × close button calls onTabClose with the correct path
  - [x] AC-0032: Dirty tabs show ● prefix; clean tabs show no indicator
Dependencies: US-0001, US-0002
```

### EPIC-0002: File Management

```
US-0007 (EPIC-0002): As a developer, I want to browse my project directory tree, so that I can find and open any file.
Priority: High (P0)
Estimate: M
Status: Done
Acceptance Criteria:
  - [x] AC-0033: FileExplorer renders all file and directory entries returned by FileSystemBridge
  - [x] AC-0034: Tapping a directory expands it and shows its children; tapping again collapses it
  - [x] AC-0035: Long-pressing any entry opens a context menu with New File, New Folder, Rename, Move to, and Delete options
Dependencies: None

US-0008 (EPIC-0002): As a developer, I want to create new files and folders, so that I can add to my project.
Priority: High (P0)
Estimate: S
Status: Done
Branch: feature/epic-0002-file-management
Acceptance Criteria:
  - [x] AC-0015: New file created at correct path + tree refreshed (TC-0041..TC-0048)
  - [x] AC-0016: New folder created at correct path + tree refreshed (TC-0049..TC-0052)
Dependencies: US-0007

US-0009 (EPIC-0002): As a developer, I want to rename files and folders, so that I can keep my project organized.
Priority: High (P0)
Estimate: S
Status: Done
Branch: feature/epic-0002-file-management
Acceptance Criteria:
  - [x] AC-0017: Rename via moveEntry + tree refreshed; modal pre-filled with current name (TC-0053..TC-0058)
Dependencies: US-0007

US-0010 (EPIC-0002): As a developer, I want to delete files and folders, so that I can clean up my project.
Priority: High (P0)
Estimate: S
Status: Done
Branch: feature/epic-0002-file-management
Acceptance Criteria:
  - [x] AC-0018: Confirmed delete calls deleteEntry + tree refreshed (TC-0059..TC-0065)
  - [x] AC-0019: Cancel skips deleteEntry — no tree change (TC-0061)
Dependencies: US-0007

US-0011 (EPIC-0002): As a developer, I want to move files and folders, so that I can restructure my project intuitively.
Priority: Low (P2)
Estimate: L
Status: Done
Branch: feature/epic-0002-file-management
Acceptance Criteria:
  - [x] AC-0020: Move to valid destination calls moveEntry + onFileMove + tree reloaded (TC-0066..TC-0077)
  - [x] AC-0021: Self-move and descendant-move blocked with error alert (TC-0073..TC-0074)
Dependencies: US-0007, US-0008, US-0009, US-0010
```

### EPIC-0003: Terminal

```
US-0012 (EPIC-0003): As a developer, I want to open an integrated terminal, so that I can run commands without leaving the app.
Priority: High (P0)
Estimate: XL
Status: Done
Branch: feature/epic-0003-terminal
Acceptance Criteria:
  - [x] AC-0036: Terminal component renders the TERMINAL header and a prompt character ($) on mount
  - [x] AC-0037: Terminal accepts a workingDirectory prop and displays it in the welcome output
  - [x] AC-0038: Terminal input clears after a command is submitted
  - [x] AC-0039: Virtual keyboard raises the terminal viewport on iOS via KeyboardAvoidingView
Dependencies: EPIC-0001, EPIC-0002

US-0013 (EPIC-0003): As a developer, I want to run build and test commands, so that I can verify my code works.
Priority: High (P0)
Estimate: M
Status: Done
Branch: feature/epic-0003-terminal
Acceptance Criteria:
  - [x] AC-0040: Submitting a command echoes it in the output prefixed with $
  - [x] AC-0041: The onCommand callback is invoked with the exact command string on submit
  - [x] AC-0042: Submitting an empty string does not add a line or call onCommand
Dependencies: US-0012

US-0014 (EPIC-0003): As a developer, I want to see colored terminal output, so that I can parse logs more easily.
Priority: Medium (P1)
Estimate: S
Status: Done
Branch: feature/epic-0003-terminal
Acceptance Criteria:
  - [x] AC-0043: Command echo lines are rendered in a distinct color (green/success style)
  - [x] AC-0044: Error/unknown-command lines are rendered in the error color (Coral #EF4444)
  - [x] AC-0045: Regular output lines are rendered in the standard text color
Dependencies: US-0012
```

### EPIC-0004: Command Palette

```
US-0015 (EPIC-0004): As a power user, I want to open a command palette, so that I can run any action without navigating menus.
Priority: Medium (P1)
Estimate: M
Status: Done
Acceptance Criteria:
  - [x] AC-0046: CommandPalette renders a search input that auto-focuses on mount
  - [x] AC-0047: CommandPalette renders all provided commands when the query is empty
  - [x] AC-0048: Tapping outside the panel (backdrop) dismisses the keyboard
Dependencies: EPIC-0001

US-0016 (EPIC-0004): As a power user, I want to search commands by name, so that I can find actions without memorizing locations.
Priority: Medium (P1)
Estimate: S
Status: Done
Acceptance Criteria:
  - [x] AC-0049: Typing a query filters commands to those matching label or description (case-insensitive)
  - [x] AC-0050: When no commands match the query, a "No commands found" message is shown
  - [x] AC-0051: Pressing Enter selects the first result in the filtered list
Dependencies: US-0015

US-0017 (EPIC-0004): As a power user, I want to see keyboard shortcuts in the palette, so that I can learn shortcuts over time.
Priority: Low (P2)
Estimate: S
Status: Done
Acceptance Criteria:
  - [x] AC-0052: Commands with a shortcut field display the shortcut in a badge alongside the label
  - [x] AC-0053: Commands without a shortcut field show no badge (no empty badge rendered)
Dependencies: US-0015, US-0016
```

### EPIC-0005: Customization

```
US-0018 (EPIC-0005): As a developer, I want to switch between light and dark themes, so that I can use the app comfortably in any environment.
Priority: Medium (P1)
Estimate: M
Status: Planned
Acceptance Criteria:
  - [ ] AC-0054: App renders using Deep Slate (#0F172A) background in dark mode by default
  - [ ] AC-0055: A theme toggle switches the editor and UI surfaces to Off-White (#F9FAFB) background
  - [ ] AC-0056: All text/background pairs in both themes meet WCAG 4.5:1 contrast for normal text
Dependencies: EPIC-0001

US-0019 (EPIC-0005): As a developer, I want to change font size, so that I can read comfortably on my device.
Priority: Medium (P1)
Estimate: S
Status: Planned
Acceptance Criteria:
  - [ ] AC-0057: Pressing A+ in the editor toolbar increments the Monaco font size by 1pt
  - [ ] AC-0058: Pressing A- in the editor toolbar decrements the Monaco font size by 1pt
  - [ ] AC-0059: The current font size value is displayed in the toolbar between the A- and A+ buttons
Dependencies: US-0018

US-0020 (EPIC-0005): As a power user, I want to install extensions, so that I can enhance the IDE with tools I need.
Priority: Medium (P1)
Estimate: XL
Status: Planned
Acceptance Criteria:
  - [ ] AC-0060: An extension manifest can be registered in ExtensionRegistry and retrieved by id
  - [ ] AC-0061: activateExtension registers the manifest and returns valid sandbox HTML containing the extension source
  - [ ] AC-0062: deactivateExtension removes the extension from ExtensionRegistry
  - [ ] AC-0063: Extensions run in an isolated WebView sandbox — the sandbox HTML wraps source in try/catch
Dependencies: EPIC-0001, EPIC-0002, EPIC-0003, EPIC-0004
```

### EPIC-0006: Plan Visualizer

```
US-0021 (EPIC-0006): As a project lead, I want a plan status dashboard, so that I can see project health at a glance.
Priority: High (P0)
Estimate: XL
Status: Done
Branch: feature/US-0021-plan-visualizer
Acceptance Criteria:
  - [x] AC-0001: HTML page generated from RELEASE_PLAN.md
  - [x] AC-0002: Filter by epic, status, priority, search
  - [x] AC-0003: Epic→Story→AC→TC hierarchy view
  - [x] AC-0004: All 7 Chart.js charts render on Charts tab
  - [x] AC-0005: Cost table shows projected and AI costs per story
  - [x] AC-0006: Traceability matrix links TCs to stories and ACs
  - [x] AC-0007: GitHub Actions auto-deploys to GitHub Pages on qualifying commits
  - [x] AC-0008: Claude Code stop hook appends cost rows to AI_COST_LOG.md
Dependencies: None
```

---

## Tasks (Phase 1 — Immediate)

```
TASK-0001 (US-0002): Implement CodeMirror 6 in WebView for syntax-highlighted editing
Type: Dev
Assignee: Agent
Status: To Do
Branch: feature/US-0002-syntax-highlighting
Notes: Evaluate @codemirror/lang-javascript bundle size before integrating

TASK-0002 (US-0001): Wire FileSystemBridge to Expo FileSystem for real file read/write
Type: Dev
Assignee: Agent
Status: Done
Branch: feature/US-0001-open-file
Notes: FileSystemBridge fully wired to expo-file-system (readFile, writeFile, listDirectory, etc). FileExplorer and App.tsx openFile() wired end-to-end. Path breadcrumb added to Editor. All ACs met.

TASK-0003 (US-0001, US-0002): Achieve 80% unit test coverage on all Phase 1 components
Type: Test
Assignee: Agent
Status: To Do
Notes: Run npm run test:coverage and report results

TASK-0004 (Infrastructure): Set up develop branch and branch protection rules on GitHub
Type: Infra
Assignee: Agent
Status: To Do
Notes: Enable branch protection on main and develop via GitHub settings
```

---

## Release Milestones

| Release | Description | Key Epics | Target Date |
|---|---|---|---|
| v0.1 Internal Alpha | Core editor + file system on tablet | EPIC-0001, EPIC-0002 | TBD |
| v0.5 Public Beta | Full feature set for TestFlight/Play Beta | EPIC-0003, EPIC-0004 | TBD |
| v1.0 GA | Extensions, polish, App Store launch | EPIC-0005 | TBD |
