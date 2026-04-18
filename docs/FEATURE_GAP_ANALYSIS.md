# Feature Gap Analysis — NomadCode vs VS Code / Cursor / Antigravity

> **Purpose:** Benchmarks NomadCode against leading desktop and AI-first IDEs to identify missing features, prioritize them by developer value, implementation complexity, and project risk, and translate gaps into new EPICs for the Release Plan.
>
> **Date:** 2026-04-18
> **NomadCode Version:** 0.1.1 (develop branch, 884 tests passing)
> **Last Updated:** Session 16

---

## Executive Summary

NomadCode has a strong foundation across all core IDE pillars: Monaco editor with multi-tab, 50+ language syntax highlighting, full file system CRUD, a sandboxed terminal with real file I/O, complete global search, GitHub OAuth + Git (clone/stage/commit/push/pull/diff), responsive split-pane layout, and a command palette. This is a genuinely capable mobile IDE.

**The competitive analysis reveals three critical findings:**

1. **NomadCode's moat is real.** Neither Cursor nor Google Firebase Studio has a usable native mobile IDE. Cursor's mobile offering is agent-execution only (no code editing). Firebase Studio's web interface has "extremely small text and buttons that make development on mobile/tablets impractical" (community reports). There is no meaningful competitor for native mobile code editing.

2. **Three features are Release 1.0 blockers for professional developers:** Search & Replace (missing entirely — find only), Branch create/switch UI (no UI exists despite the git backend), and Merge conflict resolution UI (git detects conflicts but no UI). These must land before App Store launch.

3. **AI is the Release 1.1 differentiator.** Cursor's killer features — multi-line context-aware Tab completion, inline AI edit (Cmd+K), codebase indexing — have no equivalent on mobile. NomadCode has a clear path to own this space.

---

## Methodology

### Scoring Framework

Each gap is scored on three dimensions:

| Dimension | Scale | Meaning |
|---|---|---|
| **Value** | 1–5 | Developer impact — how much does this feature's absence hurt daily workflow? |
| **Complexity** | 1–5 | Implementation effort (1 = hours, 5 = weeks/months) |
| **Risk** | 1–5 | Likelihood of breaking existing functionality (1 = isolated, 5 = cross-cutting) |

**Priority Score** = Value ÷ (Complexity × Risk)

Higher score = higher priority. Gaps are grouped into priority tiers: ★★★★★ (critical), ★★★★ (high), ★★★ (medium), ★★ (low), ★ (backlog).

### NomadCode Status Legend

| Symbol | Meaning |
|---|---|
| ✅ | Fully implemented |
| ✅⚠️ | Implemented with notable gaps |
| ⚠️ | Partially implemented / stub |
| ❌ | Not implemented |
| 🔜 | Planned (existing EPIC) |
| ➕ | New gap identified in this analysis |

---

## VS Code Feature Map

### 1. Editor Core

