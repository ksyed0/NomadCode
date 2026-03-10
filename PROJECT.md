# PROJECT.md — NomadCode Project Constitution

> This is the single source of truth for architecture, schema, rules, user profile, and design system.
> Update this file whenever schema changes, rules are added, or architecture is modified.
>
> **Platform note:** This file is the companion to `AGENTS.md`. Platform-specific filenames (`CLAUDE.md`, `Gemini.md`, etc.) are symlinks to this file — do not maintain separate content in them.

---

## Session Startup

Read these files at the start of every session, before writing any code:

1. **`AGENTS.md`** — Platform-agnostic operating standards (mandatory, read first)
2. **`PROJECT.md`** (this file) — Project constitution, schema, design system, and rules
3. **`MEMORY.md`** — Persistent knowledge base
4. **`progress.md`** — Where the last session left off
5. **`PROMPT_LOG.md`** — Session prompt history
6. **`Docs/ID_REGISTRY.md`** — Next available artefact IDs (check before creating anything)

**Critical rules (enforced at all times):**
- No code written without unit tests in the same session.
- All tests must pass before any commit.
- Never commit directly to `main` or `develop`.
- Branch naming: `feature/US-XXXX-short-description` or `bugfix/BUG-XXXX-short-description`.
- Minimum 80% test coverage on all new/modified code.

---

## § 1. Discovery Questions (Phase 1 — Blueprint)

| Question | Answer |
|---|---|
| **North Star** — Singular desired outcome | Deliver a professional-grade mobile IDE (iOS & Android) that lets developers write, run, and manage real code from tablets and phones — shipped to App Store and Google Play. |
| **Integrations** — External services needed | GitHub (git operations), S3-compatible cloud storage (file sync), OAuth 2.0 / OpenID Connect (auth), AI API (Pro+ inline suggestions), Crash reporting (Sentry/Bugsnag). Credentials: TBD — see `.env.example`. |
| **Source of Truth** — Where primary data lives | Device-local file system (Expo FileSystem + SQLite) for offline-first core. Cloud (S3-compatible) for sync. Git remote (GitHub/GitLab) for version control. |
| **Delivery Payload** — Final result destination | iOS App Store + Google Play Store. App binary built via EAS Build (Expo Application Services) and submitted through standard store review pipelines. |
| **Behavioral Rules** | Offline-first for core editing. Terminal must be sandboxed (no unrestricted native process access). Extensions run in WASM workers only. No PII in logs. App Store & Play Store policy compliant. Voice: developer-to-developer, direct, empowering. |

---

## § 2. Product Overview

**Product:** NomadCode
**Tagline:** "Code from anywhere."
**Platform:** iOS (iPad + iPhone) + Android (tablet + phone)
**Current Version:** 0.1 (Prototype)
**Status:** Phase 1 — Foundation in progress

---

## § 3. Architecture Invariants

1. **Offline-first:** Core editor, file system, and terminal must function without network access.
2. **3-Layer separation:** UI components → Core Services → Native/Cloud layer. No skipping layers.
3. **Extension isolation:** Extensions run exclusively in WASM workers. No direct DOM, native API, or file system access outside the defined `ExtensionAPI`.
4. **Terminal sandboxing:** Terminal uses WASI runtime. No unrestricted `exec()` or process spawning on device.
5. **Secrets in keychain:** Platform keychain only (iOS Keychain / Android Keystore). Never in app storage or logs.
6. **TypeScript everywhere:** No untyped JavaScript in source files.
7. **State via Zustand:** All shared application state managed through Zustand stores. No prop-drilling beyond 2 levels.

---

## § 4. Data Schema

### FileEntry
```typescript
interface FileEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  size?: number;
  modifiedAt?: Date;
}
```

### EditorBuffer
```typescript
interface EditorBuffer {
  filePath: string;
  content: string;
  language: string;
  isDirty: boolean;
  cursorPosition: { line: number; col: number };
}
```

### Command (Command Palette)
```typescript
interface Command {
  id: string;
  label: string;
  description?: string;
  action: () => void;
  shortcut?: string;
}
```

### ExtensionManifest
```typescript
interface ExtensionManifest {
  id: string;
  name: string;
  version: string;
  entryPoint: string; // path to WASM bundle
  permissions: ('file-read' | 'editor-write' | 'ui-panel')[];
}
```

### API Response Envelope
```json
{
  "success": true,
  "data": {},
  "error": null,
  "meta": { "version": "1.0", "timestamp": "ISO8601" }
}
```

---

## § 5. User Profile

