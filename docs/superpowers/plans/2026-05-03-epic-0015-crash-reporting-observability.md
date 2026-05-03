# EPIC-0015 Crash Reporting & Observability — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Sentry crash reporting and automatic performance monitoring (cold start, API latency, JS heap memory) to NomadCode with a PII-scrubbing `beforeSend` hook.

**Architecture:** A thin `src/observability/` module wraps the Sentry SDK — the rest of the app never imports `@sentry/react-native` directly. `scrubber.ts` is a pure function (no SDK import) for easy unit testing. `performanceMonitor.ts` samples Hermes `performance.memory` on a 30s interval with AppState-aware pausing. Sentry is initialised in `index.js` before `registerRootComponent`, then `Sentry.wrap(App)` adds the root ErrorBoundary.

**Tech Stack:** `@sentry/react-native` (Expo config plugin), Expo SDK 54, React Native 0.81.5, Hermes engine, Zustand, TypeScript 5.

**Test runner:** `cd mobile-ide/mobile-ide-prototype && npx jest --watchAll=false`
**Single file:** `cd mobile-ide/mobile-ide-prototype && npx jest tests/unit/<file> --watchAll=false`

---

## File map

| File | Action | Responsibility |
|---|---|---|
| `src/observability/scrubber.ts` | Create | Pure `beforeSend` hook — regex scrub + truncation |
| `src/observability/sentryService.ts` | Create | Sentry facade: init, captureError, addBreadcrumb, setContext |
| `src/observability/performanceMonitor.ts` | Create | JS heap memory sampling loop |
| `global.d.ts` | Create | Hermes `performance.memory` ambient type |
| `tests/unit/scrubber.test.ts` | Create | 10 unit tests for scrubber |
| `tests/unit/sentryService.test.ts` | Create | 7 unit tests for service facade |
| `tests/unit/performanceMonitor.test.ts` | Create | 8 unit tests for memory sampler |
| `index.js` | Modify | Add `sentryService.init()` before `registerRootComponent` |
| `App.tsx` | Modify | `Sentry.wrap(App)` export + `startMemorySampling()` useEffect |
| `app.json` | Modify | Add `@sentry/react-native/expo` config plugin |
| `eas.json` | Modify | Add `EXPO_PUBLIC_SENTRY_DSN` to all three build profiles |
| `.env.example` | Modify | Add `EXPO_PUBLIC_SENTRY_DSN=` |

---

## Task 1: Install @sentry/react-native

**Files:**
- Modify: `mobile-ide/mobile-ide-prototype/package.json` (via npm install)

No tests needed — package installation only.

- [ ] **Step 1: Install the package**

```bash
cd mobile-ide/mobile-ide-prototype && npm install @sentry/react-native
```

Expected: package installs without peer dependency errors.

- [ ] **Step 2: Verify install**

```bash
cd mobile-ide/mobile-ide-prototype && node -e "require('@sentry/react-native'); console.log('ok')"
```

Expected output: `ok`

- [ ] **Step 3: Verify existing tests still pass**

```bash
cd mobile-ide/mobile-ide-prototype && npx jest --watchAll=false 2>&1 | tail -5
```

Expected: same test count as before (no regressions from install).

- [ ] **Step 4: Commit**

```bash
git add mobile-ide/mobile-ide-prototype/package.json mobile-ide/mobile-ide-prototype/package-lock.json
git commit -m "chore US-0045: install @sentry/react-native"
```

---

## Task 2: global.d.ts — Hermes memory type

**Files:**
- Create: `mobile-ide/mobile-ide-prototype/global.d.ts`

No tests needed — TypeScript ambient declaration.

- [ ] **Step 1: Create the file**

```typescript
// mobile-ide/mobile-ide-prototype/global.d.ts
// Hermes exposes performance.memory in React Native — no @types declaration exists.
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

- [ ] **Step 2: Verify TypeScript accepts it**

```bash
cd mobile-ide/mobile-ide-prototype && npx tsc --noEmit 2>&1 | grep "global.d.ts" | head -5
```

Expected: no errors referencing `global.d.ts`.

- [ ] **Step 3: Commit**

```bash
git add mobile-ide/mobile-ide-prototype/global.d.ts
git commit -m "chore US-0045: add Hermes performance.memory ambient type declaration"
```

---

## Task 3: scrubber.ts (TDD)

**Files:**
- Create: `mobile-ide/mobile-ide-prototype/src/observability/scrubber.ts`
- Create: `mobile-ide/mobile-ide-prototype/tests/unit/scrubber.test.ts`

The scrubber is a **pure function** — no `@sentry/react-native` import. It operates on plain objects.

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/scrubber.test.ts`:

