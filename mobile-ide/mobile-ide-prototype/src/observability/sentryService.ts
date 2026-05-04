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
    enableAutoPerformanceTracing: true,  // cold start + navigation
    enableNativeFramesTracking:   true,  // slow/frozen frame detection
    tracesSampleRate:             0.3,   // 30% of sessions get full trace
    // Cast via unknown — our SentryEvent shape is a structural subset of SDK Event
    beforeSend: scrubEvent as unknown as Parameters<typeof Sentry.init>[0]['beforeSend'],
  });
}

export function captureError(
  err: Error,
  context?: Record<string, unknown>
): void {
  Sentry.captureException(err, context ? { extra: context } : {});
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

// Re-export Sentry.wrap so App.tsx never imports @sentry/react-native directly.
export const wrap: typeof Sentry.wrap = Sentry.wrap;
