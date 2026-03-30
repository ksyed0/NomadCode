# BUGS.md — NomadCode Bug Tracker (Plan Visualizer Source)

> Machine-readable format consumed by `tools/lib/parse-bugs.js`.
> Human-readable extended notes are in the root `BUGS.md`.

BUG-0001: onRequestClose fires first command on Android back (CP-1)
Severity: High
Related Story: US-0015
Related Task:
Steps to Reproduce:
  1. Open CommandPalette
  2. Press Android hardware back button
Expected: Palette closes without side effects
Actual: First command in the list is silently invoked
Status: Fixed
Fix Branch: feature/epic-0004-command-palette
Lesson Encoded: No

BUG-0002: Backdrop press does not close the palette (CP-2)
Severity: Medium
Related Story: US-0015
Related Task:
Steps to Reproduce:
  1. Open CommandPalette
  2. Tap outside the panel (backdrop area)
Expected: Palette closes
Actual: Keyboard dismisses but palette remains visible
Status: Fixed
Fix Branch: feature/epic-0004-command-palette
Lesson Encoded: No

BUG-0003: AC-0046, AC-0048, AC-0053 had no explicit tests (CP-3)
Severity: Low
Related Story: US-0015
Related Task:
Steps to Reproduce:
  1. Review CommandPalette test file before EPIC-0004 rebuild
Expected: All ACs have named test cases
Actual: Three ACs (auto-focus, backdrop dismiss, no-badge) lacked direct tests
Status: Fixed
Fix Branch: feature/epic-0004-command-palette
Lesson Encoded: No

BUG-0004: Lines 79-83 of CommandPalette.tsx were uncovered by tests (CP-4)
Severity: Low
Related Story: US-0015
Related Task:
Steps to Reproduce:
  1. Run test coverage before EPIC-0004 rebuild
Expected: onRequestClose and backdrop onPress covered
Actual: Both callbacks shown as uncovered in report
Status: Fixed
Fix Branch: feature/epic-0004-command-palette
Lesson Encoded: No

BUG-0006: EXPO_PUBLIC_GITHUB_CLIENT_SECRET bundled in app binary; env name mismatch (AUTH-1)
Severity: Critical
Related Story: US-0022
Related Task:
Steps to Reproduce:
  1. Build the Expo app with EXPO_PUBLIC_GITHUB_CLIENT_SECRET set in .env
  2. Unpack the JS bundle — client_secret is readable in plain text
  3. OR follow .env.example (GITHUB_CLIENT_SECRET) — OAuth silently fails with empty secret
Expected: Client secret stays server-side; OAuth sign-in works
Actual: Secret bundled into binary; or OAuth silently fails due to env name mismatch
Status: Fixed
Fix Branch: feature/epic-0007-auth
Lesson Encoded: No

BUG-0007: useAutoDiscovery('https://github.com') always returns null — OAuth button non-functional (AUTH-2)
Severity: High
Related Story: US-0022
Related Task:
Steps to Reproduce:
  1. Open SettingsScreen and press "Sign in with GitHub"
Expected: Browser opens to GitHub OAuth authorization page
Actual: Nothing happens — request is null because GitHub has no OIDC discovery document
Status: Fixed
Fix Branch: feature/epic-0007-auth
Lesson Encoded: No

BUG-0008: Empty catch block in exchangeCode silently discards all OAuth errors (AUTH-3)
Severity: Medium
Related Story: US-0022
Related Task:
Steps to Reproduce:
  1. Trigger OAuth flow on a device with no network
  2. Complete authorization — app receives auth code but token exchange fetch throws
Expected: User sees an error message
Actual: Error silently swallowed; no feedback shown; authError never set
Status: Fixed
Fix Branch: feature/epic-0007-auth
Lesson Encoded: No

BUG-0009: Landscape-locked app crashes on iPhone simulator when SetupWizard Modal is presented (SIM-1)
Severity: Medium
Related Story:
Related Task:
Steps to Reproduce:
  1. Run app via Expo Go on iPhone simulator (any iPhone model)
  2. Wait ~10 seconds for Zustand store to hydrate
  3. SetupWizard Modal becomes visible