```typescript
import { scrubEvent } from '../../src/observability/scrubber';

// Minimal Sentry Event shape used in tests
function makeEvent(overrides: Record<string, unknown> = {}) {
  return {
    message: 'test error',
    extra: {},
    breadcrumbs: { values: [] },
    ...overrides,
  };
}

describe('scrubEvent — token scrubbing', () => {
  it('strips GitHub PAT from error message', () => {
    const event = makeEvent({ message: 'auth failed: ghp_aBcDeFgHiJkLmNoPqRsTuVwXyZ123456789012' });
    const result = scrubEvent(event);
    expect(result.message).not.toContain('ghp_');
    expect(result.message).toContain('[redacted]');
  });

  it('strips Anthropic key from extra data', () => {
    const event = makeEvent({
      extra: { detail: 'key sk-ant-api03-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa-AAAAAAA was rejected' },
    });
    const result = scrubEvent(event);
    expect(JSON.stringify(result.extra)).not.toContain('sk-ant-');
  });

  it('strips OpenRouter key', () => {
    const event = makeEvent({ extra: { key: 'sk-or-v1-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' } });
    const result = scrubEvent(event);
    expect(JSON.stringify(result.extra)).not.toContain('sk-or-');
  });

  it('strips Google API key', () => {
    const event = makeEvent({ extra: { key: 'AIzaSyAaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' } });
    const result = scrubEvent(event);
    expect(JSON.stringify(result.extra)).not.toContain('AIza');
  });

  it('strips generic Bearer token from breadcrumb data', () => {
    const event = makeEvent({
      breadcrumbs: {
        values: [{ category: 'http', data: { Authorization: 'Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyIn0.abc' } }],
      },
    });
    const result = scrubEvent(event);
    const bc = (result.breadcrumbs as { values: Array<{ data: Record<string, string> }> }).values[0];
    expect(bc.data.Authorization).not.toContain('eyJhbGci');
  });
});

describe('scrubEvent — truncation', () => {
  it('truncates event.extra values longer than 500 chars', () => {
    const long = 'x'.repeat(501);
    const event = makeEvent({ extra: { content: long } });
    const result = scrubEvent(event);
    expect((result.extra as Record<string, string>).content).toBe('[truncated]');
  });

  it('does NOT truncate event.extra values of exactly 500 chars', () => {
    const exact = 'x'.repeat(500);
    const event = makeEvent({ extra: { content: exact } });
    const result = scrubEvent(event);
    expect((result.extra as Record<string, string>).content).toBe(exact);
  });

  it('truncates breadcrumb data values longer than 200 chars', () => {
    const long = 'y'.repeat(201);
    const event = makeEvent({
      breadcrumbs: { values: [{ category: 'action', data: { body: long } }] },
    });
    const result = scrubEvent(event);
    const bc = (result.breadcrumbs as { values: Array<{ data: Record<string, string> }> }).values[0];
    expect(bc.data.body).toBe('[truncated]');
  });
});

describe('scrubEvent — edge cases', () => {
  it('handles undefined event.extra gracefully', () => {
    const event = makeEvent({ extra: undefined });
    expect(() => scrubEvent(event)).not.toThrow();
  });

  it('handles undefined breadcrumbs gracefully', () => {
    const event = makeEvent({ breadcrumbs: undefined });
    expect(() => scrubEvent(event)).not.toThrow();
  });

  it('passes clean events through unchanged', () => {
    const event = makeEvent({ message: 'Nothing sensitive here', extra: { count: 42 } });
    const result = scrubEvent(event);
    expect(result.message).toBe('Nothing sensitive here');
    expect((result.extra as Record<string, number>).count).toBe(42);
  });
});
```