| Feature | VS Code | NomadCode | Status | Gap Notes |
|---|---|---|---|---|
| Syntax highlighting | ✅ TextMate grammars | ✅ Monaco + 50+ lang map | ✅ | — |
| Multi-tab editing | ✅ | ✅ | ✅ | — |
| Undo / Redo | ✅ | ✅ | ✅ | — |
| Find & replace (in file) | ✅ | ✅ toolbar | ✅ | Monaco built-in |
| Code folding | ✅ gutter UI | ⚠️ Monaco has it, no toolbar | ➕ | Toolbar button needed |
| Minimap | ✅ | ❌ (hidden) | ➕ | Mobile screen too small; skip |
| Breadcrumbs | ✅ | ❌ | ➕ | High value on mobile — shows scope |
| Sticky scroll | ✅ | ❌ | — | Monaco supports; low priority mobile |
| Bracket pair colorization | ✅ | ✅ Monaco default | ✅ | — |
| IntelliSense / code completion | ✅ LSP | ❌ AI_HOOK only | ➕ | Requires LSP (EPIC-0024) |
| Parameter hints | ✅ | ❌ | ➕ | Part of LSP |
| Go to Definition | ✅ | ❌ | ➕ | EPIC-0022 |
| Peek Definition | ✅ | ❌ | ➕ | EPIC-0022 |
| Find References | ✅ | ❌ | ➕ | EPIC-0022 |
| Rename symbol | ✅ | ❌ | ➕ | Monaco supports; needs UI |
| Multi-cursor | ✅ | ✅ Alt+click | ✅ | Via Monaco |
| Auto-format (Prettier etc.) | ✅ extension | ⚠️ Command exists, no backend | ➕ | Prettier in terminal bundle, not editor |
| Snippets | ✅ | ❌ | ➕ | Medium priority |
| Word wrap toggle | ✅ | ❌ | ➕ | Monaco supports; missing settings UI |
| Hover docs | ✅ | ❌ | ➕ | Requires LSP |
| Inline error/warning | ✅ | ❌ | ➕ | Requires LSP |
| Hardware keyboard shortcuts | ✅ | ⚠️ Monaco only | ➕ | ⌘S, ⌘`, ⌘N not wired globally |

### 2. File & Workspace

| Feature | VS Code | NomadCode | Status | Gap Notes |
|---|---|---|---|---|
| File explorer + CRUD | ✅ | ✅ | ✅ | — |
| Move / copy files | ✅ | ✅ | ✅ | — |
| Global search (find) | ✅ | ✅ regex, glob | ✅ | — |
| **Global search + replace** | ✅ | ❌ | ➕ | Find-only; replace missing |
| Recent files | ✅ | ❌ | ➕ | Low priority |
| Multi-root workspaces | ✅ | ❌ | — | Deferred — too complex for v1 |
| Auto-save | ✅ | ❌ | ➕ | Dirty indicator exists; auto-save not wired |
| File icons by type | ✅ | ❌ | ➕ | Nice-to-have |
| Directory watching | ✅ | ❌ | ➕ | No external change detection |
| Workspace trust | ✅ | N/A | — | Sandboxed by OS; not needed |

### 3. Source Control

| Feature | VS Code | NomadCode | Status | Gap Notes |
|---|---|---|---|---|
| Clone repository | ✅ | ✅ | ✅ | — |
| Stage / unstage files | ✅ | ✅ | ✅ | — |
| Commit with message | ✅ | ✅ | ✅ | — |
| Push / pull | ✅ | ✅ | ✅ | — |
| View diff | ✅ | ✅ inline diff | ✅ | — |
| **Branch create/switch UI** | ✅ | ❌ (backend only) | ➕ | Critical blocker |
| **Merge conflict resolution UI** | ✅ | ❌ | ➕ | Critical blocker |
| Git gutter indicators | ✅ | ❌ | ➕ | Added/modified/deleted lines |
| Stash | ✅ | ❌ | ➕ | Medium priority |
| Git blame / Timeline | ✅ | ❌ | ➕ | Medium priority |
| AI commit message | ✅ (Copilot) | ❌ | ➕ | Quick win with EPIC-0010 |
| GitHub PR review | ✅ extension | ❌ | — | Post-launch |

### 4. Terminal

| Feature | VS Code | NomadCode | Status | Gap Notes |
|---|---|---|---|---|
| Integrated terminal | ✅ real PTY | ✅ WebView WASI | ✅⚠️ | Not a real PTY; sandboxed by design |
| Multiple terminal instances | ✅ | ❌ | ➕ | Low priority; complex |
| Shell history (arrow up) | ✅ | ❌ | ➕ | Medium priority |
| Search in terminal | ✅ | ❌ | ➕ | Nice-to-have |

### 5. Debugging

| Feature | VS Code | NomadCode | Status | Gap Notes |
|---|---|---|---|---|
| Breakpoints | ✅ | ❌ | ➕ | EPIC-0026 (1.2) — very complex |
| Watch expressions | ✅ | ❌ | ➕ | EPIC-0026 |
| Call stack | ✅ | ❌ | ➕ | EPIC-0026 |
| Variable inspection | ✅ | ❌ | ➕ | EPIC-0026 |
| Debug console | ✅ | ❌ | ➕ | EPIC-0026 |
| Step over/into/out | ✅ | ❌ | ➕ | EPIC-0026 |

### 6. Customization

| Feature | VS Code | NomadCode | Status | Gap Notes |
|---|---|---|---|---|
| Color themes | ✅ | ✅ 4 themes | ✅⚠️ | Monaco theme full integration deferred (US-0067) |
| Font size | ✅ | ✅ | ✅ | — |
| Font family | ✅ | ❌ | ➕ | JetBrains Mono hardcoded; nice-to-have |
| Keybindings config | ✅ | ❌ | ➕ | Medium priority |
| Indentation settings | ✅ | ❌ (hardcoded per lang) | ➕ | Per-language rules exist; no user override |
| Snippets | ✅ | ❌ | ➕ | Medium priority |
| Settings sync | ✅ | ❌ | ➕ | EPIC-0027 |

---

## Cursor Feature Map

Cursor is a VS Code fork built around AI-first editing. Its key differentiators vs vanilla VS Code:

| Cursor Feature | NomadCode | Status | Gap Notes |
|---|---|---|---|
| AI Tab completion (multi-line, project-aware) | ❌ | 🔜 EPIC-0010 | Needs codebase context layer |
| AI chat panel | ❌ | 🔜 EPIC-0010 | Planned |
| **Inline AI edit (Cmd+K)** | ❌ | ➕ EPIC-0023 | Select code + describe change in NL |
| **AI Rules (project instructions)** | ❌ | ➕ EPIC-0023 | `.nomad-rules` or `NOMAD.md` per project |
| **AI commit message generation** | ❌ | ➕ EPIC-0023 | Quick win; sparkle button in git panel |
| **Multi-model support** (Claude, GPT, Gemini) | ❌ | ➕ EPIC-0023 | Don't lock to one provider |
| Codebase semantic indexing | ❌ | ➕ EPIC-0025 | Vector search across project (1.2) |
| @file / @codebase context references | ❌ | ➕ EPIC-0025 | Requires indexing |
| Shadow workspace (background linting) | ❌ | — | Mobile-infeasible; skip |
| Cursor Blame (AI attribution) | ❌ | ➕ EPIC-0023 | Show AI vs human edits in git blame |
| Design mode (visual UI edit) | ❌ | — | Post-launch for Swift/SwiftUI |
| Agent mode (autonomous terminal) | ❌ | — | Desktop pattern; not mobile-native |
| Local model support (Ollama) | ❌ | ➕ EPIC-0025 | Offline AI — 1.2 |
| Privacy / Ghost mode | ❌ | ➕ EPIC-0025 | Important for enterprise devs |
| Notepads (project Markdown context) | ❌ | ➕ EPIC-0023 | Lightweight version feasible |
| MCP integrations | ❌ | — | Post-launch |

---

## Google Antigravity / Firebase Studio Feature Map

| Feature | Antigravity | Firebase Studio | NomadCode | Notes |
|---|---|---|---|---|
| Native mobile IDE | ❌ desktop only | ❌ browser, non-responsive | ✅ | **NomadCode's core moat** |
| Offline-first | ❌ | ❌ cloud-only | ✅ | Major differentiator |
| Touch-optimized UI | ❌ | ❌ | ✅ | NomadCode designed for touch |
| Multi-agent orchestration | ✅ | ❌ | ❌ | Desktop paradigm; not mobile-applicable |
| Multi-platform preview (iOS+Android+web) | ⚠️ DevTools only | ✅ | ❌ | ➕ Future: embedded simulator preview |
| Android/iOS emulator | ❌ | ✅ (cloud) | ❌ | Complex; post-launch |
| App generation (prototyper) | ❌ | ✅ | ❌ | ➕ Long-term AI feature |
| Firebase/GCP integration | ❌ | ✅ | ❌ | — |
| Free tier | ✅ | ✅ | 🔜 (EPIC-0009) | Free tier parity needed |
| Full git workflow | ⚠️ terminal only | ✅ | ✅ | NomadCode matches |

**Key competitive insight:** Firebase Studio community explicitly reports the UI is unusable on mobile/tablet. This is a validated gap NomadCode uniquely fills.

---

## Prioritized Gap Table

All identified gaps scored and assigned to release targets.

| Rank | Feature | Value | Complexity | Risk | Priority | EPIC | Release |
|---|---|---|---|---|---|---|---|
| 1 | Search & Replace (across files) | 5 | 1 | 1 | ★★★★★ | EPIC-0021 | 1.0 |
| 2 | Branch create / switch UI | 5 | 2 | 1 | ★★★★★ | EPIC-0020 | 1.0 |
| 3 | Hardware keyboard shortcuts (⌘S/⌘`/⌘N/⌘P) | 5 | 2 | 1 | ★★★★★ | EPIC-0021 | 1.0 |
| 4 | Merge conflict resolution UI | 5 | 3 | 2 | ★★★★ | EPIC-0020 | 1.0 |
| 5 | AI commit message generation | 4 | 1 | 1 | ★★★★ | EPIC-0023 | 1.0 (with EPIC-0010) |
| 6 | Code folding UI | 4 | 1 | 1 | ★★★★ | EPIC-0021 | 1.1 |
| 7 | Inline AI edit (Cmd+K equivalent) | 5 | 3 | 1 | ★★★★ | EPIC-0023 | 1.1 |
| 8 | Auto-format (Prettier wired to editor) | 4 | 2 | 1 | ★★★★ | EPIC-0021 | 1.1 |
| 9 | Git gutter indicators | 3 | 2 | 1 | ★★★ | EPIC-0020 | 1.1 |
| 10 | Breadcrumbs navigation | 3 | 2 | 1 | ★★★ | EPIC-0021 | 1.1 |
| 11 | AI Rules / project instructions | 4 | 2 | 1 | ★★★ | EPIC-0023 | 1.1 |
| 12 | Multi-model AI support | 4 | 3 | 1 | ★★★ | EPIC-0023 | 1.1 |
| 13 | Code navigation (Go to Def, Find Refs) | 5 | 4 | 2 | ★★★ | EPIC-0022 | 1.1 |
| 14 | Git stash | 3 | 2 | 1 | ★★★ | EPIC-0020 | 1.1 |
| 15 | Git blame | 3 | 2 | 1 | ★★★ | EPIC-0020 | 1.1 |
| 16 | Snippets | 3 | 2 | 1 | ★★★ | EPIC-0021 | 1.1 |
| 17 | Terminal shell history | 3 | 2 | 1 | ★★★ | EPIC-0021 | 1.1 |
| 18 | Monaco theme full integration (US-0067) | 3 | 3 | 1 | ★★ | EPIC-0005 | 1.1 |
| 19 | IntelliSense / LSP completions | 5 | 5 | 2 | ★★★ | EPIC-0024 | 1.2 |
| 20 | AI codebase indexing | 5 | 5 | 1 | ★★★ | EPIC-0025 | 1.2 |
| 21 | Hover docs / inline errors | 4 | 4 | 1 | ★★ | EPIC-0024 | 1.2 |
| 22 | Model flexibility / local Ollama | 3 | 4 | 1 | ★★ | EPIC-0025 | 1.2 |
| 23 | Debugger (breakpoints, watch, stack) | 5 | 5 | 3 | ★★ | EPIC-0026 | 1.2 |
| 24 | Settings sync | 3 | 3 | 1 | ★★ | EPIC-0027 | 1.2 |
| 25 | Auto-save | 3 | 1 | 2 | ★★★ | EPIC-0021 | 1.1 |
| 26 | Multi-root workspaces | 2 | 3 | 2 | ★ | — | Deferred |
| 27 | Multiple terminal instances | 2 | 3 | 2 | ★ | — | Deferred |
| 28 | Live Share / real-time collab | 3 | 5 | 2 | ★ | EPIC-0027 | 1.2 |
| 29 | Mobile simulator preview | 3 | 5 | 1 | ★ | — | Post-launch |

