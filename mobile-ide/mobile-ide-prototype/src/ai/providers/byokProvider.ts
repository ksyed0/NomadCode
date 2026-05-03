// src/ai/providers/byokProvider.ts
import * as SecureStore from 'expo-secure-store';
import { fetchEventSource } from '@microsoft/fetch-event-source';
import type { AIProvider, ChatMessage, BYOKConfig } from '../aiProvider';
import { COMPLETION_MAX_TOKENS, CHAT_MAX_TOKENS } from '../quotaConfig';

export const BYOK_SECURE_KEY = 'nomadcode_custom_ai_key'; // same as old customProvider — preserves stored keys

const COMPLETION_SYSTEM =
  'You are a code completion engine. Return ONLY the text to insert at the cursor. ' +
  'No explanation, no markdown, no code fences. Empty string if no completion is appropriate.';

function getBaseUrl(config: BYOKConfig): string {
  switch (config.preset) {
    case 'openrouter': return 'https://openrouter.ai/api/v1';
    case 'anthropic':  return 'https://api.anthropic.com/v1';
    case 'google':     return 'https://generativelanguage.googleapis.com/v1beta/openai';
    case 'openai':     return 'https://api.openai.com/v1';
    case 'custom':     return config.customEndpoint.replace(/\/$/, '');
  }
}

async function getKey(config: BYOKConfig): Promise<string | null> {
  if (!config.apiKeyIsStored) return null;
  return SecureStore.getItemAsync(BYOK_SECURE_KEY);
}

function parseOpenAIChunk(data: string): string {
  if (data === '[DONE]') return '';
  try {
    const d = JSON.parse(data);
    return (d.choices?.[0]?.delta?.content as string) ?? '';
  } catch { return ''; }
}

function anthropicHeaders(key: string): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'x-api-key': key,
    'anthropic-version': '2023-06-01',
  };
}

function openAIHeaders(key: string | null): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (key) headers['Authorization'] = `Bearer ${key}`;
  return headers;
}

export function buildByokProvider(config: BYOKConfig): AIProvider {
  const baseUrl    = getBaseUrl(config);
  const isAnthropic = config.preset === 'anthropic';

  return {
    id: 'byok',
    displayName: 'BYOK',

    async streamChat(messages, fileContent, language, signal, onChunk) {
      const key = await getKey(config);

      if (isAnthropic) {
        if (!key) return;
        await fetchEventSource(`${baseUrl}/messages`, {
          method: 'POST',
          headers: anthropicHeaders(key),
          body: JSON.stringify({
            model: config.modelName,
            max_tokens: CHAT_MAX_TOKENS,
            stream: true,
            system: `Expert coding assistant. Current ${language} file:\n\`\`\`${language}\n${fileContent}\n\`\`\``,
            messages: messages.map((m: ChatMessage) => ({ role: m.role, content: m.content })),
          }),
          signal,
          onmessage(ev) {
            if (ev.event === 'content_block_delta') {
              try {
                const d = JSON.parse(ev.data);
                if (d.delta?.type === 'text_delta') onChunk(d.delta.text);
              } catch { /* ignore */ }
            }
          },
          onerror(err) { throw err; },
        });
        return;
      }

      // OpenAI-compatible path
      await fetchEventSource(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: openAIHeaders(key),
        body: JSON.stringify({
          model: config.modelName,
          stream: true,
          max_tokens: CHAT_MAX_TOKENS,
          messages: [
            { role: 'system', content: `Expert coding assistant. Current ${language} file:\n\`\`\`${language}\n${fileContent}\n\`\`\`` },
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
        const key = await getKey(config);

        if (isAnthropic) {
          if (!key) return '';
          const res = await fetch(`${baseUrl}/messages`, {
            method: 'POST',
            headers: anthropicHeaders(key),
            body: JSON.stringify({
              model: config.modelName,
              max_tokens: COMPLETION_MAX_TOKENS,
              temperature: 0,
              system: COMPLETION_SYSTEM,
              messages: [{ role: 'user', content: `Language: ${language}\n<prefix>${prefix}</prefix>\n<suffix>${suffix}</suffix>` }],
            }),
            signal,
          });
          if (!res.ok) return '';
          const data = await res.json();
          return (data.content?.[0]?.text as string) ?? '';
        }

        // OpenAI-compatible path
        const res = await fetch(`${baseUrl}/chat/completions`, {
          method: 'POST',
          headers: openAIHeaders(key),
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
      return 0;
    },
  };
}