| Persona | Description | Technical Level | Primary Device | Key Need |
|---|---|---|---|---|
| Tablet Developer | Professional dev, primary machine is an iPad Pro | High | iPad Pro / Android tablet | Full VS Code-like workflow on tablet |
| Phone Developer | Dev who needs to make quick edits on the go | Medium–High | iPhone / Android phone | Fast open-edit-commit on small screen |
| Student / Learner | Learning to code on a tablet-first device | Low–Medium | iPad / Android tablet | Readable syntax, low friction, offline support |
| Power User | Pro developer wanting AI + extensions | Expert | iPad Pro | AI suggestions, custom extensions, git integration |

**Design constraint:** All UI decisions must serve the Tablet Developer and Power User as primary personas. Phone support is important but should not degrade the tablet experience.

---

## § 6. Design System

### Colors
| Role | Name | Hex |
|---|---|---|
| Primary | Nomad Blue | `#2563EB` |
| Secondary | Sand | `#D97706` |
| Background (light) | Off-White | `#F9FAFB` |
| Background (dark) | Deep Slate | `#0F172A` |
| Text (light) | Charcoal | `#111827` |
| Text (dark) | Cloud | `#E2E8F0` |
| Accent | Teal | `#0D9488` |
| Error | Coral | `#EF4444` |
| Success | Sage | `#22C55E` |

**WCAG contrast:** All text/background pairs must meet 4.5:1 (normal text) or 3:1 (large text/UI components).

### Typography
| Role | Font | Weight |
|---|---|---|
| UI headings | Inter | 600, 700 |
| UI body | Inter | 400, 500 |
| Code / Editor | JetBrains Mono | 400, 700 |

### Component Patterns
- Split-pane layout on tablet (≥768px): File Explorer | Editor | Terminal side-by-side.
- Bottom sheet / single-pane on phone (<768px).
- Max 2 fonts per screen.
- All interactive elements min 44×44pt touch target (iOS HIG / Material).

---

## § 7. Technology Stack

| Layer | Technology | Pinned Version |
|---|---|---|
| UI Framework | React Native (Expo) | ~52.0.0 |
| Language | TypeScript | ^5.3.3 |
| State Management | Zustand | ^5.0.0 |
| Editor Engine | CodeMirror 6 (mobile fork) | TBD |
| Terminal Runtime | Xterm.js + WASI | TBD |
| Extension Sandbox | WebAssembly Workers | Native |
| Networking | React Query + REST | TBD |
| Storage (local) | Expo FileSystem + SQLite | ~17.0.0 |
| Storage (cloud) | S3-compatible | TBD |
| Auth | OAuth 2.0 / OIDC | TBD |
| CI/CD | GitHub Actions + EAS Build | Latest |

---

## § 8. Performance Baselines

| Metric | Target |
|---|---|
| Cold start time | < 2s on mid-range devices |
| Editor input latency | < 16ms (60fps) |
| File tree render (1,000 files) | < 100ms |
| Terminal output throughput | ≥ 10,000 lines/s |
| Memory usage (idle) | < 150MB |
| API response time (p95) | < 500ms |

---

## § 9. Behavioral Rules & Guardrails

- **Never** expose raw stack traces to end users.
- **Never** log PII, credentials, or sensitive user data.
- **Never** commit `.env` or any secrets to version control.
- **Never** write code without unit tests in the same session.
- **Always** validate and sanitize external input at system boundaries.
- **Always** implement exponential backoff for transient network failures (max 3 retries).
- **Always** run accessibility audit after every major UI change.
- **Always** update `MIGRATION_LOG.md` when a change must propagate to multiple platforms.

---

## § 10. Maintenance Log

| Date | Change | Author |
|---|---|---|
| 2026-03-09 | Initial Project Constitution created from existing docs | Claude Code |
| 2026-03-10 | Added Session Startup section, Quick Reference, and platform symlink note; CLAUDE.md and Gemini.md are now symlinks to this file | Claude Code |

---

## § 11. Quick Reference

| Item | Path / Command |
|---|---|
| Prototype | `mobile-ide/mobile-ide-prototype/` |
| Docs | `Docs/` |
| Run mobile tests | `cd mobile-ide/mobile-ide-prototype && npm test` |
| Mobile coverage | `cd mobile-ide/mobile-ide-prototype && npm run test:coverage` |
| Plan Visualizer tests | `npm test` (from repo root) |
| Regenerate dashboard | `node tools/generate-plan.js` |
| Editor component | `mobile-ide/mobile-ide-prototype/src/components/Editor.tsx` |
| File Explorer | `mobile-ide/mobile-ide-prototype/src/components/FileExplorer.tsx` |
| File System Bridge | `mobile-ide/mobile-ide-prototype/src/utils/FileSystemBridge.ts` |