---

## New EPICs Summary

These EPICs are appended to `docs/RELEASE_PLAN.md` as a direct output of this analysis.

| EPIC | Title | Release | Priority Stories |
|---|---|---|---|
| EPIC-0020 | Advanced Git Workflows | 1.0 / 1.1 | Branch UI, merge conflicts, stash, blame, gutter |
| EPIC-0021 | Advanced Editor Features | 1.0 / 1.1 | Search/replace, keyboard shortcuts, folding, format, breadcrumbs, snippets, auto-save |
| EPIC-0022 | Code Navigation | 1.1 | Go to Definition, Find References, Peek, symbol search |
| EPIC-0023 | AI Code Intelligence | 1.0 / 1.1 | Inline AI edit, AI rules, AI commit messages, multi-model |
| EPIC-0024 | Language Server Protocol | 1.2 | LSP integration, IntelliSense, diagnostics, hover docs |
| EPIC-0025 | AI Codebase Indexing | 1.2 | Semantic indexing, @file context, vector search, privacy mode |
| EPIC-0026 | Mobile Debugging | 1.2 | Breakpoints, watch, call stack, debug console |
| EPIC-0027 | Collaboration & Settings Sync | 1.2 | Settings sync, share-to-web, Live Share lite |

---

## Competitive Positioning — NomadCode's Moat

