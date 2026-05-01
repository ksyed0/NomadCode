# EPIC-0010: AI Suggestions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add AI-powered inline code completions and a chat panel to NomadCode, gated behind the Pro+AI subscription tier, with support for Claude, Gemini 3 Flash, Kimi K2.6, and custom OpenAI-compatible providers.

**Architecture:** A Zustand store (`useAIStore`) owns conversation state and shared dollar-denominated daily quota; an `AIProvider` interface abstracts provider-specific API calls; `@microsoft/fetch-event-source` handles SSE streaming; Monaco's `registerInlineCompletionsProvider` renders ghost text fed through the existing WebView message bridge via a new `injectMessage` handle on `EditorHandle`.

**Tech Stack:** TypeScript, React Native (Expo 54), Zustand 5, `@microsoft/fetch-event-source`, `expo-secure-store`, Monaco Editor (WebView), RevenueCat entitlements (`hasAIAccess` from `src/iap/entitlements.ts`).

**Spec:** `docs/superpowers/specs/2026-05-01-epic-0010-ai-suggestions-design.md`

---

## File Map

| Action | Path | Responsibility |
|---|---|---|
| NEW | `src/ai/aiProvider.ts` | `AIProvider` interface, `ChatMessage`, `ProviderId`, `CustomConfig` types |
| NEW | `src/ai/quotaConfig.ts` | All AI constants (cap, token limits, trim lengths) |
| NEW | `src/ai/providerRegistry.ts` | `getProvider()` factory |
| NEW | `src/ai/providers/claudeProvider.ts` | Anthropic — Haiku 4.5 completions, Sonnet 4.6 chat, prompt caching |
| NEW | `src/ai/providers/geminiProvider.ts` | Google Gemini 3 Flash |
| NEW | `src/ai/providers/kimiProvider.ts` | Moonshot Kimi K2.6 (OpenAI-compat) |
| NEW | `src/ai/providers/customProvider.ts` | User-configured OpenAI-compat endpoint |
| NEW | `src/stores/useAIStore.ts` | Quota, conversation history, streaming state |
| NEW | `src/components/AIChatPanel.tsx` | Chat UI in sidebar AI tab |
| NEW | `src/components/PaywallAISheet.tsx` | Inline paywall for Free/Pro tier |
| MODIFY | `src/components/Editor.tsx` | Add `injectMessage` to `EditorHandle` |
| MODIFY | `src/utils/MonacoAssetManager.ts` | `COMPLETION_CONTEXT` outbound, `registerInlineCompletionsProvider`, `SET_INLINE_COMPLETION` handler |
| MODIFY | `src/components/FileExplorer.tsx` | Add `'ai'` to `SidebarTab` union; render AI tab content |
| MODIFY | `src/components/SettingsScreen.tsx` | AI Settings section |
| MODIFY | `App.tsx` | `COMPLETION_CONTEXT` handler, `completionRequestRef`, AI store init |
| MODIFY | `package.json` | Add `@microsoft/fetch-event-source` |
| MODIFY | `.env.example` | Document three provider API key vars |

**All tests live in:** `mobile-ide/mobile-ide-prototype/tests/unit/`
**Run tests:** `cd mobile-ide/mobile-ide-prototype && npx jest --watchAll=false`
**Run single file:** `cd mobile-ide/mobile-ide-prototype && npx jest --watchAll=false tests/unit/<file>`
**Coverage:** `cd mobile-ide/mobile-ide-prototype && npx jest --watchAll=false --coverage`
**Lint:** `cd mobile-ide/mobile-ide-prototype && npm run lint`
**Type-check:** `cd mobile-ide/mobile-ide-prototype && npm run type-check`

---

## Task 0: Branch Setup

- [ ] **Create feature branch from develop**

```bash
git checkout develop && git pull origin develop
git checkout -b feature/epic-0010-ai-suggestions
```

---

## Task 1: Dependency + Environment

**Files:**
- Modify: `mobile-ide/mobile-ide-prototype/package.json`
- Modify: `.env.example`

- [ ] **Install fetch-event-source**

```bash
cd mobile-ide/mobile-ide-prototype && npm install @microsoft/fetch-event-source
```

- [ ] **Update `.env.example`** — add after existing vars:

```bash
# AI Provider Keys (injected via EAS secrets — never commit real values)
EXPO_PUBLIC_CLAUDE_API_KEY=sk-ant-...
EXPO_PUBLIC_GEMINI_API_KEY=AIza...
EXPO_PUBLIC_KIMI_API_KEY=sk-...
```

- [ ] **Verify install**

```bash
cd mobile-ide/mobile-ide-prototype && npx jest --watchAll=false
```

Expected: all existing tests pass (≥1006, 0 failures).

- [ ] **Commit**

```bash
git add mobile-ide/mobile-ide-prototype/package.json mobile-ide/mobile-ide-prototype/package-lock.json .env.example
git commit -m "chore(epic-0010): install @microsoft/fetch-event-source, document API key vars"
```

---

## Task 2: AIProvider Interface + quotaConfig

**Files:**
- Create: `mobile-ide/mobile-ide-prototype/src/ai/aiProvider.ts`
- Create: `mobile-ide/mobile-ide-prototype/src/ai/quotaConfig.ts`
- Create: `mobile-ide/mobile-ide-prototype/tests/unit/aiProvider.test.ts`

- [ ] **Write the failing test**

```typescript
// tests/unit/aiProvider.test.ts
import {
  DAILY_CAP_CENTS,
  COMPLETION_MAX_TOKENS,
  CHAT_MAX_TOKENS,
  COMPLETION_PREFIX_CHARS,
  COMPLETION_SUFFIX_CHARS,
} from '../../src/ai/quotaConfig';

describe('quotaConfig', () => {
  it('exports expected constants', () => {
    expect(DAILY_CAP_CENTS).toBe(15);
    expect(COMPLETION_MAX_TOKENS).toBe(256);
    expect(CHAT_MAX_TOKENS).toBe(2048);
    expect(COMPLETION_PREFIX_CHARS).toBe(1500);
    expect(COMPLETION_SUFFIX_CHARS).toBe(500);
  });
});
```

- [ ] **Run to verify it fails**

```bash
cd mobile-ide/mobile-ide-prototype && npx jest --watchAll=false tests/unit/aiProvider.test.ts
```

Expected: FAIL — module not found.

- [ ] **Create `src/ai/aiProvider.ts`**

```typescript
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
```

- [ ] **Create `src/ai/quotaConfig.ts`**

```typescript
// src/ai/quotaConfig.ts

export const DAILY_CAP_CENTS = process.env.EXPO_PUBLIC_DAILY_CAP_CENTS
  ? Number(process.env.EXPO_PUBLIC_DAILY_CAP_CENTS)
  : 15;

export const COMPLETION_MAX_TOKENS   = 256;
export const CHAT_MAX_TOKENS         = 2048;
export const COMPLETION_PREFIX_CHARS = 1500;
export const COMPLETION_SUFFIX_CHARS = 500;
```

- [ ] **Run test to verify it passes**

```bash
cd mobile-ide/mobile-ide-prototype && npx jest --watchAll=false tests/unit/aiProvider.test.ts
```

Expected: PASS.

- [ ] **Commit**

```bash
git add mobile-ide/mobile-ide-prototype/src/ai/ mobile-ide/mobile-ide-prototype/tests/unit/aiProvider.test.ts
git commit -m "feat(epic-0010): add AIProvider interface and quotaConfig constants"
```

---

## Task 3: claudeProvider

**Files:**
- Create: `mobile-ide/mobile-ide-prototype/src/ai/providers/claudeProvider.ts`
- Create: `mobile-ide/mobile-ide-prototype/tests/unit/claudeProvider.test.ts`

- [ ] **Write the failing tests**

```typescript
// tests/unit/claudeProvider.test.ts
import { fetchEventSource } from '@microsoft/fetch-event-source';
import { claudeProvider } from '../../src/ai/providers/claudeProvider';

jest.mock('@microsoft/fetch-event-source', () => ({
  fetchEventSource: jest.fn(),
}));

const mockFES = fetchEventSource as jest.MockedFunction<typeof fetchEventSource>;

beforeEach(() => {
  jest.clearAllMocks();
  global.fetch = jest.fn() as jest.Mock;
});

describe('claudeProvider.streamChat', () => {
  it('calls onChunk for each text_delta event', async () => {
    mockFES.mockImplementation(async (_url, opts: any) => {
      opts.onmessage({ event: 'content_block_delta', data: JSON.stringify({ delta: { type: 'text_delta', text: 'Hello' } }) });
      opts.onmessage({ event: 'content_block_delta', data: JSON.stringify({ delta: { type: 'text_delta', text: ' world' } }) });
    });
    const chunks: string[] = [];
    await claudeProvider.streamChat([], 'code', 'typescript', new AbortController().signal, (c) => chunks.push(c));
    expect(chunks).toEqual(['Hello', ' world']);
  });

  it('ignores non text_delta events', async () => {
    mockFES.mockImplementation(async (_url, opts: any) => {
      opts.onmessage({ event: 'message_start', data: JSON.stringify({ type: 'message_start' }) });
    });
    const chunks: string[] = [];
    await claudeProvider.streamChat([], '', 'typescript', new AbortController().signal, (c) => chunks.push(c));
    expect(chunks).toHaveLength(0);
  });
});

describe('claudeProvider.getCompletion', () => {
  it('returns text content on success', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ content: [{ type: 'text', text: 'const x = 1;' }] }),
    });
    const result = await claudeProvider.getCompletion('const ', '', 'typescript', new AbortController().signal);
    expect(result).toBe('const x = 1;');
  });

  it('returns empty string on non-ok response', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: false });
    const result = await claudeProvider.getCompletion('', '', 'typescript', new AbortController().signal);
    expect(result).toBe('');
  });

  it('returns empty string when content array is empty', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ content: [] }),
    });
    const result = await claudeProvider.getCompletion('', '', 'typescript', new AbortController().signal);
    expect(result).toBe('');
  });
});

describe('claudeProvider.estimateCostCents', () => {
  it('uses Sonnet rates (input $3/M, output $15/M)', () => {
    // 1M input tokens = 300 cents, 1M output = 1500 cents
    expect(claudeProvider.estimateCostCents(1_000_000, 1_000_000)).toBe(1800);
    expect(claudeProvider.estimateCostCents(0, 0)).toBe(0);
  });

  it('rounds up to nearest cent', () => {
    expect(claudeProvider.estimateCostCents(100, 100)).toBeGreaterThanOrEqual(0);
  });
});
```

