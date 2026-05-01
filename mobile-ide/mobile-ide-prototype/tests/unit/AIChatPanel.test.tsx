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
    selectedProviderId: 'claude',
    sendMessage: mockSendMessage,
    cancelStream: mockCancelStream,
    clearHistory: mockClearHistory,
  })),
  selectIsOverQuota: jest.fn(() => false),
}));

const defaultProps = {
  activeFilePath: '/workspace/App.tsx',
  activeFileContent: 'const x = 1;',
  activeFileLanguage: 'typescript',
};

const defaultStoreState = {
  messages: [],
  isStreaming: false,
  streamingText: '',
  dailySpendCents: 0,
  selectedProviderId: 'claude',
  sendMessage: mockSendMessage,
  cancelStream: mockCancelStream,
  clearHistory: mockClearHistory,
};

beforeEach(() => {
  jest.clearAllMocks();
  const useAIStore = require('../../src/stores/useAIStore').default;
  useAIStore.mockReturnValue(defaultStoreState);
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
      messages: [
        { role: 'user', content: 'hello' },
        { role: 'assistant', content: 'world' },
      ],
      isStreaming: false,
      streamingText: '',
      dailySpendCents: 0,
      selectedProviderId: 'claude',
      sendMessage: mockSendMessage,
      cancelStream: mockCancelStream,
      clearHistory: mockClearHistory,
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
      messages: [],
      isStreaming: true,
      streamingText: 'partial...',
      dailySpendCents: 0,
      selectedProviderId: 'claude',
      sendMessage: mockSendMessage,
      cancelStream: mockCancelStream,
      clearHistory: mockClearHistory,
    });
    const { getByAccessibilityHint } = render(<AIChatPanel {...defaultProps} />);
    expect(getByAccessibilityHint('Send message').props.accessibilityState?.disabled).toBe(true);
  });

  it('shows Stop button while streaming', () => {
    const useAIStore = require('../../src/stores/useAIStore').default;
    useAIStore.mockReturnValue({
      messages: [],
      isStreaming: true,
      streamingText: 'hi',
      dailySpendCents: 0,
      selectedProviderId: 'claude',
      sendMessage: mockSendMessage,
      cancelStream: mockCancelStream,
      clearHistory: mockClearHistory,
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
    const { getByText } = render(<AIChatPanel {...defaultProps} />);
    expect(getByText(/0\.0¢/)).toBeTruthy();
  });
});
