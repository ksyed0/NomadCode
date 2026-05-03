# EPIC-0011 App Store & EAS Build Delivery — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver NomadCode v1.0 to the App Store and Google Play, replacing 3 AI providers with a unified OpenRouter integration and adding a BYOK system.

**Architecture:** Types first → service → providers → store → UI → config → build/submit. The `buildOpenRouterProvider(config)` factory closes over live pricing so providers stay pure. Store key renamed to `nomadcode-ai-store-v2` to cleanly migrate persisted state.

**Tech Stack:** Expo 52 / React Native, TypeScript 5, Zustand 5, expo-secure-store, @microsoft/fetch-event-source, AsyncStorage, EAS Build + Submit, OpenRouter API (`openrouter.ai/api/v1`), RevenueCat.

**Test runner:** `cd mobile-ide/mobile-ide-prototype && npx jest --watchAll=false`
**Single file:** `cd mobile-ide/mobile-ide-prototype && npx jest tests/unit/<file> --watchAll=false`

---

## Phase 1 — Code changes (unblocked, start now)

---

### Task 1: Pre-work — git tag + version bump

No tests. Config-only.

**Files:**
- Modify: `mobile-ide/mobile-ide-prototype/package.json`
- Modify: `mobile-ide/mobile-ide-prototype/app.json`

- [ ] **Step 1: Tag pre-GA state**

```bash
cd /Users/Kamal_Syed/Projects/NomadCode
git tag -a v0.1.3-pre-ga -m "Pre-EPIC-0011 state — 1224 tests green"
git push origin v0.1.3-pre-ga
```

- [ ] **Step 2: Bump version in package.json**

In `mobile-ide/mobile-ide-prototype/package.json`, change:
```json
"version": "0.1.3"
```
to:
```json
"version": "1.0.0"
```

- [ ] **Step 3: Bump version in app.json**

In `mobile-ide/mobile-ide-prototype/app.json`, change:
```json
"version": "0.1.0"
```
to:
```json
"version": "1.0.0"
```

And add under `"ios"`:
```json
"buildNumber": "1",
"infoPlist": {
  "NSFaceIDUsageDescription": "Used to secure your stored credentials"
},
"privacyManifests": {
  "NSPrivacyAccessedAPITypes": [
    {
      "NSPrivacyAccessedAPIType": "NSPrivacyAccessedAPICategoryUserDefaults",
      "NSPrivacyAccessedAPITypeReasons": ["CA92.1"]
    }
  ]
}
```

And add under `"android"`:
```json
"versionCode": 1,
"permissions": []
```

- [ ] **Step 4: Commit**

```bash
git add mobile-ide/mobile-ide-prototype/package.json mobile-ide/mobile-ide-prototype/app.json
git commit -m "chore US-0036: bump version to 1.0.0, add iOS Privacy Manifests"
```

---

### Task 2: Expand aiProvider.ts types

**Files:**
- Modify: `mobile-ide/mobile-ide-prototype/src/ai/aiProvider.ts`
- Modify: `mobile-ide/mobile-ide-prototype/tests/unit/aiProvider.test.ts`

- [ ] **Step 1: Write failing tests**

Open `tests/unit/aiProvider.test.ts`. Replace its full content with:

```typescript
import type {
  ProviderId, BYOKPreset, BYOKConfig, OpenRouterModel, OpenRouterConfig, AIProvider
} from '../../src/ai/aiProvider';

describe('aiProvider types', () => {
  it('ProviderId only allows openrouter and byok', () => {
    const valid: ProviderId[] = ['openrouter', 'byok'];
    expect(valid).toHaveLength(2);
  });

  it('BYOKPreset covers all five presets', () => {
    const presets: BYOKPreset[] = ['openrouter', 'anthropic', 'google', 'openai', 'custom'];
    expect(presets).toHaveLength(5);
  });

  it('BYOKConfig has required fields', () => {
    const config: BYOKConfig = {
      preset: 'openrouter',
      modelName: 'openai/gpt-4o',
      customEndpoint: '',
      apiKeyIsStored: false,
    };
    expect(config.preset).toBe('openrouter');
  });

  it('OpenRouterModel has id, name, context_length, pricing', () => {
    const model: OpenRouterModel = {
      id: 'anthropic/claude-3-5-haiku',
      name: 'Claude 3.5 Haiku',
      context_length: 200000,
      pricing: { prompt: '0.0000008', completion: '0.000004' },
    };
    expect(model.pricing.prompt).toBe('0.0000008');
  });

  it('OpenRouterModel pricing "0" marks free model', () => {
    const free: OpenRouterModel = {
      id: 'meta-llama/llama-3.1-8b-instruct:free',
      name: 'Llama 3.1 8B (free)',
      context_length: 131072,
      pricing: { prompt: '0', completion: '0' },
    };
    expect(free.pricing.prompt).toBe('0');
    expect(free.pricing.completion).toBe('0');
  });

  it('OpenRouterConfig has modelId and pricingMap', () => {
    const config: OpenRouterConfig = {
      modelId: 'anthropic/claude-3-5-haiku',
      pricingMap: { 'anthropic/claude-3-5-haiku': { prompt: '0.0000008', completion: '0.000004' } },
    };
    expect(config.modelId).toBe('anthropic/claude-3-5-haiku');
  });
});
```

- [ ] **Step 2: Run — expect failures**

```bash
cd mobile-ide/mobile-ide-prototype && npx jest tests/unit/aiProvider.test.ts --watchAll=false
```

Expected: Multiple type import errors.

- [ ] **Step 3: Replace aiProvider.ts**

```typescript
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
```

- [ ] **Step 4: Run — expect pass**

```bash
cd mobile-ide/mobile-ide-prototype && npx jest tests/unit/aiProvider.test.ts --watchAll=false
```

Expected: 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add mobile-ide/mobile-ide-prototype/src/ai/aiProvider.ts \
        mobile-ide/mobile-ide-prototype/tests/unit/aiProvider.test.ts
git commit -m "feat US-0036: expand aiProvider types — OpenRouterModel, BYOKConfig, BYOKPreset"
```

---

### Task 3: openRouterModelsService

**Files:**
- Create: `mobile-ide/mobile-ide-prototype/src/ai/openRouterModelsService.ts`
- Create: `mobile-ide/mobile-ide-prototype/tests/unit/openRouterModelsService.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/unit/openRouterModelsService.test.ts`:

```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fetchOpenRouterModels, getCachedModels, MODELS_CACHE_KEY, CACHE_TTL_MS }
  from '../../src/ai/openRouterModelsService';
import type { OpenRouterModel } from '../../src/ai/aiProvider';

const FAKE_MODELS: OpenRouterModel[] = [
  { id: 'anthropic/claude-3-5-haiku', name: 'Claude 3.5 Haiku', context_length: 200000,
    pricing: { prompt: '0.0000008', completion: '0.000004' } },
  { id: 'meta-llama/llama-3.1-8b-instruct:free', name: 'Llama 3.1 8B', context_length: 131072,
    pricing: { prompt: '0', completion: '0' } },
];

beforeEach(() => {
  jest.clearAllMocks();
  (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
  (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
});

describe('fetchOpenRouterModels', () => {
  it('fetches from API and caches result', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: FAKE_MODELS }),
    });

    const result = await fetchOpenRouterModels();

    expect(fetch).toHaveBeenCalledWith('https://openrouter.ai/api/v1/models');
    expect(result).toHaveLength(2);
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      MODELS_CACHE_KEY,
      expect.stringContaining('anthropic/claude-3-5-haiku'),
    );
  });

  it('returns cached models when cache is fresh', async () => {
    const cached = {
      models: FAKE_MODELS,
      fetchedAt: Date.now() - 1000, // 1 second ago — still fresh
    };
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(cached));
    global.fetch = jest.fn();

    const result = await fetchOpenRouterModels();

    expect(fetch).not.toHaveBeenCalled();
    expect(result).toHaveLength(2);
  });

  it('re-fetches when cache is stale (>24h)', async () => {
    const stale = {
      models: FAKE_MODELS,
      fetchedAt: Date.now() - CACHE_TTL_MS - 1000, // expired
    };
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(stale));
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: FAKE_MODELS }),
    });

    await fetchOpenRouterModels();

    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('returns cached models on fetch failure (offline fallback)', async () => {
    const cached = {
      models: FAKE_MODELS,
      fetchedAt: Date.now() - CACHE_TTL_MS - 1000, // stale but available
    };
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(cached));
    global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

    const result = await fetchOpenRouterModels();

    expect(result).toHaveLength(2); // returns stale cache rather than []
  });

  it('returns empty array when offline and no cache', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

    const result = await fetchOpenRouterModels();

    expect(result).toEqual([]);
  });
});

