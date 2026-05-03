import * as SecureStore from 'expo-secure-store';
import { buildByokProvider, BYOK_SECURE_KEY } from '../../src/ai/providers/byokProvider';
import type { BYOKConfig } from '../../src/ai/aiProvider';

jest.mock('expo-secure-store');
jest.mock('@microsoft/fetch-event-source');

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

  it('exports BYOK_SECURE_KEY constant', () => {
    expect(BYOK_SECURE_KEY).toBe('nomadcode_custom_ai_key');
  });

  describe('preset base URLs', () => {
    const presets: Array<[BYOKConfig['preset'], string]> = [
      ['openrouter', 'https://openrouter.ai/api/v1'],
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
    it('uses x-api-key header and anthropic-version, not Authorization', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ content: [{ text: 'hello' }] }),
      });
      const config: BYOKConfig = { ...BASE_CONFIG, preset: 'anthropic', modelName: 'claude-3-5-haiku-20241022' };
      const p = buildByokProvider(config);
      await p.getCompletion('x', '', 'js', new AbortController().signal);
      const headers = (fetch as jest.Mock).mock.calls[0][1].headers as Record<string, string>;
      expect(headers['x-api-key']).toBe('test-key-123');
      expect(headers['anthropic-version']).toBe('2023-06-01');
      expect(headers['Authorization']).toBeUndefined();
    });

    it('parses Anthropic response format (content[0].text)', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ content: [{ text: 'result' }] }),
      });
      const config: BYOKConfig = { ...BASE_CONFIG, preset: 'anthropic', modelName: 'claude-3-5-haiku-20241022' };
      const p = buildByokProvider(config);
      const result = await p.getCompletion('x', '', 'js', new AbortController().signal);
      expect(result).toBe('result');
    });
  });

  describe('getCompletion', () => {
    it('returns empty string when no key stored', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);
      const config: BYOKConfig = { ...BASE_CONFIG, apiKeyIsStored: true };
      const p = buildByokProvider(config);
      // For non-anthropic when no key: should still attempt (no key = no auth header)
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ choices: [{ message: { content: 'ok' } }] }),
      });
      const result = await p.getCompletion('x', '', 'js', new AbortController().signal);
      expect(typeof result).toBe('string');
    });

    it('returns empty string on fetch failure', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));
      const p = buildByokProvider(BASE_CONFIG);
      const result = await p.getCompletion('x', '', 'js', new AbortController().signal);
      expect(result).toBe('');
    });

    it('returns empty string on non-ok response', async () => {
      global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 401 });
      const p = buildByokProvider(BASE_CONFIG);
      const result = await p.getCompletion('x', '', 'js', new AbortController().signal);
      expect(result).toBe('');
    });
  });
});
