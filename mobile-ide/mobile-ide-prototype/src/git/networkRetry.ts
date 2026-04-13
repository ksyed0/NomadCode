/**
 * Exponential backoff retry for transient network failures (AGENTS.md: max 3 retries).
 */

const MAX_ATTEMPTS = 4; /* initial + 3 retries */

function isTransientError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  const lower = msg.toLowerCase();
  return (
    lower.includes('network') ||
    lower.includes('timeout') ||
    lower.includes('timed out') ||
    lower.includes('econnreset') ||
    lower.includes('socket') ||
    lower.includes('503') ||
    lower.includes('502') ||
    lower.includes('504') ||
    lower.includes('fetch failed')
  );
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export async function withNetworkRetry<T>(fn: () => Promise<T>, context: string): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      const transient = isTransientError(e);
      if (!transient || attempt === MAX_ATTEMPTS - 1) {
        throw mapGitError(e, context);
      }
      const backoffMs = 2 ** attempt * 300;
      await delay(backoffMs);
    }
  }
  throw mapGitError(lastErr, context);
}

function mapGitError(err: unknown, context: string): Error {
  if (err instanceof Error) {
    const msg = err.message;
    if (msg.includes('401') || msg.toLowerCase().includes('authentication')) {
      return new Error(
        `${context}: Authentication failed. Sign in with GitHub in Settings for private repositories.`,
      );
    }
    if (msg.includes('403')) {
      return new Error(
        `${context}: Access denied. Check repository permissions and sign-in in Settings.`,
      );
    }
    if (msg.toLowerCase().includes('offline') || msg.includes('Network request failed')) {
      return new Error(`${context}: Network unavailable. Check your connection and try again.`);
    }
    return new Error(`${context}: ${msg}`);
  }
  return new Error(`${context}: ${String(err)}`);
}
