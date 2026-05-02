// tests/unit/kimiProvider.test.ts
import { fetchEventSource } from '@microsoft/fetch-event-source';
import { kimiProvider } from '../../src/ai/providers/kimiProvider';

jest.mock('@microsoft/fetch-event-source', () => ({ fetchEventSource: jest.fn() }));
const mockFES = fetchEventSource as jest.MockedFunction<typeof fetchEventSource>;

beforeEach(() => { jest.clearAllMocks(); global.fetch = jest.fn() as jest.Mock; });

describe('kimiProvider.streamChat', () => {
  it('chunks text from OpenAI-format delta events', async () => {
    mockFES.mockImplementation(async (_url, opts: any) => {
      opts.onmessage({ data: JSON.stringify({ choices: [{ delta: { content: 'test' } }] }) });
      opts.onmessage({ data: '[DONE]' });
    });
    const chunks: string[] = [];
    await kimiProvider.streamChat([], '', 'python', new AbortController().signal, (c) => chunks.push(c));
    expect(chunks).toEqual(['test']);
  });

  it('calls the Moonshot endpoint', async () => {
    let capturedUrl = '';
    mockFES.mockImplementation(async (url) => { capturedUrl = url as string; });
    await kimiProvider.streamChat([], '', 'python', new AbortController().signal, () => {});
    expect(capturedUrl).toContain('api.moonshot.cn');
  });
});

describe('kimiProvider.getCompletion', () => {
  it('returns text on success', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'result' } }] }),
    });
    expect(await kimiProvider.getCompletion('', '', 'python', new AbortController().signal)).toBe('result');
  });

  it('returns empty on failure', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: false });
    expect(await kimiProvider.getCompletion('', '', 'python', new AbortController().signal)).toBe('');
  });
});

describe('kimiProvider.estimateCostCents', () => {
  it('computes cost from Kimi K2.6 rates', () => {
    // $0.74/M input, $3.49/M output
    expect(kimiProvider.estimateCostCents(1_000_000, 0)).toBeGreaterThan(0);
    expect(kimiProvider.estimateCostCents(0, 0)).toBe(0);
  });
});
