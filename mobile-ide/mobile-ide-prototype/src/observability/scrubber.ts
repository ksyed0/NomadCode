// src/observability/scrubber.ts
// Pure PII scrubber for Sentry beforeSend hook.
// No @sentry/react-native import — operates on plain objects so it is fully
// unit-testable without SDK mocks.

const SENSITIVE_PATTERNS: RegExp[] = [
  /ghp_[a-zA-Z0-9]{36}/g,                // GitHub PAT (classic)
  /github_pat_[a-zA-Z0-9_]{82}/g,        // GitHub fine-grained PAT
  /sk-ant-[a-zA-Z0-9\-]{90,}/g,          // Anthropic key
  /AIza[a-zA-Z0-9\-_]{30,}/g,             // Google API key
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
