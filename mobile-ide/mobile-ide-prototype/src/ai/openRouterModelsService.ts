// src/ai/openRouterModelsService.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { OpenRouterModel } from './aiProvider';

export const MODELS_CACHE_KEY = 'nomadcode_openrouter_models_cache';
export const CACHE_TTL_MS     = 24 * 60 * 60 * 1000; // 24 hours

interface ModelsCache {
  models: OpenRouterModel[];
  fetchedAt: number;
}

async function readCache(): Promise<ModelsCache | null> {
  try {
    const raw = await AsyncStorage.getItem(MODELS_CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as ModelsCache;
  } catch {
    return null;
  }
}

async function writeCache(models: OpenRouterModel[]): Promise<void> {
  const cache: ModelsCache = { models, fetchedAt: Date.now() };
  await AsyncStorage.setItem(MODELS_CACHE_KEY, JSON.stringify(cache));
}

/** Fetch models from the OpenRouter API, using cache when fresh. */
export async function fetchOpenRouterModels(): Promise<OpenRouterModel[]> {
  const cache = await readCache();
  const isFresh = cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS;

  if (isFresh) return cache.models;

  try {
    const res = await fetch('https://openrouter.ai/api/v1/models');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    const raw: unknown[] = Array.isArray(json.data) ? json.data : [];
    const models: OpenRouterModel[] = raw.filter(
      (m): m is OpenRouterModel =>
        typeof m === 'object' && m !== null &&
        typeof (m as OpenRouterModel).id === 'string' &&
        typeof (m as OpenRouterModel).name === 'string' &&
        typeof (m as OpenRouterModel).pricing?.prompt === 'string' &&
        typeof (m as OpenRouterModel).pricing?.completion === 'string',
    );
    await writeCache(models);
    return models;
  } catch {
    // Offline fallback: return stale cache if available, otherwise []
    return cache?.models ?? [];
  }
}

/** Read models from cache only — no network request. */
export async function getCachedModels(): Promise<OpenRouterModel[]> {
  const cache = await readCache();
  return cache?.models ?? [];
}

/** Build a pricing map keyed by model ID for O(1) lookups. */
export function buildPricingMap(
  models: OpenRouterModel[]
): Record<string, { prompt: string; completion: string }> {
  return Object.fromEntries(models.map((m) => [m.id, m.pricing]));
}
