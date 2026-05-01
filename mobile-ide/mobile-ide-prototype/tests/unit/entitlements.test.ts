import {
  canOpenMoreFiles,
  hasAIAccess,
  tierLabel,
  tierColor,
  tierFromEntitlements,
  FREE_FILE_LIMIT,
} from '../../src/iap/entitlements';

describe('FREE_FILE_LIMIT', () => {
  it('equals 3', () => expect(FREE_FILE_LIMIT).toBe(3));
});

describe('canOpenMoreFiles', () => {
  it('free tier: allows opening when under limit', () => {
    expect(canOpenMoreFiles(0, 'free')).toBe(true);
    expect(canOpenMoreFiles(2, 'free')).toBe(true);
  });

  it('free tier: blocks at limit', () => {
    expect(canOpenMoreFiles(3, 'free')).toBe(false);
    expect(canOpenMoreFiles(10, 'free')).toBe(false);
  });

  it('pro tier: always allows', () => {
    expect(canOpenMoreFiles(100, 'pro')).toBe(true);
  });

  it('pro_ai tier: always allows', () => {
    expect(canOpenMoreFiles(100, 'pro_ai')).toBe(true);
  });
});

describe('hasAIAccess', () => {
  it('returns false for free', () => expect(hasAIAccess('free')).toBe(false));
  it('returns false for pro', () => expect(hasAIAccess('pro')).toBe(false));
  it('returns true for pro_ai', () => expect(hasAIAccess('pro_ai')).toBe(true));
});

describe('tierLabel', () => {
  it('maps each tier to its label', () => {
    expect(tierLabel('free')).toBe('Free');
    expect(tierLabel('pro')).toBe('Pro');
    expect(tierLabel('pro_ai')).toBe('Pro+AI');
  });
});

describe('tierColor', () => {
  it('returns a non-empty hex string for each tier', () => {
    expect(tierColor('free')).toMatch(/^#[0-9A-Fa-f]{6}$/);
    expect(tierColor('pro')).toMatch(/^#[0-9A-Fa-f]{6}$/);
    expect(tierColor('pro_ai')).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });

  it('free and pro have different colours', () => {
    expect(tierColor('free')).not.toBe(tierColor('pro'));
  });
});

describe('tierFromEntitlements', () => {
  it('returns free when no entitlements', () => {
    expect(tierFromEntitlements([])).toBe('free');
  });

  it('returns pro when pro entitlement is active', () => {
    expect(tierFromEntitlements(['pro'])).toBe('pro');
  });

  it('returns pro_ai when pro_ai entitlement is active', () => {
    expect(tierFromEntitlements(['pro_ai'])).toBe('pro_ai');
  });

  it('returns pro_ai even when both entitlements present (pro_ai takes precedence)', () => {
    expect(tierFromEntitlements(['pro', 'pro_ai'])).toBe('pro_ai');
  });

  it('ignores unknown entitlements', () => {
    expect(tierFromEntitlements(['some_other_flag'])).toBe('free');
  });
});
