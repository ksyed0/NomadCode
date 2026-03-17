/**
 * Unit tests — TerminalWebView component
 *
 * US-0047 / EPIC-0003
 * AC-0122: WebView renders with terminal HTML bundle
 * AC-0123: Sends SET_CWD on mount
 * AC-0124: Sends RESIZE on layout change
 * AC-0125: Shows error state with Restart button on WebView error
 */

import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

// ---------------------------------------------------------------------------
// Shared mock state
// ---------------------------------------------------------------------------

// Captured WebView callbacks so tests can trigger them directly.
const mockWebViewCallbacks: {
  onMessage?: (event: unknown) => void;
  onError?: (event: unknown) => void;
  onLayout?: (event: unknown) => void;
} = {};

const mockSendToWebView = jest.fn();

// ---------------------------------------------------------------------------
// Mock react-native-webview
// ---------------------------------------------------------------------------

jest.mock('react-native-webview', () => ({
  WebView: jest.fn(({ onMessage, onError, onLayout, ..._props }) => {
    // Store callbacks for test access.
    mockWebViewCallbacks.onMessage = onMessage;
    mockWebViewCallbacks.onError = onError;
    mockWebViewCallbacks.onLayout = onLayout;
    // Return null — WebView has no native renderer in Jest.
    return null;
  }),
}));

// ---------------------------------------------------------------------------
// Mock useTerminalBridge
// ---------------------------------------------------------------------------

jest.mock('../../src/hooks/useTerminalBridge', () => ({
  useTerminalBridge: jest.fn(() => ({
    webViewRef: { current: null },
    sendToWebView: mockSendToWebView,
    onMessage: jest.fn(),
  })),
}));

// ---------------------------------------------------------------------------
// Mock terminal HTML content
// ---------------------------------------------------------------------------

jest.mock('../../src/terminal/bundle/terminalHtmlContent', () => ({
  TERMINAL_HTML: '<html><body>mock terminal</body></html>',
}));

// ---------------------------------------------------------------------------
// Mock useTheme
// ---------------------------------------------------------------------------

jest.mock('../../src/theme/tokens', () => ({
  useTheme: () => ({
    bg: '#0F172A',
    bgElevated: '#1E293B',
    bgHighlight: '#1D3461',
    text: '#E2E8F0',
    textMuted: '#64748B',
    border: '#334155',
    accent: '#2563EB',
    keyword: '#7C3AED',
    string: '#0D9488',
    error: '#EF4444',
    success: '#22C55E',
  }),
}));

// ---------------------------------------------------------------------------
// Import component AFTER mocks are registered
// ---------------------------------------------------------------------------

import { TerminalWebView } from '../../src/components/TerminalWebView';
import { useTerminalBridge } from '../../src/hooks/useTerminalBridge';
import { WebView } from 'react-native-webview';

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks();
  // Reset captured callbacks.
  mockWebViewCallbacks.onMessage = undefined;
  mockWebViewCallbacks.onError = undefined;
  mockWebViewCallbacks.onLayout = undefined;

  // Re-configure the mock so sendToWebView is fresh for each test.
  (useTerminalBridge as jest.Mock).mockReturnValue({
    webViewRef: { current: null },
    sendToWebView: mockSendToWebView,
    onMessage: jest.fn(),
  });
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('TerminalWebView', () => {
  // 1. Renders WebView on mount
  it('renders WebView on mount', () => {
    render(<TerminalWebView />);
    expect(WebView).toHaveBeenCalled();
  });

  // 2. Sends SET_CWD on mount
  it('sends SET_CWD on mount with the provided workingDirectory', () => {
    render(<TerminalWebView workingDirectory="/projects" />);
    expect(mockSendToWebView).toHaveBeenCalledWith({
      type: 'SET_CWD',
      cwd: '/projects',
    });
  });

  // 2b. Defaults workingDirectory to '/' when not provided
  it('sends SET_CWD with "/" when workingDirectory is not provided', () => {
    render(<TerminalWebView />);
    expect(mockSendToWebView).toHaveBeenCalledWith({
      type: 'SET_CWD',
      cwd: '/',
    });
  });

  // 3. Passes onCommand to useTerminalBridge as onCommandComplete
  it('calls useTerminalBridge with onCommandComplete matching the onCommand prop', () => {
    const mockOnCommand = jest.fn();
    render(<TerminalWebView onCommand={mockOnCommand} />);
    expect(useTerminalBridge).toHaveBeenCalledWith(
      expect.objectContaining({ onCommandComplete: mockOnCommand }),
    );
  });

  // 4. Shows error state with Restart button on WebView error
  it('shows error view with Restart button when WebView fires onError', () => {
    render(<TerminalWebView />);

    // Before error: WebView should be rendered (mock was called).
    expect(WebView).toHaveBeenCalled();

    act(() => {
      mockWebViewCallbacks.onError?.({});
    });

    // After error: the Restart button should appear.
    expect(screen.getByTestId('terminal-restart-button')).toBeTruthy();
    expect(screen.getByText('Restart')).toBeTruthy();
  });

  // 5. Restart button resets error state and remounts WebView
  it('Restart button resets the error state and re-renders WebView', () => {
    render(<TerminalWebView />);

    // Trigger error.
    act(() => {
      mockWebViewCallbacks.onError?.({});
    });
    expect(screen.getByTestId('terminal-restart-button')).toBeTruthy();

    // Press Restart.
    act(() => {
      fireEvent.press(screen.getByTestId('terminal-restart-button'));
    });

    // Error view should be gone; WebView should have been called again
    // (at least twice total — once on mount, once after restart).
    expect(screen.queryByTestId('terminal-restart-button')).toBeNull();
    expect((WebView as jest.Mock).mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  // 6. Hides container when visible=false
  it('applies display:none to the container when visible=false', () => {
    render(<TerminalWebView visible={false} />);
    // display:none hides the element from the accessibility tree — use UNSAFE query.
    const container = screen.UNSAFE_getByProps({ testID: 'terminal-webview-container' });
    const flatStyle = ([] as object[]).concat(container.props.style ?? []);
    expect(flatStyle).toContainEqual(expect.objectContaining({ display: 'none' }));
  });

  // 7. Does not hide container when visible=true
  it('does not apply display:none when visible=true', () => {
    render(<TerminalWebView visible={true} />);
    const container = screen.getByTestId('terminal-webview-container');
    const flatStyle = ([] as object[]).concat(container.props.style ?? []);
    const hasHidden = flatStyle.some(
      (s) => (s as Record<string, unknown>)?.display === 'none',
    );
    expect(hasHidden).toBe(false);
  });

  // 8. Shows TERMINAL header
  it('renders the TERMINAL header bar', () => {
    render(<TerminalWebView />);
    expect(screen.getByText('TERMINAL')).toBeTruthy();
  });

  // 9. Sends RESIZE on layout change
  it('sends RESIZE message when the WebView container layout changes', () => {
    render(<TerminalWebView />);

    act(() => {
      mockWebViewCallbacks.onLayout?.({
        nativeEvent: { layout: { width: 320, height: 200 } },
      });
    });

    expect(mockSendToWebView).toHaveBeenCalledWith({
      type: 'RESIZE',
      cols: Math.floor(320 / 8),   // 40
      rows: Math.floor(200 / 20),  // 10
    });
  });
});