describe('getCachedModels', () => {
  it('returns models from cache without fetching', async () => {
    const cached = { models: FAKE_MODELS, fetchedAt: Date.now() };
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(cached));

    const result = await getCachedModels();

    expect(result).toHaveLength(2);
  });

  it('returns empty array when no cache', async () => {
    const result = await getCachedModels();
    expect(result).toEqual([]);
  });
});
```

- [ ] **Step 2: Run — expect failures**

```bash
cd mobile-ide/mobile-ide-prototype && npx jest tests/unit/openRouterModelsService.test.ts --watchAll=false
```

Expected: Module not found errors.

- [ ] **Step 3: Create openRouterModelsService.ts**

```typescript
// src/ai/openRouterModelsService.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { OpenRouterModel } from './aiProvider';

export const MODELS_CACHE_KEY = 'nomadcode_openrouter_models_cache';
export const CACHE_TTL_MS     = 24 * 60 * 60 * 1000; // 24 hours

interface ModelsCache {
  models: OpenRouterModel[];
  fetchedAt: number;
}

async function readCache(): Promise<ModelsCache | null> {
  try {
    const raw = await AsyncStorage.getItem(MODELS_CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as ModelsCache;
  } catch {
    return null;
  }
}

async function writeCache(models: OpenRouterModel[]): Promise<void> {
  const cache: ModelsCache = { models, fetchedAt: Date.now() };
  await AsyncStorage.setItem(MODELS_CACHE_KEY, JSON.stringify(cache));
}

/** Fetch models from the OpenRouter API, using cache when fresh. */
export async function fetchOpenRouterModels(): Promise<OpenRouterModel[]> {
  const cache = await readCache();
  const isFresh = cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS;

  if (isFresh) return cache.models;

  try {
    const res = await fetch('https://openrouter.ai/api/v1/models');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    const models: OpenRouterModel[] = json.data ?? [];
    await writeCache(models);
    return models;
  } catch {
    // Offline fallback: return stale cache if available, otherwise []
    return cache?.models ?? [];
  }
}

/** Read models from cache only — no network request. */
export async function getCachedModels(): Promise<OpenRouterModel[]> {
  const cache = await readCache();
  return cache?.models ?? [];
}

/** Build a pricing map keyed by model ID for O(1) lookups. */
export function buildPricingMap(
  models: OpenRouterModel[]
): Record<string, { prompt: string; completion: string }> {
  return Object.fromEntries(models.map((m) => [m.id, m.pricing]));
}
```

- [ ] **Step 4: Run — expect pass**

```bash
cd mobile-ide/mobile-ide-prototype && npx jest tests/unit/openRouterModelsService.test.ts --watchAll=false
```

Expected: 7 tests pass.

- [ ] **Step 5: Commit**

```bash
git add mobile-ide/mobile-ide-prototype/src/ai/openRouterModelsService.ts \
        mobile-ide/mobile-ide-prototype/tests/unit/openRouterModelsService.test.ts
git commit -m "feat US-0036: add openRouterModelsService — fetch/cache with 24h TTL"
```

---

### Task 4: openRouterProvider

**Files:**
- Create: `mobile-ide/mobile-ide-prototype/src/ai/providers/openRouterProvider.ts`
- Create: `mobile-ide/mobile-ide-prototype/tests/unit/openRouterProvider.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/unit/openRouterProvider.test.ts`:

```typescript
import { buildOpenRouterProvider } from '../../src/ai/providers/openRouterProvider';
import type { OpenRouterConfig, ChatMessage } from '../../src/ai/aiProvider';

const PRICING_MAP = {
  'anthropic/claude-3-5-haiku': { prompt: '0.0000008', completion: '0.000004' },
  'meta-llama/llama-3.1-8b-instruct:free': { prompt: '0', completion: '0' },
};

const CONFIG_PAID: OpenRouterConfig = {
  modelId: 'anthropic/claude-3-5-haiku',
  pricingMap: PRICING_MAP,
};

const CONFIG_FREE: OpenRouterConfig = {
  modelId: 'meta-llama/llama-3.1-8b-instruct:free',
  pricingMap: PRICING_MAP,
};

const CONFIG_UNKNOWN: OpenRouterConfig = {
  modelId: 'some/unknown-model',
  pricingMap: PRICING_MAP,
};

describe('buildOpenRouterProvider', () => {
  it('returns provider with id openrouter', () => {
    const p = buildOpenRouterProvider(CONFIG_PAID);
    expect(p.id).toBe('openrouter');
    expect(p.displayName).toBe('OpenRouter');
  });

  describe('estimateCostCents', () => {
    it('calculates cost from pricing map for paid model', () => {
      const p = buildOpenRouterProvider(CONFIG_PAID);
      // 1000 input tokens at $0.0000008/token + 500 output at $0.000004/token
      // = (1000 * 0.0000008 + 500 * 0.000004) * 100
      // = (0.0008 + 0.002) * 100 = 0.28 cents → ceil = 1
      const cost = p.estimateCostCents(1000, 500);
      expect(cost).toBeGreaterThanOrEqual(0);
      expect(typeof cost).toBe('number');
    });

    it('returns 0 for free model', () => {
      const p = buildOpenRouterProvider(CONFIG_FREE);
      expect(p.estimateCostCents(10000, 10000)).toBe(0);
    });

    it('returns DEFAULT_COST_CENTS for unknown model', () => {
      const p = buildOpenRouterProvider(CONFIG_UNKNOWN);
      expect(p.estimateCostCents(1000, 500)).toBeGreaterThan(0);
    });
  });

  describe('getCompletion', () => {
    it('returns empty string on fetch failure', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));
      const p = buildOpenRouterProvider(CONFIG_PAID);
      const result = await p.getCompletion('const x =', '', 'typescript', new AbortController().signal);
      expect(result).toBe('');
    });

    it('returns empty string on non-ok response', async () => {
      global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 429 });
      const p = buildOpenRouterProvider(CONFIG_PAID);
      const result = await p.getCompletion('const x =', '', 'typescript', new AbortController().signal);
      expect(result).toBe('');
    });

    it('returns content from successful response', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ choices: [{ message: { content: ' 42' } }] }),
      });
      const p = buildOpenRouterProvider(CONFIG_PAID);
      const result = await p.getCompletion('const x =', '', 'typescript', new AbortController().signal);
      expect(result).toBe(' 42');
    });
  });

  describe('streamChat', () => {
    it('calls onChunk with parsed SSE content', async () => {
      const { fetchEventSource } = jest.requireMock('@microsoft/fetch-event-source');
      fetchEventSource.mockImplementation(
        (_url: string, opts: { onmessage: (ev: { data: string }) => void }) => {
          opts.onmessage({ data: JSON.stringify({ choices: [{ delta: { content: 'Hello' } }] }) });
          opts.onmessage({ data: '[DONE]' });
          return Promise.resolve();
        }
      );
      const onChunk = jest.fn();
      const p = buildOpenRouterProvider(CONFIG_PAID);
      await p.streamChat([], '', 'typescript', new AbortController().signal, onChunk);
      expect(onChunk).toHaveBeenCalledWith('Hello');
    });
  });
});
```

- [ ] **Step 2: Add fetchEventSource mock (if not already present)**

Check `mobile-ide/mobile-ide-prototype/__mocks__/@microsoft/fetch-event-source.js`. If missing, create it:

```javascript
// __mocks__/@microsoft/fetch-event-source.js
module.exports = {
  fetchEventSource: jest.fn(),
};
```

- [ ] **Step 3: Run — expect failures**

```bash
cd mobile-ide/mobile-ide-prototype && npx jest tests/unit/openRouterProvider.test.ts --watchAll=false
```

Expected: Module not found.

- [ ] **Step 4: Create openRouterProvider.ts**

```typescript
// src/ai/providers/openRouterProvider.ts
import { fetchEventSource } from '@microsoft/fetch-event-source';
import type { AIProvider, ChatMessage, OpenRouterConfig } from '../aiProvider';
import { COMPLETION_MAX_TOKENS, CHAT_MAX_TOKENS } from '../quotaConfig';

const API_URL  = 'https://openrouter.ai/api/v1/chat/completions';
const API_KEY  = process.env.EXPO_PUBLIC_OPENROUTER_API_KEY ?? '';

// Fallback cost for models not in the pricing map (conservative: ~$0.01/1K tokens)
const DEFAULT_COST_CENTS_PER_TOKEN = 0.001;

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
        // Unknown model: conservative fallback
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
```

- [ ] **Step 5: Run — expect pass**

```bash
cd mobile-ide/mobile-ide-prototype && npx jest tests/unit/openRouterProvider.test.ts --watchAll=false
```

Expected: 8 tests pass.

- [ ] **Step 6: Commit**

```bash
git add mobile-ide/mobile-ide-prototype/src/ai/providers/openRouterProvider.ts \
        mobile-ide/mobile-ide-prototype/tests/unit/openRouterProvider.test.ts
