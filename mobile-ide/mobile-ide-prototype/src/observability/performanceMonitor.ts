// src/observability/performanceMonitor.ts
// JS heap memory sampling loop (Hermes-only API).
//
// Note: global.performance.memory.usedJSHeapSize reflects the JavaScript heap
// only — it does NOT include WebView memory, native buffers, or image textures.
// The 60MB threshold is calibrated for JS heap, not total process RSS (§8 of
// PROJECT.md targets 150MB total; the WebViews alone typically add 60-100MB).

import { AppState, AppStateStatus } from 'react-native';
import { captureError, setContext } from './sentryService';

const ALERT_COOLDOWN_MS = 5 * 60 * 1_000; // 5 minutes between repeated alerts

export function startMemorySampling(
  thresholdMb = 60,
  intervalMs  = 30_000
): () => void {
  // Guard: be defensive even though Hermes always provides this API.
  if (!global.performance?.memory) {
    return () => { /* no-op */ };
  }

  let lastAlertedAt = 0;
  let intervalId: ReturnType<typeof setInterval> | null = null;

  function sample(): void {
    const usedMb = global.performance!.memory!.usedJSHeapSize / 1_048_576;
    const rounded = Math.round(usedMb * 10) / 10;

    setContext('memory', { usedMb: rounded, thresholdMb, unit: 'MB (JS heap only)' });

    if (usedMb > thresholdMb && Date.now() - lastAlertedAt > ALERT_COOLDOWN_MS) {
      captureError(
        new Error(`JS heap exceeded ${thresholdMb}MB threshold`),
        { usedMb: rounded, thresholdMb }
      );
      lastAlertedAt = Date.now();
    }
  }

  function startInterval(): void {
    if (!intervalId) {
      intervalId = setInterval(sample, intervalMs);
    }
  }

  function stopInterval(): void {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
  }

  startInterval();

  const subscription = AppState.addEventListener(
    'change',
    (nextState: AppStateStatus) => {
      if (nextState === 'background' || nextState === 'inactive') {
        stopInterval();
      } else if (nextState === 'active') {
        startInterval();
      }
    }
  );

  return () => {
    stopInterval();
    subscription.remove();
  };
}
