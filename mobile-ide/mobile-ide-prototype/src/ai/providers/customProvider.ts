// src/ai/providers/customProvider.ts
import * as SecureStore from 'expo-secure-store';
import { fetchEventSource } from '@microsoft/fetch-event-source';
import type { AIProvider, ChatMessage, CustomConfig } from '../aiProvider';
import { COMPLETION_MAX_TOKENS, CHAT_MAX_TOKENS } from '../quotaConfig';

const SECURE_KEY = 'nomadcode_custom_ai_key';

const COMPLETION_SYSTEM =
  'You are a code completion engine. Return ONLY the text to insert at the cursor. ' +
  'No explanation, no markdown, no code fences. Empty string if no completion is appropriate.';

async function getAuthHeaders(config: CustomConfig): Promise<Record<string, string>> {
  if (!config.apiKeyIsStored) return {};
  const key = await SecureStore.getItemAsync(SECURE_KEY);
  if (!key) return {};
  return { Authorization: `Bearer ${key}` };
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

export function buildCustomProvider(config: CustomConfig): AIProvider {
  return {
    id: 'custom',
    displayName: 'Custom',

    async streamChat(messages, fileContent, language, signal, onChunk) {
      const authHeaders = await getAuthHeaders(config);
      const systemMsg: ChatMessage = {
        role: 'user',
        content: `[SYSTEM] Expert coding assistant. Current ${language} file:\n\`\`\`${language}\n${fileContent}\n\`\`\``,
      };
      await fetchEventSource(`${config.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({
          model: config.modelName,
          stream: true,
          max_tokens: Math.min(CHAT_MAX_TOKENS, config.contextWindowSize),
          messages: [
            systemMsg,
            ...messages.map((m) => ({ role: m.role, content: m.content })),
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
        const authHeaders = await getAuthHeaders(config);
        const res = await fetch(`${config.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeaders },
          body: JSON.stringify({
            model: config.modelName,
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

    estimateCostCents(_inputTokens, _outputTokens) {
      return 0; // user's own key — never counts toward built-in cap
    },
  };
}