- [ ] **Run to verify it fails**

```bash
cd mobile-ide/mobile-ide-prototype && npx jest --watchAll=false tests/unit/claudeProvider.test.ts
```

Expected: FAIL — module not found.

- [ ] **Create `src/ai/providers/claudeProvider.ts`**

```typescript
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
```

- [ ] **Run tests to verify pass**

```bash
cd mobile-ide/mobile-ide-prototype && npx jest --watchAll=false tests/unit/claudeProvider.test.ts
```

Expected: PASS.

- [ ] **Commit**

```bash
git add mobile-ide/mobile-ide-prototype/src/ai/providers/claudeProvider.ts mobile-ide/mobile-ide-prototype/tests/unit/claudeProvider.test.ts
git commit -m "feat(epic-0010): add claudeProvider (Haiku completions, Sonnet chat, prompt caching)"
```

---

## Task 4: geminiProvider

**Files:**
- Create: `mobile-ide/mobile-ide-prototype/src/ai/providers/geminiProvider.ts`
- Create: `mobile-ide/mobile-ide-prototype/tests/unit/geminiProvider.test.ts`

- [ ] **Write the failing tests**

```typescript
// tests/unit/geminiProvider.test.ts
import { fetchEventSource } from '@microsoft/fetch-event-source';
import { geminiProvider } from '../../src/ai/providers/geminiProvider';

jest.mock('@microsoft/fetch-event-source', () => ({ fetchEventSource: jest.fn() }));
const mockFES = fetchEventSource as jest.MockedFunction<typeof fetchEventSource>;

beforeEach(() => { jest.clearAllMocks(); global.fetch = jest.fn() as jest.Mock; });

describe('geminiProvider.streamChat', () => {
  it('calls onChunk with text from candidates', async () => {
    mockFES.mockImplementation(async (_url, opts: any) => {
      opts.onmessage({ data: JSON.stringify({ candidates: [{ content: { parts: [{ text: 'Hi' }] } }] }) });
    });
    const chunks: string[] = [];
    await geminiProvider.streamChat([], 'code', 'typescript', new AbortController().signal, (c) => chunks.push(c));
    expect(chunks).toEqual(['Hi']);
  });

  it('maps assistant role to model for Gemini API', async () => {
    let capturedBody = '';
    mockFES.mockImplementation(async (_url, opts: any) => { capturedBody = opts.body; });
    const messages = [
      { role: 'user' as const, content: 'hello' },
      { role: 'assistant' as const, content: 'hi' },
    ];
    await geminiProvider.streamChat(messages, '', 'typescript', new AbortController().signal, () => {});
    const body = JSON.parse(capturedBody);
    expect(body.contents[1].role).toBe('model');
  });
});

describe('geminiProvider.getCompletion', () => {
  it('returns text on success', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ candidates: [{ content: { parts: [{ text: 'result' }] } }] }),
    });
    const result = await geminiProvider.getCompletion('fn(', ')', 'typescript', new AbortController().signal);
    expect(result).toBe('result');
  });

  it('returns empty string on failure', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: false });
    expect(await geminiProvider.getCompletion('', '', 'typescript', new AbortController().signal)).toBe('');
  });
});

describe('geminiProvider.estimateCostCents', () => {
  it('returns a non-negative number', () => {
    expect(geminiProvider.estimateCostCents(1000, 1000)).toBeGreaterThanOrEqual(0);
  });
});
```

- [ ] **Run to verify it fails**

```bash
cd mobile-ide/mobile-ide-prototype && npx jest --watchAll=false tests/unit/geminiProvider.test.ts
```

- [ ] **Create `src/ai/providers/geminiProvider.ts`**

```typescript
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
```

- [ ] **Run tests to verify pass**

```bash
cd mobile-ide/mobile-ide-prototype && npx jest --watchAll=false tests/unit/geminiProvider.test.ts
```

- [ ] **Commit**

```bash
git add mobile-ide/mobile-ide-prototype/src/ai/providers/geminiProvider.ts mobile-ide/mobile-ide-prototype/tests/unit/geminiProvider.test.ts
git commit -m "feat(epic-0010): add geminiProvider (Gemini 3 Flash)"
```

---

## Task 5: kimiProvider

**Files:**
- Create: `mobile-ide/mobile-ide-prototype/src/ai/providers/kimiProvider.ts`
- Create: `mobile-ide/mobile-ide-prototype/tests/unit/kimiProvider.test.ts`

- [ ] **Write the failing tests**

```typescript
// tests/unit/kimiProvider.test.ts
import { fetchEventSource } from '@microsoft/fetch-event-source';
import { kimiProvider } from '../../src/ai/providers/kimiProvider';

jest.mock('@microsoft/fetch-event-source', () => ({ fetchEventSource: jest.fn() }));
const mockFES = fetchEventSource as jest.MockedFunction<typeof fetchEventSource>;

beforeEach(() => { jest.clearAllMocks(); global.fetch = jest.fn() as jest.Mock; });

describe('kimiProvider.streamChat', () => {
  it('chunks text from OpenAI-format delta events', async () => {
    mockFES.mockImplementation(async (_url, opts: any) => {
      opts.onmessage({ data: JSON.stringify({ choices: [{ delta: { content: 'test' } }] }) });
      opts.onmessage({ data: '[DONE]' });
    });
    const chunks: string[] = [];
    await kimiProvider.streamChat([], '', 'python', new AbortController().signal, (c) => chunks.push(c));
    expect(chunks).toEqual(['test']);
  });

  it('calls the Moonshot endpoint', async () => {
    let capturedUrl = '';
    mockFES.mockImplementation(async (url) => { capturedUrl = url as string; });
    await kimiProvider.streamChat([], '', 'python', new AbortController().signal, () => {});
    expect(capturedUrl).toContain('api.moonshot.cn');
  });
});

describe('kimiProvider.getCompletion', () => {
  it('returns text on success', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'result' } }] }),
    });
    expect(await kimiProvider.getCompletion('', '', 'python', new AbortController().signal)).toBe('result');
  });

  it('returns empty on failure', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: false });
    expect(await kimiProvider.getCompletion('', '', 'python', new AbortController().signal)).toBe('');
  });
});

describe('kimiProvider.estimateCostCents', () => {
  it('computes cost from Kimi K2.6 rates', () => {
    // $0.74/M input, $3.49/M output
    expect(kimiProvider.estimateCostCents(1_000_000, 0)).toBeGreaterThan(0);
    expect(kimiProvider.estimateCostCents(0, 0)).toBe(0);
  });
});
```

- [ ] **Run to verify it fails**

```bash
cd mobile-ide/mobile-ide-prototype && npx jest --watchAll=false tests/unit/kimiProvider.test.ts
```

- [ ] **Create `src/ai/providers/kimiProvider.ts`**

```typescript
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
```

- [ ] **Run tests to verify pass**

```bash
cd mobile-ide/mobile-ide-prototype && npx jest --watchAll=false tests/unit/kimiProvider.test.ts
```

- [ ] **Commit**

```bash
git add mobile-ide/mobile-ide-prototype/src/ai/providers/kimiProvider.ts mobile-ide/mobile-ide-prototype/tests/unit/kimiProvider.test.ts
git commit -m "feat(epic-0010): add kimiProvider (Kimi K2.6, OpenAI-compatible)"
```

---

## Task 6: customProvider

**Files:**
- Create: `mobile-ide/mobile-ide-prototype/src/ai/providers/customProvider.ts`
- Create: `mobile-ide/mobile-ide-prototype/tests/unit/customProvider.test.ts`

- [ ] **Write the failing tests**

```typescript
// tests/unit/customProvider.test.ts
import * as SecureStore from 'expo-secure-store';
import { fetchEventSource } from '@microsoft/fetch-event-source';
import { buildCustomProvider } from '../../src/ai/providers/customProvider';
import type { CustomConfig } from '../../src/ai/aiProvider';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
}));
jest.mock('@microsoft/fetch-event-source', () => ({ fetchEventSource: jest.fn() }));

const mockFES = fetchEventSource as jest.MockedFunction<typeof fetchEventSource>;
const mockGetItem = SecureStore.getItemAsync as jest.Mock;

const config: CustomConfig = {
  baseUrl: 'http://localhost:11434/v1',
  modelName: 'llama3.2',
  contextWindowSize: 4096,
  apiKeyIsStored: false,
};

beforeEach(() => {
  jest.clearAllMocks();
  global.fetch = jest.fn() as jest.Mock;
  mockGetItem.mockResolvedValue(null);
});

describe('buildCustomProvider', () => {
  it('returns provider with id custom', () => {
    const p = buildCustomProvider(config);
    expect(p.id).toBe('custom');
    expect(p.displayName).toBe('Custom');
  });

  it('estimateCostCents always returns 0', () => {
    const p = buildCustomProvider(config);
    expect(p.estimateCostCents(1_000_000, 1_000_000)).toBe(0);
  });
});

describe('customProvider.streamChat', () => {
  it('calls configured baseUrl for chat completions', async () => {
    let capturedUrl = '';
    mockFES.mockImplementation(async (url) => { capturedUrl = url as string; });
    const p = buildCustomProvider(config);
    await p.streamChat([], '', 'typescript', new AbortController().signal, () => {});
    expect(capturedUrl).toBe('http://localhost:11434/v1/chat/completions');
  });

  it('reads API key from SecureStore when apiKeyIsStored is true', async () => {
    mockGetItem.mockResolvedValue('my-secret-key');
    mockFES.mockImplementation(async (_url, opts: any) => {
      expect(opts.headers['Authorization']).toBe('Bearer my-secret-key');
    });
    const p = buildCustomProvider({ ...config, apiKeyIsStored: true });
    await p.streamChat([], '', 'typescript', new AbortController().signal, () => {});
    expect(mockGetItem).toHaveBeenCalledWith('nomadcode_custom_ai_key');
  });

  it('omits Authorization header when no key is stored', async () => {
    mockFES.mockImplementation(async (_url, opts: any) => {
      expect(opts.headers['Authorization']).toBeUndefined();
    });
    const p = buildCustomProvider(config);
    await p.streamChat([], '', 'typescript', new AbortController().signal, () => {});
  });
});

describe('customProvider.getCompletion', () => {
  it('returns text from OpenAI-format response', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'completion' } }] }),
    });
    const p = buildCustomProvider(config);
    const result = await p.getCompletion('fn(', ')', 'typescript', new AbortController().signal);
    expect(result).toBe('completion');
  });
});
```