Expected: Modal opens normally
Actual: SIGABRT crash in -[UIViewController __supportedInterfaceOrientations] during modal presentation
Root Cause: iOS 16+ throws when a modal is presented in a landscape-locked app on iPhone; iPads handle this correctly
Status: Fixed
Fix Branch: bugfix/batch-open-bugs
Notes: Resolved by BUG-0034 — landscape lock removed from app.json and Info.plist portrait orientation added eliminates the iOS 16+ modal SIGABRT.
Lesson Encoded: No

BUG-0005: No swipe gesture trigger for command palette (CP-5)
Severity: Low
Related Story: US-0015
Related Task:
Steps to Reproduce:
  1. Attempt to open palette via downward swipe on editor pane
Expected: Palette opens
Actual: No swipe handler existed; only FAB button worked
Status: Fixed
Fix Branch: feature/epic-0004-command-palette
Lesson Encoded: No

BUG-0010: node command exposes window.ReactNativeWebView to user scripts (TERM-1)
Severity: High
Related Story: US-0052
Related Task:
Steps to Reproduce:
  1. Write a JS file containing: window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'FILE_WRITE', requestId: 'x', path: '/sensitive', content: 'injected' }))
  2. Run: node /hack.js in terminal
Expected: User script cannot access native bridge
Actual: Script can forge arbitrary FILE_WRITE/FILE_READ messages directly to the native bridge, bypassing all dispatch() guards
Root Cause: new Function('console', 'require', code) shadows console and require but leaves full WebView global scope accessible including window.ReactNativeWebView
Status: Fixed
Fix Branch: feature/epic-0003-terminal
Lesson Encoded: No

BUG-0011: Silent undefined spread in FileBridge.handleMessage for unknown message types (TERM-2)
Severity: High
Related Story: US-0052
Related Task:
Steps to Reproduce:
  1. WebView sends a message with an unrecognised type (e.g. future protocol extension or malformed data)
  2. useTerminalBridge passes it to FileBridge.handleMessage
Expected: Error logged, message dropped safely
Actual: switch falls through with fileResult unassigned; spread of undefined produces FILE_RESULT with no result/error fields; vfsRead silently resolves to '' instead of rejecting
Root Cause: No guard for unrecognised message types before FileBridge.handleMessage call in useTerminalBridge
Status: Fixed
Fix Branch: feature/epic-0003-terminal
Lesson Encoded: No

BUG-0012: resolvePath does not normalise .. segments (TERM-3)
Severity: Medium
Related Story: US-0050
Related Task:
Steps to Reproduce:
  1. cd .. in terminal
  2. Run pwd
Expected: /foo (parent directory)
Actual: /foo/bar/.. (unnormalised path compounds with subsequent operations)
Root Cause: resolvePath concatenates segments without resolving .. — Expo FileSystem handles it at OS level but isomorphic-git string-comparison logic and pwd output are incorrect
Status: Fixed
Fix Branch: feature/epic-0003-terminal
Lesson Encoded: No

BUG-0013: TypeScript strict-mode implicit any errors in terminal dispatcher (TERM-4)
Severity: Medium
Related Story: US-0052
Related Task:
Steps to Reproduce:
  1. Run tsc --noEmit in mobile-ide/mobile-ide-prototype
Expected: No type errors
Actual: TS7031/TS7006 implicit any on statusMatrix destructuring and git.log callback parameter in src/terminal/bundle/index.ts
Root Cause: Destructure pattern lacks explicit type annotation on statusMatrix row and git.log commit parameter
Status: Fixed
Fix Branch: feature/epic-0003-terminal
Lesson Encoded: No

BUG-0014: npm run depth guard has no test coverage (TERM-5)
Severity: Low
Related Story: US-0053
Related Task:
Steps to Reproduce:
  1. Write package.json with: { "scripts": { "loop": "npm run loop" } }
  2. Run: npm run loop
