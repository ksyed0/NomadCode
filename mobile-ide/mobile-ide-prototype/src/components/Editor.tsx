/**
 * Editor — Monaco-based multi-tab code editor embedded in a WebView.
 *
 * Architecture:
 *   React Native state owns the list of open tabs and their content.
 *   Monaco runs inside a WebView and communicates via postMessage / injectJavaScript.
 *   Content flows:  file open → RN → Monaco (setContent message)
 *                   user types → Monaco → RN (contentChanged message) → state update
 *   Saves are triggered by the parent (App.tsx) reading the latest content from state.
 *
 * Future extension points:
 *   - AI code completion: inject a Claude API call on 'triggerSuggest' Monaco action
 *   - Diff view: use monaco.editor.createDiffEditor for Git diffs
 *   - Remote LSP: proxy language server messages through a WebSocket bridge
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EditorTab {
  path: string;
  name: string;
  content: string;
  language: string;
  isDirty: boolean;
}

interface EditorProps {
  tabs: EditorTab[];
  activeTabPath: string | null;
  onTabChange: (path: string) => void;
  onTabClose: (path: string) => void;
  onContentChange: (path: string, content: string) => void;
  onSave: (path: string, content: string) => void;
}

// ---------------------------------------------------------------------------
// Language detection
// ---------------------------------------------------------------------------

const LANG_MAP: Record<string, string> = {
  ts: 'typescript', tsx: 'typescript',
  js: 'javascript', jsx: 'javascript', mjs: 'javascript', cjs: 'javascript',
  json: 'json', jsonc: 'json',
  md: 'markdown', mdx: 'markdown',
  css: 'css', scss: 'scss', less: 'less',
  html: 'html', htm: 'html', xml: 'xml',
  py: 'python', rb: 'ruby', php: 'php',
  rs: 'rust', go: 'go', swift: 'swift',
  c: 'c', cpp: 'cpp', h: 'c', hpp: 'cpp',
  java: 'java', kt: 'kotlin',
  sh: 'shell', bash: 'shell', zsh: 'shell',
  yaml: 'yaml', yml: 'yaml',
  toml: 'ini', env: 'ini',
  sql: 'sql', graphql: 'graphql',
  dockerfile: 'dockerfile',
};

export function getLanguageForFile(filename: string): string {
  const lower = filename.toLowerCase();
  if (lower === 'dockerfile' || lower.startsWith('dockerfile.')) return 'dockerfile';
  const ext = lower.split('.').pop() ?? '';
  return LANG_MAP[ext] ?? 'plaintext';
}

// ---------------------------------------------------------------------------
// Monaco HTML — loaded once; content changes are driven by postMessage.
// Loads Monaco from CDN (requires network). For offline use, bundle Monaco
// assets into the app's assets/ folder and serve via a local HTTP server.
// ---------------------------------------------------------------------------

const MONACO_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
  <style>
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; height: 100%; background: #1e1e1e; overflow: hidden; }
    #container { position: absolute; inset: 0; }
    #loading {
      position: absolute; inset: 0; display: flex; align-items: center;
      justify-content: center; color: #555; font: 13px/1 -apple-system, sans-serif;
      background: #1e1e1e;
    }
  </style>
</head>
<body>
  <div id="container">
    <div id="loading">Loading Monaco editor…</div>
  </div>
  <script src="https://cdn.jsdelivr.net/npm/monaco-editor@0.45.0/min/vs/loader.js"></script>
  <script>
    var editor;

    require.config({
      paths: { vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.45.0/min/vs' }
    });

    require(['vs/editor/editor.main'], function () {
      document.getElementById('loading').remove();

      editor = monaco.editor.create(document.getElementById('container'), {
        value: '',
        language: 'plaintext',
        theme: 'vs-dark',
        fontSize: 14,
        fontFamily: "'JetBrains Mono', 'Fira Code', Menlo, Monaco, monospace",
        lineNumbers: 'on',
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        wordWrap: 'on',
        automaticLayout: true,
        padding: { top: 8, bottom: 8 },
        renderLineHighlight: 'line',
        smoothScrolling: true,
        cursorBlinking: 'smooth',
        bracketPairColorization: { enabled: true },
        // Touch / mobile optimizations
        scrollbar: { verticalScrollbarSize: 4, horizontalScrollbarSize: 4 },
        overviewRulerLanes: 0,
        hideCursorInOverviewRuler: true,
        // Multi-cursor: hold Alt/Option + click on mobile via external keyboard
        multiCursorModifier: 'alt',
      });

      // Send content changes to React Native
      editor.onDidChangeModelContent(function () {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'contentChanged',
          content: editor.getValue(),
        }));
      });

      // Keyboard shortcut: Cmd+S / Ctrl+S → request save
      editor.addCommand(
        monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS,
        function () {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'save',
            content: editor.getValue(),
          }));
        }
      );

      // Signal ready to React Native
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'ready' }));
    });

    // Receive messages from React Native
    window.addEventListener('message', function (e) {
      try {
        var msg = JSON.parse(e.data);
        if (!editor) return;
        if (msg.type === 'setContent') {
          // Preserve cursor position when language is the same (tab switch back)
          var viewState = msg.resetView ? null : editor.saveViewState();
          editor.setValue(msg.content || '');
          monaco.editor.setModelLanguage(editor.getModel(), msg.language || 'plaintext');
          if (viewState) { editor.restoreViewState(viewState); }
          if (msg.resetView) { editor.revealLine(1); editor.setPosition({ lineNumber: 1, column: 1 }); }
        } else if (msg.type === 'format') {
          editor.getAction('editor.action.formatDocument').run();
        } else if (msg.type === 'findReplace') {
          editor.getAction('editor.action.startFindReplaceAction').run();
        } else if (msg.type === 'goToLine') {
          editor.getAction('editor.action.gotoLine').run();
        }
      } catch (err) { /* ignore parse errors */ }
    });
  </script>