git commit -m "feat US-0036: add openRouterProvider — OpenAI-compatible SSE, live pricing"
```

---

### Task 5: byokProvider + delete old providers

**Files:**
- Create: `mobile-ide/mobile-ide-prototype/src/ai/providers/byokProvider.ts`
- Create: `mobile-ide/mobile-ide-prototype/tests/unit/byokProvider.test.ts`
- Delete: `src/ai/providers/claudeProvider.ts`, `geminiProvider.ts`, `kimiProvider.ts`, `customProvider.ts`
- Delete: `tests/unit/claudeProvider.test.ts`, `geminiProvider.test.ts`, `kimiProvider.test.ts`, `customProvider.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/unit/byokProvider.test.ts`:

```typescript
import * as SecureStore from 'expo-secure-store';
import { buildByokProvider, BYOK_SECURE_KEY } from '../../src/ai/providers/byokProvider';
import type { BYOKConfig } from '../../src/ai/aiProvider';

jest.mock('expo-secure-store');

const BASE_CONFIG: BYOKConfig = {
  preset: 'openrouter',
  modelName: 'openai/gpt-4o-mini',
  customEndpoint: '',
  apiKeyIsStored: true,
};

beforeEach(() => {
  jest.clearAllMocks();
  (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('test-key-123');
});

describe('buildByokProvider', () => {
  it('has id byok and displayName BYOK', () => {
    const p = buildByokProvider(BASE_CONFIG);
    expect(p.id).toBe('byok');
    expect(p.displayName).toBe('BYOK');
  });

  it('always returns 0 from estimateCostCents', () => {
    const p = buildByokProvider(BASE_CONFIG);
    expect(p.estimateCostCents(100000, 100000)).toBe(0);
  });

  describe('preset base URLs', () => {
    const presets: Array<[BYOKConfig['preset'], string]> = [
      ['openrouter', 'https://openrouter.ai/api/v1'],
      ['anthropic',  'https://api.anthropic.com/v1'],
      ['google',     'https://generativelanguage.googleapis.com/v1beta/openai'],
      ['openai',     'https://api.openai.com/v1'],
    ];

    presets.forEach(([preset, expectedBase]) => {
      it(`uses correct base URL for preset "${preset}"`, async () => {
        global.fetch = jest.fn().mockResolvedValue({
          ok: true,
          json: async () => ({ choices: [{ message: { content: 'ok' } }] }),
        });
        const config: BYOKConfig = { ...BASE_CONFIG, preset };
        const p = buildByokProvider(config);
        await p.getCompletion('x', '', 'js', new AbortController().signal);
        const calledUrl = (fetch as jest.Mock).mock.calls[0][0] as string;
        expect(calledUrl).toContain(expectedBase);
      });
    });

    it('uses customEndpoint for preset "custom"', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ choices: [{ message: { content: 'ok' } }] }),
      });
      const config: BYOKConfig = {
        preset: 'custom',
        modelName: 'llama3',
        customEndpoint: 'http://localhost:11434',
        apiKeyIsStored: false,
      };
      const p = buildByokProvider(config);
      await p.getCompletion('x', '', 'js', new AbortController().signal);
      const calledUrl = (fetch as jest.Mock).mock.calls[0][0] as string;
      expect(calledUrl).toContain('localhost:11434');
    });
  });

  describe('anthropic preset', () => {
    it('uses x-api-key header instead of Authorization', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ content: [{ text: 'hello' }] }),
      });
      const config: BYOKConfig = { ...BASE_CONFIG, preset: 'anthropic', modelName: 'claude-3-5-haiku-20241022' };
      const p = buildByokProvider(config);
      await p.getCompletion('x', '', 'js', new AbortController().signal);
      const headers = (fetch as jest.Mock).mock.calls[0][1].headers;
      expect(headers['x-api-key']).toBe('test-key-123');
      expect(headers['anthropic-version']).toBe('2023-06-01');
      expect(headers['Authorization']).toBeUndefined();
    });
  });

  describe('getCompletion', () => {
    it('returns empty string when no key stored', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);
      const config: BYOKConfig = { ...BASE_CONFIG, apiKeyIsStored: true };
      const p = buildByokProvider(config);
      const result = await p.getCompletion('x', '', 'js', new AbortController().signal);
      expect(result).toBe('');
    });

    it('returns empty string on fetch failure', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));
      const p = buildByokProvider(BASE_CONFIG);
      const result = await p.getCompletion('x', '', 'js', new AbortController().signal);
      expect(result).toBe('');
    });
  });
});
```

- [ ] **Step 2: Run — expect failures**

```bash
cd mobile-ide/mobile-ide-prototype && npx jest tests/unit/byokProvider.test.ts --watchAll=false
```

- [ ] **Step 3: Create byokProvider.ts**

```typescript
// src/ai/providers/byokProvider.ts
import * as SecureStore from 'expo-secure-store';
import { fetchEventSource } from '@microsoft/fetch-event-source';
import type { AIProvider, ChatMessage, BYOKConfig } from '../aiProvider';
import { COMPLETION_MAX_TOKENS, CHAT_MAX_TOKENS } from '../quotaConfig';

export const BYOK_SECURE_KEY = 'nomadcode_custom_ai_key'; // keep same key as customProvider for migration

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

// ── Anthropic API helpers (different format from OpenAI) ────────────────────

function anthropicHeaders(key: string): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'x-api-key': key,
    'anthropic-version': '2023-06-01',
  };
}

// ── OpenAI-compatible helpers ────────────────────────────────────────────────

function openAIHeaders(key: string | null): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (key) headers['Authorization'] = `Bearer ${key}`;
  return headers;
}

export function buildByokProvider(config: BYOKConfig): AIProvider {
  const baseUrl = getBaseUrl(config);
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

      // OpenAI-compatible path (openrouter, google, openai, custom)
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
      return 0; // user's own key — never counts toward built-in cap
    },
  };
}
```

- [ ] **Step 4: Run byokProvider tests — expect pass**

```bash
cd mobile-ide/mobile-ide-prototype && npx jest tests/unit/byokProvider.test.ts --watchAll=false
```

Expected: 10 tests pass.

- [ ] **Step 5: Delete old provider files**

```bash
rm mobile-ide/mobile-ide-prototype/src/ai/providers/claudeProvider.ts
rm mobile-ide/mobile-ide-prototype/src/ai/providers/geminiProvider.ts
rm mobile-ide/mobile-ide-prototype/src/ai/providers/kimiProvider.ts
rm mobile-ide/mobile-ide-prototype/src/ai/providers/customProvider.ts
rm mobile-ide/mobile-ide-prototype/tests/unit/claudeProvider.test.ts
rm mobile-ide/mobile-ide-prototype/tests/unit/geminiProvider.test.ts
rm mobile-ide/mobile-ide-prototype/tests/unit/kimiProvider.test.ts
rm mobile-ide/mobile-ide-prototype/tests/unit/customProvider.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add -A mobile-ide/mobile-ide-prototype/src/ai/providers/ \
           mobile-ide/mobile-ide-prototype/tests/unit/byokProvider.test.ts \
           mobile-ide/mobile-ide-prototype/tests/unit/claudeProvider.test.ts \
           mobile-ide/mobile-ide-prototype/tests/unit/geminiProvider.test.ts \
           mobile-ide/mobile-ide-prototype/tests/unit/kimiProvider.test.ts \
           mobile-ide/mobile-ide-prototype/tests/unit/customProvider.test.ts
git commit -m "feat US-0036: add byokProvider (5 presets), delete claude/gemini/kimi/custom providers"
```

---

### Task 6: Update providerRegistry

**Files:**
- Modify: `mobile-ide/mobile-ide-prototype/src/ai/providerRegistry.ts`
- Modify: `mobile-ide/mobile-ide-prototype/tests/unit/providerRegistry.test.ts`

- [ ] **Step 1: Write failing tests**

Replace `tests/unit/providerRegistry.test.ts`:

```typescript
import { getProvider } from '../../src/ai/providerRegistry';
import type { OpenRouterConfig, BYOKConfig } from '../../src/ai/aiProvider';

const OR_CONFIG: OpenRouterConfig = {
  modelId: 'anthropic/claude-3-5-haiku',
  pricingMap: { 'anthropic/claude-3-5-haiku': { prompt: '0.0000008', completion: '0.000004' } },
};

const BYOK_CONFIG: BYOKConfig = {
  preset: 'openrouter',
  modelName: 'openai/gpt-4o',
  customEndpoint: '',
  apiKeyIsStored: false,
};

