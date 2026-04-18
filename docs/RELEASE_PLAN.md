# RELEASE_PLAN.md — NomadCode Release Plan

Epics, User Stories, Tasks, MVP definition, and release milestones.
All artefact IDs are permanent — never reused. Consult `docs/ID_REGISTRY.md` before adding new artefacts.

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
Status: Done
PR: #45 (merged)
Dependencies: EPIC-0001, EPIC-0002

EPIC-0004: Command Palette
Description: Fuzzy-search command palette accessible by gesture or Cmd+P for keyboard-free power workflows.
Release Target: Release 0.5 (Beta)
Status: Done
Dependencies: EPIC-0001

EPIC-0005: Customization
Description: Light/dark themes, font size settings, and extension installation.
Release Target: Release 1.0 (GA)
Status: Done
Dependencies: EPIC-0001, EPIC-0002, EPIC-0003, EPIC-0004

EPIC-0006: Plan Visualizer
Description: Self-updating HTML dashboard for project plan status, cost tracking, and traceability — auto-deployed to GitHub Pages.
Release Target: MVP (v0.1)
Status: Done
Dependencies: None

EPIC-0007: Authentication
Description: GitHub OAuth sign-in via browser redirect, secure token storage in platform keychain, and sign-out with token revocation.
Release Target: Release 1.0 (GA)
Status: Done
Dependencies: EPIC-0005

EPIC-0008: Git Integration
Description: Full git workflow via isomorphic-git — clone, stage, commit, push, pull, diff, and branch management.
Release Target: Release 1.0 (GA)
Status: Done
Dependencies: EPIC-0007

EPIC-0009: In-App Purchases & Monetization
Description: Three-tier subscription model (Free / Pro / Pro+AI) via native IAP with receipt validation and feature gating.
Release Target: Release 1.0 (GA)
Status: Planned
Dependencies: EPIC-0007

EPIC-0010: AI Suggestions
Description: Inline code completions and AI chat panel powered by Claude API, gated behind the Pro+AI subscription tier.
Release Target: Release 1.0 (GA)
Status: Planned
Dependencies: EPIC-0009, EPIC-0008

EPIC-0011: App Store & EAS Build Delivery
Description: EAS Build pipeline producing iOS .ipa and Android .aab artefacts, submitted to App Store Connect and Google Play Console.
Release Target: Release 1.0 (GA)
Status: Planned
Dependencies: EPIC-0005, EPIC-0007, EPIC-0008, EPIC-0009, EPIC-0010

EPIC-0012: Cloud Sync
Description: S3-compatible cloud storage for project sync — upload on save, pull on launch, conflict resolution UI.
Release Target: Release 1.1 (Post-Launch)
Status: Done
PR: #48 (merged)
Dependencies: EPIC-0007