- [ ] **Run to verify it fails**

```bash
cd mobile-ide/mobile-ide-prototype && npx jest --watchAll=false tests/unit/customProvider.test.ts
```

- [ ] **Create `src/ai/providers/customProvider.ts`**

```typescript
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
```

- [ ] **Run tests to verify pass**

```bash
cd mobile-ide/mobile-ide-prototype && npx jest --watchAll=false tests/unit/customProvider.test.ts
```

- [ ] **Commit**

```bash
git add mobile-ide/mobile-ide-prototype/src/ai/providers/customProvider.ts mobile-ide/mobile-ide-prototype/tests/unit/customProvider.test.ts
git commit -m "feat(epic-0010): add customProvider (OpenAI-compat, SecureStore key, zero cost)"
```

---

## Task 7: providerRegistry

**Files:**
- Create: `mobile-ide/mobile-ide-prototype/src/ai/providerRegistry.ts`
- Create: `mobile-ide/mobile-ide-prototype/tests/unit/providerRegistry.test.ts`

- [ ] **Write the failing tests**

```typescript
// tests/unit/providerRegistry.test.ts
import { getProvider } from '../../src/ai/providerRegistry';

jest.mock('../../src/ai/providers/claudeProvider', () => ({ claudeProvider: { id: 'claude' } }));
jest.mock('../../src/ai/providers/geminiProvider', () => ({ geminiProvider: { id: 'gemini' } }));
jest.mock('../../src/ai/providers/kimiProvider',   () => ({ kimiProvider:   { id: 'kimi'   } }));
jest.mock('../../src/ai/providers/customProvider', () => ({
  buildCustomProvider: (cfg: object) => ({ id: 'custom', config: cfg }),
}));

describe('getProvider', () => {
  it('returns claudeProvider for id=claude', () => {
    expect(getProvider('claude').id).toBe('claude');
  });
  it('returns geminiProvider for id=gemini', () => {
    expect(getProvider('gemini').id).toBe('gemini');
  });
  it('returns kimiProvider for id=kimi', () => {
    expect(getProvider('kimi').id).toBe('kimi');
  });
  it('builds custom provider with config', () => {
    const cfg = { baseUrl: 'http://localhost:11434/v1', modelName: 'llama3', contextWindowSize: 4096, apiKeyIsStored: false };
    const p = getProvider('custom', cfg);
    expect(p.id).toBe('custom');
  });
  it('falls back to claude for unknown id', () => {
    expect(getProvider('unknown' as any).id).toBe('claude');
  });
});
```

- [ ] **Run to verify it fails**

```bash
cd mobile-ide/mobile-ide-prototype && npx jest --watchAll=false tests/unit/providerRegistry.test.ts
```

- [ ] **Create `src/ai/providerRegistry.ts`**

```typescript
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
```

- [ ] **Run tests to verify pass**

```bash
cd mobile-ide/mobile-ide-prototype && npx jest --watchAll=false tests/unit/providerRegistry.test.ts
```

- [ ] **Commit**

```bash
git add mobile-ide/mobile-ide-prototype/src/ai/providerRegistry.ts mobile-ide/mobile-ide-prototype/tests/unit/providerRegistry.test.ts
git commit -m "feat(epic-0010): add providerRegistry factory"
```

---

## Task 8: useAIStore

**Files:**
- Create: `mobile-ide/mobile-ide-prototype/src/stores/useAIStore.ts`
- Create: `mobile-ide/mobile-ide-prototype/tests/unit/useAIStore.test.ts`

- [ ] **Write the failing tests**

```typescript
// tests/unit/useAIStore.test.ts
import { act } from '@testing-library/react-native';

jest.mock('../../src/ai/providerRegistry', () => ({
  getProvider: jest.fn(() => ({
    id: 'claude',
    streamChat: jest.fn(async (_msgs: unknown, _fc: unknown, _lang: unknown, _sig: unknown, onChunk: (t: string) => void) => {
      onChunk('Hello'); onChunk(' world');
    }),
    getCompletion: jest.fn(async () => 'completion'),
    estimateCostCents: jest.fn(() => 1),
  })),
}));

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

import useAIStore, { selectIsOverQuota } from '../../src/stores/useAIStore';
import { DAILY_CAP_CENTS } from '../../src/ai/quotaConfig';

function resetStore() {
  useAIStore.setState({
    selectedProviderId: 'claude',
    customConfig: { baseUrl: '', modelName: '', contextWindowSize: 4096, apiKeyIsStored: false },
    dailySpendCents: 0,
    quotaResetDate: new Date().toISOString().slice(0, 10),
    messages: [],
    isStreaming: false,
    streamingText: '',
    abortController: null,
  });
}

beforeEach(() => { jest.clearAllMocks(); resetStore(); });

describe('selectIsOverQuota', () => {
  it('returns false when under cap', () => {
    expect(selectIsOverQuota(useAIStore.getState())).toBe(false);
  });

  it('returns true when at cap for built-in provider', () => {
    useAIStore.setState({ dailySpendCents: DAILY_CAP_CENTS });
    expect(selectIsOverQuota(useAIStore.getState())).toBe(true);
  });

  it('returns false for custom provider even when over cap', () => {
    useAIStore.setState({ selectedProviderId: 'custom', dailySpendCents: DAILY_CAP_CENTS + 100 });
    expect(selectIsOverQuota(useAIStore.getState())).toBe(false);
  });
});

describe('checkAndResetQuota', () => {
  it('resets spend when date has changed', () => {
    useAIStore.setState({ dailySpendCents: 10, quotaResetDate: '2000-01-01' });
    useAIStore.getState().checkAndResetQuota();
    expect(useAIStore.getState().dailySpendCents).toBe(0);
  });

  it('does not reset spend on same day', () => {
    useAIStore.setState({ dailySpendCents: 5 });
    useAIStore.getState().checkAndResetQuota();
    expect(useAIStore.getState().dailySpendCents).toBe(5);
  });
});

describe('sendMessage', () => {
  it('streams chunks and pushes final assistant message', async () => {
    await act(async () => {
      await useAIStore.getState().sendMessage('hello', 'code', 'typescript');
    });
    const { messages } = useAIStore.getState();
    expect(messages).toHaveLength(2);
    expect(messages[0]).toEqual({ role: 'user', content: 'hello' });
    expect(messages[1]).toEqual({ role: 'assistant', content: 'Hello world' });
    expect(useAIStore.getState().isStreaming).toBe(false);
    expect(useAIStore.getState().streamingText).toBe('');
  });

  it('adds quota error message when over cap', async () => {
    useAIStore.setState({ dailySpendCents: DAILY_CAP_CENTS });
    await act(async () => {
      await useAIStore.getState().sendMessage('hello', '', 'typescript');
    });
    const { messages } = useAIStore.getState();
    expect(messages.some((m) => m.content.includes('Daily AI limit'))).toBe(true);
    expect(useAIStore.getState().isStreaming).toBe(false);
  });

  it('increments dailySpendCents after successful message', async () => {
    await act(async () => {
      await useAIStore.getState().sendMessage('hi', '', 'typescript');
    });
    expect(useAIStore.getState().dailySpendCents).toBeGreaterThan(0);
  });
});

describe('cancelStream', () => {
  it('aborts the controller and clears streaming state', () => {
    const abort = new AbortController();
    const spy = jest.spyOn(abort, 'abort');
    useAIStore.setState({ isStreaming: true, abortController: abort });
    useAIStore.getState().cancelStream();
    expect(spy).toHaveBeenCalled();
    expect(useAIStore.getState().isStreaming).toBe(false);
  });
});

describe('clearHistory', () => {
  it('empties message list', () => {
    useAIStore.setState({ messages: [{ role: 'user', content: 'hi' }] });
    useAIStore.getState().clearHistory();
    expect(useAIStore.getState().messages).toHaveLength(0);
  });
});
```

- [ ] **Run to verify it fails**

```bash
cd mobile-ide/mobile-ide-prototype && npx jest --watchAll=false tests/unit/useAIStore.test.ts
```

- [ ] **Create `src/stores/useAIStore.ts`**