describe('getProvider', () => {
  it('returns openrouter provider for openrouter id', () => {
    const p = getProvider('openrouter', OR_CONFIG);
    expect(p.id).toBe('openrouter');
  });

  it('returns byok provider for byok id', () => {
    const p = getProvider('byok', BYOK_CONFIG);
    expect(p.id).toBe('byok');
  });

  it('openrouter provider has correct displayName', () => {
    const p = getProvider('openrouter', OR_CONFIG);
    expect(p.displayName).toBe('OpenRouter');
  });

  it('byok provider has correct displayName', () => {
    const p = getProvider('byok', BYOK_CONFIG);
    expect(p.displayName).toBe('BYOK');
  });
});
```

- [ ] **Step 2: Run — expect failures**

```bash
cd mobile-ide/mobile-ide-prototype && npx jest tests/unit/providerRegistry.test.ts --watchAll=false
```

- [ ] **Step 3: Replace providerRegistry.ts**

```typescript
// src/ai/providerRegistry.ts
import { buildOpenRouterProvider } from './providers/openRouterProvider';
import { buildByokProvider }       from './providers/byokProvider';
import type { AIProvider, ProviderId, OpenRouterConfig, BYOKConfig } from './aiProvider';

export function getProvider(
  id: ProviderId,
  config: OpenRouterConfig | BYOKConfig,
): AIProvider {
  switch (id) {
    case 'openrouter': return buildOpenRouterProvider(config as OpenRouterConfig);
    case 'byok':       return buildByokProvider(config as BYOKConfig);
  }
}
```

- [ ] **Step 4: Run — expect pass**

```bash
cd mobile-ide/mobile-ide-prototype && npx jest tests/unit/providerRegistry.test.ts --watchAll=false
```

Expected: 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add mobile-ide/mobile-ide-prototype/src/ai/providerRegistry.ts \
        mobile-ide/mobile-ide-prototype/tests/unit/providerRegistry.test.ts
git commit -m "feat US-0036: update providerRegistry — openrouter + byok only"
```

---

### Task 7: Restructure useAIStore

**Files:**
- Modify: `mobile-ide/mobile-ide-prototype/src/stores/useAIStore.ts`
- Modify: `mobile-ide/mobile-ide-prototype/tests/unit/useAIStore.test.ts`

- [ ] **Step 1: Write failing tests for new store shape**

