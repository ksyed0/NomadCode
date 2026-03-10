# RELEASE_PLAN.md — NomadCode Release Plan

Epics, User Stories, Tasks, MVP definition, and release milestones.
All artefact IDs are permanent — never reused. Consult `Docs/ID_REGISTRY.md` before adding new artefacts.

---

## Epics

```
EPIC-0001: Code Editing
Description: Core syntax-highlighted editor with file open/save, undo/redo, multi-tab support.
Release Target: MVP (v0.1)
Status: In Progress
Dependencies: None

EPIC-0002: File Management
Description: File Explorer with full directory CRUD — browse, create, rename, delete, move.
Release Target: MVP (v0.1)
Status: In Progress
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
Branch: feature/US-0001-open-file
Acceptance Criteria:
  - [x] AC-0012: TypeScript/JavaScript syntax highlighted correctly (Monaco, 80+ languages)
  - [x] AC-0013: Editor responsive to touch input (tap to position cursor, pinch-to-zoom)
  - [x] AC-0014: Virtual keyboard adjusts editor viewport (Monaco WebView handles layout)
Dependencies: US-0001

US-0003 (EPIC-0001): As a developer, I want to save my changes, so that my work is not lost.
Priority: High (P0)
Estimate: S
Status: Planned
Dependencies: US-0001, US-0002

US-0004 (EPIC-0001): As a developer, I want to undo and redo changes, so that I can recover from mistakes.
Priority: High (P0)
Estimate: S
Status: Planned
Dependencies: US-0002

US-0005 (EPIC-0001): As a developer, I want to search and replace text within a file, so that I can refactor code quickly.
Priority: Medium (P1)
Estimate: M
Status: Planned
Dependencies: US-0002

US-0006 (EPIC-0001): As a developer, I want to view multiple files in tabs, so that I can work across files without losing context.
Priority: Medium (P1)
Estimate: M
Status: Planned
Dependencies: US-0001, US-0002
```

### EPIC-0002: File Management

```
US-0007 (EPIC-0002): As a developer, I want to browse my project directory tree, so that I can find and open any file.
Priority: High (P0)
Estimate: M
Status: In Progress
Dependencies: None

US-0008 (EPIC-0002): As a developer, I want to create new files and folders, so that I can add to my project.
Priority: High (P0)
Estimate: S
Status: Planned
Dependencies: US-0007

US-0009 (EPIC-0002): As a developer, I want to rename files and folders, so that I can keep my project organized.
Priority: High (P0)
Estimate: S
Status: Planned
Dependencies: US-0007

US-0010 (EPIC-0002): As a developer, I want to delete files and folders, so that I can clean up my project.
Priority: High (P0)
Estimate: S
Status: Planned
Dependencies: US-0007

US-0011 (EPIC-0002): As a developer, I want to move files via drag-and-drop, so that I can restructure my project intuitively.
Priority: Low (P2)
Estimate: L
Status: Planned
Dependencies: US-0007, US-0008, US-0009, US-0010
```

### EPIC-0003: Terminal

```
US-0012 (EPIC-0003): As a developer, I want to open an integrated terminal, so that I can run commands without leaving the app.
Priority: High (P0)
Estimate: XL
Status: Planned
Dependencies: EPIC-0001, EPIC-0002

US-0013 (EPIC-0003): As a developer, I want to run build and test commands, so that I can verify my code works.
Priority: High (P0)
Estimate: M
Status: Planned
Dependencies: US-0012

US-0014 (EPIC-0003): As a developer, I want to see colored terminal output, so that I can parse logs more easily.
Priority: Medium (P1)
Estimate: S
Status: Planned
Dependencies: US-0012
```

### EPIC-0004: Command Palette

```
US-0015 (EPIC-0004): As a power user, I want to open a command palette, so that I can run any action without navigating menus.
Priority: Medium (P1)
Estimate: M
Status: Planned
Dependencies: EPIC-0001

US-0016 (EPIC-0004): As a power user, I want to search commands by name, so that I can find actions without memorizing locations.
Priority: Medium (P1)
Estimate: S
Status: Planned
Dependencies: US-0015

US-0017 (EPIC-0004): As a power user, I want to see keyboard shortcuts in the palette, so that I can learn shortcuts over time.
Priority: Low (P2)
Estimate: S
Status: Planned
Dependencies: US-0015, US-0016
```

### EPIC-0005: Customization

```
US-0018 (EPIC-0005): As a developer, I want to switch between light and dark themes, so that I can use the app comfortably in any environment.
Priority: Medium (P1)
Estimate: M
Status: Planned
Dependencies: EPIC-0001

US-0019 (EPIC-0005): As a developer, I want to change font size, so that I can read comfortably on my device.
Priority: Medium (P1)
Estimate: S
Status: Planned
Dependencies: US-0018

US-0020 (EPIC-0005): As a power user, I want to install extensions, so that I can enhance the IDE with tools I need.
Priority: Medium (P1)
Estimate: XL
Status: Planned
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
Status: Deferred
Branch: feature/US-0002-syntax-highlighting
Notes: Monaco (0.45.0) already satisfies all US-0002 ACs. CodeMirror 6 would reduce bundle size (~400 KB vs 2.5 MB) but requires reimplementing toolbar, multi-cursor, pinch-to-zoom, and offline cache. Deferred — revisit if bundle size becomes a measurable performance issue on lower-end devices.

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
Status: Done
Notes: develop branch created and pushed. Branch protection enabled on main and develop: require PR, require CI checks (lint, test, build, security, plan-visualizer-test), no force-push, no deletion.
```

---

## Release Milestones

| Release | Description | Key Epics | Target Date |
|---|---|---|---|
| v0.1 Internal Alpha | Core editor + file system on tablet | EPIC-0001, EPIC-0002 | TBD |
| v0.5 Public Beta | Full feature set for TestFlight/Play Beta | EPIC-0003, EPIC-0004 | TBD |
| v1.0 GA | Extensions, polish, App Store launch | EPIC-0005 | TBD |
