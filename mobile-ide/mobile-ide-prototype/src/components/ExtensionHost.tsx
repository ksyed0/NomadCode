/**
 * ExtensionHost — mounts one hidden WebView per active extension.
 *
 * Routes postMessage from each WebView back to the host app.
 * Rendered hidden (height: 0) in App.tsx below the visible layout.
 */

import React, { useCallback, useRef } from 'react';
import { View } from 'react-native';
import WebView from 'react-native-webview';
import type { WebView as WebViewType } from 'react-native-webview';
import {
  buildSandboxHtml,
  ExtensionRegistry,
  type ExtensionManifest,
  type ExtensionMessage,
} from '../extensions/sandbox';

export interface ExtensionHostProps {
  manifests: ExtensionManifest[];
  onGetEditorContent: () => string;
  onReplaceEditorContent: (text: string) => void;
  onShowMessage: (text: string) => void;
  onShowError: (text: string) => void;
}

export default function ExtensionHost({
  manifests,
  onGetEditorContent,
  onReplaceEditorContent,
  onShowMessage,
  onShowError,
}: ExtensionHostProps) {
  const refs = useRef<Record<string, WebViewType | null>>({});

  const handleMessage = useCallback(
    (extensionId: string, data: string) => {
      let msg: ExtensionMessage;
      try {
        msg = JSON.parse(data) as ExtensionMessage;
      } catch {
        return;
      }

      ExtensionRegistry.dispatch(msg);

      switch (msg.type) {
        case 'showMessage': {
          onShowMessage((msg.payload as { text: string }).text);
          break;
        }
        case 'showError': {
          onShowError((msg.payload as { text: string }).text);
          break;
        }
        case 'getEditorContent': {
          const content = onGetEditorContent();
          const ref = refs.current[extensionId];
          if (ref && msg.requestId) {
            ref.injectJavaScript(
              `window.dispatchEvent(new MessageEvent('message',{data:JSON.stringify({requestId:${JSON.stringify(msg.requestId)},payload:${JSON.stringify(content)}})}));true;`
            );
          }
          break;
        }
        case 'replaceEditorContent': {
          onReplaceEditorContent((msg.payload as { text: string }).text);
          break;
        }
        case 'error': {
          onShowError(`Extension error: ${(msg.payload as { message: string }).message}`);
          break;
        }
      }
    },
    [onGetEditorContent, onReplaceEditorContent, onShowMessage, onShowError],
  );

  if (manifests.length === 0) return null;

  return (
    <View style={{ height: 0, overflow: 'hidden' }}>
      {manifests.map((manifest) => (
        <WebView
          key={manifest.id}
          testID={`exthost-webview-${manifest.id}`}
          ref={(r) => { refs.current[manifest.id] = r; }}
          source={{ html: buildSandboxHtml(manifest) }}
          onMessage={(event) => handleMessage(manifest.id, event.nativeEvent.data)}
          javaScriptEnabled
          style={{ width: 1, height: 1 }}
        />
      ))}
    </View>
  );
}
