# MEMORY.md — NomadCode Persistent Knowledge Base

Organized by topic. Update entries in-place; do not append chronologically.
Last updated: 2026-05-03

---

## Project Status

- **Phase:** Phase 1 — Post-GA (store submission pending external accounts)
- **Active branch:** `develop` (tracks `origin/develop`)
- **Main branch:** `main` — protected; merge via PR only
- **Last merged PR:** #125 (EPIC-0011 App Store & EAS Build)
- **Open PRs:** #127 (EPIC-0015 Crash Reporting) — CI running
- **Test count on develop:** 1268 passing (62 suites)
- **Test count on EPIC-0015 branch:** 1302 passing (65 suites)

---

## EPIC Status Summary (as of 2026-05-03)

| EPIC | Title | Status |
|---|---|---|
| EPIC-0001 | Code Editing | Done |
| EPIC-0002 | File Management | Done |
| EPIC-0003 | Terminal (WASI) | Done |
| EPIC-0004 | Command Palette | Done |
| EPIC-0005 | Customization | Done |
| EPIC-0006 | Plan Visualizer | Done |
| EPIC-0007 | Authentication (GitHub OAuth) | Done |
| EPIC-0008 | Git Integration (isomorphic-git) | Done |
| EPIC-0009 | IAP & Monetization (RevenueCat) | Done |
| EPIC-0010 | AI Suggestions | Done |
| EPIC-0011 | App Store & EAS Build | Done (PR #125 merged) — store submission pending |
| EPIC-0015 | Crash Reporting & Observability | In Progress (PR #127) |
| EPIC-0018 | Foldable Device Support | Done |
| EPIC-0020 | Advanced Git Workflows | Done |
| EPIC-0021 | Advanced Editor Features | Done |
| EPIC-0022 | Code Navigation | Planned — **next brainstorm** |

---

## ID Registry State (as of 2026-05-01)

| Sequence | Next Available | Last Assigned |
|---|---|---|
| EPIC | EPIC-0028 | EPIC-0027 |
| US | US-0101 | US-0100 |
| TASK | TASK-0005 | TASK-0004 |
| AC | AC-0308 | AC-0307 |
| TC | TC-0367 | TC-0366 |
| BUG | BUG-0055 | BUG-0054 |

Source of truth: `docs/ID_REGISTRY.md` — always consult before creating artefacts.

---

## Tech Stack (as of 2026-05-03)

| Layer | Technology | Version |
|---|---|---|
| UI Framework | React Native (Expo) | ~54.0.0 |
| Language | TypeScript | ^6.0.3 |
| State | Zustand | ^5.0.0 |
| Editor | Monaco Editor (WebView) | 0.45.0 |
| Terminal | Xterm.js + WASI (sandboxed) | custom bundle |
| Local storage | Expo FileSystem + SQLite | ~18.0.0 |
| Git | isomorphic-git | ^1.37.x |
| IAP | RevenueCat (`react-native-purchases`) | latest |
| AI | OpenRouter (unified, 200+ models) | via @microsoft/fetch-event-source |
| Crash reporting | Sentry (`@sentry/react-native`) | ^8.10.0 |
| AI Streaming | `@microsoft/fetch-event-source` | ^2.0.1 |
| Secure storage | `expo-secure-store` | ~14.0.0 |
| CI/CD | GitHub Actions + EAS Build | Latest |
| Lint | ESLint 10 (flat config `eslint.config.js`) | ^10.x |

---

## Key File Paths

| File | Purpose |
|---|---|
| `mobile-ide/mobile-ide-prototype/App.tsx` | Root component; WebView message handler, COMPLETION_CONTEXT wiring |
| `mobile-ide/mobile-ide-prototype/src/components/Editor.tsx` | Monaco editor + `EditorHandle` (injectMessage, foldAll, blame, etc.) |
| `mobile-ide/mobile-ide-prototype/src/components/FileExplorer.tsx` | File tree + sidebar tabs (files / search / ai) |
| `mobile-ide/mobile-ide-prototype/src/utils/MonacoAssetManager.ts` | Monaco HTML template, WebView message bridge, completions provider |
| `mobile-ide/mobile-ide-prototype/src/utils/FileSystemBridge.ts` | FS abstraction (delegates to gitBridge for git ops) |
| `mobile-ide/mobile-ide-prototype/src/git/gitBridge.ts` | isomorphic-git façade: clone, pull, push, commit, blame, etc. |
| `mobile-ide/mobile-ide-prototype/src/iap/entitlements.ts` | Pure tier functions: `hasAIAccess()`, `canOpenMoreFiles()`, `tierLabel()` |
| `mobile-ide/mobile-ide-prototype/src/iap/iapService.ts` | Only file importing `react-native-purchases` |
| `mobile-ide/mobile-ide-prototype/src/stores/useSubscriptionStore.ts` | RevenueCat tier, Zustand + AsyncStorage |
| `mobile-ide/mobile-ide-prototype/src/stores/useAIStore.ts` | AI quota, streaming state, provider selection |
| `mobile-ide/mobile-ide-prototype/src/ai/aiProvider.ts` | `AIProvider` interface + types |
| `mobile-ide/mobile-ide-prototype/src/ai/quotaConfig.ts` | AI constants: `DAILY_CAP_CENTS=15`, `COMPLETION_MAX_TOKENS=256` |
| `mobile-ide/mobile-ide-prototype/src/ai/providerRegistry.ts` | `getProvider()` factory |
| `mobile-ide/mobile-ide-prototype/src/layout/TabletResponsive.tsx` | Split-pane tablet layout; terminal always at stable tree position |
| `docs/ID_REGISTRY.md` | Next available artefact IDs |
| `docs/RELEASE_PLAN.md` | Epics, user stories, ACs |
| `docs/superpowers/specs/` | Design specs (one per epic/feature) |
| `docs/superpowers/plans/` | Implementation plans (one per epic/feature) |
| `tools/generate-plan.js` | Regenerates plan dashboard |

---

## AI Features (EPIC-0010)

- **Cost model:** Developer-pays; provider API keys injected via EAS secrets (`EXPO_PUBLIC_CLAUDE_API_KEY`, `EXPO_PUBLIC_GEMINI_API_KEY`, `EXPO_PUBLIC_KIMI_API_KEY`)
- **Supported providers:** Claude (Haiku 4.5 completions / Sonnet 4.6 chat), Gemini 3 Flash, Kimi K2.6, Custom (OpenAI-compatible)
- **Daily quota:** 15¢/day shared across all built-in providers; Custom provider bypasses cap
- **Custom key storage:** `expo-secure-store` under key `'nomadcode_custom_ai_key'`
- **Completions bridge:** Monaco `registerInlineCompletionsProvider` ← `SET_INLINE_COMPLETION` ← `onCompletionContext` prop on Editor ← App.tsx 300ms debounced handler
- **Testing tiers:** Use RevenueCat Customer Override (no IAP bypass code in binary — App Store §3.1.1)

---

## IAP & Subscription (EPIC-0009)

- **Tiers:** Free (3-file limit), Pro ($7.99/mo · $59.99/yr), Pro+AI ($14.99/mo · $119.99/yr)
- **RevenueCat entitlement IDs:** `pro`, `pro_ai`
- **Key files:** `entitlements.ts` (pure functions), `iapService.ts` (RevenueCat boundary), `useSubscriptionStore` (Zustand, persists `tier` only)
- **Dev testing:** RevenueCat Dashboard → Customers → find device by GitHub user ID → grant/revoke entitlement

---

## CI/CD — Hard-Won Fixes

- **Security audit:** Use `npx audit-ci@^7 --omit=dev`. Config: `mobile-ide/mobile-ide-prototype/audit-ci.json`.
- **Android Kotlin pin:** `expo prebuild` regenerates `android/` in CI. Fix via `sed` step in `e2e-android` job to pin `kotlin-gradle-plugin:1.9.25` after prebuild.
- **iOS E2E:** Requires `brew tap wix/brew && brew install applesimutils` — not pre-installed on `macos-14`.
- **CodeQL:** Use v4 — v3 deprecated.
- **ESLint 10 flat config:** `eslint.config.js` replaces `.eslintrc.js`. Use `react: { version: '19.1.0' }` to pin (auto-detect removed in ESLint 10).
- **eslint-plugin-react-hooks@7:** Bundles React Compiler rules (`react-hooks/set-state-in-effect`, `react-hooks/preserve-manual-memoization`). Disable project-wide if not using the React Compiler transpiler.
- **Java for Android builds:** Must use Java 21 (`export JAVA_HOME=$(/usr/libexec/java_home -v 21)`). Java 25 (system default) breaks RN 0.76 Gradle plugin.
- **npm workspace lock file:** `npm install` in a workspace package updates the ROOT `package-lock.json` (`mobile-ide/package-lock.json`), not the package-level one. Always commit the root lock file.

---

## Branch Conventions

- Feature branches: `feature/US-XXXX-short-description` or `feature/epic-XXXX-description`
- Bug branches: `bugfix/BUG-XXXX-short-description`
- Never commit directly to `main` or `develop`
- All work merges to `develop` via PR; `develop` → `main` via release PR
- Git worktrees for implementation: `.worktrees/<branch-name>` (gitignored)

---

## iOS / Android Build

- **iOS build command:** `LANG=en_US.UTF-8 npx expo run:ios --device 1886F766-DF13-4673-9720-1ACDD534A6B8 --no-bundler` (iPad Pro 13-inch M5)
- **Start Metro separately:** `LANG=en_US.UTF-8 npx expo start --clear`
- **Boot simulator first:** `xcrun simctl boot 1886F766-DF13-4673-9720-1ACDD534A6B8`
- **Android build command:** `export JAVA_HOME=$(/usr/libexec/java_home -v 21) && npx expo run:android`
- **Available emulators:** `Pixel_Tablet_API35`, `Medium_Phone_API_35`
- **Bundle ID:** `com.FableSoft.NomadCode` (updated from `com.nomadcode.mobileide`)
- **LANG=en_US.UTF-8 required** — CocoaPods with Ruby 4.0 fails without it

## SDK 55 Package Hoisting Issue (simulator workaround)

Dependabot bumped several Expo packages to SDK 55 in `mobile-ide/node_modules/` while the project runs SDK 54. Symptoms: `Cannot find native module 'ExpoCryptoAES'` or similar.

- `expo-file-system` fixed: `~19.0.22` pinned in `package.json`
- `expo-crypto` still `55.x` in `mobile-ide/node_modules/` (pulled by `expo-auth-session`)
- **Fix already applied:** `metro.config.js` has `SDK54_OVERRIDES` in `resolveRequest`
- **Permanent fix needed:** upgrade entire project to SDK 55, or configure Dependabot to ignore Expo packages

---

## Test Commands

```bash
# Mobile prototype unit tests
cd mobile-ide/mobile-ide-prototype && npx jest --watchAll=false

# Mobile coverage
cd mobile-ide/mobile-ide-prototype && npx jest --watchAll=false --coverage

# Lint
cd mobile-ide/mobile-ide-prototype && npm run lint

# Type-check
cd mobile-ide/mobile-ide-prototype && npm run type-check

# Plan Visualizer tests (repo root)
npm test

# Regenerate dashboard
node tools/generate-plan.js
```

Last known passing: **1224 tests** (feature/epic-0010 branch); **1153 tests** (develop).

---

## Workflow Preferences

- **Always commit `Docs/AI_COST_LOG.md` and `progress.md`** at end of every session / before switching branches.
- **Always include `Docs/AI_COST_LOG.md`** when merging PRs — stage and commit it as part of merge prep.
- Use `superpowers:brainstorming` → `superpowers:writing-plans` → `superpowers:subagent-driven-development` for all new epics.
- Design specs → `docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md`
- Implementation plans → `docs/superpowers/plans/YYYY-MM-DD-<topic>.md`