- [ ] **Step 2: Run — expect failure**

```bash
cd mobile-ide/mobile-ide-prototype && npx jest tests/unit/scrubber.test.ts --watchAll=false 2>&1 | tail -5
```

Expected: `Cannot find module '../../src/observability/scrubber'`

- [ ] **Step 3: Create scrubber.ts**

Create `src/observability/scrubber.ts`:

```typescript
// src/observability/scrubber.ts
// Pure PII scrubber for Sentry beforeSend hook.
// No @sentry/react-native import — operates on plain objects so it is fully
// unit-testable without SDK mocks.

const SENSITIVE_PATTERNS: RegExp[] = [
  /ghp_[a-zA-Z0-9]{36}/g,                // GitHub PAT (classic)
  /github_pat_[a-zA-Z0-9_]{82}/g,        // GitHub fine-grained PAT
  /sk-ant-[a-zA-Z0-9\-]{90,}/g,          // Anthropic key
  /AIza[a-zA-Z0-9\-_]{35}/g,             // Google API key
  /sk-or-[a-zA-Z0-9\-]{40,}/g,           // OpenRouter key
  /Bearer\s+[a-zA-Z0-9._\-]{20,}/g,      // Generic bearer token
];

const EXTRA_MAX_LEN       = 500;
const BREADCRUMB_MAX_LEN  = 200;
const REDACT_TAG          = '[redacted]';
const TRUNCATE_TAG        = '[truncated]';

function redactString(value: string): string {
  let result = value;
  for (const pattern of SENSITIVE_PATTERNS) {
    result = result.replace(pattern, REDACT_TAG);
  }
  return result;
}

function processString(value: string, maxLen: number): string {
  const redacted = redactString(value);
  return redacted.length > maxLen ? TRUNCATE_TAG : redacted;
}

function scrubObject(
  obj: Record<string, unknown>,
  maxLen: number
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      result[key] = processString(value, maxLen);
    } else if (value !== null && typeof value === 'object') {
      result[key] = scrubObject(value as Record<string, unknown>, maxLen);
    } else {
      result[key] = value;
    }
  }
  return result;
}

// SentryEvent is typed loosely so this module has zero SDK imports.
interface SentryBreadcrumb {
  data?: Record<string, unknown>;
  [key: string]: unknown;
}

interface SentryEvent {
  message?: string;
  extra?: Record<string, unknown>;
  breadcrumbs?: { values?: SentryBreadcrumb[] };
  [key: string]: unknown;
}

export function scrubEvent(event: SentryEvent): SentryEvent {
  const result = { ...event };

  // Scrub event.message
  if (typeof result.message === 'string') {
    result.message = redactString(result.message);
  }

  // Scrub + truncate event.extra values
  if (result.extra && typeof result.extra === 'object') {
    result.extra = scrubObject(result.extra, EXTRA_MAX_LEN);
  }

  // Scrub + truncate breadcrumb data values
  if (result.breadcrumbs?.values) {
    result.breadcrumbs = {
      ...result.breadcrumbs,
      values: result.breadcrumbs.values.map((bc) => ({
        ...bc,
        data: bc.data ? scrubObject(bc.data, BREADCRUMB_MAX_LEN) : bc.data,
      })),
    };
  }

  return result;
}
```

- [ ] **Step 4: Run — expect pass**

```bash
cd mobile-ide/mobile-ide-prototype && npx jest tests/unit/scrubber.test.ts --watchAll=false
```

Expected: 10 tests pass.

- [ ] **Step 5: Commit**

```bash
git add mobile-ide/mobile-ide-prototype/src/observability/scrubber.ts \
        mobile-ide/mobile-ide-prototype/tests/unit/scrubber.test.ts
git commit -m "feat US-0045: add PII scrubber with token redaction and length truncation"
```

---

## Task 4: sentryService.ts (TDD)

**Files:**
- Create: `mobile-ide/mobile-ide-prototype/src/observability/sentryService.ts`
- Create: `mobile-ide/mobile-ide-prototype/tests/unit/sentryService.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/sentryService.test.ts`:

```typescript
import * as Sentry from '@sentry/react-native';
import { init, captureError, addBreadcrumb, setContext } from '../../src/observability/sentryService';

jest.mock('@sentry/react-native', () => ({
  init: jest.fn(),
  captureException: jest.fn(),
  addBreadcrumb: jest.fn(),
  setContext: jest.fn(),
}));

// Store original env to restore after tests
const originalDsn = process.env.EXPO_PUBLIC_SENTRY_DSN;

beforeEach(() => {
  jest.clearAllMocks();
  process.env.EXPO_PUBLIC_SENTRY_DSN = 'https://test@test.ingest.sentry.io/123';
});

afterAll(() => {
  process.env.EXPO_PUBLIC_SENTRY_DSN = originalDsn;
});

describe('init()', () => {
  it('calls Sentry.init with the DSN from env', () => {
    init();
    expect(Sentry.init).toHaveBeenCalledWith(
      expect.objectContaining({ dsn: 'https://test@test.ingest.sentry.io/123' })
    );
  });

  it('sets attachProps: false', () => {
    init();
    expect(Sentry.init).toHaveBeenCalledWith(
      expect.objectContaining({ attachProps: false })
    );
  });

  it('sets tracesSampleRate: 0.3', () => {
    init();
    expect(Sentry.init).toHaveBeenCalledWith(
      expect.objectContaining({ tracesSampleRate: 0.3 })
    );
  });

  it('logs a warning and does not call Sentry.init when DSN is missing', () => {
    process.env.EXPO_PUBLIC_SENTRY_DSN = '';
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    init();
    expect(Sentry.init).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('SENTRY_DSN'));
    warnSpy.mockRestore();
  });

  it('passes scrubEvent as beforeSend', () => {
    init();
    const call = (Sentry.init as jest.Mock).mock.calls[0][0];
    expect(typeof call.beforeSend).toBe('function');
  });
});

describe('captureError()', () => {
  it('calls Sentry.captureException with the error', () => {
    init();
    const err = new Error('test crash');
    captureError(err);
    expect(Sentry.captureException).toHaveBeenCalledWith(err, expect.anything());
  });

  it('passes context as extra data', () => {
    init();
    const err = new Error('test');
    captureError(err, { usedMb: 72 });
    expect(Sentry.captureException).toHaveBeenCalledWith(
      err,
      expect.objectContaining({ extra: { usedMb: 72 } })
    );
  });
});

describe('addBreadcrumb()', () => {
  it('calls Sentry.addBreadcrumb with category and message', () => {
    addBreadcrumb('file', 'File opened', { path: '/doc.ts' });
    expect(Sentry.addBreadcrumb).toHaveBeenCalledWith(
      expect.objectContaining({ category: 'file', message: 'File opened' })
    );
  });
});

describe('setContext()', () => {
  it('calls Sentry.setContext with key and value', () => {
    setContext('memory', { usedMb: 45 });
    expect(Sentry.setContext).toHaveBeenCalledWith('memory', { usedMb: 45 });
  });
});
```

- [ ] **Step 2: Run — expect failure**

```bash
cd mobile-ide/mobile-ide-prototype && npx jest tests/unit/sentryService.test.ts --watchAll=false 2>&1 | tail -5
```

Expected: `Cannot find module '../../src/observability/sentryService'`

- [ ] **Step 3: Create sentryService.ts**

Create `src/observability/sentryService.ts`:

```typescript
// src/observability/sentryService.ts
// Thin facade over @sentry/react-native.
// The rest of the app imports from here — never from @sentry/react-native directly.

import * as Sentry from '@sentry/react-native';
import { scrubEvent } from './scrubber';

export function init(): void {
  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
  if (!dsn) {
    console.warn('[sentryService] SENTRY_DSN not set — crash reporting disabled');
    return;
  }

  Sentry.init({
    dsn,
    environment:                 __DEV__ ? 'development' : 'production',
    enableAutoPerformanceTracing: true,   // cold start + navigation
    enableNativeFramesTracking:   true,   // slow/frozen frame detection
    enableNetworkInstrumentation: true,   // wraps all fetch() calls
    tracesSampleRate:             0.3,    // 30% of sessions get full trace
    attachProps:                  false,  // prevents React props/state capture
    attachStacktrace:             true,   // always include stack on message events
    beforeSend:                   scrubEvent as Parameters<typeof Sentry.init>[0]['beforeSend'],
  });
}

export function captureError(
  err: Error,
  context?: Record<string, unknown>
): void {
  Sentry.captureException(err, context ? { extra: context } : undefined);
}

export function addBreadcrumb(
  category: string,
  message: string,
  data?: Record<string, unknown>
): void {
  Sentry.addBreadcrumb({ category, message, data });
}

export function setContext(
  key: string,
  value: Record<string, unknown>
): void {
  Sentry.setContext(key, value);
}
```

