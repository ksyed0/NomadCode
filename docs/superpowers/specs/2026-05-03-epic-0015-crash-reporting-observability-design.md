# EPIC-0015 Design Spec — Crash Reporting & Observability
**Date:** 2026-05-03
**Author:** Claude Code (Session 20)
**Status:** Approved — ready for implementation planning

---

## 1. Overview

EPIC-0015 adds automated crash reporting and performance baseline monitoring to NomadCode using **Sentry** as the single observability provider. It covers two user stories:

- **US-0045** — Automated crash reporting with no PII in payloads (AC-0118, AC-0119)
- **US-0046** — Performance metrics tracking against §8 baselines (AC-0120, AC-0121)

**Dependencies:** EPIC-0011 (unblocked — EAS build pipeline now in place for source map upload).

---

## 2. Scope Decision

### In scope
- Sentry SDK initialisation with `ErrorBoundary` via `Sentry.wrap()`
- Crash capture with PII scrubbing (`beforeSend` blocklist)
- Automatic cold start tracking (`enableAutoPerformanceTracing`)
- Automatic API latency tracking (`enableNetworkInstrumentation`)
- JS heap memory sampling every 30s with threshold alerting
- Sentry dashboard alert rules for §8 baseline breaches (cold start >2s, API latency >500ms p95)

### Explicitly out of scope
- Per-pane `ErrorBoundary` components (deferred — `Sentry.wrap()` is sufficient for v1.0)
- Total process RSS monitoring (requires native module; JS heap is measurable without one)
- File tree render timing (deferred to dedicated performance EPIC)
- Terminal throughput rate tracking (deferred)
- Editor input latency (unreliable via WebView bridge; deferred)

### Performance baseline coverage

| §8 Metric | Target | How tracked | In code? |
|---|---|---|---|
| Cold start | < 2s | Automatic — `enableAutoPerformanceTracing` | No |
| API latency (p95) | < 500ms | Automatic — `enableNetworkInstrumentation` | No |
| JS heap (idle) | < 60MB JS heap (~150MB total est.) | `performanceMonitor.ts` sampling | Yes |
| Frame drops | n/a in §8 | Automatic — `enableNativeFramesTracking` | No |
| File tree render | < 100ms | **Deferred** | — |
| Terminal throughput | ≥ 10K lines/s | **Deferred** | — |
| Editor input latency | < 16ms | **Deferred** (WebView timing unreliable) | — |

**Note on memory threshold:** PROJECT.md §8 targets 150MB total process memory. `performance.memory.usedJSHeapSize` (Hermes) measures JS heap only — not Monaco WebView, terminal WebView, or native buffers, which typically add 60–100MB. The in-code threshold is set at **60MB JS heap** to leave headroom. Total RSS monitoring via `react-native-device-info`'s `getUsedMemory()` is a one-line future upgrade.

---

## 3. Provider: Sentry

**Package:** `@sentry/react-native` with the official Expo config plugin (`@sentry/react-native/expo`).

**Why Sentry over alternatives:**
- Official Expo config plugin handles source map upload automatically on EAS builds
- Single SDK covers crash reporting + performance monitoring (Bugsnag is crash-only)
- `beforeSend` hook provides a clean, testable PII scrubbing integration point
- No Firebase dependency (unlike Crashlytics — avoids ~10MB SDK overhead)
- Free tier: 5K errors/month, 10K performance traces/month — sufficient for early post-launch

---

## 4. Architecture

### New files

```
src/observability/
  sentryService.ts        — init(), captureError(), addBreadcrumb(), setContext()
  scrubber.ts             — beforeSend hook + PII regex patterns (pure, no Sentry import)
  performanceMonitor.ts   — JS heap memory sampling loop

tests/unit/
  scrubber.test.ts
  sentryService.test.ts
  performanceMonitor.test.ts
```

### Modified files

| File | Change |
|---|---|
| `global.d.ts` | Ambient type declaration for `performance.memory` (Hermes) |
| `index.js` | `sentryService.init()` before `AppRegistry.registerComponent()` |
| `App.tsx` | `Sentry.wrap(App)` at root; mount `startMemorySampling()` in `useEffect` |
| `app.json` | Add `@sentry/react-native/expo` config plugin |
| `eas.json` | Add `EXPO_PUBLIC_SENTRY_DSN` to all build profiles (non-secret) |
| `.env.example` | Add `EXPO_PUBLIC_SENTRY_DSN=` |

### Not touched
AI providers, stores, git layer, FileExplorer, TerminalWebView — errors in all these propagate up to the root `ErrorBoundary` added by `Sentry.wrap()`.

---

## 5. `sentryService.ts`

Single facade — the rest of the app never imports from `@sentry/react-native` directly.