Expected: Error after 5 levels of recursion with clear message
Actual: Behavior is correct (depth guard fires) but no test verifies this — confirmed by absence of TC-0342/TC-0343 in dispatch.test.ts
Root Cause: Depth guard test case skipped in Task 5 implementation
Status: Fixed
Fix Branch: feature/epic-0003-terminal
Lesson Encoded: No

BUG-0015: expo-crypto missing from package.json causes app entry not found crash on Android (ANDROID-1)
Severity: Critical
Related Story:
Related Task:
Steps to Reproduce:
  1. Build Android APK with expo run:android
  2. Launch app on device/emulator
Expected: App loads normally
Actual: "App entry not found — The app entry point named 'main' was not registered" crash screen; JS bundle crashes before AppRegistry.registerComponent because expo-auth-session's top-level import calls requireNativeModule('ExpoCrypto') which is absent
Root Cause: expo-auth-session@~6.0.3 peer-depends on expo-crypto but expo-crypto was not in package.json; native module ExpoCrypto was never compiled into the APK by Gradle autolinking
Status: Fixed
Fix Branch: develop
Lesson Encoded: No

BUG-0016: Terminal dist bundle stale — all commands return "command not found" (TERM-6)
Severity: High
Related Story:
Related Task:
Steps to Reproduce:
  1. Open the in-app terminal
  2. Type any command (ls, pwd, git status, etc.)
Expected: Command executes
Actual: All commands return "command not found"; git, ls, pwd are in index.ts but not in dist/terminal.js
Root Cause: dist/terminal.js was an older build that contained only the command-not-found fallback; npm run build:terminal had not been run after index.ts was updated with the full command dispatcher
Status: Fixed
Fix Branch: develop
Lesson Encoded: No

BUG-0017: No visible "New File" button in FileExplorer header (UX-1)
Severity: Medium
Related Story:
Related Task:
Steps to Reproduce:
  1. Open the app and complete setup
  2. Look at the file explorer sidebar
Expected: Visible "+" button or equivalent to create a new file
Actual: No button in header; "New File" only accessible via long-press on an existing item which opens a context menu — completely undiscoverable on first use
Status: Fixed
Fix Branch: develop
Lesson Encoded: No

BUG-0018: onFileCreate not wired in App.tsx — new files do not auto-open in editor (UX-2)
Severity: Medium
Related Story:
Related Task:
Steps to Reproduce:
  1. Long-press a file/folder in FileExplorer
  2. Choose "New File" → enter a name → confirm
Expected: File is created and automatically opens in the editor
Actual: File is created on disk but the editor does not open it; onFileCreate prop is optional and App.tsx does not pass a handler
Status: Fixed
Fix Branch: develop
Lesson Encoded: No

BUG-0019: "File: New File" command missing from command palette (UX-3)
Severity: Low
Related Story:
Related Task:
Steps to Reproduce:
  1. Open command palette (⌘ FAB)
  2. Type "new" or "file"
Expected: "File: New File" command appears
Actual: "No commands found" — palette only has Save, Close Tab, Toggle Terminal, Git Status, Git Commit
Status: Fixed
Fix Branch: develop
Lesson Encoded: No

BUG-0020: App.tsx wires Terminal.tsx stub instead of TerminalWebView (TERM-7)
Severity: High
Related Story:
Related Task:
Steps to Reproduce:
  1. Open the in-app terminal (>_ FAB)
  2. Type git status, touch test.ts, or any command not in (help, clear, pwd, ls, cd, echo)
Expected: Command executes via VFS-backed dispatch (touch, git, cat, mkdir, rm, etc.)
Actual: bash: [command]: command not found — Terminal.tsx stub hardcoded default fires for all unrecognised commands
Root Cause: App.tsx imports Terminal from ./src/components/Terminal (deprecated stub, @deprecated since TerminalWebView was written) instead of TerminalWebView; Terminal.tsx has no VFS bridge, no git, no touch support
Status: Fixed
Fix Branch: develop
Lesson Encoded: No

