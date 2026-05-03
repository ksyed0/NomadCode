// src/ai/providers/openRouterProvider.ts
import { fetchEventSource } from '@microsoft/fetch-event-source';
import type { AIProvider, ChatMessage, OpenRouterConfig } from '../aiProvider';
import { COMPLETION_MAX_TOKENS, CHAT_MAX_TOKENS } from '../quotaConfig';

const API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const API_KEY = process.env.EXPO_PUBLIC_OPENROUTER_API_KEY ?? '';

// Fallback cost for models not in the pricing map (~$0.001 per token = conservative)
const DEFAULT_COST_CENTS_PER_TOKEN = 0.0001;

const COMPLETION_SYSTEM =
  'You are a code completion engine. Return ONLY the text to insert at the cursor. ' +
  'No explanation, no markdown, no code fences. Empty string if no completion is appropriate.';

function chatSystemContent(fileContent: string, language: string): string {
  return (
    `Expert coding assistant in NomadCode mobile IDE. ` +
    `Help with ${language} code.\n\nCurrent file:\n\`\`\`${language}\n${fileContent}\n\`\`\``
  );
}

function parseOpenAIChunk(data: string): string {
  if (data === '[DONE]') return '';
  try {
    const d = JSON.parse(data);
    return (d.choices?.[0]?.delta?.content as string) ?? '';
  } catch {
    return '';
  }
}

export function buildOpenRouterProvider(config: OpenRouterConfig): AIProvider {
  return {
    id: 'openrouter',
    displayName: 'OpenRouter',

    async streamChat(messages, fileContent, language, signal, onChunk) {
      await fetchEventSource(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${API_KEY}`,
          'HTTP-Referer': 'https://nomadcode.app',
          'X-Title': 'NomadCode',
        },
        body: JSON.stringify({
          model: config.modelId,
          stream: true,
          max_tokens: CHAT_MAX_TOKENS,
          messages: [
            { role: 'system', content: chatSystemContent(fileContent, language) },
            ...messages.map((m: ChatMessage) => ({ role: m.role, content: m.content })),
          ],
        }),
        signal,
        onmessage(ev) {
          const text = parseOpenAIChunk(ev.data);
          if (text) onChunk(text);
        },
        onerror(err) { throw err; },
      });
    },

    async getCompletion(prefix, suffix, language, signal) {
      try {
        const res = await fetch(API_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${API_KEY}`,
            'HTTP-Referer': 'https://nomadcode.app',
            'X-Title': 'NomadCode',
          },
          body: JSON.stringify({
            model: config.modelId,
            max_tokens: COMPLETION_MAX_TOKENS,
            temperature: 0,
            messages: [
              { role: 'system', content: COMPLETION_SYSTEM },
              { role: 'user', content: `Language: ${language}\n<prefix>${prefix}</prefix>\n<suffix>${suffix}</suffix>` },
            ],
          }),
          signal,
        });
        if (!res.ok) return '';
        const data = await res.json();
        return (data.choices?.[0]?.message?.content as string) ?? '';
      } catch {
        return '';
      }
    },

    estimateCostCents(inputTokens, outputTokens) {
      const pricing = config.pricingMap[config.modelId];
      if (!pricing) {
        return Math.ceil((inputTokens + outputTokens) * DEFAULT_COST_CENTS_PER_TOKEN);
      }
      if (pricing.prompt === '0' && pricing.completion === '0') return 0;
      return Math.ceil(
        (inputTokens * parseFloat(pricing.prompt) +
         outputTokens * parseFloat(pricing.completion)) * 100,
      );
    },
  };
}