EPIC-0013: Multi-Language Editor Support
Description: Per-language indentation rules, auto-close behaviour, and comprehensive VSCode-compatible extension coverage (C, C++, C#, F#, TypeScript, JavaScript, Python, Rust, Go, Swift, Dart/Flutter, Lua, Elixir, R, Scala, Perl, Terraform, PowerShell, and more).
Release Target: Release 1.1 (Post-Launch)
Status: Done
PR: #49 (merged)
Dependencies: EPIC-0001

EPIC-0014: Global Search — Find in Files
Description: Cross-project full-text search panel with result grouping by file, line preview, and navigate-to-line.
Release Target: Release 1.1 (Post-Launch)
Status: Done
Branch: feature/EPIC-0014-global-search
Dependencies: EPIC-0001, EPIC-0002

EPIC-0015: Crash Reporting & Observability
Description: Automated crash reporting via Sentry/Bugsnag and performance metric tracking (cold start, latency, memory) with alerting.
Release Target: Release 1.1 (Post-Launch)
Status: Deferred
Dependencies: EPIC-0011

EPIC-0019: Native iOS Folder Picker
Description: Custom native module wrapping UIDocumentPickerViewController in directory mode with security-scoped URL bookmarks, allowing users to pick workspace folders outside the app sandbox (iCloud Drive, On My iPad, external providers) with persistent write access.
Release Target: Release 1.2 (Post-Launch)
Status: Deferred
Dependencies: EPIC-0002

EPIC-0020: Advanced Git Workflows
Description: Branch create/switch UI, merge conflict resolution editor, git gutter indicators, stash management, and git blame — completing a professional git workflow on mobile.
Release Target: Release 1.0 (GA)
Status: Planned
Dependencies: EPIC-0008

EPIC-0021: Advanced Editor Features
Description: Search & replace across files, hardware keyboard shortcuts (⌘S / ⌘` / ⌘N / ⌘P), code folding, Prettier auto-format, breadcrumbs navigation, and snippet expansion.
Release Target: Release 1.1 (Post-Launch)
Status: Planned
Dependencies: EPIC-0001, EPIC-0014

EPIC-0022: Code Navigation
Description: Go to Definition, Find All References, Peek Definition, and workspace symbol search — powered by Monaco's built-in AST support before full LSP lands.
Release Target: Release 1.1 (Post-Launch)
Status: Planned
Dependencies: EPIC-0001

EPIC-0023: AI Code Intelligence
Description: Inline AI edit (Cmd+K equivalent), project-scoped AI rules, AI-generated commit messages, and multi-model provider support (Claude, GPT-4, Gemini) — extends EPIC-0010 with intelligence beyond raw completions.
Release Target: Release 1.1 (Post-Launch)
Status: Planned
Dependencies: EPIC-0010

EPIC-0024: Language Server Protocol
Description: LSP worker integration delivering real IntelliSense completions, hover documentation, and real-time error diagnostics with inline squiggles for TypeScript, Python, and Go.
Release Target: Release 1.2 (Post-Launch)
Status: Planned
Dependencies: EPIC-0022

EPIC-0025: AI Codebase Indexing
Description: Semantic vector indexing of the open workspace enabling @file and @codebase context references in AI chat/completions, with a privacy mode to disable indexing for sensitive repos.
Release Target: Release 1.2 (Post-Launch)
Status: Planned
Dependencies: EPIC-0010, EPIC-0023

EPIC-0026: Mobile Debugging
Description: Breakpoints, watch expressions, call stack panel, and debug console — adapted for mobile touch interaction and targeting JS/TS runtimes via WASI debug adapters.
Release Target: Release 1.2 (Post-Launch)
Status: Planned
Dependencies: EPIC-0003, EPIC-0024

EPIC-0027: Collaboration & Sharing
Description: Settings sync across devices, shareable code snippet links, and a lightweight Live Share-style session for real-time collaborative editing (viewer + single editor).
Release Target: Release 1.2 (Post-Launch)
Status: Planned
Dependencies: EPIC-0012, EPIC-0007
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

US-0050 (EPIC-0003): As a developer, I can use `touch`, `cp`, and `mv` commands to create and manage files.
Priority: High (P0)
Estimate: M
Status: Done
Branch: feature/epic-0003-terminal
Acceptance Criteria:
  - [x] AC-0136: `touch <file>` creates a file if it doesn't exist; no-op if it does
  - [x] AC-0137: `cp <src> <dest>` copies a file/directory
  - [x] AC-0138: `mv <src> <dest>` moves/renames a file/directory
Dependencies: US-0012

US-0051 (EPIC-0003): As a developer, I can use `clear` to reset the terminal screen.
Priority: Medium (P1)
Estimate: S
Status: Done
Branch: feature/epic-0003-terminal
Acceptance Criteria:
  - [x] AC-0139: `clear` resets terminal output
Dependencies: US-0012

US-0052 (EPIC-0003): As a developer, I can run `node <file>` to execute JavaScript files.
Priority: High (P0)
Estimate: M
Status: Done
Branch: feature/epic-0003-terminal
Acceptance Criteria:
  - [x] AC-0140: `node <file>` executes JS via WebView engine, capturing console.log output
  - [x] AC-0141: `node <file>` with `require()` returns a clear error
Dependencies: US-0012

US-0053 (EPIC-0003): As a developer, I can use `npm run <script>` to run package.json scripts.
Priority: High (P0)
Estimate: M
Status: Done
Branch: feature/epic-0003-terminal
Acceptance Criteria:
  - [x] AC-0142: `npm run <script>` reads package.json and runs the matching script
  - [x] AC-0143: `npm run <missing>` returns 'not found in package.json' error
  - [x] AC-0144: `npm install` returns 'not supported' error
Dependencies: US-0012

US-0054 (EPIC-0003): As a developer, I can use `npx prettier` offline to format code.
Priority: Medium (P1)
Estimate: M
Status: Done
Branch: feature/epic-0003-terminal
Acceptance Criteria:
  - [x] AC-0145: `npx prettier <file>` formats the file using pre-bundled prettier
  - [x] AC-0146: `npx <unknown>` returns 'not available' with list of bundled tools
Dependencies: US-0012

US-0055 (EPIC-0003): As a developer, I see clear error messages for unsupported operations.
Priority: High (P0)
Estimate: S
Status: Done
Branch: feature/epic-0003-terminal
Acceptance Criteria:
  - [x] AC-0147: All unsupported operations return specific, actionable error messages
Dependencies: US-0012

US-0056 (EPIC-0003): App.tsx uses TerminalWebView for the live terminal experience.
Priority: High (P0)
Estimate: S
Status: Done
Branch: feature/epic-0003-terminal
Acceptance Criteria:
  - [x] AC-0148: App.tsx renders TerminalWebView instead of the deprecated Terminal stub
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
Status: Done
Branch: feature/epic-0005-customization
Acceptance Criteria:
  - [x] AC-0054: App renders using Deep Slate (#0F172A) background in dark mode by default
  - [x] AC-0055: A theme toggle switches the editor and UI surfaces to Off-White (#F9FAFB) background
  - [x] AC-0056: All text/background pairs in both themes meet WCAG 4.5:1 contrast for normal text
Dependencies: EPIC-0001

US-0019 (EPIC-0005): As a developer, I want to change font size, so that I can read comfortably on my device.
Priority: Medium (P1)
Estimate: S
Status: Done
Branch: feature/epic-0005-customization
Acceptance Criteria:
  - [x] AC-0057: Pressing A+ in the editor toolbar increments the Monaco font size by 1pt
  - [x] AC-0058: Pressing A- in the editor toolbar decrements the Monaco font size by 1pt
  - [x] AC-0059: The current font size value is displayed in the toolbar between the A- and A+ buttons
Dependencies: US-0018

US-0020 (EPIC-0005): As a power user, I want to install extensions, so that I can enhance the IDE with tools I need.
Priority: Medium (P1)
Estimate: XL
Status: Done
Acceptance Criteria:
  - [x] AC-0060: An extension manifest can be registered in ExtensionRegistry and retrieved by id
  - [x] AC-0061: activateExtension registers the manifest and returns valid sandbox HTML containing the extension source
  - [x] AC-0062: deactivateExtension removes the extension from ExtensionRegistry
  - [x] AC-0063: Extensions run in an isolated WebView sandbox — the sandbox HTML wraps source in try/catch
Dependencies: EPIC-0001, EPIC-0002, EPIC-0003, EPIC-0004

US-0057 (EPIC-0005): As a user, I want an About screen showing the splash and app info, so that I can identify the app version and credits.
Priority: Low (P2)
Estimate: S
Status: Done
Branch: feature/EPIC-0003-terminal-ac-completion
Acceptance Criteria:
  - [x] AC-0149: A ⓘ button in the status bar has a minimum 44pt touch target and is accessible via aria-label="About NomadCode"
  - [x] AC-0150: Tapping ⓘ opens a full-screen modal displaying the splash image
  - [x] AC-0151: The About modal footer shows the app version (from package.json) and copyright line
  - [x] AC-0152: Tapping the ✕ close button dismisses the About modal with a fade animation
Dependencies: US-0018

US-0067 (EPIC-0005): As a user, I want the Monaco editor's syntax colours to match my selected NomadCode theme, so that my chosen look (Dracula, Nord, Solarized Light, etc.) is reflected in code colours — not just the app chrome.
Priority: Medium (P1)
Estimate: M
Status: Deferred
Acceptance Criteria:
  - [ ] AC-0202: Each NomadCode theme ID (nomad-dark, one-dark-pro, dracula, monokai, nord, tokyo-night, nomad-light, github-light, solarized-light, catppuccin-latte, night-owl-light) is registered with monaco.editor.defineTheme on editor boot with a full IStandaloneThemeData palette (colors + token rules)
  - [ ] AC-0203: getMonacoTheme() returns the registered custom theme name (not vs / vs-dark) so custom colours are applied instead of the Monaco built-in fallback
  - [ ] AC-0204: buildMonacoHtml() injects a defineTheme call for every registered theme before the initial setTheme, so the editor never shows a vs-dark flash on custom themes
  - [ ] AC-0205: Switching themes in Settings or SetupWizard updates Monaco's active theme within one frame, with no unstyled interval
  - [ ] AC-0206: Unit tests confirm each theme's defineTheme payload contains non-empty colors.background, colors.foreground, and at least one token rule for keywords, strings, and comments
Dependencies: EPIC-0005 (existing), prior BUG-0044 (superseded)

Notes:
- Current workaround (as of SDK 54 upgrade) maps every theme ID to vs or vs-dark
  based on .mode. This preserves the light/dark distinction but loses the
  unique syntax palette for each theme.
- Requires curating 11 IStandaloneThemeData objects in src/theme/monacoThemes.ts.
- The original BUG-0044 fix attempted this by returning the raw ThemeId, but
  never called defineTheme — Monaco silently ignored the unknown theme name
  and kept vs-dark. That behaviour is now documented and tested against.
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

### EPIC-0007: Authentication

```
US-0022 (EPIC-0007): As a developer, I want to sign in with my GitHub account, so that I can access private repositories and push code.
Priority: High (P0)
Estimate: L
Status: Done
Acceptance Criteria:
  - [x] AC-0064: Tapping "Sign in with GitHub" launches the system browser with the correct OAuth authorize URL
  - [x] AC-0065: After successful OAuth callback, an access token is returned and stored in the keychain
  - [x] AC-0066: The user's GitHub username and avatar are displayed in the settings screen after sign-in
Dependencies: EPIC-0005

US-0023 (EPIC-0007): As a developer, I want my auth token stored securely, so that my credentials are never exposed.
Priority: High (P0)
Estimate: S
Status: Done
Acceptance Criteria:
  - [x] AC-0067: OAuth access token is stored in the platform keychain (iOS Keychain / Android Keystore), not in app storage or logs
  - [x] AC-0068: Token survives app restart and is retrieved without re-authentication
Dependencies: US-0022

US-0024 (EPIC-0007): As a developer, I want to sign out, so that I can switch accounts or revoke access.
Priority: Medium (P1)
Estimate: S
Status: Done
Acceptance Criteria:
  - [x] AC-0069: Tapping "Sign out" deletes the token from the keychain and clears the user session
  - [x] AC-0070: After sign-out, git operations requiring auth prompt re-authentication
Dependencies: US-0022, US-0023
```

### EPIC-0008: Git Integration

```
US-0025 (EPIC-0008): As a developer, I want to clone a GitHub repository, so that I can work on an existing project.
Priority: High (P0)
Estimate: L
Status: Complete
Acceptance Criteria:
  - [x] AC-0071: User can enter a GitHub repository URL and initiate a clone to local storage
  - [x] AC-0072: Clone progress is shown via a progress indicator; errors surface a readable message
  - [x] AC-0073: Cloned repo appears in the file explorer immediately on completion
  - [x] AC-0191: If the repository requires authentication and no GitHub token is stored, the user sees a clear message and a path to sign in (e.g. Settings)
  - [x] AC-0192: When the network is unavailable or clone fails transiently, the user sees an actionable message; transient failures retry with exponential backoff up to three times (per AGENTS.md)
Dependencies: EPIC-0007

US-0026 (EPIC-0008): As a developer, I want to stage and commit changes, so that I can record my work in git history.
Priority: High (P0)
Estimate: M
Status: Complete
Acceptance Criteria:
  - [x] AC-0074: Modified files are listed in the git status panel with staged/unstaged indicators
  - [x] AC-0075: Tapping a file checkbox toggles it between staged and unstaged
  - [x] AC-0076: Entering a commit message and confirming creates a local commit
  - [x] AC-0193: Git status panel interactive controls have accessibility labels and minimum 44pt touch targets (WCAG-minded)
Dependencies: US-0025

US-0027 (EPIC-0008): As a developer, I want to push and pull from remote, so that I can collaborate with my team.
Priority: High (P0)
Estimate: M
Status: Complete
Acceptance Criteria:
  - [x] AC-0077: Tapping Push sends local commits to the remote using the stored OAuth token
  - [x] AC-0078: Tapping Pull fetches and merges remote changes into the working directory
  - [x] AC-0194: If push or pull requires authentication and no GitHub token is stored, the user sees a clear message and a path to sign in (e.g. Settings)
  - [x] AC-0195: When offline or push/pull fails transiently, the user sees an actionable message; transient failures retry with exponential backoff up to three times (per AGENTS.md)
Dependencies: US-0026

US-0028 (EPIC-0008): As a developer, I want to view file diffs, so that I can review changes before committing.
Priority: Medium (P1)
Estimate: M
Status: Complete
Acceptance Criteria:
  - [x] AC-0079: Tapping a modified file in the git status panel shows an inline diff view
  - [x] AC-0080: Added lines are highlighted green; removed lines are highlighted red
Dependencies: US-0026

US-0029 (EPIC-0008): As a developer, I want to create and switch branches, so that I can work on features in isolation.
Priority: Medium (P1)
Estimate: M
Status: Complete
Acceptance Criteria:
  - [x] AC-0081: Current branch name is visible in the status bar
  - [x] AC-0082: User can create a new branch from the current HEAD via the branch panel
  - [x] AC-0083: User can switch to an existing local branch without losing uncommitted changes
Dependencies: US-0025
```

### EPIC-0009: In-App Purchases & Monetization

```
US-0030 (EPIC-0009): As a free-tier user, I want clear limits displayed, so that I understand what the free plan includes.
Priority: Medium (P1)
Estimate: S
Status: Planned
Acceptance Criteria:
  - [ ] AC-0084: Free tier users can open up to 3 files simultaneously; attempting a 4th shows an upgrade prompt
  - [ ] AC-0085: Free tier label is displayed in the settings screen alongside an upgrade CTA
Dependencies: EPIC-0007

US-0031 (EPIC-0009): As a developer, I want to subscribe to Pro, so that I can unlock unlimited files and advanced features.
Priority: High (P0)
Estimate: L
Status: Planned
Acceptance Criteria:
  - [ ] AC-0086: Pro subscription is purchasable via the native IAP sheet on iOS and Google Play Billing on Android
  - [ ] AC-0087: Successful purchase removes file-count limits and unlocks Pro-gated features immediately
  - [ ] AC-0088: Subscription status persists across app restarts via server-side receipt validation
Dependencies: US-0030

US-0032 (EPIC-0009): As a power user, I want to subscribe to Pro+AI, so that I can use AI-powered code suggestions.
Priority: High (P0)
Estimate: M
Status: Planned
Acceptance Criteria:
  - [ ] AC-0089: Pro+AI subscription unlocks AI Suggestions features in addition to all Pro features
  - [ ] AC-0090: Purchasing Pro+AI when already on Pro upgrades the subscription without double-charging
Dependencies: US-0031
```

### EPIC-0010: AI Suggestions

```
US-0033 (EPIC-0010): As a Pro+AI user, I want inline code completions, so that I can write code faster.
Priority: High (P0)
Estimate: XL
Status: Planned
Acceptance Criteria:
  - [ ] AC-0091: While typing, ghost-text completions appear after a 300 ms debounce
  - [ ] AC-0092: Pressing Tab accepts the current completion; pressing Escape dismisses it
  - [ ] AC-0093: Completions are only triggered for Pro+AI subscribers; other users see no ghost text
Dependencies: EPIC-0009, EPIC-0008

US-0034 (EPIC-0010): As a Pro+AI user, I want an AI chat panel, so that I can ask questions about my code.
Priority: High (P0)
Estimate: L
Status: Planned
Acceptance Criteria:
  - [ ] AC-0094: A chat panel can be opened alongside the editor via a toolbar button
  - [ ] AC-0095: User can type a prompt referencing the current file and receive a streamed response
  - [ ] AC-0096: Chat history persists for the session and is cleared on app restart
Dependencies: US-0033

US-0035 (EPIC-0010): As a non-subscriber, I want AI features gated with a clear upgrade prompt, so that I understand what I'm missing.
Priority: Medium (P1)
Estimate: S
Status: Planned
Acceptance Criteria:
  - [ ] AC-0097: Non-Pro+AI users see a paywall prompt when attempting to open the AI chat panel
  - [ ] AC-0098: AI completion ghost text is hidden entirely for Free and Pro tier users
Dependencies: US-0033, US-0034
```

### EPIC-0011: App Store & EAS Build Delivery

```
US-0036 (EPIC-0011): As a release engineer, I want an EAS Build pipeline, so that I can produce store-ready binaries from CI.
Priority: High (P0)
Estimate: L
Status: Planned
Acceptance Criteria:
  - [ ] AC-0099: `eas build --platform all` produces a valid iOS .ipa and Android .aab without errors
  - [ ] AC-0100: Build configuration is defined in `eas.json` with a production profile
Dependencies: EPIC-0005, EPIC-0007, EPIC-0008, EPIC-0009, EPIC-0010

US-0058 (EPIC-0011): As a release engineer, I want branded app icons, splash screens, and named APK artefacts, so that the app presents a polished identity in stores and on device home screens.
Priority: High (P0)
Estimate: S
Status: Done
Branch: feature/EPIC-0003-terminal-ac-completion
Acceptance Criteria:
  - [x] AC-0153: App icon (1024×1024 NomadCode logo) is correctly referenced in `app.json`, `ios/Images.xcassets/AppIcon`, and all Android mipmap densities (mdpi–xxxhdpi WebP)
  - [x] AC-0154: Splash screen displays the NomadCode logo centred on Deep Slate (#0F172A) background; `app.json` splash config uses `resizeMode: "contain"` and matching backgroundColor
  - [x] AC-0155: Android APK build artefacts are named `NomadCode-debug.apk` and `NomadCode-release.apk` via `applicationVariants.all` in `android/app/build.gradle`
Dependencies: EPIC-0005

US-0037 (EPIC-0011): As a release engineer, I want to submit to the iOS App Store, so that users can install on iPhone and iPad.
Priority: High (P0)
Estimate: M
Status: Planned
Acceptance Criteria:
  - [ ] AC-0101: `eas submit --platform ios` successfully uploads the build to App Store Connect
  - [ ] AC-0102: App metadata (name, description, screenshots, privacy policy URL) is complete in App Store Connect
Dependencies: US-0036

US-0038 (EPIC-0011): As a release engineer, I want to submit to Google Play, so that users can install on Android devices.
Priority: High (P0)
Estimate: M
Status: Planned
Acceptance Criteria:
  - [ ] AC-0103: `eas submit --platform android` successfully uploads the build to the Google Play Console
  - [ ] AC-0104: App metadata (title, description, screenshots) is complete in the Play Console internal track
Dependencies: US-0036
```

### EPIC-0012: Cloud Sync

```
US-0039 (EPIC-0012): As a developer, I want to upload my project to cloud storage, so that I can access it from multiple devices.
Priority: Medium (P1)
Estimate: L
Status: Done
Branch: feature/EPIC-0012-cloud-sync
PR: #48 (merged)
Acceptance Criteria:
  - [x] AC-0105: User can connect an S3-compatible bucket by entering endpoint URL and access credentials in settings
  - [x] AC-0106: Modified local files are uploaded to the configured bucket automatically on save
Dependencies: EPIC-0007

US-0040 (EPIC-0012): As a developer, I want to download remote changes on launch, so that my files are always up to date.
Priority: Medium (P1)
Estimate: L
Status: Done
Branch: feature/EPIC-0012-cloud-sync
PR: #48 (merged)
Acceptance Criteria:
  - [x] AC-0107: On app launch with network access, remote changes are pulled and merged into local storage
  - [x] AC-0108: Sync conflicts are surfaced to the user with a merge prompt before overwriting local files
Dependencies: US-0039
```

### EPIC-0013: Multi-Language Editor Support

```
US-0041 (EPIC-0013): As a developer, I want syntax highlighting for Python, Rust, Go, and Swift, so that I can work in my preferred language.
Priority: Medium (P1)
Estimate: M
Status: Done
Branch: feature/EPIC-0013-multi-language
PR: #49 (merged)
Note: Covered by Monaco built-in language grammars + LANG_MAP extension mapping. Superseded in scope by US-0059/US-0060/US-0061.
Acceptance Criteria:
  - [x] AC-0109: Python, Rust, Go, and Swift files receive correct syntax highlighting
  - [x] AC-0110: Language is auto-detected from file extension; unknown extensions fall back to plain text
Dependencies: EPIC-0001

US-0042 (EPIC-0013): As a developer, I want language-correct indentation and auto-close, so that the editor follows language conventions.
Priority: Low (P2)
Estimate: S
Status: Done
Branch: feature/EPIC-0013-multi-language
PR: #49 (merged)
Note: Superseded by US-0059 (indentation) and US-0060 (auto-close), which cover a broader language set with the same ACs.
Acceptance Criteria:
  - [x] AC-0111: Python files default to 4-space indentation; Go files default to tabs
  - [x] AC-0112: Bracket and quote auto-close is active for all supported languages
Dependencies: US-0041
```

### EPIC-0014: Global Search — Find in Files

```
US-0043 (EPIC-0014): As a developer, I want to search across all project files, so that I can find any symbol or string quickly.
Priority: Medium (P1)
Estimate: L
Status: Done
Branch: feature/EPIC-0014-global-search
Acceptance Criteria:
  - [ ] AC-0113: A global search panel can be opened via the command palette or a dedicated toolbar button
  - [ ] AC-0114: Entering a query returns all matching lines across the project file tree
  - [ ] AC-0115: Results are grouped by file with file path, line number, and line preview shown
Dependencies: EPIC-0001, EPIC-0002

US-0044 (EPIC-0014): As a developer, I want to navigate to a search result, so that I can jump directly to the relevant code.
Priority: Medium (P1)
Estimate: S
Status: Done
Branch: feature/EPIC-0014-global-search
Acceptance Criteria:
  - [ ] AC-0116: Tapping a search result opens the file and scrolls to the matching line
  - [ ] AC-0117: The matching text is highlighted in the editor after navigation
Dependencies: US-0043
```

### EPIC-0015: Crash Reporting & Observability

```
US-0045 (EPIC-0015): As a developer, I want crashes reported automatically, so that I can fix production issues quickly.
Priority: High (P0)
Estimate: M
Status: Deferred
Acceptance Criteria:
  - [ ] AC-0118: Unhandled exceptions and crashes are automatically reported to the configured crash reporting service
  - [ ] AC-0119: No PII, user file content, or credentials are included in crash payloads
Dependencies: EPIC-0011

US-0046 (EPIC-0015): As a developer, I want performance metrics tracked, so that I can detect regressions before users do.
Priority: Medium (P1)
Estimate: M
Status: Deferred
Acceptance Criteria:
  - [ ] AC-0120: Cold start time, editor input latency, and memory usage are tracked as named metrics
  - [ ] AC-0121: Performance degradation beyond baseline thresholds (§ 8 of PROJECT.md) triggers an alert
Dependencies: US-0045
```

---

### EPIC-0018: Foldable Device Support

```
US-0064 (EPIC-0018): As a developer using a foldable device (Samsung Galaxy Z Fold, Pixel Fold), I want the app to automatically expand to the full split-pane IDE layout when I unfold the device, so that I can use the entire inner display as a tablet workspace.
Priority: High (P0)
Estimate: M
Status: Done
Acceptance Criteria:
  - [x] AC-0182: When the device is unfolded and the inner display width is ≥ 768 dp, the app renders the split-pane layout (file explorer | editor | terminal) automatically
  - [x] AC-0183: When the device is folded and the cover display width is < 768 dp, the app renders the single-pane layout automatically
  - [x] AC-0184: The transition between folded and unfolded states occurs without an app restart — the layout reflows within the same session
  - [x] AC-0185: Open files, unsaved editor content, and active terminal session are fully preserved across a fold/unfold transition
  - [x] AC-0186: The app respects the device orientation in both folded and unfolded states — no forced landscape lock is applied (resolves BUG-0034)
Dependencies: EPIC-0001, EPIC-0002

US-0065 (EPIC-0018): As a developer, I want the foldable layout to be tested against real device form factors, so that the split-pane expansion works correctly on all major foldable profiles.
Priority: Medium (P1)
Estimate: S
Status: Done
Acceptance Criteria:
  - [x] AC-0187: Layout renders correctly on Samsung Galaxy Z Fold 6 inner display (7.6", ~882 × 2176 px)
  - [x] AC-0188: Layout renders correctly on Google Pixel Fold inner display (7.6", ~1840 × 2208 px)
  - [x] AC-0189: Layout renders correctly on Samsung Galaxy Z Flip 6 cover display (3.4") and main display (6.7") — single-pane on both
  - [x] AC-0190: `TabletResponsive` unit tests cover width breakpoints at 767 dp (single-pane), 768 dp (split-pane), and a mid-transition resize event
Dependencies: US-0064
```

---

### EPIC-0016: Project Templates

```
US-0062 (EPIC-0016): As a developer, I want to create a new project from a starter template, so that I can start coding a common project type immediately without manual scaffolding.
Priority: Medium (P1)
Estimate: M
Status: Deferred
Acceptance Criteria:
  - [ ] AC-0172: A "New Project from Template" option is available from the file explorer header and the command palette
  - [ ] AC-0173: At least 5 templates are offered: React Native (Expo), Node.js, Python, HTML/CSS/JS, and Blank
  - [ ] AC-0174: Selecting a template creates a new directory in the workspace with the appropriate starter files
  - [ ] AC-0175: The new project directory is immediately visible in the file tree after creation
  - [ ] AC-0176: Template scaffolding works fully offline — no network calls are made at project creation time
Dependencies: EPIC-0002
```

---

### EPIC-0017: SSH / Remote Terminal

```
US-0063 (EPIC-0017): As a developer, I want to connect to a remote Linux server over SSH from the terminal panel, so that I can administer servers and run commands remotely from my mobile device.
Priority: Medium (P1)
Estimate: L
Status: Deferred
Acceptance Criteria:
  - [ ] AC-0177: The terminal panel provides a "New SSH Connection" option
  - [ ] AC-0178: The user can configure hostname, port, username, and authentication method (password or private key)
  - [ ] AC-0179: SSH credentials are stored in the platform keychain (iOS Keychain / Android Keystore) — never in plain app storage or logs
  - [ ] AC-0180: The SSH session streams stdout and stderr to the terminal panel in real time
  - [ ] AC-0181: Closing the terminal tab or tapping "Disconnect" cleanly terminates the SSH session on the server
Dependencies: EPIC-0003
```

---

### EPIC-0013: Multi-Language Editor Support

```
US-0059 (EPIC-0013): As a developer, I want the editor to apply language-appropriate indentation settings automatically when I open a file, so that code I type is formatted consistently with the conventions of that language.
Priority: High (P0)
Estimate: S
Status: Done
Branch: feature/EPIC-0013-multi-language
Acceptance Criteria:
  - [x] AC-0156: Python files use tabSize=4, insertSpaces=true, detectIndentation=false
  - [x] AC-0157: Go files use tabSize=4, insertSpaces=false (hard tabs per gofmt)
  - [x] AC-0158: Rust and Swift files use tabSize=4, insertSpaces=true
  - [x] AC-0159: C, C++, C#, F#, Java, and Kotlin files use tabSize=4, insertSpaces=true
  - [x] AC-0160: TypeScript and JavaScript files use tabSize=2, insertSpaces=true
  - [x] AC-0161: Dart, HTML, CSS, JSON, YAML, and Markdown files use tabSize=2, insertSpaces=true
  - [x] AC-0162: detectIndentation is always false — Monaco must not override configured rules
  - [x] AC-0163: When switching tabs, indentation rules for the new tab's language are applied within the same message cycle as the content load
Dependencies: EPIC-0001

US-0060 (EPIC-0013): As a developer, I want language-specific auto-close bracket behaviour, so that bracket and quote completion matches the language I am writing.
Priority: Medium (P1)
Estimate: S
Status: Done
Branch: feature/EPIC-0013-multi-language
Acceptance Criteria:
  - [x] AC-0164: Python files use autoClosingQuotes='languageDefined' (defers to Monaco's built-in Python grammar to avoid doubling quotes inside strings)
  - [x] AC-0165: Ruby, R, HTML, and XML files use autoClosingQuotes='languageDefined'
  - [x] AC-0166: All other supported languages use autoClosingBrackets='always' and autoClosingQuotes='always'
  - [x] AC-0167: Switching from a Python tab to a Go tab updates autoClosingQuotes from 'languageDefined' to 'always'
Dependencies: US-0059

US-0061 (EPIC-0013): As a developer working with Zig, Dart, Lua, Elixir, C#, F#, R, Scala, Perl, PowerShell, Terraform, or Protocol Buffers files, I want NomadCode to recognise those extensions and apply a Monaco language mode and correct indentation.
Priority: Medium (P1)
Estimate: S
Status: Done
Branch: feature/EPIC-0013-multi-language
Acceptance Criteria:
  - [x] AC-0168: .cs → csharp, .fs/.fsx → fsharp, .zig → zig, .dart → dart, .lua → lua, .ex/.exs → elixir, .r/.R → r, .scala → scala, .pl/.pm → perl, .ps1/.psm1 → powershell, .tf/.hcl → hcl, .proto → proto, .ini/.cfg/.env → ini
  - [x] AC-0169: Extension matching is case-insensitive (e.g. App.DART → dart)
  - [x] AC-0170: Vue SFCs (.vue) fall back to html language mode (no dedicated Monaco grammar)
  - [x] AC-0171: jsonc files map to Monaco language ID 'jsonc'; toml files map to 'toml'
Dependencies: US-0059
```

---

### EPIC-0019: Native iOS Folder Picker

```
US-0066 (EPIC-0019): As an iOS user, I want to pick a workspace folder from iCloud Drive, On My iPad, or any File Provider (Dropbox, OneDrive, etc.), so that my NomadCode workspace lives where my other files are and syncs across devices.
Priority: Medium (P1)
Estimate: L
Status: Deferred
Acceptance Criteria:
  - [ ] AC-0196: Custom native iOS module (Swift) wraps UIDocumentPickerViewController in directory-selection mode (.folder UTType on iOS 14+)
  - [ ] AC-0197: Selected folder URL is converted to a security-scoped URL bookmark (NSURL bookmarkData) and persisted so write access survives app relaunches
  - [ ] AC-0198: Before each git write, the module calls startAccessingSecurityScopedResource() and pairs it with stopAccessingSecurityScopedResource() after completion to avoid leaking entitlements
  - [ ] AC-0199: SetupWizard and Settings use the new picker via requestWorkspacePermission() — existing call site unchanged
  - [ ] AC-0200: When the picker is unavailable (e.g. user cancels, iOS < 14), the in-app SandboxDirectoryPicker is offered as fallback
  - [ ] AC-0201: Unit + E2E tests confirm clone/commit/push works in an iCloud Drive folder on a physical device
Dependencies: EPIC-0002
```

---

### EPIC-0020: Advanced Git Workflows

```
US-0068 (EPIC-0020): As a developer, I want to create and switch branches from the mobile UI, so that I can manage feature work without needing a desktop.
Priority: High (P0)
Estimate: M
Status: Planned
Acceptance Criteria:
  - [ ] AC-0207: The Git panel exposes a "New Branch" action that accepts a name and creates the branch locally via isomorphic-git
  - [ ] AC-0208: A branch picker (bottom sheet on phone, sidebar section on tablet) lists local and remote branches and switches HEAD on tap
  - [ ] AC-0209: The active branch name is shown in the status bar and updates immediately after a switch without requiring an app restart
Dependencies: EPIC-0008

US-0069 (EPIC-0020): As a developer, I want a merge conflict resolution UI, so that I can resolve conflicts without leaving the app.
Priority: High (P0)
Estimate: L
Status: Planned
Acceptance Criteria:
  - [ ] AC-0210: Files with merge conflicts are marked with a conflict badge in the File Explorer; tapping opens a 3-panel diff view (ours / base / theirs)
  - [ ] AC-0211: Each conflicted hunk has Accept Ours, Accept Theirs, and Accept Both buttons; accepting a choice writes the resolved content to the file
  - [ ] AC-0212: Once all conflicts are resolved, a "Mark Resolved & Stage" action is available; the conflict badge clears and the file is staged automatically
Dependencies: US-0068

US-0070 (EPIC-0020): As a developer, I want git gutter indicators in the editor, so that I can see which lines have been added, modified, or deleted since the last commit.
Priority: Medium (P1)
Estimate: S
Status: Planned
Acceptance Criteria:
  - [ ] AC-0213: Lines added since HEAD are marked with a green bar in the Monaco gutter; modified lines show amber; deleted positions show a red triangle
  - [ ] AC-0214: Gutter indicators update within 500 ms of saving the file (diff is computed against the HEAD version in isomorphic-git's object store)
  - [ ] AC-0215: Tapping a gutter indicator opens a compact inline diff popup showing the original line(s) with a Revert Hunk action
Dependencies: EPIC-0008

US-0071 (EPIC-0020): As a developer, I want to stash and pop changes, so that I can context-switch without losing work in progress.
Priority: Medium (P1)
Estimate: S
Status: Planned
Acceptance Criteria:
  - [ ] AC-0216: The Git panel has a "Stash Changes" action that stashes all unstaged modifications with an optional message
  - [ ] AC-0217: A stash list shows all named stashes; tapping a stash offers Pop (apply + drop) and Apply (apply, keep stash) actions
  - [ ] AC-0218: Popping or applying a stash updates the working tree and refreshes gutter indicators without requiring a manual refresh
Dependencies: EPIC-0008

US-0072 (EPIC-0020): As a developer, I want to see git blame annotations, so that I can understand the history of each line of code.
Priority: Low (P2)
Estimate: M
Status: Planned
Acceptance Criteria:
  - [ ] AC-0219: A "Toggle Blame" action in the editor toolbar overlays each line with the commit hash, author, and relative timestamp
  - [ ] AC-0220: Tapping a blame annotation opens a detail sheet with the full commit message, author, date, and a "View Diff" link that opens the commit diff
  - [ ] AC-0221: Blame data is loaded asynchronously; a loading skeleton is shown while git log is computed so the editor remains responsive
Dependencies: EPIC-0008
```

---

### EPIC-0021: Advanced Editor Features

```
US-0073 (EPIC-0021): As a developer, I want to search and replace across all files in my project, so that I can do global refactors without a desktop IDE.
Priority: High (P0)
Estimate: M
Status: Planned
Acceptance Criteria:
  - [ ] AC-0222: The Global Search panel (EPIC-0014) gains a Replace field; entering a replacement term and pressing Replace All writes changes to every matching file simultaneously
  - [ ] AC-0223: A preview mode shows all replacements highlighted before confirmation; the developer can exclude individual matches with a checkbox
  - [ ] AC-0224: Replace supports regex with capture groups (e.g. $1); the preview updates in real time as the pattern changes
Dependencies: EPIC-0014

US-0074 (EPIC-0021): As a developer using a hardware keyboard, I want standard shortcuts like ⌘S, ⌘`, ⌘N, and ⌘P, so that I can edit at desktop speed on a tablet.
Priority: High (P0)
Estimate: S
Status: Planned
Acceptance Criteria:
  - [ ] AC-0225: ⌘S saves the current file immediately; ⌘⇧S saves all open dirty files
  - [ ] AC-0226: ⌘` opens/focuses the integrated terminal; pressing again cycles between terminal and editor
  - [ ] AC-0227: ⌘N creates a new untitled file in the editor; ⌘P opens the Command Palette; all shortcuts are discoverable in a Keyboard Shortcuts help sheet
Dependencies: EPIC-0004

US-0075 (EPIC-0021): As a developer, I want to fold and unfold code blocks, so that I can reduce visual noise when navigating large files.
Priority: Medium (P1)
Estimate: S
Status: Planned
Acceptance Criteria:
  - [ ] AC-0228: Monaco gutter displays fold/unfold chevrons for all foldable regions (functions, classes, blocks, comments)
  - [ ] AC-0229: A "Fold All" and "Unfold All" action is available in the editor context menu and Command Palette
  - [ ] AC-0230: Folded state persists per file within a session; reopening a tab restores the previous fold state
Dependencies: EPIC-0001

US-0076 (EPIC-0021): As a developer, I want my code auto-formatted on save, so that I don't have to think about style consistency.
Priority: Medium (P1)
Estimate: M
Status: Planned
Acceptance Criteria:
  - [ ] AC-0231: Prettier (bundled as a WASM module) runs on file save for JS, TS, JSON, CSS, HTML, and Markdown files
  - [ ] AC-0232: Format on save is toggleable in Settings; when disabled, a "Format Document" action is still available in the Command Palette
  - [ ] AC-0233: Prettier config is read from the project root (.prettierrc, prettier.config.js) if present; defaults apply otherwise
Dependencies: EPIC-0001

US-0077 (EPIC-0021): As a developer, I want breadcrumb navigation at the top of the editor, so that I can quickly understand and jump to any scope in a large file.
Priority: Low (P2)
Estimate: S
Status: Planned
Acceptance Criteria:
  - [ ] AC-0234: A breadcrumb bar above the editor shows the file path segments and the current symbol hierarchy (e.g. File › ClassName › methodName)
  - [ ] AC-0235: Tapping any breadcrumb segment opens a picker listing sibling symbols at that depth; selecting one navigates the cursor to that symbol
  - [ ] AC-0236: Breadcrumbs update within one animation frame of moving the cursor to a new symbol
Dependencies: EPIC-0001

US-0078 (EPIC-0021): As a developer, I want snippet expansion, so that I can scaffold common patterns with a short prefix.
Priority: Low (P2)
Estimate: M
Status: Planned
Acceptance Criteria:
  - [ ] AC-0237: Built-in snippets for JS/TS (e.g. `clg` → console.log, `afn` → arrow function), Python (`def`, `cls`), and React (`rfc`, `useEffect`) ship with the app
  - [ ] AC-0238: Users can define custom snippets in Settings using a JSON schema; snippets support tab stops ($1, $2) and default values ($\{1:name\})
  - [ ] AC-0239: Snippets appear in Monaco's autocomplete list with a snippet icon; Tab accepts the first suggestion matching the typed prefix
Dependencies: EPIC-0001
```

---

### EPIC-0022: Code Navigation

```
US-0079 (EPIC-0022): As a developer, I want Go to Definition, so that I can jump to where a symbol is declared without manual searching.
Priority: High (P0)
Estimate: M
Status: Planned
Acceptance Criteria:
  - [ ] AC-0240: Long-pressing a symbol opens a context menu with "Go to Definition"; tapping navigates the editor to the declaration line, opening the file if necessary
  - [ ] AC-0241: ⌘Click (hardware keyboard) also triggers Go to Definition inline with VS Code muscle memory
  - [ ] AC-0242: If the definition is in an external node_modules package, a read-only preview of the declaration is shown in an overlay panel rather than opening the file
Dependencies: EPIC-0001

US-0080 (EPIC-0022): As a developer, I want Find All References, so that I can see every place a symbol is used before renaming or deleting it.
Priority: High (P0)
Estimate: M
Status: Planned
Acceptance Criteria:
  - [ ] AC-0243: "Find All References" in the symbol context menu opens a References panel listing every usage grouped by file with line previews
  - [ ] AC-0244: Tapping any result navigates to that line in the editor; the panel stays open so the developer can step through each reference
  - [ ] AC-0245: Result count is shown in the panel header; empty results display a "No references found" state rather than crashing or silently closing
Dependencies: US-0079

US-0081 (EPIC-0022): As a developer, I want workspace symbol search, so that I can jump to any function or class by name without knowing which file it's in.
Priority: Medium (P1)
Estimate: S
Status: Planned
Acceptance Criteria:
  - [ ] AC-0246: The Command Palette gains a "Go to Symbol in Workspace" action (⌘T shortcut on hardware keyboard) that fuzzy-searches all exported symbols across all project files
  - [ ] AC-0247: Results show symbol name, type (function/class/variable), and file path; selecting one navigates directly to the declaration
  - [ ] AC-0248: Symbol index is built lazily on first use and refreshed on file save; an incremental spinner indicates a background refresh without blocking the UI
Dependencies: EPIC-0004, US-0079
```

---

### EPIC-0023: AI Code Intelligence

```
US-0082 (EPIC-0023): As a developer, I want to select code and describe a change in plain language, so that I can make AI-driven edits without leaving the editor.
Priority: High (P0)
Estimate: L
Status: Planned
Acceptance Criteria:
  - [ ] AC-0249: Selecting a code range and invoking "AI Edit" (⌘K on hardware keyboard or long-press context menu) opens an inline prompt bar above the selection
  - [ ] AC-0250: After the developer types an instruction and submits, the AI returns a diff which is applied in a preview mode — Accept and Reject buttons confirm or discard
  - [ ] AC-0251: The inline AI edit is only available to Pro+AI subscribers; Free and Pro users see an upgrade prompt when invoking the action
Dependencies: EPIC-0010

US-0083 (EPIC-0023): As a developer, I want to define project-scoped AI instructions, so that AI suggestions follow my team's conventions without me repeating them every session.
Priority: Medium (P1)
Estimate: S
Status: Planned
Acceptance Criteria:
  - [ ] AC-0252: A `.nomadcode/ai-rules.md` file in the project root is automatically loaded as system context for all AI requests in that project
  - [ ] AC-0253: The Settings screen exposes a global "AI Rules" editor for rules that apply across all projects; project-level rules override global rules where they conflict
  - [ ] AC-0254: AI rules are never sent to the AI provider if the session has privacy mode enabled (US-0091); a banner informs the user that rules are suppressed
Dependencies: EPIC-0010

US-0084 (EPIC-0023): As a developer, I want AI-generated commit messages, so that I can write better commit history with less effort.
Priority: Medium (P1)
Estimate: S
Status: Planned
Acceptance Criteria:
  - [ ] AC-0255: The Git Commit panel has a "Generate Message" button that sends the staged diff to the AI and populates the message field with a conventional-commit formatted summary
  - [ ] AC-0256: The developer can regenerate or manually edit the suggestion before committing; the generated text is never committed automatically
  - [ ] AC-0257: The feature is gated behind Pro+AI; Free/Pro users see a disabled button with an upgrade tooltip
Dependencies: EPIC-0010, EPIC-0008

US-0085 (EPIC-0023): As a power user, I want to choose which AI model powers my completions and chat, so that I am not locked into a single provider.
Priority: Medium (P1)
Estimate: M
Status: Planned
Acceptance Criteria:
  - [ ] AC-0258: Settings exposes a Model Picker with options for Claude (default), GPT-4o, and Gemini 1.5 Pro; selecting one updates all subsequent AI requests
  - [ ] AC-0259: Each provider requires the user to enter their own API key; keys are stored in the platform keychain (iOS Keychain / Android Keystore)
  - [ ] AC-0260: If the selected provider returns an authentication error, a non-blocking banner prompts the user to re-enter their key; the previous working provider is used as fallback
Dependencies: EPIC-0010
```

---

### EPIC-0024: Language Server Protocol

```
US-0086 (EPIC-0024): As a developer, I want a TypeScript language server running in a WASM worker, so that I get accurate completions and type information without a server round-trip.
Priority: High (P0)
Estimate: XL
Status: Planned
Acceptance Criteria:
  - [ ] AC-0261: TypeScript language server (typescript-language-server compiled to WASM) initialises in a Web Worker within 3 s of opening the first .ts or .tsx file
  - [ ] AC-0262: The LSP worker communicates with the Monaco editor via the Language Client protocol; completions, hover docs, and go-to-definition results are served from the worker
  - [ ] AC-0263: The WASM bundle is shipped with the app (not downloaded at runtime) to comply with App Store §2.5.2 and Google Play equivalent
Dependencies: EPIC-0022

US-0087 (EPIC-0024): As a developer, I want IntelliSense completions, so that I get context-aware suggestions including imported symbols, methods, and types.
Priority: High (P0)
Estimate: L
Status: Planned
Acceptance Criteria:
  - [ ] AC-0264: Typing in a .ts file triggers LSP-powered completions within 200 ms; suggestions include local variables, imported symbols, and type members
  - [ ] AC-0265: Hovering (or long-pressing on touch) a symbol shows a hover card with the TypeScript type signature and JSDoc documentation if available
  - [ ] AC-0266: Completions rank exact-match prefixes highest; accepted completions auto-import the module if not already imported
Dependencies: US-0086

US-0088 (EPIC-0024): As a developer, I want real-time error and warning squiggles, so that I can see type errors without running the compiler.
Priority: High (P0)
Estimate: M
Status: Planned
Acceptance Criteria:
  - [ ] AC-0267: TypeScript diagnostics from the LSP worker are rendered as red (error) or amber (warning) squiggles under the relevant tokens in the editor
  - [ ] AC-0268: Tapping a squiggle opens an inline tooltip with the error message, error code, and a "Quick Fix" button when an LSP code action is available
  - [ ] AC-0269: A Problems panel (accessible from the status bar) lists all errors and warnings across open files; tapping an entry navigates to the offending line
Dependencies: US-0087
```

---

### EPIC-0025: AI Codebase Indexing

```
US-0089 (EPIC-0025): As a developer, I want my project indexed semantically, so that the AI understands the full codebase — not just the current file.
Priority: High (P0)
Estimate: XL
Status: Planned
Acceptance Criteria:
  - [ ] AC-0270: On first open of a project, a background indexer computes vector embeddings for all source files (JS, TS, Python, Go, Swift, Kotlin) using a bundled embedding model
  - [ ] AC-0271: The index is stored on-device in SQLite (using the sqlite-vec extension); incremental re-indexing runs on file save, touching only changed files
  - [ ] AC-0272: A status bar indicator shows indexing progress; the AI features degrade gracefully (file-only context) until indexing completes
Dependencies: EPIC-0010, EPIC-0002

US-0090 (EPIC-0025): As a developer, I want to reference @file and @codebase in AI chat, so that the AI can answer questions about specific files or the whole project.
Priority: High (P0)
Estimate: L
Status: Planned
Acceptance Criteria:
  - [ ] AC-0273: Typing @ in the AI chat panel opens a completion picker showing project files; selecting one appends its content (up to 8 k tokens) to the AI context
  - [ ] AC-0274: @codebase triggers a semantic search of the index and appends the top-5 most relevant chunks to the AI context automatically
  - [ ] AC-0275: Token budget for attached context is displayed in the chat input bar; exceeding the limit truncates the oldest attachment first and shows a warning
Dependencies: US-0089, EPIC-0010

US-0091 (EPIC-0025): As a developer working with sensitive code, I want a privacy mode that disables codebase indexing and AI context upload, so that proprietary code never leaves my device.
Priority: Medium (P1)
Estimate: S
Status: Planned
Acceptance Criteria:
  - [ ] AC-0276: A per-project Privacy Mode toggle in Settings disables all indexing and suppresses any code context from being sent to external AI providers
  - [ ] AC-0277: When Privacy Mode is on, AI completions and chat fall back to prompt-only mode; a persistent banner reminds the user that context is limited
  - [ ] AC-0278: Privacy Mode state is stored locally and is never synced to cloud storage; it defaults to off for new projects
Dependencies: US-0089
```

---

### EPIC-0026: Mobile Debugging

```
US-0092 (EPIC-0026): As a developer, I want to set breakpoints in the editor, so that I can pause execution and inspect state at any line.
Priority: High (P0)
Estimate: XL
Status: Planned
Acceptance Criteria:
  - [ ] AC-0279: Tapping the Monaco gutter toggles a breakpoint indicator (red dot); the breakpoint is registered with the WASI debug adapter
  - [ ] AC-0280: When execution hits a breakpoint, the editor scrolls to the paused line and highlights it; a debug toolbar (Continue, Step Over, Step Into, Step Out) appears
  - [ ] AC-0281: Breakpoints persist across sessions in a per-project SQLite store; they are automatically removed if the file is deleted
Dependencies: EPIC-0003, EPIC-0024

US-0093 (EPIC-0026): As a developer, I want a Watch panel, so that I can monitor specific expressions as I step through code.
Priority: Medium (P1)
Estimate: M
Status: Planned
Acceptance Criteria:
  - [ ] AC-0282: The Debug sidebar has a Watch panel where the developer can add any expression; expressions are re-evaluated at each breakpoint pause
  - [ ] AC-0283: Watch expressions that resolve to objects display an expandable tree; primitive values show inline
  - [ ] AC-0284: Adding a watch expression while not paused shows a "Waiting for breakpoint" placeholder; it evaluates automatically at the next pause
Dependencies: US-0092

US-0094 (EPIC-0026): As a developer, I want a call stack panel, so that I can understand how execution reached the current breakpoint.
Priority: Medium (P1)
Estimate: M
Status: Planned
Acceptance Criteria:
  - [ ] AC-0285: When paused, the Call Stack panel lists all active frames with function name, file, and line number
  - [ ] AC-0286: Tapping a frame navigates the editor to that line and updates the Watch and Variables panels to reflect that frame's scope
  - [ ] AC-0287: Async frames are visually distinguished from synchronous frames with an italic label and a different colour
Dependencies: US-0092

US-0095 (EPIC-0026): As a developer, I want a debug console, so that I can evaluate expressions and see console output while paused.
Priority: Medium (P1)
Estimate: M
Status: Planned
Acceptance Criteria:
  - [ ] AC-0288: The Debug Console panel streams console.log / print / fmt.Println output from the running process in real time
  - [ ] AC-0289: An input bar at the bottom accepts REPL-style expressions; results are printed inline in the console stream
  - [ ] AC-0290: Console output is colour-coded: stdout in default text, stderr in coral (#EF4444), and evaluated results in teal (#0D9488)
Dependencies: US-0092
```

---

### EPIC-0027: Collaboration & Sharing

```
US-0096 (EPIC-0027): As a developer using multiple devices, I want my settings synced, so that my theme, keybindings, and AI rules are consistent everywhere.
Priority: Medium (P1)
Estimate: M
Status: Planned
Acceptance Criteria:
  - [ ] AC-0291: Editor settings (theme, font size, keybindings, AI rules) are serialised to JSON and synced to the user's cloud storage bucket on change (EPIC-0012)
  - [ ] AC-0292: On app launch, the latest settings JSON is fetched and applied before the editor renders; a conflict (two devices edited at the same time) shows a merge diff
  - [ ] AC-0293: Settings sync is opt-in and off by default; a Settings screen toggle enables it and shows the last sync timestamp
Dependencies: EPIC-0012

US-0097 (EPIC-0027): As a developer, I want to share a code snippet as a public link, so that I can quickly show colleagues a piece of code without setting up a gist manually.
Priority: Low (P2)
Estimate: M
Status: Planned
Acceptance Criteria:
  - [ ] AC-0294: Selecting a code range and choosing "Share Snippet" generates a short URL pointing to a syntax-highlighted, read-only web page hosted by NomadCode's share service
  - [ ] AC-0295: The share URL is valid for 30 days and includes the language, filename, and highlighted range; the developer can extend or revoke it from Settings › Shared Snippets
  - [ ] AC-0296: Shared snippets contain no auth tokens or personal data beyond the code content; the share service stores only the snippet and expiry timestamp
Dependencies: EPIC-0007

US-0098 (EPIC-0027): As a developer, I want to invite a collaborator to view my session in real time, so that we can pair-program without screen sharing overhead.
Priority: Low (P2)
Estimate: XL
Status: Planned
Acceptance Criteria:
  - [ ] AC-0297: The host generates a session invite link from the Collaboration menu; the collaborator opens it in NomadCode (or browser) and sees the editor state in real time (read-only by default)
  - [ ] AC-0298: The host can grant edit access to one collaborator at a time; cursors are shown with name labels in distinct colours; concurrent edits are resolved with operational transforms
  - [ ] AC-0299: The session is end-to-end encrypted (WebRTC DTLS); no code is stored on NomadCode servers — the relay only forwards encrypted packets between peers
Dependencies: EPIC-0012, EPIC-0007
```

---

## Tasks (Phase 1 — Immediate)

```
TASK-0001 (US-0002): Implement CodeMirror 6 in WebView for syntax-highlighted editing
Type: Dev
Assignee: Agent
Status: Done
Notes: Superseded — Monaco Editor v0.45.0 adopted instead of CodeMirror 6 (better mobile WebView support). Syntax highlighting and language detection implemented in EPIC-0001/0013.

TASK-0002 (US-0001): Wire FileSystemBridge to Expo FileSystem for real file read/write
Type: Dev
Assignee: Agent
Status: Done
Branch: feature/US-0001-open-file
Notes: FileSystemBridge fully wired to expo-file-system (readFile, writeFile, listDirectory, etc). FileExplorer and App.tsx openFile() wired end-to-end. Path breadcrumb added to Editor. All ACs met.

TASK-0003 (US-0001, US-0002): Achieve 80% unit test coverage on all Phase 1 components
Type: Test
Assignee: Agent
Status: Done
Notes: 80% coverage threshold enforced in CI across all suites. 802+ tests passing as of Session 10.

TASK-0004 (Infrastructure): Set up develop branch and branch protection rules on GitHub
Type: Infra
Assignee: Agent
Status: Done
Notes: develop branch created; branch protection on main and develop enabled at project setup.
```

---

## Release Milestones

| Release | Description | Key Epics | Target Date |
|---|---|---|---|
| v0.1 Internal Alpha | Core editor + file system on tablet | EPIC-0001, EPIC-0002 | TBD |
| v0.5 Public Beta | Full feature set for TestFlight/Play Beta | EPIC-0003, EPIC-0004 | TBD |
| v1.0 GA | Extensions, auth, git, IAP, AI, advanced git workflows, App Store launch | EPIC-0005, EPIC-0007, EPIC-0008, EPIC-0009, EPIC-0010, EPIC-0011, EPIC-0020 | TBD |
| v1.1 Post-Launch | Cloud sync, multi-language, search, advanced editor, code nav, AI intelligence | EPIC-0012, EPIC-0013, EPIC-0014, EPIC-0015, EPIC-0021, EPIC-0022, EPIC-0023 | TBD |
| v1.2 Post-Launch | LSP, AI indexing, mobile debugging, collaboration | EPIC-0024, EPIC-0025, EPIC-0026, EPIC-0027 | TBD |
| v1.2 | Foldable device support, project templates, SSH/remote terminal | EPIC-0016, EPIC-0017, EPIC-0018 | TBD |