BUG-0021: git status throws "Cannot read properties of undefined (reading 'bind')" in terminal (TERM-8)
Severity: Medium
Related Story:
Related Task:
Steps to Reproduce:
  1. Open the in-app terminal (>_ FAB)
  2. Type: git status
Expected: Shows working-tree status or "Could not find git repo" error message
Actual: git: Cannot read properties of undefined (reading 'bind') — isomorphic-git fails at runtime
Root Cause: isomorphic-git's bindFs() iterates a hardcoded commands array (readFile, writeFile, mkdir, rmdir, unlink, stat, lstat, readdir, readlink, symlink) and calls .bind() on each during FileSystem construction. gitFs.promises was missing readlink and symlink, so undefined.bind() threw before any git operation ran
Status: Fixed
Fix Branch: develop
Lesson Encoded: No

BUG-0022: Terminal cwd stays at "/" — ls / returns empty, touch creates files at wrong path (TERM-9)
Severity: Medium
Related Story:
Related Task:
Steps to Reproduce:
  1. Open the in-app terminal (>_ FAB)
  2. Type: touch hello.ts — appears to succeed
  3. Type: ls — returns empty
  4. Type: pwd — shows /
Expected: cwd = Expo documentDirectory; ls shows created files; pwd shows real path
Actual: cwd remains "/" because SET_CWD is sent via useEffect before webViewRef.current is populated; injectJavaScript silently drops the message via optional chaining
Root Cause: TerminalWebView sends SET_CWD in useEffect on mount, but WebView bridge is not ready at that point (webViewRef.current is null). The message is silently dropped. Adding onLoadEnd handler guarantees SET_CWD delivery after the WebView has fully loaded.
Status: Fixed
Fix Branch: develop
Lesson Encoded: No

BUG-0023: sendToWebView injects JS object literal; receiveFromRN calls JSON.parse — all messages silently fail (TERM-10)
Severity: Critical
Related Story: US-0047
Related Task:
Steps to Reproduce:
  1. Open the in-app terminal
  2. Run any command requiring VFS (ls, cat, touch, git status)
Expected: Command executes and returns output
Actual: All VFS operations hang or return empty; SET_CWD never updates cwd from '/'. Root: sendToWebView calls injectJavaScript(`window.receiveFromRN(${JSON.stringify(msg)})`) which passes a JS object literal — receiveFromRN(msgJson: string) immediately calls JSON.parse(msgJson) which coerces the object to "[object Object]" → SyntaxError → silent catch → message dropped
Root Cause: sendToWebView must double-stringify: JSON.stringify(JSON.stringify(msg)) so the injected JS is window.receiveFromRN("{\"type\":\"...\"}") — passing a string literal that JSON.parse can parse
Status: Fixed
Fix Branch: develop
Lesson Encoded: No

BUG-0024: android/app/debug.keystore committed to version control (SEC-1)
Severity: High
Related Story:
Related Task:
Steps to Reproduce:
  1. Clone the repo
  2. Check git log -- mobile-ide/mobile-ide-prototype/android/app/debug.keystore
Expected: File not tracked
Actual: Binary keystore (private key material) committed to repo via expo prebuild
Root Cause: expo prebuild generated the full android/ directory including debug.keystore; the generated .gitignore inside android/ did not exclude it
Status: Fixed
Fix Branch: bugfix/batch-open-bugs
Lesson Encoded: No

BUG-0025: getToken() has no reject path or timeout — git push/git clone hang forever (TERM-11)
Severity: High
Related Story:
Related Task:
Steps to Reproduce:
  1. Run git push or git clone in terminal
  2. Background the app before TOKEN_RESULT is returned
Expected: Operation times out with error message after ~30 s
Actual: git push/clone await forever; terminal permanently frozen; pendingRequests map leaks the entry
Root Cause: getToken() creates a Promise with only a resolve callback and no reject; TOKEN_RESULT message handling added without mirroring the reject/timeout pattern used by all other pending-request handlers
Status: Fixed
Fix Branch: bugfix/batch-open-bugs
Lesson Encoded: No

