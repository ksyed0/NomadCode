// src/ai/aiProvider.ts

export type ProviderId = 'claude' | 'gemini' | 'kimi' | 'custom';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface CustomConfig {
  baseUrl: string;
  modelName: string;
  contextWindowSize: number;
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
