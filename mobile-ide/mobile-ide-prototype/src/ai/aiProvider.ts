// src/ai/aiProvider.ts

export type ProviderId = 'openrouter' | 'byok';

export type BYOKPreset = 'openrouter' | 'anthropic' | 'google' | 'openai' | 'custom';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface OpenRouterModel {
  id: string;
  name: string;
  description?: string;
  context_length: number;
  pricing: {
    prompt: string;      // dollars per token as string, e.g. "0.000001"
    completion: string;  // "0" for free models
  };
}

export interface OpenRouterConfig {
  modelId: string;
  pricingMap: Record<string, { prompt: string; completion: string }>;
}

export interface BYOKConfig {
  preset: BYOKPreset;
  modelName: string;
  customEndpoint: string; // only used when preset === 'custom'
  apiKeyIsStored: boolean;
}

export interface AIProvider {
  id: ProviderId;
  displayName: string;
  streamChat(
    messages: ChatMessage[],
    fileContent: string,
    language: string,
    signal: AbortSignal,
    onChunk: (text: string) => void
  ): Promise<void>;
  getCompletion(
    prefix: string,
    suffix: string,
    language: string,
    signal: AbortSignal
  ): Promise<string>;
  estimateCostCents(inputTokens: number, outputTokens: number): number;
}