```typescript
// src/stores/useAIStore.ts
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getProvider } from '../ai/providerRegistry';
import { DAILY_CAP_CENTS } from '../ai/quotaConfig';
import type { AIProvider, ChatMessage, CustomConfig, ProviderId } from '../ai/aiProvider';

interface AIState {
  // ── Persisted ─────────────────────────────────────────────────────────────
  selectedProviderId: ProviderId;
  customConfig: CustomConfig;
  dailySpendCents: number;
  quotaResetDate: string;

  // ── Session only (not persisted — satisfies AC-0096) ──────────────────────
  messages: ChatMessage[];
  isStreaming: boolean;
  streamingText: string;
  abortController: AbortController | null;

  // ── Actions ───────────────────────────────────────────────────────────────
  sendMessage(userText: string, fileContent: string, language: string): Promise<void>;
  cancelStream(): void;
  clearHistory(): void;
  checkAndResetQuota(): void;
  getActiveProvider(): AIProvider;
}

export const selectIsOverQuota = (s: AIState): boolean =>
  s.selectedProviderId !== 'custom' && s.dailySpendCents >= DAILY_CAP_CENTS;

const DEFAULT_CUSTOM_CONFIG: CustomConfig = {
  baseUrl: '',
  modelName: '',
  contextWindowSize: 4096,
  apiKeyIsStored: false,
};

const QUOTA_ERROR_MSG =
  '⚠ Daily AI limit reached (15¢). Resets at midnight. Switch to a Custom provider to continue without limits.';

const useAIStore = create<AIState>()(
  persist(
    (set, get) => ({
      selectedProviderId: 'claude',
      customConfig: DEFAULT_CUSTOM_CONFIG,
      dailySpendCents: 0,
      quotaResetDate: new Date().toISOString().slice(0, 10),
      messages: [],
      isStreaming: false,
      streamingText: '',
      abortController: null,

      checkAndResetQuota() {
        const today = new Date().toISOString().slice(0, 10);
        if (get().quotaResetDate !== today) {
          set({ dailySpendCents: 0, quotaResetDate: today });
        }
      },

      getActiveProvider() {
        return getProvider(get().selectedProviderId, get().customConfig);
      },

      async sendMessage(userText, fileContent, language) {
        get().checkAndResetQuota();

        const pushError = (msg: string) => {
          set({
            messages: [
              ...get().messages,
              { role: 'user', content: userText },
              { role: 'assistant', content: msg },
            ],
            isStreaming: false,
            streamingText: '',
            abortController: null,
          });
        };

        if (selectIsOverQuota(get())) {
          pushError(QUOTA_ERROR_MSG);
          return;
        }

        const abort = new AbortController();
        set({
          messages: [...get().messages, { role: 'user', content: userText }],
          isStreaming: true,
          streamingText: '',
          abortController: abort,
        });

        try {
          const provider = get().getActiveProvider();

          // Pre-flight estimate — block if request would push over cap
          const estInput = Math.ceil((fileContent.length + userText.length) / 4);
          const estCost = provider.estimateCostCents(estInput, 256);
          if (
            get().selectedProviderId !== 'custom' &&
            get().dailySpendCents + estCost > DAILY_CAP_CENTS
          ) {
            // Undo the user message push
            set({ messages: get().messages.slice(0, -1) });
            pushError(QUOTA_ERROR_MSG);
            return;
          }

          let fullText = '';
          await provider.streamChat(
            get().messages,
            fileContent,
            language,
            abort.signal,
            (chunk) => {
              fullText += chunk;
              set({ streamingText: fullText });
            },
          );

          // Post-request: update with actual token estimate
          const actualCost = provider.estimateCostCents(
            Math.ceil((fileContent.length + userText.length) / 4),
            Math.ceil(fullText.length / 4),
          );

          set({
            messages: [...get().messages, { role: 'assistant', content: fullText }],
            isStreaming: false,
            streamingText: '',
            abortController: null,
            dailySpendCents: get().dailySpendCents + actualCost,
          });
        } catch (err) {
          if (abort.signal.aborted) {
            const partial = get().streamingText;
            set({
              messages: partial
                ? [...get().messages, { role: 'assistant', content: partial }]
                : get().messages.slice(0, -1),
              isStreaming: false,
              streamingText: '',
              abortController: null,
            });
          } else {
            set({
              messages: [...get().messages, {
                role: 'assistant',
                content: '⚠ Request failed. Check your connection and try again.',
              }],
              isStreaming: false,
              streamingText: '',
              abortController: null,
            });
          }
        }
      },

      cancelStream() {
        get().abortController?.abort();
        const partial = get().streamingText;
        set({
          isStreaming: false,
          streamingText: '',
          abortController: null,
          messages: partial
            ? [...get().messages, { role: 'assistant', content: partial }]
            : get().messages,
        });
      },

      clearHistory() {
        set({ messages: [], streamingText: '' });
      },
    }),
    {
      name: 'nomadcode-ai-store',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        selectedProviderId: state.selectedProviderId,
        customConfig: state.customConfig,
        dailySpendCents: state.dailySpendCents,
        quotaResetDate: state.quotaResetDate,
      }),
    },
  ),
);

export default useAIStore;
```

- [ ] **Run tests to verify pass**

```bash
cd mobile-ide/mobile-ide-prototype && npx jest --watchAll=false tests/unit/useAIStore.test.ts
```

Expected: PASS.

- [ ] **Commit**

```bash
git add mobile-ide/mobile-ide-prototype/src/stores/useAIStore.ts mobile-ide/mobile-ide-prototype/tests/unit/useAIStore.test.ts
git commit -m "feat(epic-0010): add useAIStore (quota, streaming, multi-provider)"
```

---

## Task 9: Editor.tsx — injectMessage

**Files:**
- Modify: `mobile-ide/mobile-ide-prototype/src/components/Editor.tsx`
- Modify: `mobile-ide/mobile-ide-prototype/tests/unit/Editor.test.tsx`

- [ ] **Write the failing test** — add to existing `Editor.test.tsx`:

```typescript
// Add inside the existing Editor.test.tsx describe block:
it('exposes injectMessage on the handle', () => {
  const ref = React.createRef<EditorHandle>();
  render(<Editor ref={ref} tabs={[]} activeTabPath={null} onTabChange={jest.fn()} onTabClose={jest.fn()} onContentChange={jest.fn()} onSave={jest.fn()} />);
  expect(typeof ref.current?.injectMessage).toBe('function');
});

it('injectMessage dispatches a serialised message to the WebView', () => {
  const ref = React.createRef<EditorHandle>();
  render(<Editor ref={ref} tabs={[]} activeTabPath={null} onTabChange={jest.fn()} onTabClose={jest.fn()} onContentChange={jest.fn()} onSave={jest.fn()} />);
  // Should not throw
  expect(() => ref.current?.injectMessage({ type: 'SET_INLINE_COMPLETION', text: 'hello' })).not.toThrow();
});
```

- [ ] **Run to verify the new tests fail**

```bash
cd mobile-ide/mobile-ide-prototype && npx jest --watchAll=false tests/unit/Editor.test.tsx -t "injectMessage"
```

Expected: FAIL — `injectMessage` not defined on handle.

- [ ] **Modify `src/components/Editor.tsx`**

Find the `EditorHandle` interface (around line 63) and add `injectMessage`:

```typescript
export interface EditorHandle {
  sendFoldAll: () => void;
  sendUnfoldAll: () => void;
  requestViewStateSave: (path: string) => void;
  sendPrettierConfig: (config: Record<string, unknown>) => void;
  sendFormat: () => void;
  setGutterDecorations: (lines: GutterLine[]) => void;
  toggleBlame: () => Promise<void>;
  injectMessage: (payload: { type: string } & Record<string, unknown>) => void;
}
```

Find the `useImperativeHandle` block and add the implementation. The existing `sendToEditor` helper already does the right thing:

```typescript
// Inside useImperativeHandle(ref, () => ({ ... })):
injectMessage: (payload) => {
  const { type, ...extra } = payload;
  sendToEditor(type, extra);
},
```

The `sendToEditor` helper already exists in the file:
```typescript
const sendToEditor = useCallback((type: string, extra: object = {}) => {
  const msg = JSON.stringify({ type, ...extra });
  webViewRef.current?.injectJavaScript(
    `window.dispatchEvent(new MessageEvent('message',{data:${JSON.stringify(msg)}}));true;`,
  );
}, []);
```

- [ ] **Run full Editor tests to verify no regressions**

```bash
cd mobile-ide/mobile-ide-prototype && npx jest --watchAll=false tests/unit/Editor.test.tsx
```

Expected: PASS (all existing + new injectMessage tests).

- [ ] **Commit**

```bash
git add mobile-ide/mobile-ide-prototype/src/components/Editor.tsx mobile-ide/mobile-ide-prototype/tests/unit/Editor.test.tsx
git commit -m "feat(epic-0010): add injectMessage to EditorHandle"
```

---

## Task 10: MonacoAssetManager — Completions Bridge

**Files:**
- Modify: `mobile-ide/mobile-ide-prototype/src/utils/MonacoAssetManager.ts`
- Modify: `mobile-ide/mobile-ide-prototype/tests/unit/MonacoAssetManager.test.ts`

- [ ] **Write the failing tests** — add to existing `MonacoAssetManager.test.ts`:

```typescript
// Add to the existing test file:

describe('SET_INLINE_COMPLETION message handler', () => {
  it('is present in the built HTML', () => {
    const html = buildMonacoHtml('https://example.com/vs');
    expect(html).toContain('SET_INLINE_COMPLETION');
  });

  it('includes registerInlineCompletionsProvider', () => {
    const html = buildMonacoHtml('https://example.com/vs');
    expect(html).toContain('registerInlineCompletionsProvider');
  });

  it('includes pendingCompletion variable', () => {
    const html = buildMonacoHtml('https://example.com/vs');
    expect(html).toContain('pendingCompletion');
  });
});

describe('COMPLETION_CONTEXT outbound message', () => {
  it('is present in the built HTML', () => {
    const html = buildMonacoHtml('https://example.com/vs');
    expect(html).toContain('COMPLETION_CONTEXT');
  });

  it('includes completionContextTimer debounce', () => {
    const html = buildMonacoHtml('https://example.com/vs');
    expect(html).toContain('completionContextTimer');
  });
});
```

- [ ] **Run to verify new tests fail**

```bash
cd mobile-ide/mobile-ide-prototype && npx jest --watchAll=false tests/unit/MonacoAssetManager.test.ts -t "COMPLETION"
```

Expected: FAIL.

- [ ] **Modify `src/utils/MonacoAssetManager.ts`**

Inside `buildMonacoHtml`, locate the `bootEditor` function in the template string. Find `editor.onDidChangeModelContent(function () {` and replace the entire handler with:

```javascript
// Variable declared before bootEditor alongside other vars (e.g. near breadcrumbTimer):
var completionContextTimer = null;
var pendingCompletion = null;

// Replace the existing onDidChangeModelContent handler:
editor.onDidChangeModelContent(function () {
  post({ type: 'contentChanged', content: editor.getValue() });

  if (completionContextTimer) clearTimeout(completionContextTimer);
  completionContextTimer = setTimeout(function () {
    var pos = editor.getPosition();
    if (!pos) return;
    var content = editor.getValue();
    var offset = model.getOffsetAt(pos);
    post({
      type: 'COMPLETION_CONTEXT',
      prefix: content.slice(0, offset),
      suffix: content.slice(offset),
      language: currentLanguage,
    });
  }, 100);
});
```

After `bootEditor`, register the inline completions provider (inside `require(['vs/editor/editor.main'], function () {` block, after the editor is created):

```javascript
monaco.languages.registerInlineCompletionsProvider({ pattern: '**' }, {
  provideInlineCompletions: function (model, position) {
    if (!pendingCompletion) return { items: [] };
    return {
      items: [{
        insertText: pendingCompletion,
        range: new monaco.Range(
          position.lineNumber, position.column,
          position.lineNumber, position.column
        )
      }]
    };
  },
  freeInlineCompletions: function () {}
});
```

In the message handler switch, add the `SET_INLINE_COMPLETION` case (alongside `FORMAT`, `FOLD_ALL`, etc.):

```javascript
case 'SET_INLINE_COMPLETION': {
  pendingCompletion = data.text || null;
  if (pendingCompletion) {
    editor.trigger('keyboard', 'editor.action.inlineSuggest.trigger', {});
  }
  break;
}
```

