# MEMORY.md — NomadCode Persistent Knowledge Base

Organized by topic. Update entries in-place; do not append chronologically.
Last updated: 2026-03-10

---

## Project Status

- **Phase:** Phase 1 — Foundation (in progress)
- **Active branch:** `develop` (tracks `origin/develop`)
- **Main branch:** `main` — protected; merge via PR only
- **Last merged PR:** #9 (docs: close TASK-0003 and US-0007)
- **Next up:** TASK-0002 (`feature/US-0001-open-file`) — wire FileSystemBridge to Expo FileSystem

---

## ID Registry State (as of 2026-03-10)

| Sequence | Next Available | Last Assigned |
|---|---|---|
| EPIC | EPIC-0007 | EPIC-0006 |
| US | US-0022 | US-0021 |
| TASK | TASK-0005 | TASK-0004 |
| AC | AC-0012 | AC-0011 |
| TC | TC-0035 | TC-0034 |
| BUG | BUG-0001 | — |

Source of truth: `docs/ID_REGISTRY.md` — always consult before creating artefacts.

---

## Tech Stack

| Layer | Technology | Version |
|---|---|---|
| UI Framework | React Native (Expo) | ~52.0.0 |
| Language | TypeScript | ^5.3.3 |
| State | Zustand | ^5.0.0 |
| Editor | CodeMirror 6 (mobile fork) | TBD |
| Terminal | Xterm.js + WASI | TBD |
| Local storage | Expo FileSystem + SQLite | ~17.0.0 |
| CI/CD | GitHub Actions + EAS Build | Latest |

---

## Key File Paths

| File | Purpose |
|---|---|
| `mobile-ide/mobile-ide-prototype/src/components/Editor.tsx` | Main editor component |
| `mobile-ide/mobile-ide-prototype/src/components/FileExplorer.tsx` | File tree UI |
| `mobile-ide/mobile-ide-prototype/src/utils/FileSystemBridge.ts` | FS abstraction layer |
| `docs/ID_REGISTRY.md` | Next available artefact IDs |
| `docs/RELEASE_PLAN.md` | Epics, user stories, tasks |
| `docs/TEST_CASES.md` | Human-readable test cases |
| `tools/generate-plan.js` | Regenerates plan dashboard |

---

## CI/CD — Hard-Won Fixes

- **Security audit:** Use `npx audit-ci@^7 --omit=dev` (not `npm audit`). Config: `mobile-ide/mobile-ide-prototype/audit-ci.json` allows 5 tar CVEs unfixable while on expo@52.
- **Android Kotlin pin:** `expo prebuild` regenerates `android/` in CI, overwriting `gradle.properties`. Fix via `sed` step in `e2e-android` job to pin `kotlin-gradle-plugin:1.9.25` in the generated `build.gradle` after prebuild. Run path: `android/build.gradle` (relative to `working-directory: mobile-ide/mobile-ide-prototype`).
- **iOS E2E:** Uses `irgaly/xcode-cache@v1` + `actions/cache@v4` for Pods dir. Requires `brew tap wix/brew && brew install applesimutils` — not pre-installed on `macos-14`.
- **CodeQL:** Use v4 (`github/codeql-action/init@v4`, etc.) — v3 deprecated.
- **Coverage JSON:** Jest must include `"json"` in `coverageReporters` to emit `coverage-final.json`.
- **Editor useEffect deps:** Use `[editorReady, activeTab]` not `[editorReady, activeTab?.path]` to satisfy `react-hooks/exhaustive-deps`. Use `loadedPathRef` guard to prevent spurious reloads.

---

## Branch Conventions

- Feature branches: `feature/US-XXXX-short-description`
- Bug branches: `bugfix/BUG-XXXX-short-description`
- Never commit directly to `main` or `develop`
- All work merges to `develop` via PR; `develop` → `main` via release PR

---

## Open Blockers / TBD Decisions

- Editor engine final decision: CodeMirror 6 mobile fork vs Monaco port
- Cloud storage provider (S3-compatible): TBD
- AI API provider for Pro+ inline suggestions: TBD
- Crash reporting service (Sentry vs Bugsnag): TBD

---

## Test Commands

```bash
# Mobile prototype unit tests
cd mobile-ide/mobile-ide-prototype && npm test

# Mobile coverage report
cd mobile-ide/mobile-ide-prototype && npm run test:coverage

# Plan Visualizer tests (repo root)
npm test
```

Last known passing: 121 unit tests (31 Editor + Plan Visualizer suite).