BUG-0026: git status reports newly-staged files as ?? (untracked) instead of A  (added) (TERM-12)
Severity: High
Related Story:
Related Task:
Steps to Reproduce:
  1. Create a new file
  2. Run: git add <file>
  3. Run: git status
Expected: A  <file>
Actual: ?? <file> — file shown as untracked despite being staged
Root Cause: statusMatrix evaluation checks head===0 && workdir===2 (no stage guard) before the more-specific head===0 && workdir===2 && stage===2 check; broad condition matches first making the A  branch unreachable
Status: Fixed
Fix Branch: bugfix/batch-open-bugs
Lesson Encoded: No

BUG-0027: git init failure is misreported as "not a git repository" (TERM-13)
Severity: Medium
Related Story:
Related Task:
Steps to Reproduce:
  1. Run git init with an invalid cwd that causes ENOENT on .git/objects creation
Expected: Error shows root cause of the init failure
Actual: "not a git repository — run git init" — paradoxical message immediately after typing git init
Root Cause: case 'init' shares the outer try/catch which converts ENOENT errors to "not a git repository"; no subcommand guard prevents this
Status: Fixed
Fix Branch: bugfix/batch-open-bugs
Lesson Encoded: No

BUG-0028: ENOENT error masking too broad — corrupted repos return wrong diagnostic (TERM-14)
Severity: Medium
Related Story:
Related Task:
Steps to Reproduce:
  1. Create a git repo
  2. Corrupt .git/index (e.g. write garbage bytes)
  3. Run git status
Expected: Error describing the corrupted index
Actual: "not a git repository — run git init" — wrong message; git init in a valid repo is destructive
Root Cause: Strings readAsStringAsync and readDirectoryAsync added to error matching without scoping to .git-path lookups; any locked or corrupted file in a valid repo triggers the wrong message
Status: Fixed
Fix Branch: bugfix/batch-open-bugs
Lesson Encoded: No

BUG-0029: Plan visualizer dashboard not updated since 2026-03-13 (DASH-1)
Severity: Low
Related Story:
Related Task:
Steps to Reproduce:
  1. Check docs/plan-status.html last-modified date
  2. Compare to current RELEASE_PLAN.md
Expected: Dashboard reflects current plan state
Actual: Dashboard was last generated 2026-03-13; three compounding causes: feature branch not triggering CI, outputDir case mismatch (Docs vs docs), no local regeneration committed
Root Cause: plan-visualizer.config.json had outputDir: "Docs" (capital D); Linux CI is case-sensitive and output never reached docs/; also CI only triggers on main/develop pushes
Status: Fixed
Fix Branch: bugfix/batch-open-bugs
Lesson Encoded: No

BUG-0030: version-bump workflow fails with "Invalid format '0.1.1'" on GITHUB_OUTPUT (CI-1)
Severity: High
Related Story:
Related Task:
Steps to Reproduce:
  1. Merge any PR to develop
  2. Watch version-bump.yml workflow run
Expected: Workflow bumps version and commits
Actual: "Invalid format '0.1.1'" / "Unable to process file command 'output' successfully." — job fails
Root Cause: npm version in newer npm writes extra lines to stdout alongside the version tag; capturing stdout with $(...) included those extra lines; writing multiline result to $GITHUB_OUTPUT violated the required key=value format
Status: Fixed
Fix Branch: bugfix/version-bump-output-format
Lesson Encoded: No

BUG-0031: capture-cost.js Stop hook records zero tokens and cost for every session (TOOL-1)
Severity: Medium
Related Story:
Related Task:
Steps to Reproduce:
  1. End any Claude Code session (hook fires automatically)
  2. Check docs/AI_COST_LOG.md — every row shows 0 | 0 | 0 | 0.0000