</body>
</html>`;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function Editor({
  tabs,
  activeTabPath,
  onTabChange,
  onTabClose,
  onContentChange,
  onSave,
}: EditorProps) {
  const webViewRef = useRef<WebView>(null);
  const [editorReady, setEditorReady] = useState(false);
  // Track which tab path was last loaded into Monaco to avoid redundant sends
  const loadedPathRef = useRef<string | null>(null);

  const activeTab = tabs.find((t) => t.path === activeTabPath) ?? null;

  // When the active tab changes (or Monaco first becomes ready), send the new content
  useEffect(() => {
    if (!editorReady || !activeTab) return;
    if (loadedPathRef.current === activeTab.path) return; // already loaded
    loadedPathRef.current = activeTab.path;

    const msg = JSON.stringify({
      type: 'setContent',
      content: activeTab.content,
      language: activeTab.language,
      resetView: true,
    });
    // injectJavaScript dispatches a synthetic 'message' event into the WebView
    webViewRef.current?.injectJavaScript(
      `window.dispatchEvent(new MessageEvent('message',{data:${JSON.stringify(msg)}}));true;`,
    );
  }, [editorReady, activeTab?.path]); // intentionally NOT depending on content

  const handleMessage = useCallback(
    (event: WebViewMessageEvent) => {
      try {
        const msg = JSON.parse(event.nativeEvent.data);
        switch (msg.type) {
          case 'ready':
            setEditorReady(true);
            break;
          case 'contentChanged':
            if (activeTabPath) onContentChange(activeTabPath, msg.content);
            break;
          case 'save':
            if (activeTabPath) onSave(activeTabPath, msg.content);
            break;
        }
      } catch { /* ignore */ }
    },
    [activeTabPath, onContentChange, onSave],
  );

  // Empty state
  if (tabs.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyTitle}>No files open</Text>
        <Text style={styles.emptyHint}>Select a file from the Explorer</Text>
        {/* TODO: Add recent files list here */}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* ── Tab bar ── */}
      <ScrollView
        horizontal
        style={styles.tabBar}
        contentContainerStyle={styles.tabBarContent}
        showsHorizontalScrollIndicator={false}
        bounces={false}
      >
        {tabs.map((tab) => {
          const isActive = tab.path === activeTabPath;
          return (
            <TouchableOpacity
              key={tab.path}
              style={[styles.tab, isActive && styles.tabActive]}
              onPress={() => onTabChange(tab.path)}
              activeOpacity={0.75}
            >
              <Text
                style={[styles.tabLabel, isActive && styles.tabLabelActive]}
                numberOfLines={1}
              >
                {tab.isDirty ? `● ${tab.name}` : tab.name}
              </Text>
              <TouchableOpacity
                style={styles.tabCloseHit}
                onPress={() => onTabClose(tab.path)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.tabCloseIcon}>×</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* ── Monaco editor ── */}
      <View style={styles.editorArea}>
        {!editorReady && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator color="#2563EB" size="small" />
            <Text style={styles.loadingText}>Loading editor…</Text>
          </View>
        )}
        <WebView
          ref={webViewRef}
          source={{ html: MONACO_HTML }}
          onMessage={handleMessage}
          style={styles.webView}
          javaScriptEnabled
          domStorageEnabled
          allowFileAccess
          originWhitelist={['*']}
          // Needed on iOS for keyboard to resize the WebView correctly
          keyboardDisplayRequiresUserAction={false}
          // Disable bouncing — Monaco handles its own scroll
          bounces={false}
          scrollEnabled={false}
        />
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const TAB_HEIGHT = 36;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1E1E1E',
  },
  tabBar: {
    height: TAB_HEIGHT,
    backgroundColor: '#252526',
    flexGrow: 0,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#1E1E1E',
  },
  tabBarContent: {
    alignItems: 'stretch',
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    height: TAB_HEIGHT,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: '#1E1E1E',
    maxWidth: 180,
    minWidth: 80,
  },
  tabActive: {
    backgroundColor: '#1E1E1E',
    borderBottomWidth: 2,
    borderBottomColor: '#2563EB',
  },
  tabLabel: {
    color: '#9DA5B4',
    fontSize: 12,
    flex: 1,
  },
  tabLabelActive: {
    color: '#CDD6F4',
  },
  tabCloseHit: {
    marginLeft: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabCloseIcon: {
    color: '#6B7280',
    fontSize: 16,
    lineHeight: 16,
  },
  editorArea: {
    flex: 1,
  },
  webView: {
    flex: 1,
    backgroundColor: '#1E1E1E',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#1E1E1E',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    zIndex: 1,
  },
  loadingText: {
    color: '#6B7280',
    fontSize: 13,
  },
  empty: {
    flex: 1,
    backgroundColor: '#1E1E1E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    color: '#4B5563',
    fontSize: 16,
  },
  emptyHint: {
    color: '#374151',
    fontSize: 13,
    marginTop: 8,
  },
});
