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
Status: In Progress
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
Status: Planned
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
Status: Deferred
Dependencies: EPIC-0007

EPIC-0013: Multi-Language Editor Support
Description: Per-language indentation rules, auto-close behaviour, and comprehensive VSCode-compatible extension coverage (C, C++, C#, F#, TypeScript, JavaScript, Python, Rust, Go, Swift, Dart/Flutter, Lua, Elixir, R, Scala, Perl, Terraform, PowerShell, and more).
Release Target: Release 1.1 (Post-Launch)
Status: In Progress
Dependencies: EPIC-0001

EPIC-0014: Global Search — Find in Files
Description: Cross-project full-text search panel with result grouping by file, line preview, and navigate-to-line.
Release Target: Release 1.1 (Post-Launch)
Status: Deferred
Dependencies: EPIC-0001, EPIC-0002

EPIC-0015: Crash Reporting & Observability
Description: Automated crash reporting via Sentry/Bugsnag and performance metric tracking (cold start, latency, memory) with alerting.
Release Target: Release 1.1 (Post-Launch)
Status: Deferred
Dependencies: EPIC-0011
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
Status: Planned
Acceptance Criteria:
  - [ ] AC-0071: User can enter a GitHub repository URL and initiate a clone to local storage
  - [ ] AC-0072: Clone progress is shown via a progress indicator; errors surface a readable message
  - [ ] AC-0073: Cloned repo appears in the file explorer immediately on completion
Dependencies: EPIC-0007

US-0026 (EPIC-0008): As a developer, I want to stage and commit changes, so that I can record my work in git history.
Priority: High (P0)
Estimate: M
Status: Planned
Acceptance Criteria:
  - [ ] AC-0074: Modified files are listed in the git status panel with staged/unstaged indicators
  - [ ] AC-0075: Tapping a file checkbox toggles it between staged and unstaged
  - [ ] AC-0076: Entering a commit message and confirming creates a local commit
Dependencies: US-0025

US-0027 (EPIC-0008): As a developer, I want to push and pull from remote, so that I can collaborate with my team.
Priority: High (P0)
Estimate: M
Status: Planned
Acceptance Criteria:
  - [ ] AC-0077: Tapping Push sends local commits to the remote using the stored OAuth token
  - [ ] AC-0078: Tapping Pull fetches and merges remote changes into the working directory
Dependencies: US-0026

US-0028 (EPIC-0008): As a developer, I want to view file diffs, so that I can review changes before committing.
Priority: Medium (P1)
Estimate: M
Status: Planned
Acceptance Criteria:
  - [ ] AC-0079: Tapping a modified file in the git status panel shows an inline diff view
  - [ ] AC-0080: Added lines are highlighted green; removed lines are highlighted red
Dependencies: US-0026

US-0029 (EPIC-0008): As a developer, I want to create and switch branches, so that I can work on features in isolation.
Priority: Medium (P1)
Estimate: M
Status: Planned
Acceptance Criteria:
  - [ ] AC-0081: Current branch name is visible in the status bar
  - [ ] AC-0082: User can create a new branch from the current HEAD via the branch panel
  - [ ] AC-0083: User can switch to an existing local branch without losing uncommitted changes
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
Status: Deferred
Acceptance Criteria:
  - [ ] AC-0105: User can connect an S3-compatible bucket by entering endpoint URL and access credentials in settings
  - [ ] AC-0106: Modified local files are uploaded to the configured bucket automatically on save
Dependencies: EPIC-0007

US-0040 (EPIC-0012): As a developer, I want to download remote changes on launch, so that my files are always up to date.
Priority: Medium (P1)
Estimate: L
Status: Deferred
Acceptance Criteria:
  - [ ] AC-0107: On app launch with network access, remote changes are pulled and merged into local storage
  - [ ] AC-0108: Sync conflicts are surfaced to the user with a merge prompt before overwriting local files
Dependencies: US-0039
```

### EPIC-0013: Multi-Language Editor Support

```
US-0041 (EPIC-0013): As a developer, I want syntax highlighting for Python, Rust, Go, and Swift, so that I can work in my preferred language.
Priority: Medium (P1)
Estimate: M
Status: Deferred
Acceptance Criteria:
  - [ ] AC-0109: Python, Rust, Go, and Swift files receive correct syntax highlighting
  - [ ] AC-0110: Language is auto-detected from file extension; unknown extensions fall back to plain text
Dependencies: EPIC-0001

US-0042 (EPIC-0013): As a developer, I want language-correct indentation and auto-close, so that the editor follows language conventions.
Priority: Low (P2)
Estimate: S
Status: Deferred
Acceptance Criteria:
  - [ ] AC-0111: Python files default to 4-space indentation; Go files default to tabs
  - [ ] AC-0112: Bracket and quote auto-close is active for all supported languages
Dependencies: US-0041
```

### EPIC-0014: Global Search — Find in Files

```
US-0043 (EPIC-0014): As a developer, I want to search across all project files, so that I can find any symbol or string quickly.
Priority: Medium (P1)
Estimate: L
Status: Deferred
Acceptance Criteria:
  - [ ] AC-0113: A global search panel can be opened via the command palette or a dedicated toolbar button
  - [ ] AC-0114: Entering a query returns all matching lines across the project file tree
  - [ ] AC-0115: Results are grouped by file with file path, line number, and line preview shown
Dependencies: EPIC-0001, EPIC-0002

US-0044 (EPIC-0014): As a developer, I want to navigate to a search result, so that I can jump directly to the relevant code.
Priority: Medium (P1)
Estimate: S
Status: Deferred
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
| v1.0 GA | Extensions, auth, git, IAP, AI, App Store launch | EPIC-0005, EPIC-0007, EPIC-0008, EPIC-0009, EPIC-0010, EPIC-0011 | TBD |
| v1.1 Post-Launch | Cloud sync, multi-language, global search, observability | EPIC-0012, EPIC-0013, EPIC-0014, EPIC-0015 | TBD |