- [ ] **Run all MonacoAssetManager tests**

```bash
cd mobile-ide/mobile-ide-prototype && npx jest --watchAll=false tests/unit/MonacoAssetManager.test.ts
```

Expected: PASS.

- [ ] **Commit**

```bash
git add mobile-ide/mobile-ide-prototype/src/utils/MonacoAssetManager.ts mobile-ide/mobile-ide-prototype/tests/unit/MonacoAssetManager.test.ts
git commit -m "feat(epic-0010): add inline completions provider and COMPLETION_CONTEXT bridge to MonacoAssetManager"
```

---

## Task 11: PaywallAISheet

**Files:**
- Create: `mobile-ide/mobile-ide-prototype/src/components/PaywallAISheet.tsx`
- Create: `mobile-ide/mobile-ide-prototype/tests/unit/PaywallAISheet.test.tsx`

- [ ] **Write the failing tests**

```typescript
// tests/unit/PaywallAISheet.test.tsx
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import PaywallAISheet from '../../src/components/PaywallAISheet';

const mockTheme = {
  bg: '#0F172A', bgElevated: '#1E293B', bgHighlight: '#334155',
  text: '#E2E8F0', textMuted: '#64748B', accent: '#0D9488',
  border: '#334155', error: '#EF4444',
};
jest.mock('../../src/theme/useTheme', () => ({ useTheme: () => mockTheme }));

describe('PaywallAISheet', () => {
  it('renders Pro+AI Feature heading', () => {
    const { getByText } = render(<PaywallAISheet onUpgrade={jest.fn()} />);
    expect(getByText('Pro+AI Feature')).toBeTruthy();
  });

  it('renders pricing text', () => {
    const { getByText } = render(<PaywallAISheet onUpgrade={jest.fn()} />);
    expect(getByText(/\$14\.99\/mo/)).toBeTruthy();
  });

  it('calls onUpgrade when Upgrade button is tapped', () => {
    const onUpgrade = jest.fn();
    const { getByText } = render(<PaywallAISheet onUpgrade={onUpgrade} />);
    fireEvent.press(getByText('Upgrade to Pro+AI'));
    expect(onUpgrade).toHaveBeenCalledTimes(1);
  });

  it('renders feature list items', () => {
    const { getByText } = render(<PaywallAISheet onUpgrade={jest.fn()} />);
    expect(getByText(/Inline code completions/)).toBeTruthy();
    expect(getByText(/AI chat/)).toBeTruthy();
  });
});
```

- [ ] **Run to verify it fails**

```bash
cd mobile-ide/mobile-ide-prototype && npx jest --watchAll=false tests/unit/PaywallAISheet.test.tsx
```

- [ ] **Create `src/components/PaywallAISheet.tsx`**

```typescript
// src/components/PaywallAISheet.tsx
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '../theme/useTheme';

interface PaywallAISheetProps {
  onUpgrade: () => void;
}

const FEATURES = [
  'Inline code completions',
  'AI chat with file context',
  '3 built-in provider choices',
  'Custom model support',
];

export default function PaywallAISheet({ onUpgrade }: PaywallAISheetProps) {
  const t = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: t.bg }]}>
      <View style={[styles.iconTile, { backgroundColor: t.bgElevated }]}>
        <Text style={styles.lockIcon}>🔒</Text>
      </View>

      <Text style={[styles.heading, { color: t.text }]}>Pro+AI Feature</Text>
      <Text style={[styles.description, { color: t.textMuted }]}>
        AI chat and inline completions are included in the{' '}
        <Text style={{ color: t.accent }}>Pro+AI</Text> plan.
      </Text>

      <View style={[styles.featureBox, { backgroundColor: t.bgElevated, borderColor: t.border }]}>
        <Text style={[styles.featureLabel, { color: t.textMuted }]}>What you get</Text>
        {FEATURES.map((f) => (
          <Text key={f} style={[styles.featureItem, { color: t.text }]}>
            ✦ {f}
          </Text>
        ))}
      </View>

      <TouchableOpacity
        style={[styles.upgradeBtn, { backgroundColor: t.accent }]}
        onPress={onUpgrade}
        accessibilityRole="button"
        accessibilityLabel="Upgrade to Pro+AI"
      >
        <Text style={styles.upgradeBtnText}>Upgrade to Pro+AI</Text>
      </TouchableOpacity>

      <Text style={[styles.price, { color: t.textMuted }]}>$14.99/mo · $119.99/yr</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20, gap: 16 },
  iconTile:     { width: 56, height: 56, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  lockIcon:     { fontSize: 26 },
  heading:      { fontSize: 16, fontWeight: '700', textAlign: 'center' },
  description:  { fontSize: 13, textAlign: 'center', lineHeight: 20 },
  featureBox:   { width: '100%', borderRadius: 10, padding: 12, borderWidth: 1, gap: 6 },
  featureLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  featureItem:  { fontSize: 13 },
  upgradeBtn:   { width: '100%', borderRadius: 10, padding: 14, alignItems: 'center' },
  upgradeBtnText: { color: 'white', fontWeight: '700', fontSize: 15 },
  price:        { fontSize: 12 },
});
```

- [ ] **Run tests to verify pass**

```bash
cd mobile-ide/mobile-ide-prototype && npx jest --watchAll=false tests/unit/PaywallAISheet.test.tsx
```

- [ ] **Commit**

```bash
git add mobile-ide/mobile-ide-prototype/src/components/PaywallAISheet.tsx mobile-ide/mobile-ide-prototype/tests/unit/PaywallAISheet.test.tsx
git commit -m "feat(epic-0010): add PaywallAISheet inline paywall (AC-0097)"
```

---

## Task 12: AIChatPanel

**Files:**
- Create: `mobile-ide/mobile-ide-prototype/src/components/AIChatPanel.tsx`
- Create: `mobile-ide/mobile-ide-prototype/tests/unit/AIChatPanel.test.tsx`

- [ ] **Write the failing tests**

```typescript
// tests/unit/AIChatPanel.test.tsx
import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import AIChatPanel from '../../src/components/AIChatPanel';

const mockTheme = {
  bg: '#0F172A', bgElevated: '#1E293B', bgHighlight: '#334155',
  text: '#E2E8F0', textMuted: '#64748B', accent: '#0D9488',
  border: '#334155', error: '#EF4444',
};
jest.mock('../../src/theme/useTheme', () => ({ useTheme: () => mockTheme }));

const mockSendMessage = jest.fn();
const mockCancelStream = jest.fn();
const mockClearHistory = jest.fn();

jest.mock('../../src/stores/useAIStore', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    messages: [],
    isStreaming: false,
    streamingText: '',
    dailySpendCents: 0,
    selectedProviderId: 'claude',
    sendMessage: mockSendMessage,
    cancelStream: mockCancelStream,
    clearHistory: mockClearHistory,
  })),
  selectIsOverQuota: jest.fn(() => false),
}));

const defaultProps = {
  activeFilePath: '/workspace/App.tsx',
  activeFileContent: 'const x = 1;',
  activeFileLanguage: 'typescript',
};

beforeEach(() => jest.clearAllMocks());

describe('AIChatPanel', () => {
  it('renders AI Chat heading', () => {
    const { getByText } = render(<AIChatPanel {...defaultProps} />);
    expect(getByText('AI Chat')).toBeTruthy();
  });

  it('shows current filename as context', () => {
    const { getByText } = render(<AIChatPanel {...defaultProps} />);
    expect(getByText(/App\.tsx/)).toBeTruthy();
  });

  it('renders messages from the store', () => {
    const useAIStore = require('../../src/stores/useAIStore').default;
    useAIStore.mockReturnValue({
      messages: [
        { role: 'user', content: 'hello' },
        { role: 'assistant', content: 'world' },
      ],
      isStreaming: false,
      streamingText: '',
      dailySpendCents: 0,
      selectedProviderId: 'claude',
      sendMessage: mockSendMessage,
      cancelStream: mockCancelStream,
      clearHistory: mockClearHistory,
    });
    const { getByText } = render(<AIChatPanel {...defaultProps} />);
    expect(getByText('hello')).toBeTruthy();
    expect(getByText('world')).toBeTruthy();
  });

  it('calls sendMessage when Send is pressed', async () => {
    mockSendMessage.mockResolvedValue(undefined);
    const { getByPlaceholderText, getByAccessibilityHint } = render(<AIChatPanel {...defaultProps} />);
    fireEvent.changeText(getByPlaceholderText(/Ask about/), 'what does this do?');
    await act(async () => {
      fireEvent.press(getByAccessibilityHint('Send message'));
    });
    expect(mockSendMessage).toHaveBeenCalledWith('what does this do?', 'const x = 1;', 'typescript');
  });

  it('disables send button while streaming', () => {
    const useAIStore = require('../../src/stores/useAIStore').default;
    useAIStore.mockReturnValue({
      messages: [],
      isStreaming: true,
      streamingText: 'partial...',
      dailySpendCents: 0,
      selectedProviderId: 'claude',
      sendMessage: mockSendMessage,
      cancelStream: mockCancelStream,
      clearHistory: mockClearHistory,
    });
    const { getByAccessibilityHint } = render(<AIChatPanel {...defaultProps} />);
    expect(getByAccessibilityHint('Send message').props.accessibilityState?.disabled).toBe(true);
  });

  it('shows Stop button while streaming', () => {
    const useAIStore = require('../../src/stores/useAIStore').default;
    useAIStore.mockReturnValue({
      messages: [],
      isStreaming: true,
      streamingText: 'hi',
      dailySpendCents: 0,
      selectedProviderId: 'claude',
      sendMessage: mockSendMessage,
      cancelStream: mockCancelStream,
      clearHistory: mockClearHistory,
    });
    const { getByText } = render(<AIChatPanel {...defaultProps} />);
    expect(getByText('■ Stop')).toBeTruthy();
    fireEvent.press(getByText('■ Stop'));
    expect(mockCancelStream).toHaveBeenCalled();
  });

  it('calls clearHistory when clear button is tapped', () => {
    const { getByAccessibilityLabel } = render(<AIChatPanel {...defaultProps} />);
    fireEvent.press(getByAccessibilityLabel('Clear chat history'));
    expect(mockClearHistory).toHaveBeenCalled();
  });

  it('shows spend chip for built-in provider', () => {
    const { getByText } = render(<AIChatPanel {...defaultProps} />);
    expect(getByText(/0\.0¢/)).toBeTruthy();
  });
});
```

