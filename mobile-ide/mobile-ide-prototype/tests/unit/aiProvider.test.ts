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
