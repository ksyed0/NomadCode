# progress.md — Session Activity Log

Running log of what was done each session, errors, test results, and blockers.

---

## Session 1 — 2026-03-09

### What Was Done
- Connected local working directory to GitHub repo `ksyed0/NomadCode`
- Pulled latest code from `origin/main` (commit 13fec40)
- Read AGENTS.md and all existing documentation in `mobile-ide/docs/`
- Executed Protocol 0 — Initialization:
  - Created root `.gitignore`
  - Created `.env.example`
  - Created `PROJECT.md` (Project Constitution)
  - Created `CLAUDE.md` (Claude Code entry point)
  - Created `MEMORY.md`
  - Created `PROMPT_LOG.md`
  - Created `MIGRATION_LOG.md`
  - Created `progress.md` (this file)
  - Created `findings.md`
  - Created `task_plan.md`
  - Created `Docs/ID_REGISTRY.md`
  - Created `Docs/RELEASE_PLAN.md`
  - Created `Docs/TEST_CASES.md`
  - Created `Docs/BUGS.md`
  - Created `Docs/LESSONS.md`
  - Created `Docs/ROLLBACK.md`
  - Created `architecture/ERROR_TAXONOMY.md`
  - Created `tools/` directory
  - Created `.tmp/` directory

### Current State
- Project infrastructure initialized per AGENTS.md Protocol 0
- Prototype exists at `mobile-ide/mobile-ide-prototype/` (Phase 1 in progress)
- All 5 Discovery Questions pre-populated from existing docs — pending user confirmation
- `task_plan.md` Blueprint pending user confirmation

### Test Status
- Not run this session (infrastructure only)

### Blockers / Open Questions
- Discovery Question answers need user confirmation in next session
- Editor engine final decision: CodeMirror 6 mobile fork vs Monaco port
- Cloud storage provider TBD
- AI API provider TBD
- Crash reporting service TBD

### Next Session Pick-up
1. Confirm Discovery Questions with user
2. Finalize `task_plan.md` Blueprint
3. Begin Phase 2: Core Features (File Explorer, Terminal, Command Palette)

---

## Session 2 — 2026-03-09

### What Was Done
- Continued from previous context window (PR #5 / US-0021 Plan Visualizer CI fixes)
- **Security audit fix**: Replaced `npm audit --omit=dev --audit-level=high` with `npx audit-ci@^7 --omit=dev`; created `mobile-ide/mobile-ide-prototype/audit-ci.json` allowlisting 5 tar CVEs (unfixable while on expo@52)
- **Workspace tar fix**: Bumped `mobile-ide/package.json` tar dep `6.2.1` → `7.5.11`; added CJS interop shim `mobile-ide/scripts/patch-tar-interop.js`; added `postinstall` script
- **Android Kotlin pin**: `expo prebuild` regenerates `android/` in CI, overwriting committed `gradle.properties`; fixed by adding `sed` step in `e2e-android` job to pin `kotlin-gradle-plugin:1.9.25` in the generated `build.gradle` after prebuild
- **Sed path fix**: Corrected doubled path in `sed` step — `mobile-ide/mobile-ide-prototype/android/build.gradle` → `android/build.gradle` (runs under default `working-directory: mobile-ide/mobile-ide-prototype`)
- **iOS E2E caching**: Added `irgaly/xcode-cache@v1` for DerivedData and `actions/cache@v4` for CocoaPods Pods dir; added `timeout-minutes: 60`
- **iOS applesimutils**: Added `brew tap wix/brew && brew install applesimutils` step — not pre-installed on `macos-14` runner
- **CodeQL v3 → v4**: Upgraded all three CodeQL action refs (`init`, `autobuild`, `analyze`)
- **Coverage action**: Added `permissions: pull-requests: write` to `test` job; added `json-final-path`; added `"json"` to Jest `coverageReporters` so `coverage-final.json` is emitted; removed invalid `vite-config-path`
- **Bundle size action**: Removed invalid `package_manager: npm` input from `andresz1/size-limit-action@v1`
- **Plan visualizer CI job**: Added `plan-visualizer-test` job (job 11) running `npm run test:coverage -- --ci` from repo root; added to release gate `needs`
- **Editor.tsx ESLint fix**: Changed useEffect dep array from `[editorReady, activeTab?.path]` → `[editorReady, activeTab]` to satisfy react-hooks/exhaustive-deps; `loadedPathRef` guard prevents spurious reloads

### Current State
- PR #5 (`feature/US-0021-plan-visualizer`) open, CI fixes pushed, awaiting final green run
- Worktree active at `~/.config/superpowers/worktrees/NomadCode/feature/US-0021-plan-visualizer`
- Latest commit on feature branch: `c17fffb` (coverage reporter fix)
- EPIC-0006 (Plan Visualizer): Done — pending PR merge
- EPIC-0001 (Code Editing) and EPIC-0002 (File Management): next up after merge

### Test Status
- All 121 unit tests passing on feature branch (31 Editor, remainder Plan Visualizer)
- E2E: iOS/Android running in CI on PRs targeting main; Android Kotlin fix in place

### Blockers / Open Questions
- Android E2E may still have issues — exit code 2 seen in last CI run; sed path fix pushed but not yet confirmed green
- iOS E2E cancellations are concurrency cascade noise from rapid pushes — should stabilise

### Next Session Pick-up
1. Confirm PR #5 CI is green and merge
2. TASK-0004: Set up `develop` branch + branch protection rules on GitHub
3. TASK-0002: Wire `FileSystemBridge` to Expo FileSystem (`feature/US-0001-open-file`)
4. TASK-0001: Implement CodeMirror 6 in WebView (`feature/US-0002-syntax-highlighting`)
5. TASK-0003: 80% coverage sweep across all Phase 1 components
