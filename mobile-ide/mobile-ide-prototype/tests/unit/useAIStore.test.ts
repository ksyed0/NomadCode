// tests/unit/useAIStore.test.ts
import { act } from '@testing-library/react-native';

jest.mock('../../src/ai/providerRegistry', () => ({
  getProvider: jest.fn(() => ({
    id: 'claude',
    streamChat: jest.fn(async (_msgs: unknown, _fc: unknown, _lang: unknown, _sig: unknown, onChunk: (t: string) => void) => {
      onChunk('Hello'); onChunk(' world');
    }),
    getCompletion: jest.fn(async () => 'completion'),
    estimateCostCents: jest.fn(() => 1),
  })),
}));

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

import useAIStore, { selectIsOverQuota } from '../../src/stores/useAIStore';
import { DAILY_CAP_CENTS } from '../../src/ai/quotaConfig';

function resetStore() {
  useAIStore.setState({
    selectedProviderId: 'claude',
    customConfig: { baseUrl: '', modelName: '', contextWindowSize: 4096, apiKeyIsStored: false },
    dailySpendCents: 0,
    quotaResetDate: new Date().toISOString().slice(0, 10),
    messages: [],
    isStreaming: false,
    streamingText: '',
    abortController: null,
  });
}

beforeEach(() => { jest.clearAllMocks(); resetStore(); });

describe('selectIsOverQuota', () => {
  it('returns false when under cap', () => {
    expect(selectIsOverQuota(useAIStore.getState())).toBe(false);
  });

  it('returns true when at cap for built-in provider', () => {
    useAIStore.setState({ dailySpendCents: DAILY_CAP_CENTS });
    expect(selectIsOverQuota(useAIStore.getState())).toBe(true);
  });

  it('returns false for custom provider even when over cap', () => {
    useAIStore.setState({ selectedProviderId: 'custom', dailySpendCents: DAILY_CAP_CENTS + 100 });
    expect(selectIsOverQuota(useAIStore.getState())).toBe(false);
  });
});

describe('checkAndResetQuota', () => {
  it('resets spend when date has changed', () => {
    useAIStore.setState({ dailySpendCents: 10, quotaResetDate: '2000-01-01' });
    useAIStore.getState().checkAndResetQuota();
    expect(useAIStore.getState().dailySpendCents).toBe(0);
  });

  it('does not reset spend on same day', () => {
    useAIStore.setState({ dailySpendCents: 5 });
    useAIStore.getState().checkAndResetQuota();
    expect(useAIStore.getState().dailySpendCents).toBe(5);
  });
});

describe('sendMessage', () => {
  it('streams chunks and pushes final assistant message', async () => {
    await act(async () => {
      await useAIStore.getState().sendMessage('hello', 'code', 'typescript');
    });
    const { messages } = useAIStore.getState();
    expect(messages).toHaveLength(2);
    expect(messages[0]).toEqual({ role: 'user', content: 'hello' });
    expect(messages[1]).toEqual({ role: 'assistant', content: 'Hello world' });
    expect(useAIStore.getState().isStreaming).toBe(false);
    expect(useAIStore.getState().streamingText).toBe('');
  });

  it('adds quota error message when over cap', async () => {
    useAIStore.setState({ dailySpendCents: DAILY_CAP_CENTS });
    await act(async () => {
      await useAIStore.getState().sendMessage('hello', '', 'typescript');
    });
    const { messages } = useAIStore.getState();
    expect(messages.some((m) => m.content.includes('Daily AI limit'))).toBe(true);
    expect(useAIStore.getState().isStreaming).toBe(false);
  });

  it('increments dailySpendCents after successful message', async () => {
    await act(async () => {
      await useAIStore.getState().sendMessage('hi', '', 'typescript');
    });
    expect(useAIStore.getState().dailySpendCents).toBeGreaterThan(0);
  });
});

describe('cancelStream', () => {
  it('aborts the controller and clears streaming state', () => {
    const abort = new AbortController();
    const spy = jest.spyOn(abort, 'abort');
    useAIStore.setState({ isStreaming: true, abortController: abort });
    useAIStore.getState().cancelStream();
    expect(spy).toHaveBeenCalled();
    expect(useAIStore.getState().isStreaming).toBe(false);
  });
});

describe('clearHistory', () => {
  it('empties message list', () => {
    useAIStore.setState({ messages: [{ role: 'user', content: 'hi' }] });
    useAIStore.getState().clearHistory();
    expect(useAIStore.getState().messages).toHaveLength(0);
  });
});
