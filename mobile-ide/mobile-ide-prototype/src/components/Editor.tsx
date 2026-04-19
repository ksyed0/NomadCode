/**
 * Editor — Monaco multi-tab code editor with:
 *   • Touch gestures  — pinch-to-zoom font size (Pointer Events in WebView)
 *   • Multi-cursor    — tap-to-add-cursor mode toggled from the mobile toolbar
 *   • Mobile toolbar  — undo/redo, indent/dedent, find, format, comment,
 *                       select-all, multi-cursor toggle, font size controls
 *   • Preview mode    — rendered view for Markdown, HTML, and JSON files
 *   • Offline Monaco  — loads from local cache when available (MonacoAssetManager)
 *
 * Architecture:
 *   RN state  →  Monaco (setContent message on tab switch)
 *   Monaco    →  RN state (contentChanged / save / fontSizeChanged messages)
 *   Toolbar   →  Monaco (injectJavaScript with command messages)
 *
 * Future extension points:
 *   AI_HOOK: insert AI completion on Cmd+K via sendToEditor('aiComplete', {prompt})
 *   CLOUD_HOOK: sync content after save via CloudSync.enqueueUpload(path, content)
 */

import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { marked } from 'marked';
import { buildMonacoHtml, MonacoAssetManager } from '../utils/MonacoAssetManager';
import { getLanguageRules } from '../utils/languageRules';
import { useTheme, getMonacoTheme, THEMES } from '../theme/tokens';
import type { ThemeTokens } from '../theme/tokens';
import useSettingsStore from '../stores/useSettingsStore';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EditorTab {
  path: string;
  name: string;
  content: string;
  language: string;
  isDirty: boolean;
  scrollTo?: {
    line: number;
    matchStart: number;
    matchEnd: number;
  } | null;
  viewState?: string;
}

export interface EditorHandle {
  sendFoldAll: () => void;
  sendUnfoldAll: () => void;
  requestViewStateSave: (path: string) => void;
}

interface EditorProps {
  tabs: EditorTab[];
  activeTabPath: string | null;
  onTabChange: (path: string) => void;
  onTabClose: (path: string) => void;
  onContentChange: (path: string, content: string) => void;
  onSave: (path: string, content: string) => void;
  onTabScrollConsumed?: (path: string) => void;
  onTabViewStateChange?: (path: string, viewState: string) => void;
}

// ---------------------------------------------------------------------------
// Language detection
// ---------------------------------------------------------------------------

const LANG_MAP: Record<string, string> = {
  // TypeScript / JavaScript
  ts: 'typescript', tsx: 'typescript',
  js: 'javascript', jsx: 'javascript', mjs: 'javascript', cjs: 'javascript',
  // Web
  json: 'json', jsonc: 'jsonc',
  md: 'markdown', mdx: 'markdown',
  css: 'css', scss: 'scss', less: 'less',
  html: 'html', htm: 'html', xml: 'xml',
  // Scripting
  py: 'python', rb: 'ruby', php: 'php',
  lua: 'lua',
  ex: 'elixir', exs: 'elixir',
  r: 'r',
  pl: 'perl', pm: 'perl',
  // Systems / compiled
  rs: 'rust', go: 'go', swift: 'swift',
  c: 'c', cpp: 'cpp', h: 'c', hpp: 'cpp',
  java: 'java', kt: 'kotlin',
  cs: 'csharp',
  fs: 'fsharp', fsx: 'fsharp',
  scala: 'scala',
  dart: 'dart',
  zig: 'zig',
  m: 'objective-c',
  vb: 'vb',
  // Shell / infra
  sh: 'shell', bash: 'shell', zsh: 'shell',
  ps1: 'powershell', psm1: 'powershell',
  tf: 'hcl', hcl: 'hcl',
  dockerfile: 'dockerfile',
  // Data / config
  yaml: 'yaml', yml: 'yaml',
  toml: 'toml', env: 'ini', ini: 'ini', cfg: 'ini',
  sql: 'sql', graphql: 'graphql',
  proto: 'proto',
  // Vue SFCs: no dedicated Monaco grammar — fall back to HTML
  vue: 'html',
};

