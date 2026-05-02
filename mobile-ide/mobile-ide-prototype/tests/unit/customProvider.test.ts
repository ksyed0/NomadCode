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

  it('chunks text from OpenAI delta events', async () => {
    mockFES.mockImplementation(async (_url, opts: any) => {
      opts.onmessage({ data: JSON.stringify({ choices: [{ delta: { content: 'hello' } }] }) });
      opts.onmessage({ data: '[DONE]' });
    });
    const chunks: string[] = [];
    const p = buildCustomProvider(config);
    await p.streamChat([], 'code', 'typescript', new AbortController().signal, (c) => chunks.push(c));
    expect(chunks).toEqual(['hello']);
  });

  it('handles invalid JSON in stream chunks', async () => {
    mockFES.mockImplementation(async (_url, opts: any) => {
      opts.onmessage({ data: 'not valid json' });
      opts.onmessage({ data: JSON.stringify({ choices: [{ delta: { content: 'valid' } }] }) });
    });
    const chunks: string[] = [];
    const p = buildCustomProvider(config);
    await p.streamChat([], 'code', 'typescript', new AbortController().signal, (c) => chunks.push(c));
    expect(chunks).toEqual(['valid']);
  });

  it('includes prior messages in streamChat request', async () => {
    let capturedBody: any = {};
    mockFES.mockImplementation(async (_url, opts: any) => {
      capturedBody = JSON.parse(opts.body);
    });
    const p = buildCustomProvider(config);
    const priorMessages = [
      { role: 'user' as const, content: 'hello' },
      { role: 'assistant' as const, content: 'hi' },
    ];
    await p.streamChat(priorMessages, 'code', 'typescript', new AbortController().signal, () => {});
    expect(capturedBody.messages).toHaveLength(3); // system + 2 prior
    expect(capturedBody.messages[1].content).toBe('hello');
    expect(capturedBody.messages[2].content).toBe('hi');
  });

  it('throws error in streamChat when onerror is called', async () => {
    mockFES.mockImplementation(async (_url, opts: any) => {
      opts.onerror(new Error('Stream error'));
    });
    const p = buildCustomProvider(config);
    await expect(
      p.streamChat([], 'code', 'typescript', new AbortController().signal, () => {})
    ).rejects.toThrow('Stream error');
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

  it('returns empty string on non-ok response', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: false });
    const p = buildCustomProvider(config);
    const result = await p.getCompletion('', '', 'typescript', new AbortController().signal);
    expect(result).toBe('');
  });

  it('returns empty string when fetch throws', async () => {
    (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));
    const p = buildCustomProvider(config);
    const result = await p.getCompletion('', '', 'typescript', new AbortController().signal);
    expect(result).toBe('');
  });

  it('uses API key in getCompletion when stored', async () => {
    mockGetItem.mockResolvedValue('test-key');
    let capturedHeaders: Record<string, string> = {};
    (global.fetch as jest.Mock).mockImplementation((_url: string, opts: any) => {
      capturedHeaders = opts.headers;
      return Promise.resolve({
        ok: true,
        json: async () => ({ choices: [{ message: { content: 'result' } }] }),
      });
    });
    const p = buildCustomProvider({ ...config, apiKeyIsStored: true });
    await p.getCompletion('', '', 'typescript', new AbortController().signal);
    expect(capturedHeaders['Authorization']).toBe('Bearer test-key');
  });
});
