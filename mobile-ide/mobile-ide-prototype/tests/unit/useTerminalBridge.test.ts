/**
 * Unit tests — useTerminalBridge
 *
 * US-0047 / EPIC-0003
 *
 * AC coverage:
 *   - webViewRef is initialised as a React ref
 *   - sendToWebView injects the correct JS into the WebView
 *   - onMessage / COMMAND_COMPLETE routes to onCommandComplete callback
 *   - onMessage / FILE_* routes to FileBridge.handleMessage
 *   - After FILE_* FileBridge response is forwarded via sendToWebView
 *   - Malformed JSON is handled gracefully (no throw)
 *   - Works without an onCommandComplete option
 */

import { act, renderHook } from '@testing-library/react-native';
import type { WebViewMessageEvent } from 'react-native-webview';

// ---------------------------------------------------------------------------
// Mock react-native-webview
// ---------------------------------------------------------------------------

const mockInjectJavaScript = jest.fn();

jest.mock('react-native-webview', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require('react');
  // Provide a minimal WebView component so the ref type resolves at runtime.
  const MockWebView = React.forwardRef(
    (_props: unknown, ref: React.Ref<unknown>) => {
      React.useImperativeHandle(ref, () => ({
        injectJavaScript: mockInjectJavaScript,
      }));
      return null;
    },
  );
  MockWebView.displayName = 'MockWebView';
  return { default: MockWebView };
});

// ---------------------------------------------------------------------------
// Mock FileBridge
// ---------------------------------------------------------------------------

const mockHandleMessage = jest.fn();

jest.mock('../../src/terminal/FileBridge', () => ({
  FileBridge: {
    handleMessage: (...args: unknown[]) => mockHandleMessage(...args),
  },
}));

// ---------------------------------------------------------------------------
// Import hook AFTER mocks are registered
// ---------------------------------------------------------------------------

import { useTerminalBridge } from '../../src/hooks/useTerminalBridge';
import type { WebViewToRN } from '../../src/terminal/protocol';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMessageEvent(data: unknown): WebViewMessageEvent {
  return {
    nativeEvent: { data: JSON.stringify(data) },
  } as WebViewMessageEvent;
}

function makeMalformedEvent(): WebViewMessageEvent {
  return {
    nativeEvent: { data: 'NOT_JSON{{{{' },
  } as WebViewMessageEvent;
}

const FILE_RESULT_RESPONSE = {
  type: 'FILE_RESULT' as const,
  requestId: 'req-1',
  result: 'file-content',
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks();
  mockHandleMessage.mockResolvedValue(FILE_RESULT_RESPONSE);
});

