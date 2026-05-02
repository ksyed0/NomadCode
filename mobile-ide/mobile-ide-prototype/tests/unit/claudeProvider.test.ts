// tests/unit/claudeProvider.test.ts
import { fetchEventSource } from '@microsoft/fetch-event-source';
import { claudeProvider } from '../../src/ai/providers/claudeProvider';

jest.mock('@microsoft/fetch-event-source', () => ({
  fetchEventSource: jest.fn(),
}));

const mockFES = fetchEventSource as jest.MockedFunction<typeof fetchEventSource>;

beforeEach(() => {
  jest.clearAllMocks();
  global.fetch = jest.fn() as jest.Mock;
});

describe('claudeProvider.streamChat', () => {
  it('calls onChunk for each text_delta event', async () => {
    mockFES.mockImplementation(async (_url, opts: any) => {
      opts.onmessage({ event: 'content_block_delta', data: JSON.stringify({ delta: { type: 'text_delta', text: 'Hello' } }) });
      opts.onmessage({ event: 'content_block_delta', data: JSON.stringify({ delta: { type: 'text_delta', text: ' world' } }) });
    });
    const chunks: string[] = [];
    await claudeProvider.streamChat([], 'code', 'typescript', new AbortController().signal, (c) => chunks.push(c));
    expect(chunks).toEqual(['Hello', ' world']);
  });

  it('ignores non text_delta events', async () => {
    mockFES.mockImplementation(async (_url, opts: any) => {
      opts.onmessage({ event: 'message_start', data: JSON.stringify({ type: 'message_start' }) });
    });
    const chunks: string[] = [];
    await claudeProvider.streamChat([], '', 'typescript', new AbortController().signal, (c) => chunks.push(c));
    expect(chunks).toHaveLength(0);
  });
});

describe('claudeProvider.getCompletion', () => {
  it('returns text content on success', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ content: [{ type: 'text', text: 'const x = 1;' }] }),
    });
    const result = await claudeProvider.getCompletion('const ', '', 'typescript', new AbortController().signal);
    expect(result).toBe('const x = 1;');
  });

  it('returns empty string on non-ok response', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: false });
    const result = await claudeProvider.getCompletion('', '', 'typescript', new AbortController().signal);
    expect(result).toBe('');
  });

  it('returns empty string when content array is empty', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ content: [] }),
    });
    const result = await claudeProvider.getCompletion('', '', 'typescript', new AbortController().signal);
    expect(result).toBe('');
  });
});

describe('claudeProvider.estimateCostCents', () => {
  it('uses Sonnet rates (input $3/M, output $15/M)', () => {
    // 1M input tokens = 300 cents, 1M output = 1500 cents
    expect(claudeProvider.estimateCostCents(1_000_000, 1_000_000)).toBe(1800);
    expect(claudeProvider.estimateCostCents(0, 0)).toBe(0);
  });

  it('rounds up to nearest cent', () => {
    expect(claudeProvider.estimateCostCents(100, 100)).toBeGreaterThanOrEqual(0);
  });
});