- [ ] **Run to verify it fails**

```bash
cd mobile-ide/mobile-ide-prototype && npx jest --watchAll=false tests/unit/AIChatPanel.test.tsx
```

- [ ] **Create `src/components/AIChatPanel.tsx`**

```typescript
// src/components/AIChatPanel.tsx
import React, { useState, useRef, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useTheme } from '../theme/useTheme';
import useAIStore, { selectIsOverQuota } from '../stores/useAIStore';
import type { ChatMessage } from '../ai/aiProvider';
import { DAILY_CAP_CENTS } from '../ai/quotaConfig';

interface AIChatPanelProps {
  activeFilePath: string | null;
  activeFileContent: string;
  activeFileLanguage: string;
}

const PROVIDER_LABELS: Record<string, string> = {
  claude: '✦ Claude',
  gemini: '◈ Gemini',
  kimi:   '◉ Kimi',
  custom: '⚙ Custom',
};

function filename(path: string | null): string {
  if (!path) return 'no file open';
  return path.split('/').pop() ?? path;
}

export default function AIChatPanel({ activeFilePath, activeFileContent, activeFileLanguage }: AIChatPanelProps) {
  const t = useTheme();
  const { messages, isStreaming, streamingText, dailySpendCents, selectedProviderId,
          sendMessage, cancelStream, clearHistory } = useAIStore();
  const isOverQuota = selectIsOverQuota(useAIStore.getState());

  const [inputText, setInputText] = useState('');
  const flatListRef = useRef<FlatList>(null);

  const handleSend = useCallback(async () => {
    if (!inputText.trim() || isStreaming) return;
    const text = inputText.trim();
    setInputText('');
    await sendMessage(text, activeFileContent, activeFileLanguage);
  }, [inputText, isStreaming, sendMessage, activeFileContent, activeFileLanguage]);

  const spendLabel = selectedProviderId === 'custom'
    ? 'custom'
    : `${(dailySpendCents / 10).toFixed(1)}¢`;

  const allMessages: ChatMessage[] = [
    ...messages,
    ...(streamingText ? [{ role: 'assistant' as const, content: streamingText }] : []),
  ];

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: t.bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: t.border, backgroundColor: t.bgElevated }]}>
        <View>
          <Text style={[styles.headerTitle, { color: t.text }]}>AI Chat</Text>
          <Text style={[styles.headerSub, { color: t.textMuted }]}>
            Context: {filename(activeFilePath)}
          </Text>
        </View>
        <View style={styles.headerActions}>
          {isStreaming ? (
            <TouchableOpacity
              onPress={cancelStream}
              style={[styles.stopBtn, { backgroundColor: t.bgHighlight }]}
            >
              <Text style={[styles.stopBtnText, { color: t.error }]}>■ Stop</Text>
            </TouchableOpacity>
          ) : (
            <Text style={[styles.spendChip, { color: t.textMuted, backgroundColor: t.bgHighlight }]}>
              {spendLabel}
            </Text>
          )}
          <TouchableOpacity
            onPress={clearHistory}
            accessibilityLabel="Clear chat history"
            style={styles.clearBtn}
          >
            <Text style={[styles.clearBtnText, { color: t.textMuted }]}>⌫</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Messages */}
      <FlatList
        ref={flatListRef}
        data={allMessages}
        keyExtractor={(_, i) => String(i)}
        contentContainerStyle={styles.messageList}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        renderItem={({ item }) => (
          <View style={item.role === 'user' ? styles.userBubbleWrap : styles.assistantBubbleWrap}>
            {item.role === 'assistant' && (
              <Text style={[styles.providerLabel, { color: t.accent }]}>
                {PROVIDER_LABELS[selectedProviderId] ?? '✦ AI'}
              </Text>
            )}
            <View style={[
              styles.bubble,
              item.role === 'user'
                ? [styles.userBubble, { backgroundColor: '#1E3A5F' }]
                : [styles.assistantBubble, { backgroundColor: t.bgElevated }],
            ]}>
              <Text style={[styles.bubbleText, { color: t.text }]}>{item.content}</Text>
            </View>
          </View>
        )}
      />

      {/* Input */}
      <View style={[styles.inputRow, { borderTopColor: t.border, backgroundColor: t.bgElevated }]}>
        <TextInput
          style={[styles.input, { backgroundColor: t.bg, borderColor: t.border, color: t.text }]}
          value={inputText}
          onChangeText={setInputText}
          placeholder={`Ask about ${filename(activeFilePath)}…`}
          placeholderTextColor={t.textMuted}
          multiline
          editable={!isStreaming}
          onSubmitEditing={handleSend}
          returnKeyType="send"
          blurOnSubmit={false}
        />
        <TouchableOpacity
          onPress={handleSend}
          disabled={isStreaming || !inputText.trim()}
          accessibilityHint="Send message"
          accessibilityState={{ disabled: isStreaming || !inputText.trim() }}
          style={[styles.sendBtn, { backgroundColor: isStreaming ? t.bgHighlight : t.accent }]}
        >
          <Text style={styles.sendBtnText}>↑</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container:          { flex: 1 },
  header:             { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 10, borderBottomWidth: 1 },
  headerTitle:        { fontSize: 13, fontWeight: '700' },
  headerSub:          { fontSize: 11, marginTop: 1 },
  headerActions:      { flexDirection: 'row', alignItems: 'center', gap: 6 },
  spendChip:          { fontSize: 11, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  stopBtn:            { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  stopBtnText:        { fontSize: 12, fontWeight: '600' },
  clearBtn:           { padding: 4, minWidth: 32, alignItems: 'center' },
  clearBtnText:       { fontSize: 16 },
  messageList:        { padding: 10, gap: 10, flexGrow: 1 },
  userBubbleWrap:     { alignItems: 'flex-end' },
  assistantBubbleWrap:{ alignItems: 'flex-start' },
  providerLabel:      { fontSize: 10, fontWeight: '700', marginBottom: 3, marginLeft: 2 },
  bubble:             { borderRadius: 10, padding: 9, maxWidth: '88%' },
  userBubble:         { borderBottomRightRadius: 2 },
  assistantBubble:    { borderBottomLeftRadius: 2 },
  bubbleText:         { fontSize: 13, lineHeight: 20 },
  inputRow:           { flexDirection: 'row', gap: 8, padding: 8, borderTopWidth: 1 },
  input:              { flex: 1, borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 13, maxHeight: 100 },
  sendBtn:            { width: 36, height: 36, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  sendBtnText:        { color: 'white', fontSize: 18, fontWeight: '700' },
});
```

- [ ] **Run tests to verify pass**

```bash
cd mobile-ide/mobile-ide-prototype && npx jest --watchAll=false tests/unit/AIChatPanel.test.tsx
```

- [ ] **Commit**

```bash
git add mobile-ide/mobile-ide-prototype/src/components/AIChatPanel.tsx mobile-ide/mobile-ide-prototype/tests/unit/AIChatPanel.test.tsx
git commit -m "feat(epic-0010): add AIChatPanel with streaming UI, quota chip, stop button (AC-0094, AC-0095, AC-0096)"
```

---

## Task 13: FileExplorer — AI Tab

**Files:**
- Modify: `mobile-ide/mobile-ide-prototype/src/components/FileExplorer.tsx`
- Modify: `mobile-ide/mobile-ide-prototype/tests/unit/FileExplorer.test.tsx`

- [ ] **Write the failing tests** — add to existing `FileExplorer.test.tsx`:

```typescript
// Add these tests to the existing FileExplorer describe block:

it('renders AI tab in the tab bar', () => {
  const { getByText } = render(
    <FileExplorer
      {...defaultProps}
      sidebarTab="files"
      onSidebarTabChange={jest.fn()}
    />
  );
  expect(getByText('✦ AI')).toBeTruthy();
});

it('renders PaywallAISheet for Free tier when ai tab selected', () => {
  jest.mock('../../src/stores/useSubscriptionStore', () => ({
    default: jest.fn(() => ({ tier: 'free' })),
  }));
  const { getByText } = render(
    <FileExplorer
      {...defaultProps}
      sidebarTab="ai"
      onSidebarTabChange={jest.fn()}
    />
  );
  expect(getByText('Pro+AI Feature')).toBeTruthy();
});
```

- [ ] **Run to verify new tests fail**

```bash
cd mobile-ide/mobile-ide-prototype && npx jest --watchAll=false tests/unit/FileExplorer.test.tsx -t "AI tab"
```

- [ ] **Modify `src/components/FileExplorer.tsx`**

**Step 1:** Update the `SidebarTab` type (line ~33):
```typescript
// Before:
sidebarTab: 'files' | 'search';
onSidebarTabChange: (tab: 'files' | 'search') => void;

// After:
sidebarTab: 'files' | 'search' | 'ai';
onSidebarTabChange: (tab: 'files' | 'search' | 'ai') => void;
```

**Step 2:** Add imports at the top of the file:
```typescript
import AIChatPanel from './AIChatPanel';
import PaywallAISheet from './PaywallAISheet';
import useSubscriptionStore from '../stores/useSubscriptionStore';
import { hasAIAccess } from '../iap/entitlements';
```

**Step 3:** Add `activeFilePath`, `activeFileContent`, `activeFileLanguage`, `onUpgrade` props to the interface:
```typescript
interface FileExplorerProps {
  // ... existing props ...
  sidebarTab: 'files' | 'search' | 'ai';
  onSidebarTabChange: (tab: 'files' | 'search' | 'ai') => void;
  activeFilePath?: string | null;
  activeFileContent?: string;
  activeFileLanguage?: string;
  onUpgrade?: () => void;
}
```

**Step 4:** Add the AI tab to the tab bar (alongside existing "Files" / "Search" tabs):
```typescript
{ label: '✦ AI', value: 'ai' as const },
```

**Step 5:** Add AI tab content rendering. In the section that checks `sidebarTab === 'search'`, add a new branch:
```typescript
{sidebarTab === 'ai' ? (
  hasAIAccess(useSubscriptionStore.getState().tier) ? (
    <AIChatPanel
      activeFilePath={activeFilePath ?? null}
      activeFileContent={activeFileContent ?? ''}
      activeFileLanguage={activeFileLanguage ?? 'plaintext'}
    />
  ) : (
    <PaywallAISheet onUpgrade={onUpgrade ?? (() => {})} />
  )
) : sidebarTab === 'search' ? (
  // existing search panel
) : (
  // existing file tree
)}
```