```typescript
// src/observability/sentryService.ts

init(): void
```
Calls `Sentry.init()` with:
- `dsn`: `process.env.EXPO_PUBLIC_SENTRY_DSN` — logs a warning and returns early if missing (no crash in the crash reporter)
- `environment`: `__DEV__ ? 'development' : 'production'`
- `release`: `${appVersion}+${buildNumber}` (from `expo-application`)
- `enableAutoPerformanceTracing: true` — cold start + navigation transactions
- `enableNativeFramesTracking: true` — slow/frozen frame detection
- `enableNetworkInstrumentation: true` — automatic fetch() wrapping
- `tracesSampleRate: 0.3` — 30% of sessions; reduce after first month of production data
- `attachProps: false` — disables automatic React prop/state capture (prevents AI chat content leaking)
- `attachStacktrace: true` — always include stack trace on message-only events
- `beforeSend: scrubEvent` — PII scrubber from `scrubber.ts`

```typescript
captureError(err: Error, context?: Record<string, unknown>): void
addBreadcrumb(category: string, message: string, data?: Record<string, unknown>): void
setContext(key: string, value: Record<string, unknown>): void
```

Call sites for `addBreadcrumb` (non-exhaustive — implementer adds as needed):
- File opened / closed
- Git clone started / completed / failed
- AI request started / completed / failed
- Subscription tier loaded

---

## 6. `scrubber.ts`

Pure module — no Sentry import, takes and returns a plain `Event` object shape. Fully unit-testable without SDK mocks.

### PII patterns (blocklist)

```typescript
const SENSITIVE_PATTERNS: RegExp[] = [
  /ghp_[a-zA-Z0-9]{36}/g,              // GitHub PAT
  /github_pat_[a-zA-Z0-9_]{82}/g,      // GitHub fine-grained PAT
  /sk-ant-[a-zA-Z0-9\-]{90,}/g,        // Anthropic key
  /AIza[a-zA-Z0-9\-_]{35}/g,           // Google API key
  /sk-or-[a-zA-Z0-9\-]{40,}/g,         // OpenRouter key
  /Bearer\s+[a-zA-Z0-9._\-]{20,}/g,   // Generic bearer token
];
```

### Truncation rules

| Field | Limit | Replacement |
|---|---|---|
| `event.extra.*` values | 500 chars | `"[truncated]"` |
| `event.breadcrumbs[].data.*` values | 200 chars | `"[truncated]"` |
| `event.message` | 1000 chars | truncated (no replacement tag — message is safe) |

### Behaviour

1. Walk all string fields in `event.extra` recursively — apply regex replacements
2. Walk all `event.breadcrumbs[].data` values — apply regex + truncation
3. Apply truncation to `event.extra` values
4. Return the scrubbed event (or `null` to drop the event entirely — not used; dropping silently is worse than a scrubbed report)

**Rationale for blocklist over allowlist:** Allowlist (only send stack trace + device info) is safer but loses diagnostic context needed to fix bugs. The blocklist covers all credential formats used by NomadCode; the 500-char truncation is a belt-and-suspenders catch for file content that doesn't match a known pattern.

---

## 7. `performanceMonitor.ts`

```typescript
startMemorySampling(
  thresholdMb: number = 60,
  intervalMs: number = 30_000
): () => void   // returns cleanup function
```

### Behaviour

```
On start:
  → Guard: if (!global.performance?.memory) return no-op cleanup

Interval (every 30s while app is active):
  → usedMb = performance.memory.usedJSHeapSize / 1_048_576
  → sentryService.setContext('memory', { usedMb, thresholdMb, unit: 'MB (JS heap)' })
  → if usedMb > thresholdMb AND Date.now() - lastAlertedAt > 5 * 60 * 1000:
      sentryService.captureError(
        new Error(`JS heap exceeded ${thresholdMb}MB threshold`),
        { usedMb, thresholdMb }
      )
      lastAlertedAt = Date.now()

AppState 'background' → clearInterval (pause)
AppState 'active'     → restart interval
Cleanup              → clearInterval + AppState.removeEventListener
```

### Rate limiting
`lastAlertedAt` is a module-level `number` (default `0`). The 5-minute cooldown prevents alert storms during a sustained memory leak. Tests mock `Date.now()` to verify this behaviour.

### App.tsx wiring

```typescript
useEffect(() => {
  const stopSampling = startMemorySampling();
  return stopSampling; // cleanup on unmount
}, []);
```

---

## 8. `global.d.ts`

```typescript
// global.d.ts — Hermes performance.memory type declaration
declare global {
  interface Performance {
    memory?: {
      usedJSHeapSize: number;
      totalJSHeapSize: number;
      jsHeapSizeLimit: number;
    };
  }
}
export {};
```

Without this file, `global.performance.memory` causes a TypeScript error in `performanceMonitor.ts`.

---

## 9. EAS & App Config

### `eas.json`

Add `EXPO_PUBLIC_SENTRY_DSN` to **all three** build profiles (development, preview, production) as a non-secret env var. Development needs it for crash visibility during QA:

```json
"development": {
  "env": { "EXPO_PUBLIC_SENTRY_DSN": "https://4d0ca8de7cdf9df11b212786fd3af78e@o4511328521551872.ingest.us.sentry.io/4511328528171008" }
},
"preview": {
  "env": { "EXPO_PUBLIC_SENTRY_DSN": "https://4d0ca8de7cdf9df11b212786fd3af78e@o4511328521551872.ingest.us.sentry.io/4511328528171008" }
},
"production": {
  "autoIncrement": true,
  "env": {
    "EXPO_PUBLIC_SENTRY_DSN": "https://4d0ca8de7cdf9df11b212786fd3af78e@o4511328521551872.ingest.us.sentry.io/4511328528171008",
    "EXPO_PUBLIC_OPENROUTER_API_KEY": "EAS_SECRET",
    "EXPO_PUBLIC_REVENUECAT_IOS_KEY": "EAS_SECRET",
    "EXPO_PUBLIC_REVENUECAT_ANDROID_KEY": "EAS_SECRET"
  }
}
```

**Where to get the DSN:** Sentry dashboard → Project → Settings → Client Keys (DSN). The DSN is a public identifier — safe to commit to `app.json` or `.env.example`.

### `app.json` — Sentry config plugin

```json
"plugins": [
  "expo-secure-store",
  "expo-web-browser",
  [
    "@sentry/react-native/expo",
    {
      "project": "nomadcode",
      "organization": "fablesoft"
    }
  ]
]
```

The plugin handles: source map upload on EAS builds, native crash handler registration (iOS + Android), and ProGuard rules for Android.

---

## 10. Sentry Dashboard Setup (manual, post-deployment)

These are dashboard configurations, not code changes:

1. **Alert: Cold start regression** — Transaction `app.load` p75 > 2000ms → notify
2. **Alert: API latency regression** — Transaction `http.client` p95 > 500ms → notify
3. **Alert: Crash rate spike** — Error event rate > 50/hour → notify
4. **Issue grouping:** Group by stack frame, not error message (reduces noise from dynamic messages)
5. **Ignored issues:** `AbortError` from cancelled AI streams (expected, not a crash)

---

## 11. Test Strategy

### `scrubber.test.ts` (10 tests)
- Strips each of the 6 key patterns
- Truncates `event.extra` values > 500 chars
- Truncates `breadcrumb.data` values > 200 chars
- Handles `undefined` extra and `null` breadcrumbs gracefully
- Passes clean events unchanged
- Scrubs recursively in nested objects

### `sentryService.test.ts` (7 tests)
Mock `@sentry/react-native`. Assert:
- `init()` calls `Sentry.init` with `attachProps: false`, `tracesSampleRate: 0.3`
- `init()` with missing DSN logs warning and returns early
- `captureError()` calls `Sentry.captureException`
- `addBreadcrumb()` calls `Sentry.addBreadcrumb`
- `setContext()` calls `Sentry.setContext`
- `init()` passes `scrubEvent` as `beforeSend`

### `performanceMonitor.test.ts` (8 tests)
Mock `global.performance.memory`, `setInterval`, `clearInterval`, `AppState`:
- Starts interval on call
- Cleanup function clears interval and removes AppState listener
- Fires `captureError` when heap exceeds threshold
- Does NOT fire within 5-minute rate-limit window (mock `Date.now()`)
- Pauses on `AppState` → `'background'`
- Resumes on `AppState` → `'active'`
- Returns no-op cleanup when `performance.memory` is undefined
- Calls `setContext` on every tick with current reading

---

## 12. Acceptance Criteria Mapping

| AC | How satisfied |
|---|---|
| AC-0118: Crashes auto-reported | `Sentry.wrap()` root ErrorBoundary + global unhandledRejection handler via SDK |
| AC-0119: No PII in payloads | `scrubber.ts` `beforeSend` hook + `attachProps: false` |
| AC-0120: Cold start, latency, memory tracked | Automatic (cold start, latency) + `performanceMonitor.ts` (memory) |
| AC-0121: Degradation beyond baseline triggers alert | Sentry dashboard alert rules (cold start >2s, API latency >500ms p95, heap >60MB) |

---

## 13. Open Questions / Decisions Made

| Question | Decision |
|---|---|
| Provider? | Sentry — covers crash + performance in one SDK |
| Performance scope? | Automatic metrics only; manual (file tree, terminal) deferred |
| PII scrubbing strategy? | Blocklist — regex patterns + truncation |
| DSN as secret? | No — non-secret env var in all profiles (public identifier by design) |
| Memory API? | `performance.memory.usedJSHeapSize` (Hermes) at 60MB threshold; total RSS deferred |
| Sample rate? | 0.3 — reduce after first month of production data |
| Automatic prop/state capture? | Disabled (`attachProps: false`) — prevents AI chat content leaking |
| Per-pane ErrorBoundary? | Deferred — `Sentry.wrap()` sufficient for v1.0 |
