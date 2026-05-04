import { scrubEvent } from '../../src/observability/scrubber';

// Minimal Sentry Event shape used in tests
function makeEvent(overrides: Record<string, unknown> = {}) {
  return {
    message: 'test error',
    extra: {},
    breadcrumbs: { values: [] },
    ...overrides,
  };
}

describe('scrubEvent — token scrubbing', () => {
  it('strips GitHub PAT from error message', () => {
    const event = makeEvent({ message: 'auth failed: ghp_aBcDeFgHiJkLmNoPqRsTuVwXyZ123456789012' });
    const result = scrubEvent(event);
    expect(result.message).not.toContain('ghp_');
    expect(result.message).toContain('[redacted]');
  });

  it('strips Anthropic key from extra data', () => {
    const event = makeEvent({
      extra: { detail: 'key sk-ant-api03-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa-AAAAAAA was rejected' },
    });
    const result = scrubEvent(event);
    expect(JSON.stringify(result.extra)).not.toContain('sk-ant-');
  });

  it('strips OpenRouter key', () => {
    const event = makeEvent({ extra: { key: 'sk-or-v1-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' } });
    const result = scrubEvent(event);
    expect(JSON.stringify(result.extra)).not.toContain('sk-or-');
  });

  it('strips Google API key', () => {
    const event = makeEvent({ extra: { key: 'AIzaSyAaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' } });
    const result = scrubEvent(event);
    expect(JSON.stringify(result.extra)).not.toContain('AIza');
  });

  it('strips GitHub fine-grained PAT from extra data', () => {
    const token = 'github_pat_' + 'a'.repeat(22) + '_' + 'b'.repeat(59);
    const event = makeEvent({ extra: { key: token } });
    const result = scrubEvent(event);
    expect(JSON.stringify(result.extra)).not.toContain('github_pat_');
    expect(JSON.stringify(result.extra)).toContain('[redacted]');
  });

  it('strips generic Bearer token from breadcrumb data', () => {
    const event = makeEvent({
      breadcrumbs: {
        values: [{ category: 'http', data: { Authorization: 'Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyIn0.abc' } }],
      },
    });
    const result = scrubEvent(event);
    const bc = (result.breadcrumbs as { values: Array<{ data: Record<string, string> }> }).values[0];
    expect(bc.data.Authorization).not.toContain('eyJhbGci');
  });

  it('strips tokens on repeated scrubEvent calls (stateful regex guard)', () => {
    const msg = 'ghp_aBcDeFgHiJkLmNoPqRsTuVwXyZ123456789012';
    const make = () => makeEvent({ message: msg });
    scrubEvent(make()); // first call
    const result = scrubEvent(make()); // second call must still redact
    expect(result.message).not.toContain('ghp_');
    expect(result.message).toContain('[redacted]');
  });
});

describe('scrubEvent — truncation', () => {
  it('truncates event.extra values longer than 500 chars', () => {
    const long = 'x'.repeat(501);
    const event = makeEvent({ extra: { content: long } });
    const result = scrubEvent(event);
    expect((result.extra as Record<string, string>).content).toBe('[truncated]');
  });

  it('does NOT truncate event.extra values of exactly 500 chars', () => {
    const exact = 'x'.repeat(500);
    const event = makeEvent({ extra: { content: exact } });
    const result = scrubEvent(event);
    expect((result.extra as Record<string, string>).content).toBe(exact);
  });

  it('truncates breadcrumb data values longer than 200 chars', () => {
    const long = 'y'.repeat(201);
    const event = makeEvent({
      breadcrumbs: { values: [{ category: 'action', data: { body: long } }] },
    });
    const result = scrubEvent(event);
    const bc = (result.breadcrumbs as { values: Array<{ data: Record<string, string> }> }).values[0];
    expect(bc.data.body).toBe('[truncated]');
  });
});

describe('scrubEvent — edge cases', () => {
  it('handles undefined event.extra gracefully', () => {
    const event = makeEvent({ extra: undefined });
    expect(() => scrubEvent(event)).not.toThrow();
  });

  it('handles undefined breadcrumbs gracefully', () => {
    const event = makeEvent({ breadcrumbs: undefined });
    expect(() => scrubEvent(event)).not.toThrow();
  });

  it('passes clean events through unchanged', () => {
    const event = makeEvent({ message: 'Nothing sensitive here', extra: { count: 42 } });
    const result = scrubEvent(event);
    expect(result.message).toBe('Nothing sensitive here');
    expect((result.extra as Record<string, number>).count).toBe(42);
  });

  it('handles array values inside breadcrumb data without corrupting to plain object', () => {
    const event = makeEvent({
      breadcrumbs: {
        values: [{ category: 'http', data: { headers: ['Content-Type', 'application/json'] } }],
      },
    });
    const result = scrubEvent(event);
    const bc = (result.breadcrumbs as { values: Array<{ data: Record<string, unknown> }> }).values[0];
    expect(Array.isArray(bc.data.headers)).toBe(true);
  });
});
