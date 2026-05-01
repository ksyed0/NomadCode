// src/ai/providers/claudeProvider.ts
import { fetchEventSource } from '@microsoft/fetch-event-source';
import type { AIProvider, ChatMessage } from '../aiProvider';
import { COMPLETION_MAX_TOKENS, CHAT_MAX_TOKENS } from '../quotaConfig';

const API_KEY      = process.env.EXPO_PUBLIC_CLAUDE_API_KEY ?? '';
const MESSAGES_URL = 'https://api.anthropic.com/v1/messages';
const HAIKU_MODEL  = 'claude-haiku-4-5-20251001';
const SONNET_MODEL = 'claude-sonnet-4-6';

// Per-million token rates in cents
const SONNET_IN_CPM  = 300;   // $3.00 / M
const SONNET_OUT_CPM = 1500;  // $15.00 / M

const COMPLETION_SYSTEM =
  'You are a code completion engine. Given a code prefix and suffix, return ONLY the text ' +
  'to insert at the cursor. No explanation, no markdown, no code fences. ' +
  'If no meaningful completion is appropriate, return an empty string.';

function chatSystemPrompt(fileContent: string, language: string): string {
  return (
    `You are an expert coding assistant embedded in NomadCode, a mobile IDE. ` +
    `Help the developer with their ${language} code.\n\n` +
    `Current file:\n\`\`\`${language}\n${fileContent}\n\`\`\``
  );
}

export const claudeProvider: AIProvider = {
  id: 'claude',
  displayName: 'Claude',

  async streamChat(messages, fileContent, language, signal, onChunk) {
    await fetchEventSource(MESSAGES_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'prompt-caching-2024-07-31',
      },
      body: JSON.stringify({
        model: SONNET_MODEL,
        max_tokens: CHAT_MAX_TOKENS,
        stream: true,
        system: [
          {
            type: 'text',
            text: chatSystemPrompt(fileContent, language),
            cache_control: { type: 'ephemeral' },
          },
        ],
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
      }),
      signal,
      onmessage(ev) {
        if (ev.event === 'content_block_delta') {
          try {
            const d = JSON.parse(ev.data);
            if (d.delta?.type === 'text_delta') onChunk(d.delta.text);
          } catch { /* ignore malformed SSE */ }
        }
      },
      onerror(err) { throw err; },
    });
  },

  async getCompletion(prefix, suffix, language, signal) {
    try {
      const res = await fetch(MESSAGES_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: HAIKU_MODEL,
          max_tokens: COMPLETION_MAX_TOKENS,
          temperature: 0,
          system: COMPLETION_SYSTEM,
          messages: [{
            role: 'user',
            content: `Language: ${language}\n<prefix>${prefix}</prefix>\n<suffix>${suffix}</suffix>`,
          }],
        }),
        signal,
      });
      if (!res.ok) return '';
      const data = await res.json();
      return (data.content?.[0]?.text as string) ?? '';
    } catch {
      return '';
    }
  },

  estimateCostCents(inputTokens, outputTokens) {
    return Math.ceil(
      (inputTokens / 1_000_000) * SONNET_IN_CPM +
      (outputTokens / 1_000_000) * SONNET_OUT_CPM,
    );
  },
};