- [ ] **Run all FileExplorer tests**

```bash
cd mobile-ide/mobile-ide-prototype && npx jest --watchAll=false tests/unit/FileExplorer.test.tsx
```

Expected: PASS.

- [ ] **Commit**

```bash
git add mobile-ide/mobile-ide-prototype/src/components/FileExplorer.tsx mobile-ide/mobile-ide-prototype/tests/unit/FileExplorer.test.tsx
git commit -m "feat(epic-0010): add AI sidebar tab to FileExplorer (AC-0094, AC-0097)"
```

---

## Task 14: SettingsScreen — AI Settings Section

**Files:**
- Modify: `mobile-ide/mobile-ide-prototype/src/components/SettingsScreen.tsx`
- Modify: `mobile-ide/mobile-ide-prototype/tests/unit/SettingsScreen.test.tsx`

- [ ] **Write the failing tests** — add to existing `SettingsScreen.test.tsx`:

```typescript
// Add after existing imports:
jest.mock('../../src/stores/useAIStore', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    selectedProviderId: 'claude',
    customConfig: { baseUrl: '', modelName: '', contextWindowSize: 4096, apiKeyIsStored: false },
    dailySpendCents: 0,
  })),
}));
jest.mock('expo-secure-store', () => ({ setItemAsync: jest.fn(), getItemAsync: jest.fn() }));

// Add these test cases:
describe('AI Settings section', () => {
  it('renders AI SETTINGS section header', () => {
    const { getByText } = render(<SettingsScreen {...defaultProps} />);
    expect(getByText('AI SETTINGS')).toBeTruthy();
  });

  it('shows current provider name', () => {
    const { getByText } = render(<SettingsScreen {...defaultProps} />);
    expect(getByText(/Claude/)).toBeTruthy();
  });

  it('does not show custom fields for built-in provider', () => {
    const { queryByPlaceholderText } = render(<SettingsScreen {...defaultProps} />);
    expect(queryByPlaceholderText('http://localhost:11434/v1')).toBeNull();
  });

  it('shows custom fields when Custom provider is selected', () => {
    const useAIStore = require('../../src/stores/useAIStore').default;
    useAIStore.mockReturnValue({
      selectedProviderId: 'custom',
      customConfig: { baseUrl: '', modelName: '', contextWindowSize: 4096, apiKeyIsStored: false },
      dailySpendCents: 0,
    });
    const { getByPlaceholderText } = render(<SettingsScreen {...defaultProps} />);
    expect(getByPlaceholderText('http://localhost:11434/v1')).toBeTruthy();
    expect(getByPlaceholderText('llama3.2')).toBeTruthy();
  });
});
```

- [ ] **Run to verify new tests fail**

```bash
cd mobile-ide/mobile-ide-prototype && npx jest --watchAll=false tests/unit/SettingsScreen.test.tsx -t "AI Settings"
```

- [ ] **Modify `src/components/SettingsScreen.tsx`**

Add the following imports:
```typescript
import * as SecureStore from 'expo-secure-store';
import useAIStore from '../stores/useAIStore';
import { DAILY_CAP_CENTS } from '../ai/quotaConfig';
import type { ProviderId } from '../ai/aiProvider';
```

Add the AI Settings section inside the `ScrollView`, after the existing sections:

```typescript
{/* ── AI Settings ─────────────────────────────────────────────────── */}
<Text style={[styles.sectionHeader, { color: t.accent }]}>AI SETTINGS</Text>

{/* Daily usage bar (built-in only) */}
{selectedProviderId !== 'custom' && (
  <View style={[styles.row, { borderColor: t.border }]}>
    <View style={styles.rowContent}>
      <View style={styles.spendRow}>
        <Text style={[styles.label, { color: t.textMuted }]}>Daily usage</Text>
        <Text style={[styles.value, { color: t.accent }]}>
          {(dailySpendCents / 10).toFixed(1)}¢ / {(DAILY_CAP_CENTS / 10).toFixed(0)}¢
        </Text>
      </View>
      <View style={[styles.progressBar, { backgroundColor: t.bgHighlight }]}>
        <View style={[styles.progressFill, {
          backgroundColor: t.accent,
          width: `${Math.min((dailySpendCents / DAILY_CAP_CENTS) * 100, 100)}%` as any,
        }]} />
      </View>
      <Text style={[styles.hint, { color: t.textMuted }]}>Shared cap across all providers · resets midnight</Text>
    </View>
  </View>
)}

{/* Provider picker */}
<TouchableOpacity
  style={[styles.row, { borderColor: t.border }]}
  onPress={() => setShowProviderPicker(true)}
  accessibilityLabel="Select AI provider"
>
  <Text style={[styles.label, { color: t.text }]}>AI Provider</Text>
  <View style={[styles.pill, { backgroundColor: t.bgHighlight, borderColor: t.border }]}>
    <Text style={[styles.pillText, { color: t.accent }]}>
      {PROVIDER_DISPLAY[selectedProviderId]} ▾
    </Text>
  </View>
</TouchableOpacity>

{/* Read-only model pills for built-in providers */}
{selectedProviderId !== 'custom' && (
  <>
    <View style={[styles.row, { borderColor: t.border }]}>
      <Text style={[styles.label, { color: t.textMuted }]}>Completions</Text>
      <Text style={[styles.pill2, { color: t.textMuted, backgroundColor: t.bgHighlight }]}>
        {COMPLETION_MODEL_LABELS[selectedProviderId]}
      </Text>
    </View>
    <View style={[styles.row, { borderColor: t.border }]}>
      <Text style={[styles.label, { color: t.textMuted }]}>Chat</Text>
      <Text style={[styles.pill2, { color: t.textMuted, backgroundColor: t.bgHighlight }]}>
        {CHAT_MODEL_LABELS[selectedProviderId]}
      </Text>
    </View>
  </>
)}

{/* Custom provider fields (only shown when Custom is selected) */}
{selectedProviderId === 'custom' && (
  <View style={[styles.customSection, { borderLeftColor: t.accent, backgroundColor: t.bgElevated }]}>
    <Text style={[styles.customSectionHeader, { color: t.accent }]}>Custom Provider Config</Text>
    <Text style={[styles.fieldLabel, { color: t.textMuted }]}>Base URL</Text>
    <TextInput
      style={[styles.textField, { color: t.text, borderColor: t.border, backgroundColor: t.bg }]}
      value={customBaseUrl}
      onChangeText={setCustomBaseUrl}
      onBlur={() => saveCustomConfig()}
      placeholder="http://localhost:11434/v1"
      placeholderTextColor={t.textMuted}
      autoCapitalize="none"
      autoCorrect={false}
    />
    <Text style={[styles.fieldLabel, { color: t.textMuted }]}>
      API Key <Text style={{ color: t.textMuted }}>(optional)</Text>
    </Text>
    <TextInput
      style={[styles.textField, { color: t.text, borderColor: t.border, backgroundColor: t.bg }]}
      value={customApiKey}
      onChangeText={setCustomApiKey}
      onBlur={saveApiKey}
      placeholder="sk-..."
      placeholderTextColor={t.textMuted}
      secureTextEntry
      autoCapitalize="none"
    />
    <Text style={[styles.fieldLabel, { color: t.textMuted }]}>Model name</Text>
    <TextInput
      style={[styles.textField, { color: t.text, borderColor: t.border, backgroundColor: t.bg }]}
      value={customModelName}
      onChangeText={setCustomModelName}
      onBlur={() => saveCustomConfig()}
      placeholder="llama3.2"
      placeholderTextColor={t.textMuted}
      autoCapitalize="none"
      autoCorrect={false}
    />
    <Text style={[styles.fieldLabel, { color: t.textMuted }]}>Context window (tokens)</Text>
    <TextInput
      style={[styles.textField, { color: t.text, borderColor: t.border, backgroundColor: t.bg }]}
      value={String(customContextSize)}
      onChangeText={(v) => setCustomContextSize(Number(v.replace(/[^0-9]/g, '')) || 4096)}
      onBlur={() => saveCustomConfig()}
      placeholder="4096"
      placeholderTextColor={t.textMuted}
      keyboardType="numeric"
    />
    <Text style={[styles.hint, { color: t.textMuted }]}>
      Requires OpenAI-compatible endpoint · key stored in device keychain
    </Text>
  </View>
)}
```

Add the required local state and constants at the top of the component:

```typescript
const { selectedProviderId, customConfig, dailySpendCents } = useAIStore();
const [showProviderPicker, setShowProviderPicker] = useState(false);
const [customBaseUrl, setCustomBaseUrl]       = useState(customConfig.baseUrl);
const [customModelName, setCustomModelName]   = useState(customConfig.modelName);
const [customContextSize, setCustomContextSize] = useState(customConfig.contextWindowSize);
const [customApiKey, setCustomApiKey]         = useState('');

const PROVIDER_DISPLAY: Record<ProviderId, string> = {
  claude:  '✦ Claude',
  gemini:  '◈ Gemini 3 Flash',
  kimi:    '◉ Kimi K2.6',
  custom:  '⚙ Custom',
};

const COMPLETION_MODEL_LABELS: Record<ProviderId, string> = {
  claude: 'Haiku 4.5', gemini: 'Gemini 3 Flash', kimi: 'Kimi K2.6', custom: '',
};

const CHAT_MODEL_LABELS: Record<ProviderId, string> = {
  claude: 'Sonnet 4.6', gemini: 'Gemini 3 Flash', kimi: 'Kimi K2.6', custom: '',
};

const saveCustomConfig = useCallback(() => {
  useAIStore.setState((s) => ({
    customConfig: {
      ...s.customConfig,
      baseUrl: customBaseUrl,
      modelName: customModelName,
      contextWindowSize: customContextSize,
    },
  }));
}, [customBaseUrl, customModelName, customContextSize]);

const saveApiKey = useCallback(async () => {
  if (customApiKey) {
    await SecureStore.setItemAsync('nomadcode_custom_ai_key', customApiKey);
    useAIStore.setState((s) => ({
      customConfig: { ...s.customConfig, apiKeyIsStored: true },
    }));
  }
}, [customApiKey]);
```

