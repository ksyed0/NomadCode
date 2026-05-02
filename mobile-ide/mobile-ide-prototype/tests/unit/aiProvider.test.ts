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
