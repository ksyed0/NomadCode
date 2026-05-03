import { buildOpenRouterProvider } from '../../src/ai/providers/openRouterProvider';
import type { OpenRouterConfig } from '../../src/ai/aiProvider';

jest.mock('@microsoft/fetch-event-source');

const PRICING_MAP = {
  'anthropic/claude-3-5-haiku': { prompt: '0.0000008', completion: '0.000004' },
  'meta-llama/llama-3.1-8b-instruct:free': { prompt: '0', completion: '0' },
};

const CONFIG_PAID: OpenRouterConfig = {
  modelId: 'anthropic/claude-3-5-haiku',
  pricingMap: PRICING_MAP,
};

const CONFIG_FREE: OpenRouterConfig = {
  modelId: 'meta-llama/llama-3.1-8b-instruct:free',
  pricingMap: PRICING_MAP,
};

const CONFIG_UNKNOWN: OpenRouterConfig = {
  modelId: 'some/unknown-model',
  pricingMap: PRICING_MAP,
};

describe('buildOpenRouterProvider', () => {
  it('returns provider with id openrouter', () => {
    const p = buildOpenRouterProvider(CONFIG_PAID);
    expect(p.id).toBe('openrouter');
    expect(p.displayName).toBe('OpenRouter');
  });

  describe('estimateCostCents', () => {
    it('calculates cost from pricing map for paid model', () => {
      const p = buildOpenRouterProvider(CONFIG_PAID);
      // 1M input tokens at $0.0000008/token + 1M output at $0.000004/token
      // = (1_000_000 * 0.0000008 + 1_000_000 * 0.000004) * 100
      // = (0.8 + 4) * 100 = 480 cents
      const cost = p.estimateCostCents(1_000_000, 1_000_000);
      expect(cost).toBe(480);
    });

    it('returns 0 for free model', () => {
      const p = buildOpenRouterProvider(CONFIG_FREE);
      expect(p.estimateCostCents(10000, 10000)).toBe(0);
    });

    it('returns positive fallback for unknown model', () => {
      const p = buildOpenRouterProvider(CONFIG_UNKNOWN);
      expect(p.estimateCostCents(1000, 500)).toBeGreaterThan(0);
    });

    it('handles small token counts', () => {
      const p = buildOpenRouterProvider(CONFIG_PAID);
      // Very small amounts should still return a non-negative integer
      expect(p.estimateCostCents(10, 5)).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(p.estimateCostCents(100, 50))).toBe(true);
    });
  });

  describe('getCompletion', () => {
    beforeEach(() => jest.clearAllMocks());

    it('returns empty string on fetch failure', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));
      const p = buildOpenRouterProvider(CONFIG_PAID);
      const result = await p.getCompletion('const x =', '', 'typescript', new AbortController().signal);
      expect(result).toBe('');
    });

    it('returns empty string on non-ok response', async () => {
      global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 429 });
      const p = buildOpenRouterProvider(CONFIG_PAID);
      const result = await p.getCompletion('const x =', '', 'typescript', new AbortController().signal);
      expect(result).toBe('');
    });

    it('returns content from successful response', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ choices: [{ message: { content: ' 42' } }] }),
      });
      const p = buildOpenRouterProvider(CONFIG_PAID);
      const result = await p.getCompletion('const x =', '', 'typescript', new AbortController().signal);
      expect(result).toBe(' 42');
    });
  });

  describe('streamChat', () => {
    beforeEach(() => jest.clearAllMocks());

    it('calls onChunk with parsed SSE content', async () => {
      const { fetchEventSource } = require('@microsoft/fetch-event-source');
      fetchEventSource.mockImplementation(
        (_url: string, opts: { onmessage: (ev: { data: string }) => void }) => {
          opts.onmessage({ data: JSON.stringify({ choices: [{ delta: { content: 'Hello' } }] }) });
          opts.onmessage({ data: '[DONE]' });
          return Promise.resolve();
        }
      );
      const onChunk = jest.fn();
      const p = buildOpenRouterProvider(CONFIG_PAID);
      await p.streamChat([], '', 'typescript', new AbortController().signal, onChunk);
      expect(onChunk).toHaveBeenCalledWith('Hello');
    });

    it('ignores [DONE] sentinel', async () => {
      const { fetchEventSource } = require('@microsoft/fetch-event-source');
      fetchEventSource.mockImplementation(
        (_url: string, opts: { onmessage: (ev: { data: string }) => void }) => {
          opts.onmessage({ data: '[DONE]' });
          return Promise.resolve();
        }
      );
      const onChunk = jest.fn();
      const p = buildOpenRouterProvider(CONFIG_PAID);
      await p.streamChat([], '', 'typescript', new AbortController().signal, onChunk);
      expect(onChunk).not.toHaveBeenCalled();
    });
  });
});