Expected: Actual session token counts and cost USD recorded
Actual: All zeros; hook receives only { session_id, stop_hook_active } from older Claude Code
Root Cause: Claude Code 50.18.2 Stop hook payload omitted cost_usd and usage fields entirely; CLAUDE_SESSION_ID env var not injected in PreToolUse hooks so baseline keying by session ID was unreliable
Status: Fixed
Fix Branch: bugfix/batch-open-bugs
Notes: Implemented stats-cache baseline diff via temp file at os.tmpdir()/.nomadcode-cost-baseline.json; PreToolUse hook snapshots modelUsage on first tool call; Stop hook diffs and computes per-session token delta.
Lesson Encoded: No

BUG-0035: [FIXED] editor.focus() not called after setContent — Android soft keyboard input silently dropped (EDITOR-1)
Severity: High
Related Story:
Related Task:
Steps to Reproduce:
  1. Open a file on Android (triggers setContent message to Monaco WebView)
  2. Tap on the editor area to bring up the soft keyboard
  3. Type characters
Expected: Characters appear in the editor
Actual: Characters are silently dropped; the soft keyboard is visible but key events are not received by the editor
Root Cause: The setContent message handler in MonacoAssetManager.ts did not call editor.focus() after applying content, view state, and language rules. On Android, if the editor element does not explicitly hold focus when the soft keyboard activates, key events are silently dropped.
Status: Fixed
Fix Branch: bugfix/batch-open-bugs
Lesson Encoded: No
**Fix applied:** Added editor.focus() at end of setContent case in MonacoAssetManager.ts — ensures Monaco editor holds focus when content is set, allowing soft keyboard input to be received immediately.

BUG-0032: docs/LESSONS.md missing — plan visualizer Lessons tab always empty (TOOL-2)
Severity: Low
Related Story:
Related Task:
Steps to Reproduce:
  1. Open plan visualizer dashboard
  2. Click Lessons tab
Expected: Project lessons listed
Actual: "No lessons logged yet." because docs/LESSONS.md did not exist
Root Cause: LESSONS.md was never created as part of plan visualizer setup
Status: Fixed
Fix Branch: bugfix/version-bump-output-format
Lesson Encoded: No

BUG-0033: applyLanguageRules message handler in MonacoAssetManager.ts is untested dead code (LANG-1)
Severity: Medium
Related Story:
Related Task:
Steps to Reproduce:
  1. Search MonacoAssetManager.ts for case 'applyLanguageRules'
  2. Search codebase for any caller dispatching that message type
Expected: Handler is covered by tests and has at least one caller
Actual: No caller exists; Editor.tsx dispatches language rules inline inside setContent only; no test covers the handler
Root Cause: Handler added as future-use escape hatch without writing a test; violates CLAUDE.md no-code-without-tests rule
Status: Fixed
Fix Branch: feature/EPIC-0013-multi-language-editor
Lesson Encoded: No

BUG-0034: App forces landscape orientation on all devices — breaks foldables and phones (COMPAT-1)
Severity: High
Related Story:
Related Task:
Steps to Reproduce:
  1. Run app on Samsung Galaxy Z Fold or any iPhone
  2. Rotate device to portrait
Expected: App follows device orientation; layout adapts via useWindowDimensions()
Actual: Orientation locked to landscape; portrait unusable; compounds BUG-0009 on iPhone
Root Cause: app.json sets "orientation": "landscape" globally; no runtime orientation logic; Info.plist missing UIInterfaceOrientationPortrait for iPhone
Status: Fixed
Fix Branch: bugfix/batch-open-bugs
Notes: Changed app.json orientation to "default"; added UIInterfaceOrientationPortrait to UISupportedInterfaceOrientations (iPhone key) in Info.plist.
Lesson Encoded: No

BUG-0035: Soft keyboard types but characters do not appear in Monaco editor after creating a new file (EDITOR-1)
Severity: High
Related Story:
Related Task:
Steps to Reproduce:
  1. Create a new file via file explorer
  2. Tap into the Monaco editor — keyboard appears
  3. Type any character