- [ ] **Step 4: Run — expect pass**

```bash
cd mobile-ide/mobile-ide-prototype && npx jest tests/unit/sentryService.test.ts --watchAll=false
```

Expected: 9 tests pass.

- [ ] **Step 5: Commit**

```bash
git add mobile-ide/mobile-ide-prototype/src/observability/sentryService.ts \
        mobile-ide/mobile-ide-prototype/tests/unit/sentryService.test.ts
git commit -m "feat US-0045: add sentryService facade — init, captureError, addBreadcrumb, setContext"
```

---

## Task 5: performanceMonitor.ts (TDD)

**Files:**
- Create: `mobile-ide/mobile-ide-prototype/src/observability/performanceMonitor.ts`
- Create: `mobile-ide/mobile-ide-prototype/tests/unit/performanceMonitor.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/performanceMonitor.test.ts`:

```typescript
import { AppState, AppStateStatus } from 'react-native';
import { startMemorySampling } from '../../src/observability/performanceMonitor';
import * as sentryService from '../../src/observability/sentryService';

jest.mock('react-native', () => ({
  AppState: {
    addEventListener: jest.fn(() => ({ remove: jest.fn() })),
  },
}));

jest.mock('../../src/observability/sentryService', () => ({
  captureError: jest.fn(),
  setContext:   jest.fn(),
}));

function setMemory(usedMb: number) {
  (global as unknown as { performance: { memory: { usedJSHeapSize: number } } })
    .performance = { memory: { usedJSHeapSize: usedMb * 1_048_576 } };
}

function clearMemory() {
  (global as unknown as { performance?: unknown }).performance = undefined;
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  setMemory(30); // default: below threshold
});

afterEach(() => {
  jest.useRealTimers();
  clearMemory();
});

describe('startMemorySampling()', () => {
  it('returns a cleanup function', () => {
    const stop = startMemorySampling();
    expect(typeof stop).toBe('function');
    stop();
  });

  it('calls setContext on each interval tick', () => {
    startMemorySampling(60, 30_000);
    jest.advanceTimersByTime(30_000);
    expect(sentryService.setContext).toHaveBeenCalledWith(
      'memory',
      expect.objectContaining({ usedMb: expect.any(Number), thresholdMb: 60 })
    );
  });

  it('fires captureError when heap exceeds threshold', () => {
    setMemory(75); // above 60MB threshold
    startMemorySampling(60, 30_000);
    jest.advanceTimersByTime(30_000);
    expect(sentryService.captureError).toHaveBeenCalledTimes(1);
    expect(sentryService.captureError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ usedMb: expect.any(Number), thresholdMb: 60 })
    );
  });

  it('does NOT fire captureError when heap is below threshold', () => {
    setMemory(30); // below 60MB
    startMemorySampling(60, 30_000);
    jest.advanceTimersByTime(30_000);
    expect(sentryService.captureError).not.toHaveBeenCalled();
  });

  it('rate-limits alerts — does not fire twice within 5 minutes', () => {
    setMemory(75);
    startMemorySampling(60, 30_000);
    jest.advanceTimersByTime(30_000);   // first tick — fires
    jest.advanceTimersByTime(30_000);   // second tick — within 5 min, should NOT fire again
    expect(sentryService.captureError).toHaveBeenCalledTimes(1);
  });

  it('fires again after 5-minute cooldown', () => {
    setMemory(75);
    startMemorySampling(60, 30_000);
    jest.advanceTimersByTime(30_000);              // fires once
    jest.advanceTimersByTime(5 * 60 * 1_000 + 1); // cooldown elapsed
    jest.advanceTimersByTime(30_000);              // fires again
    expect(sentryService.captureError).toHaveBeenCalledTimes(2);
  });

  it('cleanup function clears the interval', () => {
    const stop = startMemorySampling(60, 30_000);
    stop();
    jest.advanceTimersByTime(60_000);
    expect(sentryService.setContext).not.toHaveBeenCalled();
  });

  it('returns no-op cleanup when performance.memory is unavailable', () => {
    clearMemory();
    const stop = startMemorySampling();
    expect(typeof stop).toBe('function');
    expect(() => {
      jest.advanceTimersByTime(30_000);
      stop();
    }).not.toThrow();
    // No intervals were started, so setContext is never called
    expect(sentryService.setContext).not.toHaveBeenCalled();
  });

  it('registers an AppState listener', () => {
    startMemorySampling();
    expect(AppState.addEventListener).toHaveBeenCalledWith(
      'change',
      expect.any(Function)
    );
  });
});
```

