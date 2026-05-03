// tests/unit/AIChatPanel.test.tsx
import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import AIChatPanel from '../../src/components/AIChatPanel';

const mockTheme = {
  bg: '#0F172A', bgElevated: '#1E293B', bgHighlight: '#334155',
  text: '#E2E8F0', textMuted: '#64748B', accent: '#0D9488',
  border: '#334155', error: '#EF4444',
};
jest.mock('../../src/theme/tokens', () => ({ useTheme: () => mockTheme }));

const mockSendMessage = jest.fn();
const mockCancelStream = jest.fn();
const mockClearHistory = jest.fn();

jest.mock('../../src/stores/useAIStore', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    messages: [],
    isStreaming: false,
    streamingText: '',
    dailySpendCents: 0,
    builtInModel: 'anthropic/claude-3-5-haiku',
    byokEnabled: false,
    byokConfig: { preset: 'openrouter', modelName: '', customEndpoint: '', apiKeyIsStored: false },
    modelPricingMap: {},
    openRouterModels: [],
    byokKeyConfigured: false,
    sendMessage: mockSendMessage,
    cancelStream: mockCancelStream,
    clearHistory: mockClearHistory,
    setBuiltInModel: jest.fn(),
    setByokEnabled: jest.fn(),
    loadOpenRouterModels: jest.fn(),
  })),
  selectIsOverQuota: jest.fn(() => false),
}));

const defaultProps = {
  activeFilePath: '/workspace/App.tsx',
  activeFileContent: 'const x = 1;',
  activeFileLanguage: 'typescript',
};

const defaultMockState = {
  messages: [],
  isStreaming: false,
  streamingText: '',
  dailySpendCents: 0,
  builtInModel: 'anthropic/claude-3-5-haiku',
  byokEnabled: false,
  byokConfig: { preset: 'openrouter', modelName: '', customEndpoint: '', apiKeyIsStored: false },
  modelPricingMap: {},
  openRouterModels: [],
  byokKeyConfigured: false,
  sendMessage: mockSendMessage,
  cancelStream: mockCancelStream,
  clearHistory: mockClearHistory,
  setBuiltInModel: jest.fn(),
  setByokEnabled: jest.fn(),
  loadOpenRouterModels: jest.fn(),
};

beforeEach(() => {
  jest.clearAllMocks();
  const useAIStore = require('../../src/stores/useAIStore').default;
  useAIStore.mockReturnValue(defaultMockState);
});

describe('AIChatPanel', () => {
  it('renders AI Chat heading', () => {
    const { getByText } = render(<AIChatPanel {...defaultProps} />);
    expect(getByText('AI Chat')).toBeTruthy();
  });

  it('shows current filename as context', () => {
    const { getByText } = render(<AIChatPanel {...defaultProps} />);
    expect(getByText(/App\.tsx/)).toBeTruthy();
  });

  it('renders messages from the store', () => {
    const useAIStore = require('../../src/stores/useAIStore').default;
    useAIStore.mockReturnValue({
      ...defaultMockState,
      messages: [
        { role: 'user', content: 'hello' },
        { role: 'assistant', content: 'world' },
      ],
    });
    const { getByText } = render(<AIChatPanel {...defaultProps} />);
    expect(getByText('hello')).toBeTruthy();
    expect(getByText('world')).toBeTruthy();
  });

  it('calls sendMessage when Send is pressed', async () => {
    mockSendMessage.mockResolvedValue(undefined);
    const { getByPlaceholderText, getByAccessibilityHint } = render(<AIChatPanel {...defaultProps} />);
    fireEvent.changeText(getByPlaceholderText(/Ask about/), 'what does this do?');
    await act(async () => {
      fireEvent.press(getByAccessibilityHint('Send message'));
    });
    expect(mockSendMessage).toHaveBeenCalledWith('what does this do?', 'const x = 1;', 'typescript');
  });

  it('disables send button while streaming', () => {
    const useAIStore = require('../../src/stores/useAIStore').default;
    useAIStore.mockReturnValue({
      ...defaultMockState,
      isStreaming: true,
      streamingText: 'partial...',
    });
    const { getByAccessibilityHint } = render(<AIChatPanel {...defaultProps} />);
    expect(getByAccessibilityHint('Send message').props.accessibilityState?.disabled).toBe(true);
  });

  it('shows Stop button while streaming', () => {
    const useAIStore = require('../../src/stores/useAIStore').default;
    useAIStore.mockReturnValue({
      ...defaultMockState,
      isStreaming: true,
      streamingText: 'hi',
    });
    const { getByText } = render(<AIChatPanel {...defaultProps} />);
    expect(getByText('■ Stop')).toBeTruthy();
    fireEvent.press(getByText('■ Stop'));
    expect(mockCancelStream).toHaveBeenCalled();
  });

  it('calls clearHistory when clear button is tapped', () => {
    const { getByLabelText } = render(<AIChatPanel {...defaultProps} />);
    fireEvent.press(getByLabelText('Clear chat history'));
    expect(mockClearHistory).toHaveBeenCalled();
  });

  it('shows spend chip for built-in provider', () => {
    const useAIStore = require('../../src/stores/useAIStore').default;
    useAIStore.mockReturnValue({
      ...defaultMockState,
      dailySpendCents: 0,
      modelPricingMap: { 'anthropic/claude-3-5-haiku': { prompt: '0.0000008', completion: '0.000004' } },
    });
    const { getByText } = render(<AIChatPanel {...defaultProps} />);
    expect(getByText(/0\.0¢/)).toBeTruthy();
  });
});

describe('spend chip display', () => {
  it('shows spend amount for paid model', () => {
    (require('../../src/stores/useAIStore').default as jest.Mock).mockReturnValue({
      ...defaultMockState,
      builtInModel: 'anthropic/claude-3-5-haiku',
      byokEnabled: false,
      dailySpendCents: 5,
      modelPricingMap: { 'anthropic/claude-3-5-haiku': { prompt: '0.0000008', completion: '0.000004' } },
      isStreaming: false,
    });
    const { getByText } = render(<AIChatPanel activeFilePath={null} activeFileContent="" activeFileLanguage="typescript" />);
    expect(getByText('5.0¢')).toBeTruthy();
  });

  it('shows "free" for free model', () => {
    (require('../../src/stores/useAIStore').default as jest.Mock).mockReturnValue({
      ...defaultMockState,
      builtInModel: 'meta-llama/llama-3.1-8b-instruct:free',
      byokEnabled: false,
      dailySpendCents: 0,
      modelPricingMap: { 'meta-llama/llama-3.1-8b-instruct:free': { prompt: '0', completion: '0' } },
      isStreaming: false,
    });
    const { getByText } = render(<AIChatPanel activeFilePath={null} activeFileContent="" activeFileLanguage="typescript" />);
    expect(getByText('free')).toBeTruthy();
  });

  it('shows "BYOK" when byokEnabled', () => {
    (require('../../src/stores/useAIStore').default as jest.Mock).mockReturnValue({
      ...defaultMockState,
      byokEnabled: true,
      isStreaming: false,
    });
    const { getByText } = render(<AIChatPanel activeFilePath={null} activeFileContent="" activeFileLanguage="typescript" />);
    expect(getByText('BYOK')).toBeTruthy();
  });
});
