// tests/unit/geminiProvider.test.ts
import { fetchEventSource } from '@microsoft/fetch-event-source';
import { geminiProvider } from '../../src/ai/providers/geminiProvider';

jest.mock('@microsoft/fetch-event-source', () => ({ fetchEventSource: jest.fn() }));
const mockFES = fetchEventSource as jest.MockedFunction<typeof fetchEventSource>;

beforeEach(() => { jest.clearAllMocks(); global.fetch = jest.fn() as jest.Mock; });

describe('geminiProvider.streamChat', () => {
  it('calls onChunk with text from candidates', async () => {
    mockFES.mockImplementation(async (_url, opts: any) => {
      opts.onmessage({ data: JSON.stringify({ candidates: [{ content: { parts: [{ text: 'Hi' }] } }] }) });
    });
    const chunks: string[] = [];
    await geminiProvider.streamChat([], 'code', 'typescript', new AbortController().signal, (c) => chunks.push(c));
    expect(chunks).toEqual(['Hi']);
  });

  it('maps assistant role to model for Gemini API', async () => {
    let capturedBody = '';
    mockFES.mockImplementation(async (_url, opts: any) => { capturedBody = opts.body; });
    const messages = [
      { role: 'user' as const, content: 'hello' },
      { role: 'assistant' as const, content: 'hi' },
    ];
    await geminiProvider.streamChat(messages, '', 'typescript', new AbortController().signal, () => {});
    const body = JSON.parse(capturedBody);
    expect(body.contents[1].role).toBe('model');
  });
});

describe('geminiProvider.getCompletion', () => {
  it('returns text on success', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ candidates: [{ content: { parts: [{ text: 'result' }] } }] }),
    });
    const result = await geminiProvider.getCompletion('fn(', ')', 'typescript', new AbortController().signal);
    expect(result).toBe('result');
  });

  it('returns empty string on failure', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: false });
    expect(await geminiProvider.getCompletion('', '', 'typescript', new AbortController().signal)).toBe('');
  });
});

describe('geminiProvider.estimateCostCents', () => {
  it('returns a non-negative number', () => {
    expect(geminiProvider.estimateCostCents(1000, 1000)).toBeGreaterThanOrEqual(0);
  });
});