describe('useTerminalBridge', () => {
  // 1. webViewRef is initialised
  it('returns a React ref object (webViewRef)', () => {
    const { result } = renderHook(() => useTerminalBridge());
    expect(result.current.webViewRef).toBeDefined();
    expect(typeof result.current.webViewRef).toBe('object');
    expect('current' in result.current.webViewRef).toBe(true);
  });

  // 2. sendToWebView calls injectJavaScript with a JSON string argument
  // receiveFromRN(msgJson: string) calls JSON.parse(msgJson) — the injected JS must
  // pass a quoted string literal, not an object literal. The injection must
  // double-stringify: JSON.stringify(JSON.stringify(msg)) so the WebView receives
  // window.receiveFromRN("{\"type\":\"SET_CWD\",...}") — a string that JSON.parse can parse.
  it('sendToWebView injects a JSON string literal (double-stringified) into receiveFromRN', () => {
    const { result } = renderHook(() => useTerminalBridge());

    // Manually set ref.current so we can verify the call.
    (result.current.webViewRef as React.MutableRefObject<unknown>).current = {
      injectJavaScript: mockInjectJavaScript,
    };

    const msg = { type: 'SET_CWD' as const, cwd: '/home/user' };
    act(() => {
      result.current.sendToWebView(msg);
    });

    expect(mockInjectJavaScript).toHaveBeenCalledTimes(1);
    // The injected JS must pass a string to receiveFromRN, not an object literal.
    expect(mockInjectJavaScript).toHaveBeenCalledWith(
      `window.receiveFromRN(${JSON.stringify(JSON.stringify(msg))});true;`,
    );
  });

  // 3. COMMAND_COMPLETE calls onCommandComplete
  it('onMessage COMMAND_COMPLETE calls onCommandComplete with exitCode', () => {
    const onCommandComplete = jest.fn();
    const { result } = renderHook(() =>
      useTerminalBridge({ onCommandComplete }),
    );

    act(() => {
      result.current.onMessage(
        makeMessageEvent({ type: 'COMMAND_COMPLETE', exitCode: 0 }),
      );
    });

    expect(onCommandComplete).toHaveBeenCalledTimes(1);
    expect(onCommandComplete).toHaveBeenCalledWith(0);
  });

  // 4. COMMAND_COMPLETE does not call FileBridge
  it('onMessage COMMAND_COMPLETE does not call FileBridge.handleMessage', () => {
    const { result } = renderHook(() =>
      useTerminalBridge({ onCommandComplete: jest.fn() }),
    );

    act(() => {
      result.current.onMessage(
        makeMessageEvent({ type: 'COMMAND_COMPLETE', exitCode: 1 }),
      );
    });

    expect(mockHandleMessage).not.toHaveBeenCalled();
  });

  // 5-11. FILE_* messages call FileBridge.handleMessage
  const fileMessages: WebViewToRN[] = [
    { type: 'FILE_READ', requestId: 'req-1', path: '/a.txt' },
    {
      type: 'FILE_WRITE',
      requestId: 'req-2',
      path: '/b.txt',
      content: 'hello',
    },
    { type: 'FILE_LIST', requestId: 'req-3', path: '/' },
    { type: 'FILE_MKDIR', requestId: 'req-4', path: '/new-dir' },
    { type: 'FILE_DELETE', requestId: 'req-5', path: '/old.txt' },
    { type: 'FILE_COPY', requestId: 'req-6', src: '/a.txt', dest: '/b.txt' },
    { type: 'FILE_MOVE', requestId: 'req-7', src: '/a.txt', dest: '/c.txt' },
  ];

  fileMessages.forEach((fileMsg) => {
    it(`onMessage ${fileMsg.type} calls FileBridge.handleMessage`, async () => {
      const { result } = renderHook(() => useTerminalBridge());

      await act(async () => {
        result.current.onMessage(makeMessageEvent(fileMsg));
        // Allow the async IIFE inside onMessage to settle.
        await Promise.resolve();
      });

      expect(mockHandleMessage).toHaveBeenCalledWith(fileMsg);
    });
  });

  // 10. After FILE_READ, sendToWebView is called with FILE_RESULT response
  it('after FILE_READ FileBridge response is forwarded via sendToWebView', async () => {
    const { result } = renderHook(() => useTerminalBridge());

    (result.current.webViewRef as React.MutableRefObject<unknown>).current = {
      injectJavaScript: mockInjectJavaScript,
    };

    await act(async () => {
      result.current.onMessage(
        makeMessageEvent({
          type: 'FILE_READ',
          requestId: 'req-1',
          path: '/a.txt',
        }),
      );
      await Promise.resolve();
    });

    expect(mockInjectJavaScript).toHaveBeenCalledTimes(1);
    expect(mockInjectJavaScript).toHaveBeenCalledWith(
      `window.receiveFromRN(${JSON.stringify(JSON.stringify(FILE_RESULT_RESPONSE))});true;`,
    );
  });

  // 11. Malformed JSON is handled gracefully
  it('handles malformed JSON in onMessage without throwing', () => {
    const { result } = renderHook(() => useTerminalBridge());
    const consoleSpy = jest
      .spyOn(console, 'warn')
      .mockImplementation(() => {});

    expect(() => {
      act(() => {
        result.current.onMessage(makeMalformedEvent());
      });
    }).not.toThrow();

    consoleSpy.mockRestore();
  });

  // 12. Works correctly with no onCommandComplete option
  it('works when no onCommandComplete option is provided (no-op)', () => {
    const { result } = renderHook(() => useTerminalBridge());

    expect(() => {
      act(() => {
        result.current.onMessage(
          makeMessageEvent({ type: 'COMMAND_COMPLETE', exitCode: 0 }),
        );
      });
    }).not.toThrow();

    expect(mockHandleMessage).not.toHaveBeenCalled();
  });

  // 13 (TC-0335). GET_TOKEN calls onGetToken and sends TOKEN_RESULT via sendToWebView
  it('onMessage GET_TOKEN calls onGetToken and forwards TOKEN_RESULT via sendToWebView', () => {
    const onGetToken = jest.fn().mockReturnValue('ghp_mocktoken');
    const { result } = renderHook(() => useTerminalBridge({ onGetToken }));

    (result.current.webViewRef as React.MutableRefObject<unknown>).current = {
      injectJavaScript: mockInjectJavaScript,
    };

    act(() => {
      result.current.onMessage(
        makeMessageEvent({ type: 'GET_TOKEN', requestId: 'req-t1' }),
      );
    });

    expect(onGetToken).toHaveBeenCalledTimes(1);
    expect(mockInjectJavaScript).toHaveBeenCalledWith(
      `window.receiveFromRN(${JSON.stringify(
        JSON.stringify({ type: 'TOKEN_RESULT', requestId: 'req-t1', token: 'ghp_mocktoken' }),
      )});true;`,
    );
  });

  // 14. BUG-0011 — unknown message type is silently dropped (no FileBridge call)
  it('onMessage with unknown type does not call FileBridge.handleMessage', async () => {
    const { result } = renderHook(() => useTerminalBridge());

    await act(async () => {
      result.current.onMessage(
        makeMessageEvent({ type: 'UNKNOWN_MSG', requestId: 'req-99' }),
      );
      await Promise.resolve();
    });

    expect(mockHandleMessage).not.toHaveBeenCalled();
  });

  // 15. BUG-0011 — unknown message type emits a __DEV__ warning
  it('onMessage with unknown type logs a console.warn in __DEV__ mode', async () => {
    const consoleSpy = jest
      .spyOn(console, 'warn')
      .mockImplementation(() => {});

    // Force __DEV__ truthy for this test (Jest runs with NODE_ENV=test;
    // React Native sets __DEV__ = true in test environments).
    const prevDev = (global as Record<string, unknown>).__DEV__;
    (global as Record<string, unknown>).__DEV__ = true;

    const { result } = renderHook(() => useTerminalBridge());

    await act(async () => {
      result.current.onMessage(
        makeMessageEvent({ type: 'UNKNOWN_MSG', requestId: 'req-99' }),
      );
      await Promise.resolve();
    });

    expect(consoleSpy).toHaveBeenCalledWith(
      '[useTerminalBridge] Unhandled message type:',
      'UNKNOWN_MSG',
    );

    (global as Record<string, unknown>).__DEV__ = prevDev;
    consoleSpy.mockRestore();
  });

  // 16. BUG-0045 — onMessage uses the updated callback after rerender with new onCommandComplete
  it('onMessage calls the latest onCommandComplete after rerender (BUG-0045)', () => {
    const callbackA = jest.fn();
    const callbackB = jest.fn();

    const { result, rerender } = renderHook(
      ({ cb }: { cb: (exitCode: number) => void }) =>
        useTerminalBridge({ onCommandComplete: cb }),
      { initialProps: { cb: callbackA } },
    );

    // Switch to callbackB before sending the message.
    rerender({ cb: callbackB });

    act(() => {
      result.current.onMessage(
        makeMessageEvent({ type: 'COMMAND_COMPLETE', exitCode: 42 }),
      );
    });

    // callbackB is the current callback and must be invoked.
    expect(callbackB).toHaveBeenCalledWith(42);
    // callbackA is stale and must NOT be invoked.
    expect(callbackA).not.toHaveBeenCalled();
  });
});
