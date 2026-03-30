/**
 * useTerminalBridge — bidirectional message bridge between React Native and the
 * WebView-hosted terminal.
 *
 * US-0047 / EPIC-0003
 *
 * The hook owns:
 *   - A WebView ref the caller attaches via `<WebView ref={webViewRef} />`
 *   - `sendToWebView`: posts a typed RNToWebView message into the WebView by
 *     injecting a call to `window.receiveFromRN(msg)`.
 *   - `onMessage`: receives WebViewToRN messages from the WebView, routes
 *     FILE_* messages through FileBridge, and calls back the optional
 *     `onCommandComplete` listener for COMMAND_COMPLETE events.
 */

import { useCallback, useRef } from 'react';
import type WebView from 'react-native-webview';
import type { WebViewMessageEvent } from 'react-native-webview';
import { FileBridge } from '../terminal/FileBridge';
import type { RNToWebView, WebViewToRN } from '../terminal/protocol';

// ---------------------------------------------------------------------------
// Module-level constants
// ---------------------------------------------------------------------------

const VALID_FILE_TYPES = new Set([
  'FILE_READ', 'FILE_WRITE', 'FILE_LIST', 'FILE_MKDIR',
  'FILE_DELETE', 'FILE_COPY', 'FILE_MOVE',
] as const);

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface UseTerminalBridgeOptions {
  onCommandComplete?: (exitCode: number) => void;
  /** Called when the WebView requests the OAuth token for git push/pull. */
  onGetToken?: () => string | null;
}

export interface UseTerminalBridgeResult {
  webViewRef: React.RefObject<WebView>;
  sendToWebView: (msg: RNToWebView) => void;
  onMessage: (event: WebViewMessageEvent) => void;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useTerminalBridge(
  options?: UseTerminalBridgeOptions,
): UseTerminalBridgeResult {
  const webViewRef = useRef<WebView>(null);
  const { onCommandComplete, onGetToken } = options ?? {};

  const sendToWebView = useCallback((msg: RNToWebView): void => {
    // receiveFromRN(msgJson: string) calls JSON.parse(msgJson) — the argument must be
    // a JSON string literal, not an object literal. Double-stringify so the injected JS
    // is: window.receiveFromRN("{\"type\":\"...\"}") — a quoted string JSON.parse can parse.
    webViewRef.current?.injectJavaScript(
      `window.receiveFromRN(${JSON.stringify(JSON.stringify(msg))});true;`,
    );
  }, []);

  const onMessage = useCallback(
    (event: WebViewMessageEvent): void => {
      let msg: WebViewToRN;
      try {
        msg = JSON.parse(event.nativeEvent.data) as WebViewToRN;
      } catch (e) {
        console.warn('[useTerminalBridge] Failed to parse WebView message', e);
        return;
      }

      if (msg.type === 'COMMAND_COMPLETE') {
        onCommandComplete?.(msg.exitCode);
        return;
      }

      if (msg.type === 'GET_TOKEN') {
        const token = onGetToken?.() ?? null;
        sendToWebView({ type: 'TOKEN_RESULT', requestId: msg.requestId, token });
        return;
      }

      if (!VALID_FILE_TYPES.has(msg.type)) {
        if (__DEV__) console.warn('[useTerminalBridge] Unhandled message type:', msg.type);
        return;
      }

      // All FILE_* messages are handled by FileBridge asynchronously.
      // Type-narrow: after COMMAND_COMPLETE and GET_TOKEN checks, msg is a FileMessage
      void (async () => {
        const response = await FileBridge.handleMessage(
          msg as Extract<typeof msg, { type: 'FILE_READ' | 'FILE_WRITE' | 'FILE_LIST' | 'FILE_MKDIR' | 'FILE_DELETE' }>
        );
        sendToWebView(response);
      })();
    },
    [onCommandComplete, onGetToken, sendToWebView],
  );

  return { webViewRef, sendToWebView, onMessage };
}
