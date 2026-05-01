// src/ai/providerRegistry.ts
import { claudeProvider } from './providers/claudeProvider';
import { geminiProvider } from './providers/geminiProvider';
import { kimiProvider }   from './providers/kimiProvider';
import { buildCustomProvider } from './providers/customProvider';
import type { AIProvider, ProviderId, CustomConfig } from './aiProvider';

export function getProvider(id: ProviderId, customConfig?: CustomConfig): AIProvider {
  switch (id) {
    case 'claude':  return claudeProvider;
    case 'gemini':  return geminiProvider;
    case 'kimi':    return kimiProvider;
    case 'custom':  return buildCustomProvider(customConfig!);
    default:        return claudeProvider;
  }
}
