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
