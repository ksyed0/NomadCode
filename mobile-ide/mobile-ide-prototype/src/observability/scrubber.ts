// src/observability/scrubber.ts
// Pure PII scrubber for Sentry beforeSend hook.
// No @sentry/react-native import — operates on plain objects so it is fully
// unit-testable without SDK mocks.

const SENSITIVE_PATTERN_SOURCES: string[] = [
  String.raw`ghp_[a-zA-Z0-9]{36,}`,           // GitHub PAT (classic)
  String.raw`github_pat_[a-zA-Z0-9_]{82,}`,    // GitHub fine-grained PAT
  String.raw`sk-ant-[a-zA-Z0-9\-]{90,}`,       // Anthropic key
  String.raw`AIza[a-zA-Z0-9\-_]{30,}`,          // Google API key
  String.raw`sk-or-[a-zA-Z0-9\-]{40,}`,        // OpenRouter key
  String.raw`Bearer\s+[a-zA-Z0-9._+/\-]{20,}`, // Generic bearer token (incl. base64 chars)
];

const EXTRA_MAX_LEN       = 500;
const BREADCRUMB_MAX_LEN  = 200;
const REDACT_TAG          = '[redacted]';
const TRUNCATE_TAG        = '[truncated]';

function redactString(value: string): string {
  let result = value;
  for (const src of SENSITIVE_PATTERN_SOURCES) {
    result = result.replace(new RegExp(src, 'g'), REDACT_TAG);
  }
  return result;
}

function processString(value: string, maxLen: number): string {
  // Truncate first: a fully-replaced string cannot leak tokens.
  // Only strings short enough to pass through are redacted.
  if (value.length > maxLen) return TRUNCATE_TAG;
  return redactString(value);
}

function scrubObject(
  obj: Record<string, unknown>,
  maxLen: number
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      result[key] = processString(value, maxLen);
    } else if (Array.isArray(value)) {
      result[key] = (value as unknown[]).map((item) =>
        typeof item === 'string'
          ? processString(item, maxLen)
          : item !== null && typeof item === 'object'
            ? scrubObject(item as Record<string, unknown>, maxLen)
            : item
      );
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
    result.message = processString(result.message, EXTRA_MAX_LEN);
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