Expected: Characters are inserted at the cursor
Actual: No characters appear; cursor not visible; resolves after closing and re-opening the tab
Root Cause: setContent is dispatched via injectJavaScript before Monaco's focus handshake completes; editor does not call editor.focus() after setContent, so soft keyboard key events are dropped
Status: Fixed
Fix Branch: bugfix/batch-open-bugs
Notes: Added editor.focus() call at end of setContent case in MonacoAssetManager.ts.
Lesson Encoded: No

BUG-0036: Markdown preview loads marked.js from CDN violating offline-first architecture (ED-1)
Severity: Critical
Related Story:
Related Task:
Steps to Reproduce:
  1. Enable airplane mode
  2. Open a .md file in the editor
  3. Click the preview toggle (eye icon)
Expected: Preview renders offline using bundled library
Actual: Preview fails to load — requests https://cdn.jsdelivr.net/npm/marked@12/marked.min.js
Root Cause: Editor.tsx line 184 loads marked.js from CDN instead of bundling it locally
Status: Open
Fix Branch:
Lesson Encoded: No

BUG-0037: WebView security settings overly permissive (ED-2)
Severity: High
Related Story:
Related Task:
Steps to Reproduce:
  1. Inspect WebView configuration in Editor.tsx
Expected: Minimal file access permissions
Actual: allowFileAccess, allowFileAccessFromFileURLs, allowUniversalAccessFromFileURLs, originWhitelist={['*']}
Root Cause: WebView configured with excessive permissions enabling potential XSS attacks
Status: Open
Fix Branch:
Lesson Encoded: No

BUG-0038: Hardcoded colors in Editor.tsx break light theme support (ED-3)
Severity: High
Related Story:
Related Task:
Steps to Reproduce:
  1. Switch to a light theme (e.g., nomad-light)
  2. Observe editor toolbar badge colors
Expected: Colors adapt to theme
Actual: color: '#FFF' hardcoded in mcBadgeText/mcBadgeClose (lines 750-751)
Status: Open
Fix Branch:
Lesson Encoded: No

BUG-0039: JSON preview uses hardcoded theme colors instead of dynamic values (ED-4)
Severity: High
Related Story:
Related Task:
Steps to Reproduce:
  1. Open a .json file
  2. Toggle preview with light theme active
Expected: Preview uses theme-consistent colors
Actual: Hardcoded #0f172a, #e2e8f0, etc. in buildJsonPreviewHtml (line 239)
Status: Open
Fix Branch:
Lesson Encoded: No

BUG-0040: Dead code — Terminal.tsx marked @deprecated but still exists (TERM-11)
Severity: Medium
Related Story:
Related Task:
Steps to Reproduce:
  1. Search for Terminal component usage in codebase
Expected: Only TerminalWebView is used
Actual: Both Terminal.tsx (deprecated stub) and TerminalWebView exist; Terminal.tsx exports still present
Root Cause: Deprecated component not removed after TerminalWebView was implemented
Status: Open
Fix Branch:
Lesson Encoded: No

BUG-0041: GitBridge stub implementations throw errors at runtime (FS-1)
Severity: High
Related Story:
Related Task:
Steps to Reproduce:
  1. Any code path calls GitBridge.clone(), .commit(), .push(), .pull(), or .checkout()
Expected: Method executes or returns graceful error
Actual: Methods throw 'not yet implemented' Error — could crash app if called
Root Cause: GitBridge in FileSystemBridge.ts lines 294-327 contains stub implementations that throw
Status: Open
Fix Branch:
Lesson Encoded: No

BUG-0042: ESLint-disable comment in FileExplorer.tsx indicates code smell (FE-1)
Severity: Low
Related Story:
Related Task:
Steps to Reproduce:
  1. Run ESLint on FileExplorer.tsx
Expected: No eslint-disable comments needed
Actual: Line 280 has // eslint-disable-next-line react-hooks/set-state-in-effect
Root Cause: triggerNewFile useEffect calls handleHeaderNewFile directly — should be refactored
Status: Open
Fix Branch:
Lesson Encoded: No