- [ ] **Step 2: Run — expect failure**

```bash
cd mobile-ide/mobile-ide-prototype && npx jest tests/unit/performanceMonitor.test.ts --watchAll=false 2>&1 | tail -5
```

Expected: `Cannot find module '../../src/observability/performanceMonitor'`

- [ ] **Step 3: Create performanceMonitor.ts**

Create `src/observability/performanceMonitor.ts`:

```typescript
// src/observability/performanceMonitor.ts
// JS heap memory sampling loop.
// Samples global.performance.memory (Hermes API) every intervalMs ms.
// Pauses when the app is backgrounded, resumes on foreground.
// Note: usedJSHeapSize is JS heap only — does NOT include WebView or native memory.
// The 60MB threshold reflects this (not the 150MB total-process target in §8).

import { AppState, AppStateStatus } from 'react-native';
import { captureError, setContext } from './sentryService';

const ALERT_COOLDOWN_MS = 5 * 60 * 1_000; // 5 minutes

export function startMemorySampling(
  thresholdMb = 60,
  intervalMs  = 30_000
): () => void {
  // Guard: Hermes always has performance.memory, but be defensive.
  if (!global.performance?.memory) {
    return () => { /* no-op */ };
  }

  let lastAlertedAt = 0;
  let intervalId: ReturnType<typeof setInterval> | null = null;

  function sample() {
    const usedMb = (global.performance!.memory!.usedJSHeapSize) / 1_048_576;
    setContext('memory', { usedMb: Math.round(usedMb * 10) / 10, thresholdMb, unit: 'MB (JS heap)' });

    if (usedMb > thresholdMb && Date.now() - lastAlertedAt > ALERT_COOLDOWN_MS) {
      captureError(
        new Error(`JS heap exceeded ${thresholdMb}MB threshold`),
        { usedMb: Math.round(usedMb * 10) / 10, thresholdMb }
      );
      lastAlertedAt = Date.now();
    }
  }

  function start() {
    if (!intervalId) {
      intervalId = setInterval(sample, intervalMs);
    }
  }

  function pause() {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
  }

  start();

  const subscription = AppState.addEventListener(
    'change',
    (nextState: AppStateStatus) => {
      if (nextState === 'background' || nextState === 'inactive') {
        pause();
      } else if (nextState === 'active') {
        start();
      }
    }
  );

  return () => {
    pause();
    subscription.remove();
  };
}
```

- [ ] **Step 4: Run — expect pass**

```bash
cd mobile-ide/mobile-ide-prototype && npx jest tests/unit/performanceMonitor.test.ts --watchAll=false
```

Expected: 8 tests pass.

- [ ] **Step 5: Commit**

```bash
git add mobile-ide/mobile-ide-prototype/src/observability/performanceMonitor.ts \
        mobile-ide/mobile-ide-prototype/tests/unit/performanceMonitor.test.ts
git commit -m "feat US-0046: add performanceMonitor — JS heap sampling, AppState-aware, 5min rate limit"
```

---

## Task 6: Wire index.js + App.tsx

**Files:**
- Modify: `mobile-ide/mobile-ide-prototype/index.js`
- Modify: `mobile-ide/mobile-ide-prototype/App.tsx`
- Modify: `mobile-ide/mobile-ide-prototype/tests/unit/App.test.tsx`

