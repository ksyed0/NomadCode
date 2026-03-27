'use strict';
import { simpleHash } from '../../src/utils/hash';

describe('simpleHash', () => {
  it('returns a non-empty hex string', () => {
    expect(simpleHash('hello')).toMatch(/^[0-9a-f]+$/);
  });

  it('is deterministic — same input gives same output', () => {
    expect(simpleHash('abc')).toBe(simpleHash('abc'));
  });

  it('returns different values for different inputs', () => {
    expect(simpleHash('foo')).not.toBe(simpleHash('bar'));
  });

  it('handles empty string', () => {
    expect(simpleHash('')).toBe('1505');
  });

  it('handles single character', () => {
    const h = simpleHash('a');
    expect(typeof h).toBe('string');
    expect(h.length).toBeGreaterThan(0);
  });

  it('handles long strings consistently', () => {
    const long = 'x'.repeat(10000);
    expect(simpleHash(long)).toBe(simpleHash(long));
  });

  it('detects a single character change', () => {
    expect(simpleHash('hello world')).not.toBe(simpleHash('hello World'));
  });
});