### Why NomadCode wins on mobile

| Dimension | VS Code | Cursor | Firebase Studio | Antigravity | **NomadCode** |
|---|---|---|---|---|---|
| Native mobile app | ❌ | ❌ | ❌ | ❌ | ✅ |
| Offline-first | ✅ | ⚠️ (AI needs internet) | ❌ | ❌ | ✅ |
| Touch-optimized UI | ❌ | ❌ | ❌ | ❌ | ✅ |
| Full git workflow | ✅ | ✅ | ✅ | ⚠️ terminal | ✅ |
| Real file system | ✅ | ✅ | ⚠️ cloud | ✅ local | ✅ |
| AI completions | ✅ Copilot | ✅ Tab | ✅ Gemini | ✅ Gemini | 🔜 EPIC-0010 |
| Tablet split-pane IDE | ❌ | ❌ | ❌ | ❌ | ✅ |
| App Store delivery | ❌ | ❌ | ❌ | ❌ | 🔜 EPIC-0011 |

### Narrative

Every significant code editor exists as a desktop or web application. NomadCode is the only IDE designed ground-up for the native mobile form factor — with touch gestures, split-pane tablet layouts, hardware keyboard support, and offline-first file I/O.

The absence of any usable mobile-native competitor is not a gap in the market — it is the market. NomadCode's primary risk is not competitive displacement; it is feature incompleteness at launch. The gap analysis above shows that several basic professional features (branch UI, merge conflicts, search/replace) are missing and must ship in Release 1.0 to be taken seriously by professional developers.

### AI Differentiation Path

Cursor's $2B ARR is built on one insight: AI that understands your entire codebase is categorically more useful than AI that only sees the current file. NomadCode's EPIC-0025 (AI Codebase Indexing) targets this same insight — but for the mobile context, where the benefit is even higher because screen space limits how much a developer can hold in view simultaneously.

---

*This document is a living artifact. Update when new competitive products launch, when EPICs are completed, or when the prioritization framework changes.*

*Generated from competitive research conducted 2026-04-18 covering VS Code 1.110+, Cursor April 2026, Google Antigravity v1.22+, and Firebase Studio (Project IDX) open beta.*