- [ ] **Step 1: Update index.js**

Open `index.js`. The current content is:

```javascript
import { Buffer } from 'buffer';
if (typeof global.Buffer === 'undefined') {
  global.Buffer = Buffer;
}

import { registerRootComponent } from 'expo';
import App from './App';

registerRootComponent(App);
```

Replace with:

```javascript
// Polyfill Node.js Buffer global — required by isomorphic-git.
// Must be imported before any code that uses Buffer.
import { Buffer } from 'buffer';
if (typeof global.Buffer === 'undefined') {
  global.Buffer = Buffer;
}

// Initialise Sentry before registering the root component so that crashes
// during the initial render are captured. This must come before App import.
import { init as initSentry } from './src/observability/sentryService';
initSentry();

import { registerRootComponent } from 'expo';
import App from './App';

registerRootComponent(App);
```

- [ ] **Step 2: Update App.tsx — add Sentry.wrap + memory sampling**

Find the last line of `App.tsx`. It currently ends with the `StyleSheet.create({...})` block and the file exports `export default function App()` at line 69.

**Change the export** — find this pattern near line 69:

```typescript
export default function App() {
```

This stays as-is (function declaration, not the export we need to change). Instead, find or add a default export wrapper at the very end of the file after the StyleSheet.create block. Check what the last line of App.tsx is:

```bash
tail -3 mobile-ide/mobile-ide-prototype/App.tsx
```

If the file ends with the StyleSheet (no separate export), add after the closing `});` of StyleSheet.create:

```typescript
// Re-export wrapped in Sentry root ErrorBoundary
import * as Sentry from '@sentry/react-native';
```

Wait — imports must be at the top. Instead, do this properly:

**a)** Add to the imports section at the top of App.tsx (after the last existing import, around line 65):

```typescript
import * as Sentry from '@sentry/react-native';
import { startMemorySampling } from './src/observability/performanceMonitor';
```

**b)** Inside the `App` function body, add a `useEffect` for memory sampling after the existing `useEffect` for `loadOpenRouterModels` (around line 148–150):

```typescript
// Start memory sampling — reports JS heap usage to Sentry every 30s
useEffect(() => {
  const stopSampling = startMemorySampling();
  return stopSampling;
}, []);
```

**c)** Change the export at the bottom of the file. The function is declared as:
```typescript
export default function App() {
```

This needs to become a named function wrapped by Sentry. The cleanest approach without restructuring the whole file:

Find the line `export default function App() {` and change it to:
```typescript
function App() {
```

Then after the closing `StyleSheet.create({...});` at the very end of the file, add:

```typescript
export default Sentry.wrap(App);
```

- [ ] **Step 3: Update App.test.tsx mock**

Open `tests/unit/App.test.tsx`. Find the `jest.mock` call for `@sentry/react-native` if it exists, or add one. The mock for `@sentry/react-native` must include:

```typescript
jest.mock('@sentry/react-native', () => ({
  init: jest.fn(),
  wrap: jest.fn((component: unknown) => component),
  captureException: jest.fn(),
  addBreadcrumb: jest.fn(),
  setContext: jest.fn(),
}));
```

Also add a mock for `./src/observability/performanceMonitor` so the memory sampling doesn't run in tests:

```typescript
jest.mock('./src/observability/performanceMonitor', () => ({
  startMemorySampling: jest.fn(() => jest.fn()), // returns no-op cleanup
}));
```

And for `./src/observability/sentryService`:

```typescript
jest.mock('./src/observability/sentryService', () => ({
  init:            jest.fn(),
  captureError:    jest.fn(),
  addBreadcrumb:   jest.fn(),
  setContext:      jest.fn(),
}));
```

- [ ] **Step 4: Run full test suite**

```bash
cd mobile-ide/mobile-ide-prototype && npx jest --watchAll=false 2>&1 | tail -8
```

Expected: all tests pass (same count + new tests). Fix any import or mock failures before committing.

- [ ] **Step 5: Commit**

