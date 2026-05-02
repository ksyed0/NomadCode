// src/ai/providers/geminiProvider.ts
import { fetchEventSource } from '@microsoft/fetch-event-source';
import type { AIProvider, ChatMessage } from '../aiProvider';
import { COMPLETION_MAX_TOKENS, CHAT_MAX_TOKENS } from '../quotaConfig';

const API_KEY  = process.env.EXPO_PUBLIC_GEMINI_API_KEY ?? '';
const MODEL    = 'gemini-3-flash';
const BASE_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}`;

// Gemini 3 Flash rates (approximate) in cents per million tokens
const IN_CPM  = 30;   // ~$0.30/M
const OUT_CPM = 250;  // ~$2.50/M

const COMPLETION_SYSTEM =
  'You are a code completion engine. Return ONLY the text to insert at the cursor. ' +
  'No explanation, no markdown, no code fences. Empty string if no completion is appropriate.';

function toGeminiRole(role: ChatMessage['role']): string {
  return role === 'assistant' ? 'model' : 'user';
}

function chatSystemInstruction(fileContent: string, language: string): object {
  return {
    parts: [{
      text: `You are an expert coding assistant in NomadCode. Help with ${language} code.\n\nCurrent file:\n\`\`\`${language}\n${fileContent}\n\`\`\``,
    }],
  };
}

export const geminiProvider: AIProvider = {
  id: 'gemini',
  displayName: 'Gemini 3 Flash',

  async streamChat(messages, fileContent, language, signal, onChunk) {
    const url = `${BASE_URL}:streamGenerateContent?alt=sse&key=${API_KEY}`;
    await fetchEventSource(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: chatSystemInstruction(fileContent, language),
        contents: messages.map((m) => ({
          role: toGeminiRole(m.role),
          parts: [{ text: m.content }],
        })),
        generationConfig: { maxOutputTokens: CHAT_MAX_TOKENS, temperature: 0.7 },
      }),
      signal,
      onmessage(ev) {
        try {
          const d = JSON.parse(ev.data);
          const text: string = d.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
          if (text) onChunk(text);
        } catch { /* ignore malformed */ }
      },
      onerror(err) { throw err; },
    });
  },

  async getCompletion(prefix, suffix, language, signal) {
    try {
      const url = `${BASE_URL}:generateContent?key=${API_KEY}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: COMPLETION_SYSTEM }] },
          contents: [{
            role: 'user',
            parts: [{ text: `Language: ${language}\n<prefix>${prefix}</prefix>\n<suffix>${suffix}</suffix>` }],
          }],
          generationConfig: { maxOutputTokens: COMPLETION_MAX_TOKENS, temperature: 0 },
        }),
        signal,
      });
      if (!res.ok) return '';
      const data = await res.json();
      return (data.candidates?.[0]?.content?.parts?.[0]?.text as string) ?? '';
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
