/**
 * Unit tests — networkRetry (exponential backoff for transient failures)
 */

import { withNetworkRetry } from '../../../src/git/networkRetry';

describe('withNetworkRetry', () => {
  beforeEach(() => {
    jest.spyOn(global, 'setTimeout').mockImplementation((fn: () => void) => {
      fn();
      return 0 as unknown as ReturnType<typeof setTimeout>;
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns result on first successful attempt', async () => {
    const fn = jest.fn().mockResolvedValue('ok');
    await expect(withNetworkRetry(fn, 'Op')).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries on transient errors then succeeds', async () => {
    let n = 0;
    const fn = jest.fn().mockImplementation(() => {
      n += 1;
      if (n < 2) return Promise.reject(new Error('network timeout'));
      return Promise.resolve('done');
    });
    await expect(withNetworkRetry(fn, 'Op')).resolves.toBe('done');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('throws mapped error after exhausting retries on persistent transient failure', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('ECONNRESET'));
    await expect(withNetworkRetry(fn, 'Push')).rejects.toThrow(/Push: ECONNRESET/);
    expect(fn).toHaveBeenCalledTimes(4);
  });

  it('does not retry non-transient errors', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('bad request'));
    await expect(withNetworkRetry(fn, 'Clone')).rejects.toThrow(/Clone:/);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('maps 401 to authentication message', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('HTTP 401'));
    await expect(withNetworkRetry(fn, 'Pull')).rejects.toThrow(/Authentication failed/);
  });

  it('maps 403 to access denied message', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('403 Forbidden'));
    await expect(withNetworkRetry(fn, 'Push')).rejects.toThrow(/Access denied/);
  });

  it('maps offline-style messages (non-transient)', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('you are offline'));
    await expect(withNetworkRetry(fn, 'Clone')).rejects.toThrow(/Network unavailable/);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('wraps non-Error rejections', async () => {
    const fn = jest.fn().mockRejectedValue('string fail');
    await expect(withNetworkRetry(fn, 'X')).rejects.toThrow(/X: string fail/);
  });
});