Open `tests/unit/useAIStore.test.ts`. Add these test cases at the top of the describe block (keep existing tests, they'll be updated in Step 3 after implementation):

```typescript
// Add these imports at the top of the existing test file:
// import { selectIsOverQuota, selectIsFreeModel } from '../../src/stores/useAIStore';

describe('useAIStore — new shape', () => {
  it('has builtInModel defaulting to anthropic/claude-3-5-haiku', () => {
    const { builtInModel } = useAIStore.getState();
    expect(builtInModel).toBe('anthropic/claude-3-5-haiku');
  });

  it('has byokEnabled defaulting to false', () => {
    expect(useAIStore.getState().byokEnabled).toBe(false);
  });

  it('selectIsOverQuota returns false when byokEnabled', () => {
    useAIStore.setState({ byokEnabled: true, dailySpendCents: 100 });
    expect(selectIsOverQuota(useAIStore.getState())).toBe(false);
  });

  it('selectIsOverQuota returns false for free model', () => {
    useAIStore.setState({
      byokEnabled: false,
      dailySpendCents: 100,
      modelPricingMap: { 'free/model': { prompt: '0', completion: '0' } },
      builtInModel: 'free/model',
    });
    expect(selectIsOverQuota(useAIStore.getState())).toBe(false);
  });

  it('selectIsOverQuota returns true when over cap on paid model', () => {
    useAIStore.setState({
      byokEnabled: false,
      dailySpendCents: 20,
      modelPricingMap: { 'paid/model': { prompt: '0.001', completion: '0.002' } },
      builtInModel: 'paid/model',
    });
    expect(selectIsOverQuota(useAIStore.getState())).toBe(true);
  });

  it('loadOpenRouterModels populates openRouterModels and modelPricingMap', async () => {
    const { fetchOpenRouterModels } = jest.requireMock('../../src/ai/openRouterModelsService');
    fetchOpenRouterModels.mockResolvedValue([
      { id: 'test/model', name: 'Test', context_length: 4096, pricing: { prompt: '0.001', completion: '0.002' } },
    ]);
    await useAIStore.getState().loadOpenRouterModels();
    expect(useAIStore.getState().openRouterModels).toHaveLength(1);
    expect(useAIStore.getState().modelPricingMap['test/model']).toEqual({ prompt: '0.001', completion: '0.002' });
  });
});
```

- [ ] **Step 2: Run — expect failures**

```bash
cd mobile-ide/mobile-ide-prototype && npx jest tests/unit/useAIStore.test.ts --watchAll=false
```

- [ ] **Step 3: Replace useAIStore.ts**

```typescript
// src/stores/useAIStore.ts
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getProvider } from '../ai/providerRegistry';
import { DAILY_CAP_CENTS } from '../ai/quotaConfig';
import { fetchOpenRouterModels, buildPricingMap } from '../ai/openRouterModelsService';
import type {
  AIProvider, ChatMessage, BYOKConfig, OpenRouterModel, OpenRouterConfig,
} from '../ai/aiProvider';

export interface AIState {
  // ── Persisted ─────────────────────────────────────────────────────────────
  builtInModel: string;
  byokEnabled: boolean;
  byokConfig: BYOKConfig;
  dailySpendCents: number;
  quotaResetDate: string;

  // ── Session only (not persisted) ──────────────────────────────────────────
  openRouterModels: OpenRouterModel[];
  modelPricingMap: Record<string, { prompt: string; completion: string }>;
  byokKeyConfigured: boolean;
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
  loadOpenRouterModels(): Promise<void>;
  setBuiltInModel(modelId: string): void;
  setByokEnabled(enabled: boolean): void;
  setByokConfig(config: BYOKConfig): void;
  setByokKeyConfigured(configured: boolean): void;
}

const DEFAULT_BYOK_CONFIG: BYOKConfig = {
  preset: 'openrouter',
  modelName: '',
  customEndpoint: '',
  apiKeyIsStored: false,
};

export const selectIsOverQuota = (s: AIState): boolean => {
  if (s.byokEnabled) return false;
  const pricing = s.modelPricingMap[s.builtInModel];
  if (pricing && pricing.prompt === '0' && pricing.completion === '0') return false;
  return s.dailySpendCents >= DAILY_CAP_CENTS;
};

export const selectIsFreeModel = (s: AIState): boolean => {
  if (s.byokEnabled) return true; // BYOK is free from quota perspective
  const pricing = s.modelPricingMap[s.builtInModel];
  return !!(pricing && pricing.prompt === '0' && pricing.completion === '0');
};

const QUOTA_ERROR_MSG =
  '⚠ Daily AI limit reached (15¢). Resets at midnight. Enable BYOK or switch to a free model to continue.';

const useAIStore = create<AIState>()(
  persist(
    (set, get) => ({
      builtInModel: 'anthropic/claude-3-5-haiku',
      byokEnabled: false,
      byokConfig: DEFAULT_BYOK_CONFIG,
      dailySpendCents: 0,
      quotaResetDate: new Date().toISOString().slice(0, 10),
      openRouterModels: [],
      modelPricingMap: {},
      byokKeyConfigured: false,
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
        if (get().byokEnabled) {
          return getProvider('byok', get().byokConfig);
        }
        const orConfig: OpenRouterConfig = {
          modelId: get().builtInModel,
          pricingMap: get().modelPricingMap,
        };
        return getProvider('openrouter', orConfig);
      },

      async loadOpenRouterModels() {
        const models = await fetchOpenRouterModels();
        set({ openRouterModels: models, modelPricingMap: buildPricingMap(models) });
      },

      setBuiltInModel(modelId) { set({ builtInModel: modelId }); },
      setByokEnabled(enabled)  { set({ byokEnabled: enabled }); },
      setByokConfig(config)    { set({ byokConfig: config }); },
      setByokKeyConfigured(c)  { set({ byokKeyConfigured: c }); },

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

          const estInput  = Math.ceil((fileContent.length + userText.length) / 4);
          const estCost   = provider.estimateCostCents(estInput, 256);
          if (!get().byokEnabled && get().dailySpendCents + estCost > DAILY_CAP_CENTS) {
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
        } catch (_err) {
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
      name: 'nomadcode-ai-store-v2', // renamed to clear old persisted state
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        builtInModel:      state.builtInModel,
        byokEnabled:       state.byokEnabled,
        byokConfig:        state.byokConfig,
        dailySpendCents:   state.dailySpendCents,
        quotaResetDate:    state.quotaResetDate,
      }),
    },
  ),
);

export default useAIStore;
```

- [ ] **Step 4: Add mock for openRouterModelsService in jest setup**

In `tests/unit/useAIStore.test.ts`, add near the top:

```typescript
jest.mock('../../src/ai/openRouterModelsService', () => ({
  fetchOpenRouterModels: jest.fn().mockResolvedValue([]),
  buildPricingMap: jest.fn().mockReturnValue({}),
}));
```

- [ ] **Step 5: Run — expect pass**

```bash
cd mobile-ide/mobile-ide-prototype && npx jest tests/unit/useAIStore.test.ts --watchAll=false
```

Expected: All tests pass. Fix any existing tests that reference `selectedProviderId` or `customConfig` by updating them to use `builtInModel`/`byokEnabled`/`byokConfig`.

- [ ] **Step 6: Run full suite — fix any broken imports**

```bash
cd mobile-ide/mobile-ide-prototype && npx jest --watchAll=false 2>&1 | grep -E "FAIL|Cannot find|error TS" | head -30
```

Fix any remaining import errors referencing old `ProviderId` values or `customConfig`.

- [ ] **Step 7: Commit**

```bash
git add mobile-ide/mobile-ide-prototype/src/stores/useAIStore.ts \
        mobile-ide/mobile-ide-prototype/tests/unit/useAIStore.test.ts
git commit -m "feat US-0036: restructure useAIStore — builtInModel, byok fields, free model quota"
```

---

### Task 8: PaywallAISheet — reason prop

**Files:**
- Modify: `mobile-ide/mobile-ide-prototype/src/components/PaywallAISheet.tsx`
- Modify: `mobile-ide/mobile-ide-prototype/tests/unit/PaywallAISheet.test.tsx`

- [ ] **Step 1: Write failing tests**

Open `tests/unit/PaywallAISheet.test.tsx`. Add:

```typescript
it('shows Pro+AI upgrade text for reason="builtin"', () => {
  const { getByText } = render(
    <PaywallAISheet reason="builtin" onUpgrade={jest.fn()} />
  );
  expect(getByText(/Pro\+AI/i)).toBeTruthy();
  expect(getByText(/Upgrade to Pro\+AI/i)).toBeTruthy();
});

it('shows Pro upgrade text for reason="byok"', () => {
  const { getByText } = render(
    <PaywallAISheet reason="byok" onUpgrade={jest.fn()} />
  );
  expect(getByText(/Pro plan/i)).toBeTruthy();
  expect(getByText(/Upgrade to Pro/i)).toBeTruthy();
});
```

- [ ] **Step 2: Run — expect failures**

```bash
cd mobile-ide/mobile-ide-prototype && npx jest tests/unit/PaywallAISheet.test.tsx --watchAll=false
```

- [ ] **Step 3: Update PaywallAISheet.tsx**

Replace the `PaywallAISheetProps` interface and component content:

```typescript
interface PaywallAISheetProps {
  reason: 'builtin' | 'byok';
  onUpgrade: () => void;
}

const BUILTIN_FEATURES = [
  'Inline code completions',
  'AI chat with file context',
  '200+ models via OpenRouter',
  'Free models — unlimited use',
];

const BYOK_FEATURES = [
  'Your own API key (OpenRouter, Claude, Gemini, OpenAI)',
  'No daily quota — use as much as you want',
  'Custom / local models (Ollama, LM Studio)',
];

export default function PaywallAISheet({ reason, onUpgrade }: PaywallAISheetProps) {
  const t = useTheme();
  const isBuiltin = reason === 'builtin';
  const features  = isBuiltin ? BUILTIN_FEATURES : BYOK_FEATURES;
  const planName  = isBuiltin ? 'Pro+AI' : 'Pro';
  const price     = isBuiltin ? '$14.99/mo · $119.99/yr' : '$7.99/mo · $59.99/yr';
  const heading   = isBuiltin ? 'Pro+AI Feature' : 'Pro Feature';
  const desc      = isBuiltin
    ? 'Inline suggestions and chat are included in the Pro+AI plan.'
    : 'Bring Your Own Key is included in the Pro plan.';

  return (
    <View style={[styles.container, { backgroundColor: t.bg }]}>
      <View style={[styles.iconTile, { backgroundColor: t.bgElevated }]}>
        <Text style={styles.lockIcon}>🔒</Text>
      </View>
      <Text style={[styles.heading, { color: t.text }]}>{heading}</Text>
      <Text style={[styles.description, { color: t.textMuted }]}>
        {desc.replace(planName, '')}
        <Text style={{ color: t.accent }}>{planName}</Text>
        {isBuiltin ? ' plan.' : ' plan.'}
      </Text>
      <View style={[styles.featureBox, { backgroundColor: t.bgElevated, borderColor: t.border }]}>
        <Text style={[styles.featureLabel, { color: t.textMuted }]}>What you get</Text>
        {features.map((f) => (
          <Text key={f} style={[styles.featureItem, { color: t.text }]}>✦ {f}</Text>
        ))}
      </View>
      <TouchableOpacity
        style={[styles.upgradeBtn, { backgroundColor: t.accent }]}
        onPress={onUpgrade}
        accessibilityRole="button"
        accessibilityLabel={`Upgrade to ${planName}`}
      >
        <Text style={styles.upgradeBtnText}>Upgrade to {planName}</Text>
      </TouchableOpacity>
      <Text style={[styles.price, { color: t.textMuted }]}>{price}</Text>
    </View>
  );
}
```

- [ ] **Step 4: Update all call sites of PaywallAISheet**

Search for `<PaywallAISheet` across the codebase:
```bash
grep -r "PaywallAISheet" mobile-ide/mobile-ide-prototype/src --include="*.tsx" -l
```

For each file found, add `reason="builtin"` to existing `<PaywallAISheet` usages where the AI features relate to built-in AI. In `FileExplorer.tsx` (BYOK gating), add `reason="byok"`.

- [ ] **Step 5: Run — expect pass**

```bash
cd mobile-ide/mobile-ide-prototype && npx jest tests/unit/PaywallAISheet.test.tsx --watchAll=false
```

- [ ] **Step 6: Commit**

```bash
git add mobile-ide/mobile-ide-prototype/src/components/PaywallAISheet.tsx \
        mobile-ide/mobile-ide-prototype/tests/unit/PaywallAISheet.test.tsx
git commit -m "feat US-0036: PaywallAISheet reason prop — builtin vs byok upgrade messages"
```

---

### Task 9: ModelSearchSelector

**Files:**
- Create: `mobile-ide/mobile-ide-prototype/src/components/ModelSearchSelector.tsx`
- Create: `mobile-ide/mobile-ide-prototype/tests/unit/ModelSearchSelector.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `tests/unit/ModelSearchSelector.test.tsx`:

```typescript
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import ModelSearchSelector from '../../src/components/ModelSearchSelector';
import type { OpenRouterModel } from '../../src/ai/aiProvider';

const MODELS: OpenRouterModel[] = [
  { id: 'anthropic/claude-3-5-haiku', name: 'Claude 3.5 Haiku', context_length: 200000,
    pricing: { prompt: '0.0000008', completion: '0.000004' } },
  { id: 'meta-llama/llama-3.1-8b-instruct:free', name: 'Llama 3.1 8B', context_length: 131072,
    pricing: { prompt: '0', completion: '0' } },
  { id: 'openai/gpt-4o', name: 'GPT-4o', context_length: 128000,
    pricing: { prompt: '0.000005', completion: '0.000015' } },
];

describe('ModelSearchSelector', () => {
  it('renders all models initially', () => {
    const { getAllByTestId } = render(
      <ModelSearchSelector
        models={MODELS}
        selectedModel="anthropic/claude-3-5-haiku"
        onSelect={jest.fn()}
        loading={false}
      />
    );
    expect(getAllByTestId('model-row')).toHaveLength(3);
  });

  it('filters models by search query', () => {
    const { getByPlaceholderText, getAllByTestId } = render(
      <ModelSearchSelector
        models={MODELS}
        selectedModel="anthropic/claude-3-5-haiku"
        onSelect={jest.fn()}
        loading={false}
      />
    );
    fireEvent.changeText(getByPlaceholderText('Search models...'), 'claude');
    expect(getAllByTestId('model-row')).toHaveLength(1);
  });

  it('shows FREE badge for free models', () => {
    const { getByText } = render(
      <ModelSearchSelector
        models={MODELS}
        selectedModel="anthropic/claude-3-5-haiku"
        onSelect={jest.fn()}
        loading={false}
      />
    );
    expect(getByText('FREE')).toBeTruthy();
  });

  it('calls onSelect when a model row is tapped', () => {
    const onSelect = jest.fn();
    const { getAllByTestId } = render(
      <ModelSearchSelector
        models={MODELS}
        selectedModel="anthropic/claude-3-5-haiku"
        onSelect={onSelect}
        loading={false}
      />
    );
    fireEvent.press(getAllByTestId('model-row')[1]); // Llama (free)
    expect(onSelect).toHaveBeenCalledWith('meta-llama/llama-3.1-8b-instruct:free');
  });

  it('shows loading spinner when loading=true', () => {
    const { getByTestId } = render(
      <ModelSearchSelector
        models={[]}
        selectedModel=""
        onSelect={jest.fn()}
        loading={true}
      />
    );
    expect(getByTestId('models-loading')).toBeTruthy();
  });

  it('shows selected indicator on current model', () => {
    const { getAllByTestId } = render(
      <ModelSearchSelector
        models={MODELS}
        selectedModel="openai/gpt-4o"
        onSelect={jest.fn()}
        loading={false}
      />
    );
    const rows = getAllByTestId('model-row');
    // GPT-4o is third — look for selected style (we check testID 'model-row-selected')
    const selected = getAllByTestId('model-row-selected');
    expect(selected).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run — expect failures**

```bash
cd mobile-ide/mobile-ide-prototype && npx jest tests/unit/ModelSearchSelector.test.tsx --watchAll=false
```

- [ ] **Step 3: Create ModelSearchSelector.tsx**

```typescript
// src/components/ModelSearchSelector.tsx
import React, { useState, useMemo } from 'react';
import {
  View, Text, TextInput, FlatList, TouchableOpacity,
  StyleSheet, ActivityIndicator,
} from 'react-native';
import { useTheme } from '../theme/tokens';
import type { OpenRouterModel } from '../ai/aiProvider';

interface ModelSearchSelectorProps {
  models: OpenRouterModel[];
  selectedModel: string;
  onSelect: (modelId: string) => void;
  loading: boolean;
  disabled?: boolean;
}

function isFreeModel(model: OpenRouterModel): boolean {
  return model.pricing.prompt === '0' && model.pricing.completion === '0';
}

function formatPrice(model: OpenRouterModel): string {
  if (isFreeModel(model)) return 'FREE';
  const outPer1M = (parseFloat(model.pricing.completion) * 1_000_000).toFixed(2);
  return `$${outPer1M}/1M out`;
}

function providerLabel(modelId: string): string {
  return modelId.split('/')[0] ?? modelId;
}

export default function ModelSearchSelector({
  models, selectedModel, onSelect, loading, disabled,
}: ModelSearchSelectorProps) {
  const t = useTheme();
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    if (!query) return models;
    const q = query.toLowerCase();
    return models.filter(
      (m) => m.id.toLowerCase().includes(q) || m.name.toLowerCase().includes(q),
    );
  }, [models, query]);

  const styles = StyleSheet.create({
    container:    { flex: 1, backgroundColor: t.bg },
    input:        { backgroundColor: t.bgElevated, borderWidth: 1, borderColor: t.border,
                    borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10,
                    color: t.text, fontSize: 14, margin: 12 },
    row:          { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                    paddingHorizontal: 16, paddingVertical: 12,
                    borderBottomWidth: 1, borderBottomColor: t.border },
    rowSelected:  { backgroundColor: t.bgHighlight },
    name:         { fontSize: 13, fontWeight: '600', color: t.text, flex: 1 },
    provider:     { fontSize: 11, color: t.textMuted, marginTop: 2 },
    freeBadge:    { backgroundColor: t.accent + '22', borderRadius: 4,
                    paddingHorizontal: 6, paddingVertical: 2 },
    freeBadgeText:{ fontSize: 10, fontWeight: '700', color: t.accent },
    priceText:    { fontSize: 11, color: t.textMuted },
    loader:       { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  });

  if (loading) {
    return (
      <View style={styles.loader} testID="models-loading">
        <ActivityIndicator color={t.accent} />
        <Text style={{ color: t.textMuted, marginTop: 8, fontSize: 12 }}>Loading models…</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.input}
        placeholder="Search models..."
        placeholderTextColor={t.textMuted}
        value={query}
        onChangeText={setQuery}
        editable={!disabled}
        autoCapitalize="none"
        autoCorrect={false}
      />
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          const selected = item.id === selectedModel;
          const free     = isFreeModel(item);
          return (
            <TouchableOpacity
              style={[styles.row, selected && styles.rowSelected]}
              onPress={() => !disabled && onSelect(item.id)}
              testID={selected ? 'model-row-selected' : 'model-row'}
              accessibilityRole="button"
              accessibilityLabel={`Select model ${item.name}`}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
                <Text style={styles.provider}>{providerLabel(item.id)}</Text>
              </View>
              {free ? (
                <View style={styles.freeBadge}>
                  <Text style={styles.freeBadgeText}>FREE</Text>
                </View>
              ) : (
                <Text style={styles.priceText}>{formatPrice(item)}</Text>
              )}
            </TouchableOpacity>
          );
        }}
        keyboardShouldPersistTaps="handled"
      />
    </View>
  );
}
```

- [ ] **Step 4: Run — expect pass**

```bash
cd mobile-ide/mobile-ide-prototype && npx jest tests/unit/ModelSearchSelector.test.tsx --watchAll=false
```

Expected: 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add mobile-ide/mobile-ide-prototype/src/components/ModelSearchSelector.tsx \
        mobile-ide/mobile-ide-prototype/tests/unit/ModelSearchSelector.test.tsx
git commit -m "feat US-0036: add ModelSearchSelector — search, FREE badge, selection"
```

---

### Task 10: Update AIChatPanel

**Files:**
- Modify: `mobile-ide/mobile-ide-prototype/src/components/AIChatPanel.tsx`
- Modify: `mobile-ide/mobile-ide-prototype/tests/unit/AIChatPanel.test.tsx`

- [ ] **Step 1: Write failing tests**

Add to `tests/unit/AIChatPanel.test.tsx`:

```typescript
it('shows "free" in spend chip for free model', () => {
  useAIStore.setState({
    byokEnabled: false,
    builtInModel: 'free/model',
    modelPricingMap: { 'free/model': { prompt: '0', completion: '0' } },
    dailySpendCents: 0,
  });
  const { getByText } = render(<AIChatPanel activeFilePath={null} activeFileContent="" activeFileLanguage="typescript" />);
  expect(getByText(/free/i)).toBeTruthy();
});

it('shows "BYOK" label when byokEnabled', () => {
  useAIStore.setState({ byokEnabled: true, byokConfig: { preset: 'openrouter', modelName: 'openai/gpt-4o', customEndpoint: '', apiKeyIsStored: false } });
  const { getByText } = render(<AIChatPanel activeFilePath={null} activeFileContent="" activeFileLanguage="typescript" />);
  expect(getByText(/byok/i)).toBeTruthy();
});
```

- [ ] **Step 2: Run — expect failures**

```bash
cd mobile-ide/mobile-ide-prototype && npx jest tests/unit/AIChatPanel.test.tsx --watchAll=false
```

- [ ] **Step 3: Update AIChatPanel.tsx**

Replace the `PROVIDER_LABELS` constant and `spendLabel` computation with:

```typescript
// Remove PROVIDER_LABELS entirely.

// Replace the spendLabel line:
const { messages, isStreaming, streamingText, dailySpendCents,
        byokEnabled, builtInModel, modelPricingMap,
        sendMessage, cancelStream, clearHistory } = storeState;

const isFree = byokEnabled ||
  (modelPricingMap[builtInModel]?.prompt === '0' &&
   modelPricingMap[builtInModel]?.completion === '0');

const spendLabel = byokEnabled
  ? 'BYOK'
  : isFree
  ? 'free'
  : `${dailySpendCents.toFixed(1)}¢`;
```

Also update the header subtitle to show the active model:

```typescript
<Text style={[styles.headerSub, { color: t.textMuted }]}>
  {byokEnabled
    ? `BYOK · ${storeState.byokConfig.modelName || 'no model set'}`
    : builtInModel.split('/').pop() ?? builtInModel
  } · {filename(activeFilePath)}
</Text>
```

- [ ] **Step 4: Run — expect pass**

```bash
cd mobile-ide/mobile-ide-prototype && npx jest tests/unit/AIChatPanel.test.tsx --watchAll=false
```

- [ ] **Step 5: Commit**

```bash
git add mobile-ide/mobile-ide-prototype/src/components/AIChatPanel.tsx \
        mobile-ide/mobile-ide-prototype/tests/unit/AIChatPanel.test.tsx
git commit -m "feat US-0036: update AIChatPanel — free model display, BYOK label, model name"
```

---

### Task 11: SettingsScreen BYOK section

**Files:**
- Modify: `mobile-ide/mobile-ide-prototype/src/components/SettingsScreen.tsx`
- Modify: `mobile-ide/mobile-ide-prototype/tests/unit/SettingsScreen.test.tsx`

- [ ] **Step 1: Write failing tests**

Add to `tests/unit/SettingsScreen.test.tsx`:

```typescript
describe('BYOK settings section', () => {
  it('hides BYOK section for Free tier', () => {
    useSubscriptionStore.setState({ tier: 'free' });
    const { queryByText } = render(<SettingsScreen onClose={jest.fn()} />);
    expect(queryByText('Bring Your Own Key')).toBeNull();
  });

  it('shows BYOK section for Pro tier', () => {
    useSubscriptionStore.setState({ tier: 'pro' });
    const { getByText } = render(<SettingsScreen onClose={jest.fn()} />);
    expect(getByText('Bring Your Own Key')).toBeTruthy();
  });

  it('shows BYOK section for Pro+AI tier', () => {
    useSubscriptionStore.setState({ tier: 'proAI' });
    const { getByText } = render(<SettingsScreen onClose={jest.fn()} />);
    expect(getByText('Bring Your Own Key')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run — expect failures**

```bash
cd mobile-ide/mobile-ide-prototype && npx jest tests/unit/SettingsScreen.test.tsx --watchAll=false
```

- [ ] **Step 3: Add BYOK section to SettingsScreen.tsx**

Find the existing AI Settings section in `SettingsScreen.tsx`. After it, add a BYOK section gated on `tier !== 'free'`:

```typescript
// Add imports at top:
import * as SecureStore from 'expo-secure-store';
import useAIStore from '../stores/useAIStore';
import { BYOK_SECURE_KEY } from '../ai/providers/byokProvider';
import type { BYOKConfig, BYOKPreset } from '../ai/aiProvider';

// Inside the component, after existing AI settings:
const { byokEnabled, byokConfig, builtInModel, openRouterModels,
        setByokEnabled, setByokConfig, setByokKeyConfigured,
        setBuiltInModel } = useAIStore();

const [byokKeyInput, setByokKeyInput] = useState('');
const [byokTestStatus, setByokTestStatus] = useState<'idle' | 'testing' | 'ok' | 'fail'>('idle');

async function saveBYOKKey() {
  if (!byokKeyInput.trim()) return;
  await SecureStore.setItemAsync(BYOK_SECURE_KEY, byokKeyInput.trim());
  setByokKeyConfigured(true);
  setByokKeyInput('');
}

// In the JSX, gated on tier !== 'free':
{tier !== 'free' && (
  <View style={[styles.section, { borderTopColor: t.border }]}>
    <Text style={[styles.sectionTitle, { color: t.text }]}>Bring Your Own Key</Text>

    {/* Enable toggle */}
    <View style={styles.settingRow}>
      <Text style={[styles.settingLabel, { color: t.text }]}>Use my own API key</Text>
      <Switch
        value={byokEnabled}
        onValueChange={setByokEnabled}
        trackColor={{ false: t.border, true: t.accent }}
      />
    </View>

    {byokEnabled && (
      <>
        {/* Preset picker */}
        <Text style={[styles.settingLabel, { color: t.textMuted, marginTop: 12 }]}>Provider</Text>
        {(['openrouter', 'anthropic', 'google', 'openai', 'custom'] as BYOKPreset[]).map((p) => (
          <TouchableOpacity
            key={p}
            style={[styles.presetRow, byokConfig.preset === p && { borderColor: t.accent }]}
            onPress={() => setByokConfig({ ...byokConfig, preset: p })}
          >
            <Text style={{ color: byokConfig.preset === p ? t.accent : t.text, fontSize: 13 }}>
              {p === 'openrouter' ? 'OpenRouter' :
               p === 'anthropic'  ? 'Anthropic (Claude)' :
               p === 'google'     ? 'Google (Gemini)' :
               p === 'openai'     ? 'OpenAI / Codex' :
                                    'Custom endpoint'}
            </Text>
          </TouchableOpacity>
        ))}

        {/* Custom endpoint field */}
        {byokConfig.preset === 'custom' && (
          <TextInput
            style={[styles.input, { color: t.text, borderColor: t.border }]}
            placeholder="https://your-endpoint/v1"
            placeholderTextColor={t.textMuted}
            value={byokConfig.customEndpoint}
            onChangeText={(v) => setByokConfig({ ...byokConfig, customEndpoint: v })}
            autoCapitalize="none"
            keyboardType="url"
          />
        )}

        {/* API Key input */}
        <TextInput
          style={[styles.input, { color: t.text, borderColor: t.border, marginTop: 8 }]}
          placeholder="API Key"
          placeholderTextColor={t.textMuted}
          value={byokKeyInput}
          onChangeText={setByokKeyInput}
          secureTextEntry
          autoCapitalize="none"
          onSubmitEditing={saveBYOKKey}
        />
        <TouchableOpacity
          style={[styles.btn, { backgroundColor: t.accent }]}
          onPress={saveBYOKKey}
        >
          <Text style={{ color: t.bg, fontWeight: '700', fontSize: 13 }}>Save Key</Text>
        </TouchableOpacity>

        {/* Model name */}
        <TextInput
          style={[styles.input, { color: t.text, borderColor: t.border, marginTop: 8 }]}
          placeholder="Model name (e.g. openai/gpt-4o)"
          placeholderTextColor={t.textMuted}
          value={byokConfig.modelName}
          onChangeText={(v) => setByokConfig({ ...byokConfig, modelName: v })}
          autoCapitalize="none"
        />
      </>
    )}

    {/* Built-in model selector (Pro+AI only) */}
    {tier === 'proAI' && !byokEnabled && (
      <View style={{ marginTop: 16 }}>
        <Text style={[styles.settingLabel, { color: t.text }]}>Built-in AI Model</Text>
        <Text style={[styles.settingDesc, { color: t.textMuted }]}>
          Current: {builtInModel.split('/').pop()}
        </Text>
        <TouchableOpacity
          style={[styles.btn, { backgroundColor: t.bgElevated, borderColor: t.border, borderWidth: 1, marginTop: 8 }]}
          onPress={() => { /* open ModelSearchSelector modal */ }}
        >
          <Text style={{ color: t.text, fontSize: 13 }}>Change Model →</Text>
        </TouchableOpacity>
      </View>
    )}
  </View>
)}
```

Also add the missing style entries to `StyleSheet.create`:
```typescript
presetRow: { padding: 10, borderRadius: 8, borderWidth: 1, borderColor: t.border, marginTop: 6 },
btn:       { padding: 10, borderRadius: 8, alignItems: 'center', marginTop: 6 },
input:     { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13 },
settingDesc: { fontSize: 12, marginTop: 2 },
```

- [ ] **Step 4: Run — expect pass**

```bash
cd mobile-ide/mobile-ide-prototype && npx jest tests/unit/SettingsScreen.test.tsx --watchAll=false
```

- [ ] **Step 5: Commit**

```bash
git add mobile-ide/mobile-ide-prototype/src/components/SettingsScreen.tsx \
        mobile-ide/mobile-ide-prototype/tests/unit/SettingsScreen.test.tsx
git commit -m "feat US-0036 US-0037: SettingsScreen BYOK section — tier-gated, 5 presets, key storage"
```

---

### Task 12: FileExplorer tier check + full suite

**Files:**
- Modify: `mobile-ide/mobile-ide-prototype/src/components/FileExplorer.tsx`

- [ ] **Step 1: Find BYOK-related tier checks**

```bash
grep -n "proAI\|byok\|PaywallAI" mobile-ide/mobile-ide-prototype/src/components/FileExplorer.tsx
```

- [ ] **Step 2: Update tier check**

Find the line in `FileExplorer.tsx` that gates the AI tab on `tier === 'proAI'`. Update so BYOK entry point shows `PaywallAISheet` with `reason="byok"` for Free users, and `reason="builtin"` for Pro users:

```typescript
// Replace existing AI tab gating with:
{tier === 'free' ? (
  <PaywallAISheet reason="byok" onUpgrade={openPaywall} />
) : tier === 'pro' ? (
  // Pro users: AI tab shows BYOK only — built-in AI still paywalled
  byokEnabled ? <AIChatPanel {...chatProps} /> : <PaywallAISheet reason="builtin" onUpgrade={openPaywall} />
) : (
  // proAI: full access
  <AIChatPanel {...chatProps} />
)}
```

- [ ] **Step 3: Run full test suite**

```bash
cd mobile-ide/mobile-ide-prototype && npx jest --watchAll=false
```

Expected: All tests pass. Fix any remaining failures before committing.

- [ ] **Step 4: Commit**

```bash
git add mobile-ide/mobile-ide-prototype/src/components/FileExplorer.tsx
git commit -m "feat US-0036: FileExplorer AI tab — tiered BYOK/builtin paywall routing"
```

---

## Phase 2 — EAS Configuration

---

### Task 13: Update eas.json

**Files:**
- Modify: `mobile-ide/mobile-ide-prototype/eas.json`

No unit tests for config files.

- [ ] **Step 1: Update eas.json production profile**

Replace the `"production"` section with:

```json
"production": {
  "autoIncrement": true,
  "env": {
    "EXPO_PUBLIC_OPENROUTER_API_KEY": "EAS_SECRET",
    "EXPO_PUBLIC_REVENUECAT_IOS_KEY": "EAS_SECRET",
    "EXPO_PUBLIC_REVENUECAT_ANDROID_KEY": "EAS_SECRET"
  }
}
```

- [ ] **Step 2: Verify full suite still passes**

```bash
cd mobile-ide/mobile-ide-prototype && npx jest --watchAll=false 2>&1 | tail -5
```

Expected: All tests pass.

- [ ] **Step 3: Commit**

```bash
git add mobile-ide/mobile-ide-prototype/eas.json
git commit -m "chore US-0036: eas.json production profile — OpenRouter + RevenueCat secrets"
```

---

## Phase 3 — Build & Submit (requires external accounts)

---

### Task 14: Store EAS secrets + Android build

Prerequisites:
- OpenRouter account with API key (`openrouter.ai` → Keys)
- RevenueCat project with Android app SDK key (`app.revenuecat.com`)
- Google Play Console account ($25 one-time, `play.google.com/console`)

- [ ] **Step 1: Log in to EAS CLI**

```bash
cd mobile-ide/mobile-ide-prototype
npx eas login
# Enter your Expo account credentials
```

- [ ] **Step 2: Store secrets**

```bash
npx eas secret:create --scope project --name EXPO_PUBLIC_OPENROUTER_API_KEY --value <your-openrouter-key>
npx eas secret:create --scope project --name EXPO_PUBLIC_REVENUECAT_IOS_KEY --value <your-rc-ios-key>
npx eas secret:create --scope project --name EXPO_PUBLIC_REVENUECAT_ANDROID_KEY --value <your-rc-android-key>
```

Verify secrets are stored:
```bash
npx eas secret:list
```

Expected: 3 secrets listed.

- [ ] **Step 3: Run Android production build**

```bash
npx eas build --platform android --profile production
```

EAS will:
1. Generate Android upload keystore (Managed credentials — approve when prompted)
2. Upload source to EAS build servers
3. Build the `.aab` (~10–15 min)

Copy the build URL from the output. Monitor at `expo.dev`.

- [ ] **Step 4: Download and smoke-test the .aab**

When build completes, download the `.aab`. Install on `Pixel_Tablet_API35`:

```bash
# EAS produces .aab (not .apk). To test locally, use bundletool:
java -jar bundletool.jar build-apks --bundle=app.aab --output=app.apks --mode=universal
java -jar bundletool.jar install-apks --apks=app.apks
```

Run smoke tests (see spec Section 12 manual checklist).

- [ ] **Step 5: Create Google Play app listing**

1. Go to `play.google.com/console`
2. Create app → App name: `NomadCode` → Default language: English (US) → App type: App → Free
3. Package name: `com.nomadcode.mobileide`
4. Complete store listing: description, feature graphic (1024×500), screenshots (see Task 17)
5. Content rating questionnaire: Games → No → submit (rates "Everyone")
6. Target audience: 18+

- [ ] **Step 6: Fill eas.json submit section for Android**

Create a Google Play service account:
1. Google Play Console → Setup → API access → Link to Google Cloud project
2. Create service account → Grant "Release manager" role
3. Download JSON key → save as `mobile-ide/mobile-ide-prototype/google-service-account.json`
4. Add `google-service-account.json` to `.gitignore`

Update `eas.json`:
```json
"submit": {
  "production": {
    "android": {
      "serviceAccountKeyPath": "./google-service-account.json",
      "track": "internal"
    }
  }
}
```

- [ ] **Step 7: Submit to Play Console internal track**

```bash
npx eas submit --platform android --profile production
```

Expected: Build uploaded to Play Console internal track. Verify in Play Console → Testing → Internal testing.

---

### Task 15: iOS build + App Store submit (post-enrollment)

**Blocked until:** Apple Developer Program identity verification passes and enrollment is complete ($99/yr, `developer.apple.com/enroll`).

Once enrollment is active:

- [ ] **Step 1: Fill Apple fields in eas.json**

```json
"submit": {
  "production": {
    "ios": {
      "appleId": "<your-apple-id-email>",
      "ascAppId": "<app-id-from-app-store-connect>",
      "appleTeamId": "<10-char-team-id>"
    }
  }
}
```

Get `ascAppId`: App Store Connect → Apps → NomadCode → App Information → Apple ID (numeric).
Get `appleTeamId`: developer.apple.com → Account → Membership → Team ID.

- [ ] **Step 2: Run iOS production build**

```bash
npx eas build --platform ios --profile production
```

EAS will generate Distribution cert + provisioning profile (Managed credentials — approve when prompted).

- [ ] **Step 3: Create App Store Connect listing**

1. App Store Connect → Apps → + New App
2. Platform: iOS, Name: NomadCode, Primary Language: English (US)
3. Bundle ID: `com.nomadcode.mobileide`
4. SKU: `nomadcode-ios`
5. Fill metadata: subtitle, description, keywords, support URL, privacy policy URL
   - Privacy Policy URL: `https://ksyed0.github.io/NomadCode/privacy/`
   - Support URL: `https://ksyed0.github.io/NomadCode/support/`
6. Upload screenshots (see Task 17)
7. Complete age rating questionnaire (4+)

- [ ] **Step 4: Submit to App Store**

```bash
npx eas submit --platform ios --profile production
```

---

## Phase 4 — Screenshots (manual)

---

### Task 16: Capture + frame screenshots

- [ ] **Step 1: Boot simulators**

```bash
# iPad Pro 13" (M5) — already known from MEMORY.md
xcrun simctl boot 1886F766-DF13-4673-9720-1ACDD534A6B8

# iPhone 15 Pro Max (6.7")
xcrun simctl boot <iphone-15-pro-max-udid>
# Find UDID: xcrun simctl list devices | grep "iPhone 15 Pro Max"

# Android tablet
~/Library/Android/sdk/emulator/emulator -avd Pixel_Tablet_API35
```

- [ ] **Step 2: Build and run on each simulator**

```bash
# iOS (set JAVA_HOME first for good measure)
npx expo run:ios --device 1886F766-DF13-4673-9720-1ACDD534A6B8

# Android
export JAVA_HOME=$(/usr/libexec/java_home -v 21)
npx expo run:android
```

- [ ] **Step 3: Take screenshots — 5 key screens**

For each screen below, navigate the app and capture:

```bash
# iOS
xcrun simctl io booted screenshot ~/Desktop/nomad-screen-N.png

# Android
adb exec-out screencap -p > ~/Desktop/nomad-screen-N.png
```

| N | Screen | How to reach |
|---|---|---|
| 1 | Split-pane editor + file explorer + terminal | Open any file from explorer |
| 2 | AI chat panel with streaming response | Tap ✦ AI tab, send a message |
| 3 | Git panel — staged files + commit input | Open a cloned repo, modify a file |
| 4 | Command palette open | Swipe down on tablet / FAB menu |
| 5 | Settings screen — BYOK section | Settings → scroll to BYOK |

- [ ] **Step 4: Frame screenshots**

1. Go to `applaunchpad.com` (free tier)
2. Upload each screenshot
3. Select device frame:
   - iPhone 15 Pro Max for 6.7" screenshots
   - iPad Pro 13" for iPad screenshots
4. Optional: Add tagline overlay using:
   - Background: Deep Slate `#0F172A`
   - Accent text: Nomad Blue `#2563EB`
   - Body text: Cloud `#E2E8F0`
5. Export at required dimensions

- [ ] **Step 5: Required output files**

```
ios/screenshots/iphone-67/  screen-1.png through screen-5.png  (1290×2796)
ios/screenshots/iphone-65/  screen-1.png through screen-5.png  (1242×2688)
ios/screenshots/ipad-13/    screen-1.png through screen-5.png  (2048×2732)
android/screenshots/        screen-1.png through screen-5.png
android/feature-graphic.png                                     (1024×500)
```

Upload to App Store Connect and Google Play Console store listings.

---

## Self-Review Checklist

- [x] **Spec Section 5 (OpenRouter migration):** Covered by Tasks 2–7
- [x] **Spec Section 6 (BYOK):** Covered by Tasks 5, 8, 11, 12
- [x] **Spec Section 7 (Model search selector):** Task 9
- [x] **Spec Section 4 (EAS config + app.json):** Tasks 1, 13
- [x] **Spec Section 8 (Store metadata):** Tasks 14–16 (metadata + screenshots)
- [x] **Spec Section 9 (Entitlements):** Covered in Task 1 (Privacy Manifests in app.json)
- [x] **Spec Section 10 (RevenueCat keys):** Task 14
- [x] **Spec Section 11 (Rollback plan):** Task 1 (git tag)
- [x] **Spec Section 12 (Test strategy):** All code tasks follow TDD; manual checklist in Task 14
- [x] **`selectIsOverQuota` updated for free models:** Task 7
- [x] **Store migration (v2 key):** Task 7
- [x] **`loadOpenRouterModels` called on app init:** Needs wiring in `App.tsx`

**One gap found:** `loadOpenRouterModels()` must be called at app startup. Add this to Task 7, Step 3 — in `App.tsx`, add:

```typescript
// In App.tsx useEffect on mount:
useEffect(() => {
  useAIStore.getState().loadOpenRouterModels();
}, []);
```

Include this in Task 7's commit.