Add the provider picker modal:
```typescript
<Modal visible={showProviderPicker} transparent animationType="slide">
  <TouchableOpacity style={styles.modalOverlay} onPress={() => setShowProviderPicker(false)}>
    <View style={[styles.pickerSheet, { backgroundColor: t.bgElevated }]}>
      {(['claude', 'gemini', 'kimi', 'custom'] as ProviderId[]).map((id) => (
        <TouchableOpacity
          key={id}
          style={[styles.pickerItem, { borderBottomColor: t.border }]}
          onPress={() => {
            useAIStore.setState({ selectedProviderId: id });
            setShowProviderPicker(false);
          }}
        >
          <Text style={[styles.pickerItemText, { color: selectedProviderId === id ? t.accent : t.text }]}>
            {PROVIDER_DISPLAY[id]}
          </Text>
          {selectedProviderId === id && <Text style={{ color: t.accent }}>✓</Text>}
        </TouchableOpacity>
      ))}
    </View>
  </TouchableOpacity>
</Modal>
```

- [ ] **Run all SettingsScreen tests**

```bash
cd mobile-ide/mobile-ide-prototype && npx jest --watchAll=false tests/unit/SettingsScreen.test.tsx
```

Expected: PASS.

- [ ] **Commit**

```bash
git add mobile-ide/mobile-ide-prototype/src/components/SettingsScreen.tsx mobile-ide/mobile-ide-prototype/tests/unit/SettingsScreen.test.tsx
git commit -m "feat(epic-0010): add AI Settings section to SettingsScreen (provider picker, custom config, quota bar)"
```

---

## Task 15: App.tsx — COMPLETION_CONTEXT Handler

**Files:**
- Modify: `mobile-ide/mobile-ide-prototype/App.tsx`
- Modify: `mobile-ide/mobile-ide-prototype/tests/unit/App.test.tsx`

- [ ] **Write the failing tests** — add to existing `App.test.tsx`:

```typescript
// Add imports:
import useAIStore from '../../src/stores/useAIStore';
jest.mock('../../src/stores/useAIStore', () => ({
  __esModule: true,
  default: Object.assign(jest.fn(() => ({})), {
    getState: jest.fn(() => ({
      getActiveProvider: jest.fn(() => ({
        getCompletion: jest.fn(async () => 'completion text'),
        estimateCostCents: jest.fn(() => 0),
      })),
    })),
    setState: jest.fn(),
  }),
  selectIsOverQuota: jest.fn(() => false),
}));

// Add test cases:
describe('COMPLETION_CONTEXT handling', () => {
  it('does not fire completion for Free tier (AC-0098)', async () => {
    // subscriptionStore returns 'free'
    const mockGetCompletion = jest.fn();
    require('../../src/stores/useAIStore').default.getState.mockReturnValue({
      getActiveProvider: () => ({ getCompletion: mockGetCompletion, estimateCostCents: () => 0 }),
    });
    // simulate COMPLETION_CONTEXT message from WebView with Free tier
    // getCompletion should NOT be called
    // (exact implementation depends on how WebView onMessage is testable in the existing test setup)
    expect(mockGetCompletion).not.toHaveBeenCalled();
  });
});
```

- [ ] **Modify `App.tsx`**

**Step 1:** Add imports near the top:
```typescript
import useAIStore, { selectIsOverQuota } from './src/stores/useAIStore';
import { hasAIAccess } from './src/iap/entitlements';
import { COMPLETION_PREFIX_CHARS, COMPLETION_SUFFIX_CHARS } from './src/ai/quotaConfig';
```

**Step 2:** Add the completion request ref alongside other refs (near `editorRef`, `fileExplorerRef`):
```typescript
const completionRequestRef = useRef<{
  timer: ReturnType<typeof setTimeout>;
  abort: AbortController;
} | null>(null);
```

**Step 3:** In the WebView `onMessage` handler inside `<Editor>`, add the `COMPLETION_CONTEXT` case alongside existing cases (`contentChanged`, `save`, etc.):

```typescript
case 'COMPLETION_CONTEXT': {
  // AC-0098: completely skip for non-Pro+AI — no timer, no API call
  if (!hasAIAccess(subscriptionTier)) break;

  // Cancel any in-flight completion and clear stale ghost text
  completionRequestRef.current?.abort.abort();
  clearTimeout(completionRequestRef.current?.timer);
  editorRef.current?.injectMessage({ type: 'SET_INLINE_COMPLETION', text: '' });

  const abort = new AbortController();
  const { prefix, suffix, language } = msgData as { prefix: string; suffix: string; language: string };

  const timer = setTimeout(async () => {
    try {
      const aiStore = useAIStore.getState();
      if (selectIsOverQuota(aiStore)) return;

      const trimmedPrefix = prefix.slice(-COMPLETION_PREFIX_CHARS);
      const trimmedSuffix = suffix.slice(0, COMPLETION_SUFFIX_CHARS);

      const text = await aiStore
        .getActiveProvider()
        .getCompletion(trimmedPrefix, trimmedSuffix, language, abort.signal);

      if (!abort.signal.aborted) {
        editorRef.current?.injectMessage({ type: 'SET_INLINE_COMPLETION', text });
      }
    } catch {
      // Completion failures are always silent — never interrupt typing
    }
  }, 300);

  completionRequestRef.current = { timer, abort };
  break;
}
```

**Step 4:** Pass AI-related props to `FileExplorer`. Find `<FileExplorer` in the JSX and add:
```typescript
activeFilePath={activeTabPath}
activeFileContent={tabs.find((t) => t.path === activeTabPath)?.content ?? ''}
activeFileLanguage={tabs.find((t) => t.path === activeTabPath)?.language ?? 'plaintext'}
onUpgrade={() => setShowPaywall(true)}
```

Also ensure `sidebarTab` state type accommodates `'ai'`:
```typescript
// If sidebarTab state is typed, update it:
const [sidebarTab, setSidebarTab] = useState<'files' | 'search' | 'ai'>('files');
```

- [ ] **Run all App tests**

```bash
cd mobile-ide/mobile-ide-prototype && npx jest --watchAll=false tests/unit/App.test.tsx
```

Expected: PASS (existing tests unaffected).

- [ ] **Run full test suite**

```bash
cd mobile-ide/mobile-ide-prototype && npx jest --watchAll=false
```

Expected: All tests pass (≥1006 + new tests from this epic).

- [ ] **Commit**

```bash
git add mobile-ide/mobile-ide-prototype/App.tsx mobile-ide/mobile-ide-prototype/tests/unit/App.test.tsx
git commit -m "feat(epic-0010): wire COMPLETION_CONTEXT handler in App.tsx (AC-0091, AC-0093, AC-0098)"
```

---

## Task 16: Final Verification

- [ ] **Run full test suite and verify ≥80% coverage on new files**

```bash
cd mobile-ide/mobile-ide-prototype && npx jest --watchAll=false --coverage 2>&1 | grep -E "claudeProvider|geminiProvider|kimiProvider|customProvider|providerRegistry|useAIStore|AIChatPanel|PaywallAISheet"
```

Expected: Each new file ≥80% statement coverage.

- [ ] **Run lint — zero errors**

```bash
cd mobile-ide/mobile-ide-prototype && npm run lint
```

Expected: `0 errors`.

- [ ] **Run type-check — zero errors**

```bash
cd mobile-ide/mobile-ide-prototype && npm run type-check
```

Expected: `0 errors`.

- [ ] **Update `docs/RELEASE_PLAN.md`** — mark all ACs for US-0033, US-0034, US-0035 as `[x]` and set `Status: Done` on all three user stories. Set `EPIC-0010 Status: Done`.

- [ ] **Update `docs/ID_REGISTRY.md`** — no new IDs assigned during implementation; verify counters unchanged.

- [ ] **Update `progress.md`** — add Session 18 entry summarising what was built.

- [ ] **Final commit**

```bash
git add docs/RELEASE_PLAN.md docs/ID_REGISTRY.md progress.md
git commit -m "chore(epic-0010): mark US-0033/0034/0035 Done, update progress log"
```

- [ ] **Open PR**

```bash
gh pr create \
  --title "feat(EPIC-0010): AI Suggestions — inline completions, chat panel, multi-provider" \
  --body "$(cat <<'EOF'
## Summary
- US-0033: Ghost-text inline completions via Monaco's registerInlineCompletionsProvider (300ms debounce, Tab/Escape)
- US-0034: AI chat panel in left sidebar tab with streaming responses
- US-0035: Inline paywall for Free/Pro users; completions completely hidden
- Multi-provider: Claude (default), Gemini 3 Flash, Kimi K2.6, Custom (OpenAI-compat)
- Shared 15¢/day dollar-denominated quota across all built-in providers

## Test plan
- [ ] Grant pro_ai entitlement in RevenueCat dashboard for test device
- [ ] Open editor, type code — ghost text appears after ~300ms
- [ ] Tab accepts, Escape dismisses
- [ ] Open AI sidebar tab — chat panel visible
- [ ] Send message — response streams in
- [ ] Switch providers in Settings — completions and chat use new provider
- [ ] Set Custom provider with Ollama URL — works without cap
- [ ] Revoke pro_ai entitlement — PaywallAISheet shows, ghost text disappears

🤖 Generated with Claude Code
EOF
)"
```

---

## Self-Review

**Spec coverage:**
- AC-0091 ✓ 300ms debounce in Task 15 App.tsx
- AC-0092 ✓ Monaco built-in Tab/Escape via `registerInlineCompletionsProvider` in Task 10
- AC-0093 ✓ `hasAIAccess` check in Task 15 COMPLETION_CONTEXT handler
- AC-0094 ✓ `'ai'` tab in FileExplorer in Task 13
- AC-0095 ✓ `streamChat` → `onChunk` → `streamingText` → AIChatPanel re-render in Tasks 3-8, 12
- AC-0096 ✓ `messages`/`streamingText` excluded from `partialize` in Task 8
- AC-0097 ✓ PaywallAISheet rendered for Free/Pro in Task 13 FileExplorer
- AC-0098 ✓ `hasAIAccess` silent break before timer in Task 15

**Type consistency:** `ProviderId`, `ChatMessage`, `CustomConfig`, `AIProvider` defined in Task 2 and used consistently across all tasks. `selectIsOverQuota` defined in Task 8 and used in Tasks 15 and 12. `injectMessage` signature `{ type: string } & Record<string, unknown>` defined in Task 9 and called in Task 15.

**Dependency order verified:** Tasks 2→3→4→5→6→7→8 follow the dependency graph. Task 9 is independent. Tasks 11-14 depend on 8. Task 15 depends on all.
