/**
 * TerminalWebView — React Native WebView wrapper for the WASI terminal runtime.
 *
 * US-0047 / EPIC-0003
 * AC-0122: WebView renders with terminal HTML bundle
 * AC-0123: Sends SET_CWD on mount
 * AC-0124: Sends RESIZE on layout change
 * AC-0125: Shows error state with Restart button on WebView error
 *
 * This component replaces Terminal.tsx as the rendered terminal component.
 * It hosts the xterm.js + WASI runtime inside a WebView and communicates
 * bidirectionally via useTerminalBridge.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  LayoutChangeEvent,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { useTheme } from '../theme/tokens';
import { useTerminalBridge } from '../hooks/useTerminalBridge';
import { TERMINAL_HTML } from '../terminal/bundle/terminalHtmlContent';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface TerminalWebViewProps {
  /** Initial working directory sent to the terminal on mount. */
  workingDirectory?: string;
  /** Called when a command completes inside the terminal. */
  onCommand?: (exitCode: number) => void;
  /** When false the container is hidden via display:none (preserves state). */
  visible?: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TerminalWebView({
  workingDirectory,
  onCommand,
  visible,
}: TerminalWebViewProps): React.ReactElement {
  const t = useTheme();
  const { webViewRef, sendToWebView, onMessage } = useTerminalBridge({
    onCommandComplete: onCommand,
  });

  // Key is bumped on Restart to force a full WebView remount.
  const [webViewKey, setWebViewKey] = useState(0);
  const [hasError, setHasError] = useState(false);

  // Send SET_CWD on mount (or when workingDirectory changes).
  useEffect(() => {
    sendToWebView({ type: 'SET_CWD', cwd: workingDirectory ?? '/' });
  }, [sendToWebView, workingDirectory]);

  // Send RESIZE when the WebView container changes dimensions.
  const handleLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const { width, height } = event.nativeEvent.layout;
      sendToWebView({
        type: 'RESIZE',
        cols: Math.floor(width / 8),
        rows: Math.floor(height / 20),
      });
    },
    [sendToWebView],
  );

  const handleError = useCallback(() => {
    setHasError(true);
  }, []);

  const handleRestart = useCallback(() => {
    setHasError(false);
    setWebViewKey((k) => k + 1);
  }, []);

  return (
    <View
      testID="terminal-webview-container"
      style={[
        styles.container,
        { backgroundColor: t.bg },
        visible === false && { display: 'none' },
      ]}
    >
      {/* Header bar — matches Terminal.tsx visual style */}
      <View
        style={[
          styles.header,
          { borderBottomColor: t.border, backgroundColor: t.bgElevated },
        ]}
      >
        <Text style={[styles.headerText, { color: t.textMuted }]}>
          TERMINAL
        </Text>
      </View>

      <KeyboardAvoidingView
        style={styles.innerContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {hasError ? (
          // Error state — show a message and a Restart button.
          <View
            testID="terminal-error-view"
            style={[styles.errorContainer, { backgroundColor: t.bg }]}
          >
            <Text style={[styles.errorText, { color: t.error }]}>
              Terminal failed to load.
            </Text>
            <TouchableOpacity
              testID="terminal-restart-button"
              onPress={handleRestart}
              style={[styles.restartButton, { backgroundColor: t.accent }]}
            >
              <Text style={[styles.restartButtonText, { color: '#FFFFFF' }]}>
                Restart
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <WebView
            key={webViewKey}
            ref={webViewRef}
            testID="terminal-webview"
            source={{ html: TERMINAL_HTML }}
            onMessage={onMessage}
            onError={handleError}
            onLayout={handleLayout}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            originWhitelist={['*']}
            scrollEnabled={false}
            style={styles.webView}
          />
        )}
      </KeyboardAvoidingView>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  headerText: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1,
  },
  innerContainer: {
    flex: 1,
  },
  webView: {
    flex: 1,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  errorText: {
    fontSize: 14,
    marginBottom: 16,
    textAlign: 'center',
  },
  restartButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 6,
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  restartButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
