// Mock AsyncStorage before importing the service
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
  removeItem: jest.fn(() => Promise.resolve()),
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import { fetchOpenRouterModels, getCachedModels, buildPricingMap, MODELS_CACHE_KEY, CACHE_TTL_MS }
  from '../../src/ai/openRouterModelsService';
import type { OpenRouterModel } from '../../src/ai/aiProvider';

const FAKE_MODELS: OpenRouterModel[] = [
  { id: 'anthropic/claude-3-5-haiku', name: 'Claude 3.5 Haiku', context_length: 200000,
    pricing: { prompt: '0.0000008', completion: '0.000004' } },
  { id: 'meta-llama/llama-3.1-8b-instruct:free', name: 'Llama 3.1 8B', context_length: 131072,
    pricing: { prompt: '0', completion: '0' } },
];

beforeEach(() => {
  jest.clearAllMocks();
  (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
  (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
});

describe('fetchOpenRouterModels', () => {
  it('fetches from API and caches result', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: FAKE_MODELS }),
    });

    const result = await fetchOpenRouterModels();

    expect(fetch).toHaveBeenCalledWith('https://openrouter.ai/api/v1/models');
    expect(result).toHaveLength(2);
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      MODELS_CACHE_KEY,
      expect.stringContaining('anthropic/claude-3-5-haiku'),
    );
  });

  it('returns cached models when cache is fresh', async () => {
    const cached = {
      models: FAKE_MODELS,
      fetchedAt: Date.now() - 1000, // 1 second ago — still fresh
    };
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(cached));
    global.fetch = jest.fn();

    const result = await fetchOpenRouterModels();

    expect(fetch).not.toHaveBeenCalled();
    expect(result).toHaveLength(2);
  });

  it('re-fetches when cache is stale (>24h)', async () => {
    const stale = {
      models: FAKE_MODELS,
      fetchedAt: Date.now() - CACHE_TTL_MS - 1000, // expired
    };
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(stale));
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: FAKE_MODELS }),
    });

    await fetchOpenRouterModels();

    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('returns cached models on fetch failure (offline fallback)', async () => {
    const cached = {
      models: FAKE_MODELS,
      fetchedAt: Date.now() - CACHE_TTL_MS - 1000, // stale but available
    };
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(cached));
    global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

    const result = await fetchOpenRouterModels();

    expect(result).toHaveLength(2); // returns stale cache rather than []
  });

  it('returns empty array when offline and no cache', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

    const result = await fetchOpenRouterModels();

    expect(result).toEqual([]);
  });
});

describe('getCachedModels', () => {
  it('returns models from cache without fetching', async () => {
    const cached = { models: FAKE_MODELS, fetchedAt: Date.now() };
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(cached));

    const result = await getCachedModels();

    expect(result).toHaveLength(2);
  });

  it('returns empty array when no cache', async () => {
    const result = await getCachedModels();
    expect(result).toEqual([]);
  });
});

describe('buildPricingMap', () => {
  it('builds a map keyed by model id', () => {
    const map = buildPricingMap(FAKE_MODELS);
    expect(map['anthropic/claude-3-5-haiku']).toEqual({ prompt: '0.0000008', completion: '0.000004' });
    expect(map['meta-llama/llama-3.1-8b-instruct:free']).toEqual({ prompt: '0', completion: '0' });
  });

  it('returns empty object for empty array', () => {
    expect(buildPricingMap([])).toEqual({});
  });
});
