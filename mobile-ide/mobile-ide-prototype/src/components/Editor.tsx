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
import { buildMonacoHtml, MonacoAssetManager } from '../utils/MonacoAssetManager';

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

/** File types that support a rendered preview alongside the editor. */
const PREVIEWABLE = new Set(['markdown', 'html', 'json']);

export function canPreview(language: string): boolean {
  return PREVIEWABLE.has(language);
}

// ---------------------------------------------------------------------------
// Preview HTML builders
// ---------------------------------------------------------------------------

function buildMarkdownPreviewHtml(markdown: string): string {
  const safe = JSON.stringify(markdown);
  return `<!DOCTYPE html><html><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  body{font:15px/1.6 -apple-system,sans-serif;color:#e2e8f0;background:#0f172a;
       padding:16px 20px;margin:0;}
  h1,h2,h3,h4{color:#f1f5f9;margin:1em 0 .4em;}
  a{color:#60a5fa;}
  pre{background:#1e293b;border-radius:6px;padding:12px;overflow-x:auto;}
  code{font-family:'JetBrains Mono',monospace;font-size:13px;color:#7dd3fc;}
  pre code{color:#e2e8f0;}
  blockquote{border-left:3px solid #334155;margin:0;padding-left:16px;color:#94a3b8;}
  table{border-collapse:collapse;width:100%;}
  th,td{border:1px solid #334155;padding:6px 10px;text-align:left;}
  th{background:#1e293b;}
  img{max-width:100%;}
  hr{border:none;border-top:1px solid #334155;}
</style>
</head><body>
<div id="out">Rendering…</div>
<script src="https://cdn.jsdelivr.net/npm/marked@12/marked.min.js"></script>
<script>document.getElementById('out').innerHTML=marked.parse(${safe});</script>
</body></html>`;
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

function buildJsonPreviewHtml(jsonSource: string): string {
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
  body{font:13px/1.5 'JetBrains Mono',monospace;background:#0f172a;color:#e2e8f0;
       padding:12px;margin:0;}
  details>summary{cursor:pointer;list-style:none;outline:none;user-select:none;}
  details>summary::-webkit-details-marker{display:none;}
  .item,.row{padding-left:16px;border-left:1px solid #1e293b;}
  .key{color:#93c5fd;} .str{color:#86efac;} .num{color:#fbbf24;}
  .bool{color:#f472b6;} .null{color:#94a3b8;} .arr,.obj{color:#7dd3fc;}
  .err{color:#f87171;white-space:pre-wrap;} pre{margin:0;}
</style>
</head><body>${content}</body></html>`;
}

export function buildPreviewHtml(language: string, content: string): string {
  switch (language) {
    case 'markdown': return buildMarkdownPreviewHtml(content);
    case 'html':     return buildHtmlPreviewHtml(content);
    case 'json':     return buildJsonPreviewHtml(content);
    default:         return '<body style="background:#0f172a;color:#94a3b8;padding:16px">No preview available</body>';
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

const TOOLBAR_ITEMS: ToolbarItem[] = [
  { id: 'undo',        label: '↩',   title: 'Undo',             action: 'undo' },
  { id: 'redo',        label: '↪',   title: 'Redo',             action: 'redo' },
  { id: 'dedent',      label: '⇤',   title: 'Decrease indent',  action: 'dedent' },
  { id: 'indent',      label: '⇥',   title: 'Increase indent',  action: 'indent' },
  { id: 'comment',     label: '//',  title: 'Toggle comment',   action: 'comment' },
  { id: 'find',        label: '⌕',   title: 'Find & replace',  action: 'findReplace' },
  { id: 'format',      label: '✦',   title: 'Format document',  action: 'format' },
  { id: 'select',      label: '⊞',   title: 'Select all',       action: 'selectAll' },
  { id: 'multicursor', label: '⊕',   title: 'Add cursor mode',  action: 'multicursor', toggle: true },
  { id: 'preview',     label: '👁',  title: 'Toggle preview',   action: 'preview',     toggle: true },
];

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
  const webViewRef    = useRef<WebView>(null);
  const loadedPathRef = useRef<string | null>(null);

  const [editorReady, setEditorReady] = useState(false);
  const [monacoHtml,  setMonacoHtml]  = useState<string | null>(null);
  const [isOffline,   setIsOffline]   = useState(false);
  const [multiCursor, setMultiCursor] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [fontSize,    setFontSize]    = useState(14);

  const activeTab      = tabs.find((t) => t.path === activeTabPath) ?? null;
  const previewEnabled = activeTab ? canPreview(activeTab.language) : false;

  // ── Resolve Monaco source (CDN or local cache) on mount ─────────────────
  useEffect(() => {
    MonacoAssetManager.resolve().then(({ baseUrl, isOffline: offline }) => {
      setMonacoHtml(buildMonacoHtml(baseUrl));
      setIsOffline(offline);
    });
  }, []);

  // ── Send content to Monaco when active tab changes ───────────────────────
  useEffect(() => {
    if (!editorReady || !activeTab) return;
    if (loadedPathRef.current === activeTab.path) return;
    loadedPathRef.current = activeTab.path;

    const msg = JSON.stringify({
      type: 'setContent',
      content: activeTab.content,
      language: activeTab.language,
      resetView: true,
    });
    webViewRef.current?.injectJavaScript(
      `window.dispatchEvent(new MessageEvent('message',{data:${JSON.stringify(msg)}}));true;`,
    );
  }, [editorReady, activeTab?.path]);

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
        }
      } catch { /* ignore */ }
    },
    [activeTabPath, onContentChange, onSave],
  );

  // ── Send a command to Monaco ─────────────────────────────────────────────
  const sendToEditor = useCallback((type: string, extra: object = {}) => {
    const msg = JSON.stringify({ type, ...extra });
    webViewRef.current?.injectJavaScript(
      `window.dispatchEvent(new MessageEvent('message',{data:${JSON.stringify(msg)}}));true;`,
    );
  }, []);

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
    [fontSize, sendToEditor],
  );

  const exitMultiCursor = useCallback(() => {
    setMultiCursor(false);
    sendToEditor('setAddCursorMode', { active: false });
    sendToEditor('clearCursors');
  }, [sendToEditor]);

  // ── Empty state ───────────────────────────────────────────────────────────
  if (tabs.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyTitle}>No files open</Text>
        <Text style={styles.emptyHint}>Select a file from the Explorer</Text>
      </View>
    );
  }

  const previewHtml = (showPreview && activeTab && previewEnabled)
    ? buildPreviewHtml(activeTab.language, activeTab.content)
    : null;

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

      {/* ── Editor + optional preview split ── */}
      <View style={styles.editorArea}>
        {/* Monaco pane */}
        <View style={[styles.monacoPane, previewHtml ? styles.split : styles.full]}>
          {(!editorReady || !monacoHtml) && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator color="#2563EB" size="small" />
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
              allowUniversalAccessFromFileURLs
              originWhitelist={['*']}
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
              originWhitelist={['*']}
              bounces={false}
            />
          </View>
        )}
      </View>

      {/* ── Mobile toolbar ── */}
      <View style={styles.toolbar}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.toolbarContent}
          bounces={false}
        >
          {/* Font size A- / size / A+ */}
          <TouchableOpacity
            style={styles.toolbarBtn}
            onPress={() => changeFontSize(-1)}
            hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
          >
            <Text style={styles.toolbarIcon}>A-</Text>
          </TouchableOpacity>
          <Text style={styles.toolbarFontSize}>{fontSize}</Text>
          <TouchableOpacity
            style={styles.toolbarBtn}
            onPress={() => changeFontSize(+1)}
            hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
          >
            <Text style={styles.toolbarIcon}>A+</Text>
          </TouchableOpacity>

          <View style={styles.toolbarDivider} />

          {TOOLBAR_ITEMS.map((item) => {
            const isActive =
              (item.id === 'multicursor' && multiCursor) ||
              (item.id === 'preview' && showPreview);
            const isDisabled = item.id === 'preview' && !previewEnabled;

            return (
              <TouchableOpacity
                key={item.id}
                style={[
                  styles.toolbarBtn,
                  isActive && styles.toolbarBtnActive,
                  isDisabled && styles.toolbarBtnDisabled,
                ]}
                onPress={() => !isDisabled && handleToolbarAction(item)}
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
              </TouchableOpacity>
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
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const TAB_HEIGHT     = 36;
const TOOLBAR_HEIGHT = 40;

const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: '#1E1E1E' },
  // Tab bar
  tabBar: {
    height: TAB_HEIGHT, backgroundColor: '#252526', flexGrow: 0,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#1E1E1E',
  },
  tabBarContent:  { alignItems: 'stretch' },
  tab: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12,
    height: TAB_HEIGHT, borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: '#1E1E1E', maxWidth: 180, minWidth: 80,
  },
  tabActive: {
    backgroundColor: '#1E1E1E', borderBottomWidth: 2, borderBottomColor: '#2563EB',
  },
  tabLabel:       { color: '#9DA5B4', fontSize: 12, flex: 1 },
  tabLabelActive: { color: '#CDD6F4' },
  tabCloseHit:    { marginLeft: 6, alignItems: 'center', justifyContent: 'center' },
  tabCloseIcon:   { color: '#6B7280', fontSize: 16, lineHeight: 16 },
  // Editor + preview
  editorArea:     { flex: 1, flexDirection: 'row' },
  monacoPane:     { backgroundColor: '#1E1E1E' },
  full:           { flex: 1 },
  split:          { flex: 1 },
  previewPane: {
    flex: 1, borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: '#334155',
  },
  previewHeader: {
    height: 28, backgroundColor: '#1E293B',
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#334155',
    justifyContent: 'center', paddingHorizontal: 10,
  },
  previewHeaderText: { color: '#64748B', fontSize: 10, fontWeight: '600', letterSpacing: 1 },
  webView:        { flex: 1, backgroundColor: '#1E1E1E' },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject, backgroundColor: '#1E1E1E',
    alignItems: 'center', justifyContent: 'center', gap: 12, zIndex: 1,
  },
  loadingText:    { color: '#6B7280', fontSize: 13 },
  // Mobile toolbar
  toolbar: {
    height: TOOLBAR_HEIGHT, backgroundColor: '#1E293B', flexDirection: 'row',
    alignItems: 'center', borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#334155',
  },
  toolbarContent: { alignItems: 'center', paddingHorizontal: 8, gap: 2 },
  toolbarBtn: {
    height: 32, minWidth: 32, paddingHorizontal: 8,
    alignItems: 'center', justifyContent: 'center', borderRadius: 4,
  },
  toolbarBtnActive:   { backgroundColor: '#2563EB33' },
  toolbarBtnDisabled: { opacity: 0.3 },
  toolbarIcon:        { color: '#94A3B8', fontSize: 14, fontWeight: '500' },
  toolbarIconActive:  { color: '#60A5FA' },
  toolbarIconDisabled:{ color: '#4B5563' },
  toolbarFontSize:    { color: '#64748B', fontSize: 11, minWidth: 20, textAlign: 'center' },
  toolbarDivider: {
    width: StyleSheet.hairlineWidth, height: 20,
    backgroundColor: '#334155', marginHorizontal: 4,
  },
  mcBadge: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#2563EB',
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4,
    marginRight: 8, gap: 6,
  },
  mcBadgeText:  { color: '#FFF', fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  mcBadgeClose: { color: '#FFF', fontSize: 12 },
  // Empty state
  empty:      { flex: 1, backgroundColor: '#1E1E1E', alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { color: '#4B5563', fontSize: 16 },
  emptyHint:  { color: '#374151', fontSize: 13, marginTop: 8 },
});
