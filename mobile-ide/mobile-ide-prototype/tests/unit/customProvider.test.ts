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