```bash
git add mobile-ide/mobile-ide-prototype/index.js \
        mobile-ide/mobile-ide-prototype/App.tsx \
        mobile-ide/mobile-ide-prototype/tests/unit/App.test.tsx
git commit -m "feat US-0045 US-0046: wire Sentry.wrap + memory sampling into App root"
```

---

## Task 7: EAS + app.json config

**Files:**
- Modify: `mobile-ide/mobile-ide-prototype/eas.json`
- Modify: `mobile-ide/mobile-ide-prototype/app.json`
- Modify: `mobile-ide/mobile-ide-prototype/.env.example`

No unit tests — config only. Verify with a TypeScript check.

- [ ] **Step 1: Update eas.json**

Replace the `"build"` section with:

```json
"build": {
  "development": {
    "developmentClient": true,
    "distribution": "internal",
    "ios": {
      "simulator": true
    },
    "env": {
      "EXPO_PUBLIC_SENTRY_DSN": "https://4d0ca8de7cdf9df11b212786fd3af78e@o4511328521551872.ingest.us.sentry.io/4511328528171008"
    }
  },
  "preview": {
    "distribution": "internal",
    "android": {
      "buildType": "apk"
    },
    "env": {
      "EXPO_PUBLIC_SENTRY_DSN": "https://4d0ca8de7cdf9df11b212786fd3af78e@o4511328521551872.ingest.us.sentry.io/4511328528171008"
    }
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
}
```

- [ ] **Step 2: Update app.json — add Sentry config plugin**

Open `app.json`. Find the `"plugins"` array:

```json
"plugins": [
  "expo-secure-store",
  "expo-web-browser"
]
```

Replace with:

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

- [ ] **Step 3: Update .env.example**

Open `.env.example`. Add this line (keep existing lines):

```
EXPO_PUBLIC_SENTRY_DSN=https://your-dsn@sentry.io/project-id
```

- [ ] **Step 4: Validate JSON**

```bash
cat mobile-ide/mobile-ide-prototype/eas.json | python3 -m json.tool > /dev/null && echo "eas.json valid"
cat mobile-ide/mobile-ide-prototype/app.json | python3 -m json.tool > /dev/null && echo "app.json valid"
```

Expected: both print `valid`.

- [ ] **Step 5: Run full test suite one final time**

```bash
cd mobile-ide/mobile-ide-prototype && npx jest --watchAll=false 2>&1 | tail -5
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add mobile-ide/mobile-ide-prototype/eas.json \
        mobile-ide/mobile-ide-prototype/app.json \
        mobile-ide/mobile-ide-prototype/.env.example
git commit -m "chore US-0045 US-0046: add Sentry config plugin + DSN to all EAS build profiles"
```

---

## Self-Review

**Spec coverage check:**

| Spec section | Task |
|---|---|
| AC-0118: Crashes auto-reported | Task 6 — `Sentry.wrap(App)` root ErrorBoundary |
| AC-0119: No PII in payloads | Task 3 — `scrubber.ts` beforeSend; Task 4 — `attachProps: false` |
| AC-0120: Cold start, latency, memory tracked | Task 4 — `enableAutoPerformanceTracing`, `enableNetworkInstrumentation`; Task 5 — memory sampling |
| AC-0121: Degradation triggers alert | Task 5 — `captureError` on heap threshold; dashboard rules noted in spec §10 |
| `global.d.ts` declaration | Task 2 |
| `index.js` init before registerRootComponent | Task 6 |
| Sentry DSN in all EAS profiles | Task 7 |
| `@sentry/react-native/expo` plugin | Task 7 |
| `.env.example` updated | Task 7 |

**Placeholder scan:** None found.

**Type consistency:**
- `scrubEvent` defined in Task 3 as `(event: SentryEvent) => SentryEvent` ✅
- `captureError`, `addBreadcrumb`, `setContext` defined in Task 4 and referenced in Task 5 ✅
- `startMemorySampling` defined in Task 5 and wired in Task 6 ✅
- `sentryService.init()` defined in Task 4 and called in Task 6 ✅

**One implementation note for Task 6:** The exact line numbers for the App.tsx edits depend on the current file state. The implementer should search for `export default function App()` and the `loadOpenRouterModels` useEffect rather than using line numbers directly.
