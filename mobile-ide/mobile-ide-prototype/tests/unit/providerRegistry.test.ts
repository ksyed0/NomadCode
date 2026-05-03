import { getProvider } from '../../src/ai/providerRegistry';
import type { OpenRouterConfig, BYOKConfig } from '../../src/ai/aiProvider';

jest.mock('@microsoft/fetch-event-source');
jest.mock('expo-secure-store');

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

  it('openrouter provider estimateCostCents works', () => {
    const p = getProvider('openrouter', OR_CONFIG);
    expect(typeof p.estimateCostCents(1000, 500)).toBe('number');
  });

  it('byok provider always returns 0 cost', () => {
    const p = getProvider('byok', BYOK_CONFIG);
    expect(p.estimateCostCents(100000, 100000)).toBe(0);
  });
});
