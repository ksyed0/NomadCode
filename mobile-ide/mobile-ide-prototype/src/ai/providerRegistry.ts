// src/ai/providerRegistry.ts
import { buildOpenRouterProvider } from './providers/openRouterProvider';
import { buildByokProvider }       from './providers/byokProvider';
import type { AIProvider, ProviderId, OpenRouterConfig, BYOKConfig } from './aiProvider';

export function getProvider(
  id: ProviderId,
  config: OpenRouterConfig | BYOKConfig,
): AIProvider {
  switch (id) {
    case 'openrouter': return buildOpenRouterProvider(config as OpenRouterConfig);
    case 'byok':       return buildByokProvider(config as BYOKConfig);
  }
}