export function getLanguageForFile(filename: string): string {
  const lower = filename.toLowerCase();
  if (lower === 'dockerfile' || lower.startsWith('dockerfile.')) return 'dockerfile';
  const ext = lower.split('.').pop() ?? '';
  // If the extension IS the whole filename (no dot) pop() returns the filename itself,
  // which won't be in LANG_MAP — handled by the fallback below.
  if (ext === lower) return 'plaintext'; // no extension
  return LANG_MAP[ext] ?? 'plaintext';
}

/**
 * Lightweight content-based language detection used as a fallback when the
 * filename has no extension. Checks only the first 512 characters so it stays
 * fast even on large files.
 */
export function detectLanguageFromContent(content: string): string {
  const head = content.slice(0, 512).trimStart();
  if (!head) return 'plaintext';

  // JSON: starts with { or [
  if (head[0] === '{' || head[0] === '[') {
    try { JSON.parse(content); return 'json'; } catch { /* not valid JSON */ }
  }

  // HTML: starts with <!DOCTYPE or <html or common tags
  if (/^<!doctype\s+html/i.test(head) || /^<html[\s>]/i.test(head)) return 'html';

  // Markdown: has ATX headings, list markers, or emphasis
  const markdownScore = [
    /^#{1,6}\s/m,          // # Heading
    /^\s*[-*+]\s/m,        // - list item
    /^\s*\d+\.\s/m,        // 1. ordered list
    /\*\*.+\*\*/,          // **bold**
    /\[.+\]\(.+\)/,        // [link](url)
    /^>\s/m,               // > blockquote
    /^```/m,               // fenced code block
  ].filter((re) => re.test(head)).length;
  if (markdownScore >= 2) return 'markdown';

  return 'plaintext';
}

/** File types that support a rendered preview alongside the editor. */
const PREVIEWABLE = new Set(['markdown', 'html', 'json']);

export function canPreview(language: string): boolean {
  return PREVIEWABLE.has(language);
}

// ---------------------------------------------------------------------------
// Preview HTML builders
// ---------------------------------------------------------------------------

function buildMarkdownPreviewHtml(markdown: string, theme: ThemeTokens): string {
  const rendered = marked.parse(markdown) as string;
  return `<!DOCTYPE html><html><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  body{font:15px/1.6 -apple-system,sans-serif;color:${theme.text};background:${theme.bg};
       padding:16px 20px;margin:0;}
  h1,h2,h3,h4{color:${theme.text};margin:1em 0 .4em;}
  a{color:${theme.accent};}
  pre{background:${theme.bgElevated};border-radius:6px;padding:12px;overflow-x:auto;}
  code{font-family:'JetBrains Mono',monospace;font-size:13px;color:${theme.accent};}
  pre code{color:${theme.text};}
  blockquote{border-left:3px solid ${theme.border};margin:0;padding-left:16px;color:${theme.textMuted};}
  table{border-collapse:collapse;width:100%;}
  th,td{border:1px solid ${theme.border};padding:6px 10px;text-align:left;}
  th{background:${theme.bgElevated};}
  img{max-width:100%;}
  hr{border:none;border-top:1px solid ${theme.border};}
</style>
</head><body>${rendered}</body></html>`;
}

function buildHtmlPreviewHtml(htmlSource: string): string {
  // Sandboxed preview — user scripts are disabled via sandbox attribute
  const encoded = 'data:text/html;charset=utf-8,' + encodeURIComponent(htmlSource);
  return `<!DOCTYPE html><html><head>
<meta charset="utf-8">
<style>html,body{margin:0;padding:0;height:100%;background:#fff;}
iframe{width:100%;height:100%;border:none;}</style>
</head><body>
<iframe src="${encoded}" sandbox="allow-same-origin"></iframe>
</body></html>`;
}

function buildJsonPreviewHtml(jsonSource: string, theme: ThemeTokens): string {
  let parsed: unknown;
  let parseError: string | null = null;
  try { parsed = JSON.parse(jsonSource); } catch (e) { parseError = String(e); }

  const content = parseError
    ? `<div class="err">${parseError}</div>`
    : `<pre id="tree"></pre>
<script>
(function(){
  function r(v){
    if(v===null) return '<span class="null">null</span>';
    if(typeof v==='boolean') return '<span class="bool">'+v+'</span>';
    if(typeof v==='number')  return '<span class="num">'+v+'</span>';
    if(typeof v==='string')  return '<span class="str">"'
      +v.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
        .replace(/"/g,'&quot;')+'</span>';
    if(Array.isArray(v)){
      if(!v.length) return '[]';
      return '<details open><summary class="arr">Array['+v.length+']</summary>'
        +v.map(function(i){return '<div class="item">'+r(i)+'</div>';}).join('')
        +'</details>';
    }
    var keys=Object.keys(v);
    if(!keys.length) return '{}';
    return '<details open><summary class="obj">Object{'+keys.length+'}</summary>'
      +keys.map(function(k){
        return '<div class="row"><span class="key">"'+k+'"</span>: '+r(v[k])+'</div>';
      }).join('')+'</details>';
  }
  document.getElementById('tree').innerHTML=r(${JSON.stringify(parsed)});
})();
</script>`;

  return `<!DOCTYPE html><html><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  body{font:13px/1.5 'JetBrains Mono',monospace;background:${theme.bg};color:${theme.text};
       padding:12px;margin:0;}
  details>summary{cursor:pointer;list-style:none;outline:none;user-select:none;}
  details>summary::-webkit-details-marker{display:none;}
  .item,.row{padding-left:16px;border-left:1px solid ${theme.bgElevated};}
  .key{color:${theme.accent};} .str{color:${theme.string};} .num{color:${theme.keyword};}
  .bool{color:${theme.keyword};} .null{color:${theme.textMuted};} .arr,.obj{color:${theme.accent};}
  .err{color:${theme.error};white-space:pre-wrap;} pre{margin:0;}
</style>
</head><body>${content}</body></html>`;
}

export function buildPreviewHtml(
  language: string,
  content: string,
  theme: ThemeTokens = THEMES['nomad-dark'],
): string {
  switch (language) {
    case 'markdown': return buildMarkdownPreviewHtml(content, theme);
    case 'html':     return buildHtmlPreviewHtml(content);
    case 'json':     return buildJsonPreviewHtml(content, theme);
    default:
      return `<body style="background:${theme.bg};color:${theme.textMuted};padding:16px">No preview available</body>`;
  }
}

// ---------------------------------------------------------------------------
// Toolbar definition
// ---------------------------------------------------------------------------

interface ToolbarItem {
  id: string;
  label: string;
  title: string;
  action: string;
  toggle?: boolean;
}

export const TOOLBAR_ITEMS: ToolbarItem[] = [
  { id: 'undo',        label: '↩',   title: 'Undo',             action: 'undo' },
  { id: 'redo',        label: '↪',   title: 'Redo',             action: 'redo' },
  { id: 'dedent',      label: '⇤',   title: 'Decrease indent',  action: 'dedent' },
  { id: 'indent',      label: '⇥',   title: 'Increase indent',  action: 'indent' },
  { id: 'comment',     label: '//',  title: 'Toggle comment',   action: 'comment' },
  { id: 'find',        label: '⌕',   title: 'Find & replace',  action: 'findReplace' },
  { id: 'format',      label: '✦',   title: 'Format document',  action: 'format' },
  { id: 'select',      label: '⊞',   title: 'Select all',       action: 'selectAll' },
  { id: 'multicursor', label: '⊕',   title: 'Add cursor mode',  action: 'multicursor', toggle: true },
  { id: 'preview',     label: '◫',   title: 'Toggle preview',   action: 'preview',     toggle: true },
];

const FONT_DEC_ID = 'font-dec';
const FONT_INC_ID = 'font-inc';

const TOOLTIP_LABELS: Readonly<Record<string, string>> = {
  [FONT_DEC_ID]: 'Decrease font size',
  [FONT_INC_ID]: 'Increase font size',
  ...Object.fromEntries(TOOLBAR_ITEMS.map((item) => [item.id, item.title])),
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const Editor = forwardRef<EditorHandle, EditorProps>(function Editor({
  tabs,
  activeTabPath,
  onTabChange,
  onTabClose,
  onContentChange,
  onSave,
  onTabScrollConsumed,
  onTabViewStateChange,
}, ref) {
  const webViewRef    = useRef<WebView | null>(null);
  const loadedPathRef = useRef<string | null>(null);

  const t = useTheme();
  const fontSize    = useSettingsStore((s) => s.fontSize);
  const setFontSize = useSettingsStore((s) => s.setFontSize);
  const themeId     = useSettingsStore((s) => s.theme);
  const monacoTheme = getMonacoTheme(themeId);

  const [editorReady, setEditorReady] = useState(false);
  const [monacoHtml,  setMonacoHtml]  = useState<string | null>(null);
  const [isOffline,   setIsOffline]   = useState(false);
  const [multiCursor, setMultiCursor] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [tooltipId,   setTooltipId]   = useState<string | null>(null);
  const tooltipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const activeTab      = tabs.find((tab) => tab.path === activeTabPath) ?? null;
  const previewEnabled = activeTab ? canPreview(activeTab.language) : false;

  // ── Resolve Monaco source (CDN or local cache) on mount ─────────────────
  // Pass the user's current theme so the editor boots in the right mode
  // and avoids a flash of vs-dark on light themes.
  useEffect(() => {
    MonacoAssetManager.resolve().then(({ baseUrl, isOffline: offline }) => {
      setMonacoHtml(buildMonacoHtml(baseUrl, monacoTheme));
      setIsOffline(offline);
    }).catch(console.error);
    // monacoTheme intentionally excluded from deps — Monaco only boots once;
    // subsequent theme changes are handled by the setTheme effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Tooltip helpers ──────────────────────────────────────────────────────
  const showTooltip = useCallback((id: string) => {
    if (tooltipTimerRef.current) clearTimeout(tooltipTimerRef.current);
    setTooltipId(id);
  }, []);

  const hideTooltip = useCallback(() => {
    if (tooltipTimerRef.current) clearTimeout(tooltipTimerRef.current);
    setTooltipId(null);
  }, []);

  /** Show tooltip then auto-dismiss after 1500 ms (for long-press on touch). */
  const showTooltipTemp = useCallback((id: string) => {
    showTooltip(id);
    tooltipTimerRef.current = setTimeout(() => setTooltipId(null), 1500);
  }, [showTooltip]);

  useEffect(() => () => {
    if (tooltipTimerRef.current) clearTimeout(tooltipTimerRef.current);
  }, []);

  // ── Send a command to Monaco ─────────────────────────────────────────────
  const sendToEditor = useCallback((type: string, extra: object = {}) => {
    const msg = JSON.stringify({ type, ...extra });
    webViewRef.current?.injectJavaScript(
      `window.dispatchEvent(new MessageEvent('message',{data:${JSON.stringify(msg)}}));true;`,
    );
  }, []);

  // ── Send content to Monaco when active tab changes ───────────────────────
  useEffect(() => {
    if (!editorReady || !activeTab) return;
    const hasScrollIntent = !!activeTab.scrollTo;
    if (loadedPathRef.current === activeTab.path && !hasScrollIntent) return;
    if (loadedPathRef.current !== activeTab.path) {
      loadedPathRef.current = activeTab.path;
    }

    const msg = JSON.stringify({
      type: 'setContent',
      content: activeTab.content,
      language: activeTab.language,
      resetView: true,
      rules: getLanguageRules(activeTab.language),
      scrollTo: activeTab.scrollTo ?? null,
    });
    webViewRef.current?.injectJavaScript(
      `window.dispatchEvent(new MessageEvent('message',{data:${JSON.stringify(msg)}}));true;`,
    );
    if (activeTab.scrollTo) {
      onTabScrollConsumed?.(activeTab.path);
    }
    if (activeTab.viewState) {
      setTimeout(() => {
        sendToEditor('RESTORE_VIEW_STATE', { viewState: activeTab.viewState });
      }, 50);
    }
  }, [editorReady, activeTab, onTabScrollConsumed, sendToEditor]);

  // ── Apply Monaco theme when editor is ready or theme changes ─────────────
  useEffect(() => {
    if (!editorReady) return;
    webViewRef.current?.injectJavaScript(
      `if(typeof monaco!=='undefined'){monaco.editor.setTheme(${JSON.stringify(monacoTheme)});}true;`,
    );
  }, [editorReady, monacoTheme]);

  // ── Messages from Monaco ─────────────────────────────────────────────────
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
          case 'fontSizeChanged':
            setFontSize(msg.fontSize);
            break;
          case 'SAVE_VIEW_STATE':
            if (msg.viewState && msg.path) {
              onTabViewStateChange?.(msg.path, msg.viewState);
            }
            break;
        }
      } catch { /* ignore */ }
    },
    [activeTabPath, onContentChange, onSave, setFontSize, onTabViewStateChange],
  );

  // ── Expose imperative handle (fold commands, view state) ─────────────────
  useImperativeHandle(ref, () => ({
    sendFoldAll: () => sendToEditor('FOLD_ALL'),
    sendUnfoldAll: () => sendToEditor('UNFOLD_ALL'),
    requestViewStateSave: (path: string) => sendToEditor('REQUEST_VIEW_STATE', { path }),
  }), [sendToEditor]);

  // ── Toolbar action dispatcher ────────────────────────────────────────────
  const handleToolbarAction = useCallback(
    (item: ToolbarItem) => {
      if (item.action === 'multicursor') {
        const next = !multiCursor;
        setMultiCursor(next);
        sendToEditor('setAddCursorMode', { active: next });
        if (!next) sendToEditor('clearCursors');
      } else if (item.action === 'preview') {
        setShowPreview((v) => !v);
      } else {
        sendToEditor(item.action);
      }
    },
    [multiCursor, sendToEditor],
  );

  const changeFontSize = useCallback(
    (delta: number) => {
      const next = Math.min(32, Math.max(8, fontSize + delta));
      setFontSize(next);
      sendToEditor('setFontSize', { fontSize: next });
    },
    [fontSize, setFontSize, sendToEditor],
  );

  const exitMultiCursor = useCallback(() => {
    setMultiCursor(false);
    sendToEditor('setAddCursorMode', { active: false });
    sendToEditor('clearCursors');
  }, [sendToEditor]);

  // ── Dynamic styles using theme tokens ────────────────────────────────────
  const styles = useMemo(() => makeStyles(t), [t]);

  // ── Empty state ───────────────────────────────────────────────────────────
  if (tabs.length === 0) {
    return (
      <KeyboardAvoidingView
        testID="editor-keyboard-avoiding-view"
        style={styles.empty}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0} // Update when navigation header is added
      >
        <Text style={styles.emptyIcon}>{'>_'}</Text>
        <Text style={styles.emptyTitle}>No file open</Text>
        <Text style={styles.emptyHint}>Select a file from the Explorer</Text>
      </KeyboardAvoidingView>
    );
  }

  const previewHtml = (showPreview && activeTab && previewEnabled)
    ? buildPreviewHtml(activeTab.language, activeTab.content, t)
    : null;

  return (
    <KeyboardAvoidingView
      testID="editor-keyboard-avoiding-view"
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >

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

      {/* ── Path breadcrumb — shows the last 3 meaningful path segments ── */}
      {activeTab && (
        <View testID="editor-path-breadcrumb" style={styles.pathBar}>
          <Text style={styles.pathText} numberOfLines={1}>
            {activeTab.path
              .replace(/^file:\/\//, '')       // strip file:// scheme
              .split('/')
              .filter(Boolean)
              .slice(-3)                        // grandparent › parent › file
              .join(' › ')}
          </Text>
        </View>
      )}

      {/* ── Editor + optional preview split ── */}
      <View style={styles.editorArea}>
        {/* Monaco pane */}
        <View style={[styles.monacoPane, previewHtml ? styles.split : styles.full]}>
          {(!editorReady || !monacoHtml) && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator color={t.accent} size="small" />
              <Text style={styles.loadingText}>
                {isOffline ? 'Loading editor (offline)…' : 'Loading editor…'}
              </Text>
            </View>
          )}
          {monacoHtml && (
            <WebView
              ref={webViewRef}
              source={{ html: monacoHtml }}
              onMessage={handleMessage}
              style={styles.webView}
              javaScriptEnabled
              domStorageEnabled
              allowFileAccess
              allowFileAccessFromFileURLs
              originWhitelist={['file://', 'about:*']}
              keyboardDisplayRequiresUserAction={false}
              bounces={false}
              scrollEnabled={false}
            />
          )}
        </View>

        {/* Preview pane */}
        {previewHtml && (
          <View style={styles.previewPane}>
            <View style={styles.previewHeader}>
              <Text style={styles.previewHeaderText}>PREVIEW</Text>
            </View>
            <WebView
              source={{ html: previewHtml }}
              style={styles.webView}
              javaScriptEnabled
              originWhitelist={['about:*', 'data:*']}
              bounces={false}
            />
          </View>
        )}
      </View>

      {/* ── Tooltip strip (shown on hover or long-press) ── */}
      {tooltipId !== null && (
        <View testID="toolbar-tooltip" style={styles.tooltipStrip} pointerEvents="none">
          <Text style={styles.tooltipText} numberOfLines={1}>
            {TOOLTIP_LABELS[tooltipId] ?? ''}
          </Text>
        </View>
      )}

      {/* ── Mobile toolbar ── */}
      <View style={styles.toolbar}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.toolbarContent}
          bounces={false}
        >
          {/* Font size A- / size / A+ */}
          <Pressable
            style={styles.toolbarBtn}
            onPress={() => changeFontSize(-1)}
            onHoverIn={() => showTooltip(FONT_DEC_ID)}
            onHoverOut={hideTooltip}
            onLongPress={() => showTooltipTemp(FONT_DEC_ID)}
            hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
            accessibilityLabel="Decrease font size"
          >
            <Text style={styles.toolbarIcon}>A-</Text>
          </Pressable>
          <Text style={styles.toolbarFontSize}>{fontSize}</Text>
          <Pressable
            style={styles.toolbarBtn}
            onPress={() => changeFontSize(+1)}
            onHoverIn={() => showTooltip(FONT_INC_ID)}
            onHoverOut={hideTooltip}
            onLongPress={() => showTooltipTemp(FONT_INC_ID)}
            hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
            accessibilityLabel="Increase font size"
          >
            <Text style={styles.toolbarIcon}>A+</Text>
          </Pressable>

          <View style={styles.toolbarDivider} />

          {TOOLBAR_ITEMS.map((item) => {
            const isActive =
              (item.id === 'multicursor' && multiCursor) ||
              (item.id === 'preview' && showPreview);
            const isDisabled = item.id === 'preview' && !previewEnabled;

            return (
              <Pressable
                key={item.id}
                style={[
                  styles.toolbarBtn,
                  isActive && styles.toolbarBtnActive,
                  isDisabled && styles.toolbarBtnDisabled,
                ]}
                onPress={() => !isDisabled && handleToolbarAction(item)}
                onHoverIn={() => showTooltip(item.id)}
                onHoverOut={hideTooltip}
                onLongPress={() => showTooltipTemp(item.id)}
                hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
                accessibilityLabel={item.title}
              >
                <Text style={[
                  styles.toolbarIcon,
                  isActive && styles.toolbarIconActive,
                  isDisabled && styles.toolbarIconDisabled,
                ]}>
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Multi-cursor active badge */}
        {multiCursor && (
          <View style={styles.mcBadge}>
            <Text style={styles.mcBadgeText}>+ CURSOR</Text>
            <TouchableOpacity
              onPress={exitMultiCursor}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.mcBadgeClose}>✕</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </KeyboardAvoidingView>
  );
});

Editor.displayName = 'Editor';
export default Editor;

// ---------------------------------------------------------------------------
// Styles — generated from theme tokens
// ---------------------------------------------------------------------------

const TAB_HEIGHT     = 36;
const TOOLBAR_HEIGHT = 40;

function makeStyles(t: ThemeTokens) {
  return StyleSheet.create({
    container:      { flex: 1, backgroundColor: t.bg },
    // Tab bar
    tabBar: {
      height: TAB_HEIGHT, backgroundColor: t.bgElevated, flexGrow: 0,
      borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.bg,
    },
    tabBarContent:  { alignItems: 'stretch' },
    tab: {
      flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12,
      height: TAB_HEIGHT, borderRightWidth: StyleSheet.hairlineWidth,
      borderRightColor: t.bg, minWidth: 80, maxWidth: 360,
    },
    tabActive: {
      backgroundColor: t.bg, borderBottomWidth: 2, borderBottomColor: t.accent,
    },
    tabLabel:       { color: t.textMuted, fontSize: 12, flexShrink: 1 },
    tabLabelActive: { color: t.text },
    tabCloseHit:    { marginLeft: 6, alignItems: 'center', justifyContent: 'center' },
    tabCloseIcon:   { color: t.textMuted, fontSize: 16, lineHeight: 16 },
    // Editor + preview
    editorArea:     { flex: 1, flexDirection: 'row' },
    monacoPane:     { backgroundColor: t.bg },
    full:           { flex: 1 },
    split:          { flex: 1 },
    previewPane: {
      flex: 1, borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: t.border,
    },
    previewHeader: {
      height: 28, backgroundColor: t.bgElevated,
      borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.border,
      justifyContent: 'center', paddingHorizontal: 10,
    },
    previewHeaderText: { color: t.textMuted, fontSize: 10, fontWeight: '600', letterSpacing: 1 },
    webView:        { flex: 1, backgroundColor: t.bg },
    loadingOverlay: {
      ...StyleSheet.absoluteFillObject, backgroundColor: t.bg,
      alignItems: 'center', justifyContent: 'center', gap: 12, zIndex: 1,
    },
    loadingText:    { color: t.textMuted, fontSize: 13 },
    // Tooltip strip (appears above toolbar on hover / long-press)
    tooltipStrip: {
      height: 22, backgroundColor: t.bgElevated,
      borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.border,
      justifyContent: 'center', paddingHorizontal: 12,
    },
    tooltipText: { color: t.accent, fontSize: 11, fontStyle: 'italic' },
    // Mobile toolbar
    toolbar: {
      height: TOOLBAR_HEIGHT, backgroundColor: t.bgElevated, flexDirection: 'row',
      alignItems: 'center', borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: t.border,
    },
    toolbarContent: { alignItems: 'center', paddingHorizontal: 8, gap: 2 },
    toolbarBtn: {
      height: 32, minWidth: 32, paddingHorizontal: 8,
      alignItems: 'center', justifyContent: 'center', borderRadius: 4,
    },
    toolbarBtnActive:   { backgroundColor: t.accent + '33' },
    toolbarBtnDisabled: { opacity: 0.3 },
    toolbarIcon:        { color: t.textMuted, fontSize: 14, fontWeight: '500' },
    toolbarIconActive:  { color: t.accent },
    toolbarIconDisabled:{ color: t.border },
    toolbarFontSize:    { color: t.textMuted, fontSize: 11, minWidth: 20, textAlign: 'center' },
    toolbarDivider: {
      width: StyleSheet.hairlineWidth, height: 20,
      backgroundColor: t.border, marginHorizontal: 4,
    },
    mcBadge: {
      flexDirection: 'row', alignItems: 'center', backgroundColor: t.accent,
      paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4,
      marginRight: 8, gap: 6,
    },
    mcBadgeText:  { color: '#FFF', fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
    mcBadgeClose: { color: '#FFF', fontSize: 12 },
    // Path breadcrumb
    pathBar: {
      height: 22,
      backgroundColor: t.bg,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.border,
      justifyContent: 'center',
      paddingHorizontal: 12,
    },
    pathText: { color: t.textMuted, fontSize: 11 },
    // Empty state
    empty:      { flex: 1, backgroundColor: t.bg, alignItems: 'center', justifyContent: 'center', gap: 8 },
    emptyIcon:  { color: t.accent, fontSize: 36, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', opacity: 0.6 },
    emptyTitle: { color: t.textMuted, fontSize: 16, fontWeight: '600' },
    emptyHint:  { color: t.border, fontSize: 12 },
  });
}
