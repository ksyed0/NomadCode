// src/ai/providers/kimiProvider.ts
import { fetchEventSource } from '@microsoft/fetch-event-source';
import type { AIProvider, ChatMessage } from '../aiProvider';
import { COMPLETION_MAX_TOKENS, CHAT_MAX_TOKENS } from '../quotaConfig';

const API_KEY  = process.env.EXPO_PUBLIC_KIMI_API_KEY ?? '';
const BASE_URL = 'https://api.moonshot.cn/v1';
const MODEL    = 'kimi-k2.6';

// Kimi K2.6 rates in cents per million tokens
const IN_CPM  = 74;   // $0.74/M
const OUT_CPM = 349;  // $3.49/M

const COMPLETION_SYSTEM =
  'You are a code completion engine. Return ONLY the text to insert at the cursor. ' +
  'No explanation, no markdown, no code fences. Empty string if no completion is appropriate.';

function chatSystem(fileContent: string, language: string): ChatMessage {
  return {
    role: 'user',
    content: `[SYSTEM] You are an expert coding assistant in NomadCode. Current ${language} file:\n\`\`\`${language}\n${fileContent}\n\`\`\``,
  };
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

export const kimiProvider: AIProvider = {
  id: 'kimi',
  displayName: 'Kimi K2.6',

  async streamChat(messages, fileContent, language, signal, onChunk) {
    await fetchEventSource(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        stream: true,
        max_tokens: CHAT_MAX_TOKENS,
        messages: [
          chatSystem(fileContent, language),
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
      const res = await fetch(`${BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${API_KEY}`,
        },
        body: JSON.stringify({
          model: MODEL,
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
    return Math.ceil(
      (inputTokens / 1_000_000) * IN_CPM +
      (outputTokens / 1_000_000) * OUT_CPM,
    );
  },
};