BUG-0043: StyleSheet created inside CommandPalette render (CP-6)
Severity: Low
Related Story:
Related Task:
Steps to Reproduce:
  1. Run performance profiling on CommandPalette
Expected: Styles memoized, not recreated each render
Actual: const styles = StyleSheet.create(...) inside component body (line 94)
Root Cause: StyleSheet.create() called on every render; should be moved outside component
Status: Open
Fix Branch:
Lesson Encoded: No

BUG-0044: getMonacoTheme() returns only vs-dark/vs instead of named themes (THEME-1)
Severity: Medium
Related Story:
Related Task:
Steps to Reproduce:
  1. Select Dracula or Monokai theme in settings
  2. Open a file in the editor
Expected: Monaco uses matching named theme
Actual: Monaco always uses vs-dark or vs; themes like 'dracula', 'monokai' not mapped
Root Cause: tokens.ts lines 131-132 only map to generic vs-dark/vs
Status: Open
Fix Branch:
Lesson Encoded: No

BUG-0045: useTerminalBridge missing sendToWebView in dependency array (TERM-12)
Severity: Medium
Related Story:
Related Task:
Steps to Reproduce:
  1. Run React DevTools with warnings enabled
Expected: No hook dependency warnings
Actual: sendToWebView excluded from deps with eslint-disable comment (lines 100-101)
Root Cause: Callback dependency array has intentional exclusion; risky pattern
Status: Open
Fix Branch:
Lesson Encoded: No

BUG-0046: Duplicate BUGS.md files — root and docs/ (DUP-1)
Severity: Low
Related Story:
Related Task:
Steps to Reproduce:
  1. List all BUGS.md files in project
Expected: Single source at docs/BUGS.md
Actual: Both /BUGS.md and /docs/BUGS.md exist
Root Cause: AGENTS.md specifies docs/BUGS.md as canonical; root file should be removed
Status: Fixed
Fix Branch: feature/EPIC-0014-global-search
Notes: Merged all entries from root BUGS.md into docs/BUGS.md (added BUG-0024 through BUG-0035 which were only in root); root BUGS.md removed. docs/BUGS.md is now the single source of truth.
Lesson Encoded: Yes

BUG-0047: Emoji in toolbar icon causes potential rendering issues (ED-5)
Severity: Low
Related Story:
Related Task:
Steps to Reproduce:
  1. Render Editor toolbar on various devices/platforms
Expected: Consistent icon rendering
Actual: label: '👁' (line 282) uses emoji that may render differently across platforms
Root Cause: Unicode emoji used instead of icon component or consistent glyph
Status: Open
Fix Branch:
Lesson Encoded: No

BUG-0048: Unsafe type assertion in useSettingsStore (SET-1)
Severity: Low
Related Story:
Related Task:
Steps to Reproduce:
  1. Run TypeScript strict mode
Expected: No unsafe casts
Actual: Line 39 has workspaceUriType: 'file' as WorkspaceUriType — unsafe cast
Root Cause: Type assertion bypasses proper type checking
Status: Open
Fix Branch:
Lesson Encoded: No

BUG-0049: App does not resize to fill screen on orientation change in Android emulator (LAYOUT-1)
Severity: High
Related Story:
Related Task:
Steps to Reproduce:
  1. Launch app on Android tablet emulator (Pixel_Tablet_API35)
  2. Rotate device from landscape to portrait (or vice versa)
Expected: App layout fills the full screen after rotation
Actual: Large black bands appear at top and bottom; app UI occupies only a letterboxed portion of the screen; layout does not reflow to match new dimensions
Root Cause: Suspected: React Native window dimensions not updating on rotation, or the root view is not re-measuring after configuration change. Possibly related to BUG-0034 residue — the previous landscape orientation lock may have left the Android activity's configChanges or screenOrientation attribute in a state that prevents proper reflow. Could also be a known issue with React Native's useWindowDimensions() not triggering a re-layout when the emulator reports a new screen size.
Status: Open
Fix Branch:
Lesson Encoded: No
