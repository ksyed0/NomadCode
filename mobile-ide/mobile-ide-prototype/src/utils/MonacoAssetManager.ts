/**
 * MonacoAssetManager — offline Monaco editor asset cache.
 *
 * Strategy (cache-first):
 *   1. Check if Monaco loader + main bundle are cached in documentDirectory.
 *   2. If cached → generate HTML pointing to file:// URIs (fully offline).
 *   3. If not cached → generate HTML pointing to CDN; cache in background.
 *
 * The two critical files that must be cached for offline operation are:
 *   vs/loader.js           (~16 KB)   AMD loader
 *   vs/editor/editor.main.js  (~2.5 MB)  Full Monaco bundle (minified)
 *
 * Worker files (vs/base/worker/workerMain.js) are optional — Monaco degrades
 * gracefully to main-thread execution when workers are unavailable.
 *
 * Usage:
 *   const { baseUrl, isOffline } = await MonacoAssetManager.resolve();
 *   const html = buildMonacoHtml(baseUrl);
 *
 * To pre-download for offline use (e.g., from a settings screen):
 *   await MonacoAssetManager.downloadForOffline((pct) => setProgress(pct));
 */

import * as ExpoFS from 'expo-file-system/legacy';
import { ThemeId, THEMES } from '../theme/tokens';
import { ALL_MONACO_THEMES } from '../theme/monacoThemes';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const MONACO_VERSION = '0.45.0';
const CDN_BASE = `https://cdn.jsdelivr.net/npm/monaco-editor@${MONACO_VERSION}/min/vs`;

function localDir(): string {
  return `${ExpoFS.documentDirectory ?? '/'}monaco/${MONACO_VERSION}/vs/`;
}

/** Files required for basic offline operation (relative to vs/ directory). */
const CORE_FILES = [
  'loader.js',
  'editor/editor.main.js',
  'editor/editor.main.nls.js',
  'base/worker/workerMain.js',
];

const PRETTIER_VERSION = '3.5.3';
const PRETTIER_CDN_BASE = `https://cdn.jsdelivr.net/npm/prettier@${PRETTIER_VERSION}`;
const PRETTIER_CACHE_DIR = () => `${ExpoFS.documentDirectory ?? '/'}prettier/${PRETTIER_VERSION}/`;

const PRETTIER_FILES = [
  { remote: `${PRETTIER_CDN_BASE}/standalone.js`,         local: 'standalone.js' },
  { remote: `${PRETTIER_CDN_BASE}/plugins/babel.js`,      local: 'plugins/babel.js' },
  { remote: `${PRETTIER_CDN_BASE}/plugins/typescript.js`, local: 'plugins/typescript.js' },
  { remote: `${PRETTIER_CDN_BASE}/plugins/postcss.js`,    local: 'plugins/postcss.js' },
  { remote: `${PRETTIER_CDN_BASE}/plugins/html.js`,       local: 'plugins/html.js' },
  { remote: `${PRETTIER_CDN_BASE}/plugins/markdown.js`,   local: 'plugins/markdown.js' },
  { remote: `${PRETTIER_CDN_BASE}/plugins/estree.js`,     local: 'plugins/estree.js' },
];

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface MonacoSource {
  /** Base URL for the vs/ directory (either CDN or file://) */
  baseUrl: string;
  /** True when serving from the local cache */
  isOffline: boolean;
}

export const MonacoAssetManager = {
  /**
   * Resolve the best available Monaco source.
   * Returns local cache if available, CDN otherwise.
   */
  async resolve(): Promise<MonacoSource> {
    const loaderPath = `${localDir()}loader.js`;
    const mainPath = `${localDir()}editor/editor.main.js`;

    try {
      const [loaderInfo, mainInfo] = await Promise.all([
        ExpoFS.getInfoAsync(loaderPath),
        ExpoFS.getInfoAsync(mainPath),
      ]);

      if (loaderInfo.exists && mainInfo.exists) {
        return { baseUrl: localDir(), isOffline: true };
      }
    } catch {
      // Fall through to CDN
    }

    return { baseUrl: CDN_BASE, isOffline: false };
  },

  /** Returns true if all core files are locally cached. */
  async isOfflineAvailable(): Promise<boolean> {
    try {
      const checks = await Promise.all(
        CORE_FILES.map((f) => ExpoFS.getInfoAsync(`${localDir()}${f}`)),
      );
      return checks.every((info) => info.exists);
    } catch {
      return false;
    }
  },

  /**
   * Download Monaco core files to the local cache.
   * @param onProgress Called with a 0–100 progress percentage.
   */
  async downloadForOffline(onProgress?: (pct: number) => void): Promise<void> {
    const dir = localDir();

    for (let i = 0; i < CORE_FILES.length; i++) {
      const file = CORE_FILES[i];
      const dest = `${dir}${file}`;
      const destDir = dest.substring(0, dest.lastIndexOf('/'));

      await ExpoFS.makeDirectoryAsync(destDir, { intermediates: true });
      await ExpoFS.downloadAsync(`${CDN_BASE}/${file}`, dest);

      onProgress?.(Math.round(((i + 1) / CORE_FILES.length) * 100));
    }
  },

  /** Delete all cached Monaco files (frees ~3 MB). */
  async clearCache(): Promise<void> {
    const base = `${ExpoFS.documentDirectory ?? '/'}monaco/`;
    await ExpoFS.deleteAsync(base, { idempotent: true });
  },

  /** Returns the local cache directory path (for debugging). */
  get cacheDir(): string {
    return localDir();
  },

  /**
   * Load Prettier standalone + plugins as a single concatenated JS string.
   * Uses a local cache in documentDirectory/prettier/{version}/; downloads
   * from the CDN on first use and serves from cache thereafter.
   * Returns null on any error (Prettier will simply not be available).
   */
  async loadPrettierSource(): Promise<string | null> {
    try {
      const dir = PRETTIER_CACHE_DIR();
      await ExpoFS.makeDirectoryAsync(dir + 'plugins/', { intermediates: true }).catch(() => {});

      const parts: string[] = [];
      for (const f of PRETTIER_FILES) {
        const localPath = dir + f.local;
        let content: string;
        const info = await ExpoFS.getInfoAsync(localPath);
        if (info.exists) {
          content = await ExpoFS.readAsStringAsync(localPath);
        } else {
          const resp = await ExpoFS.downloadAsync(f.remote, localPath);
          content = await ExpoFS.readAsStringAsync(resp.uri);
        }
        parts.push(content);
      }
      return parts.join('\n;\n');
    } catch {
      return null;
    }
  },
};

// ---------------------------------------------------------------------------
// HTML builder — parameterised by base URL so it works both online and offline.
// ---------------------------------------------------------------------------

/**
 * Build the self-contained Monaco HTML string.
 *
 * @param vsBaseUrl  URL of the vs/ directory:
 *                   - CDN:    "https://cdn.jsdelivr.net/npm/monaco-editor@0.45.0/min/vs"
 *                   - Local:  "file:///path/to/documentDirectory/monaco/0.45.0/vs"
 */
export function buildMonacoHtml(vsBaseUrl: string, initialTheme: ThemeId = 'nomad-dark', prettierSource?: string): string {
  // Safely embed the URL in JS (no injection vector since it's our own constant)
  const safeBase = JSON.stringify(vsBaseUrl);
  const safeTheme = JSON.stringify(initialTheme);
  // Match the chrome (loading screen + body bg) to the editor theme so users
  // don't see a flash of the wrong colour while Monaco bootstraps.
  const isLight = THEMES[initialTheme].mode === 'light';
  const chromeBg = isLight ? '#ffffff' : '#1e1e1e';
  const chromeText = isLight ? '#374151' : '#6b7280';

  // Serialise all 11 theme definitions into JS that runs inside the Monaco WebView.
  const defineThemesScript = Object.entries(ALL_MONACO_THEMES)
    .map(([id, data]) =>
      `        monaco.editor.defineTheme(${JSON.stringify(id)}, ${JSON.stringify(data)});`)
    .join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body  { height: 100%; background: ${chromeBg}; overflow: hidden; }
    #container  { position: absolute; inset: 0; -webkit-user-select: text; user-select: text; }
    #loading    {
      position: absolute; inset: 0; display: flex; flex-direction: column;
      align-items: center; justify-content: center; gap: 12px;
      color: ${chromeText}; font: 13px/1 -apple-system, sans-serif; background: ${chromeBg};
    }
    #loading-bar-wrap { width: 160px; height: 3px; background: #1f2937; border-radius: 2px; }
    #loading-bar      { height: 100%; width: 0%; background: #2563eb; border-radius: 2px;
                        transition: width 0.2s ease; }

    /* ── Search match highlight ────────────────────────────────────────── */
    .search-match-highlight { background: rgba(37,99,235,0.4); border-radius: 2px; }

    /* ── Multi-cursor overlay ──────────────────────────────────────────── */
    #mc-overlay {
      display: none; position: absolute; inset: 0; z-index: 5;
      cursor: crosshair; background: transparent;
    }
    #mc-overlay.active { display: block; }

    /* ── Git gutter indicators ────────────────────────────────────────── */
    .gutter-added    { background: #22C55E; width: 3px !important; margin-left: 3px; border-radius: 1px; }
    .gutter-modified { background: #D97706; width: 3px !important; margin-left: 3px; border-radius: 1px; }
    .gutter-deleted::after { content: '▾'; color: #EF4444; font-size: 10px; line-height: 1; }

    /* ── Git blame annotations ───────────────────────────────────────── */
    .blame-annotation { color: #64748B; font-size: 11px; font-style: italic; margin-left: 24px; }
  </style>
</head>
<body>
  <div id="loading">
    <span>Loading editor…</span>
    <div id="loading-bar-wrap"><div id="loading-bar"></div></div>
  </div>
  <div id="container"></div>
  <div id="mc-overlay" title="Tap to place additional cursor — press ✕ to exit"></div>

  ${prettierSource ? `<script>${prettierSource}</script>` : '<!-- prettier not loaded -->'}
  <script src="${vsBaseUrl}/loader.js" onerror="onLoaderError()"></script>
  <script>
  (function () {
    'use strict';

    // ── Globals ────────────────────────────────────────────────────────────
    var editor;
    var currentFontSize = 14;
    var addCursorMode   = false;
    var mcOverlay       = document.getElementById('mc-overlay');
    var PARSER_MAP = {
      typescript: 'typescript', javascript: 'babel',
      css: 'css', scss: 'css', html: 'html', markdown: 'markdown', json: 'json'
    };
    var formatOnSave = false;
    var prettierConfig = {};

    function formatRelTime(ms) {
      var diff = Date.now() - ms;
      var m = Math.floor(diff / 60000);
      if (m < 1) return 'just now';
      if (m < 60) return m + 'm ago';
      var h = Math.floor(m / 60);
      if (h < 24) return h + 'h ago';
      return Math.floor(h / 24) + 'd ago';
    }

    // ── Snippet completion provider ────────────────────────────────────────────
    var snippetDisposables = {};
    function registerSnippets(snippets, currentLanguage) {
      Object.values(snippetDisposables).forEach(function(d) { if (d && d.dispose) d.dispose(); });
      snippetDisposables = {};
      if (!snippets || !snippets.length) return;
      var byLang = {};
      snippets.forEach(function(s) {
        var langs = s.language === 'all' ? [currentLanguage] : [s.language];
        langs.forEach(function(lang) {
          if (!byLang[lang]) byLang[lang] = [];
          byLang[lang].push(s);
        });
      });
      Object.keys(byLang).forEach(function(lang) {
        snippetDisposables[lang] = monaco.languages.registerCompletionItemProvider(lang, {
          provideCompletionItems: function() {
            return {
              suggestions: byLang[lang].map(function(s) {
                return {
                  label: s.prefix,
                  kind: monaco.languages.CompletionItemKind.Snippet,
                  documentation: s.description,
                  insertText: s.body,
                  insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                };
              }),
            };
          },
        });
      });
    }

    // ── Prettier format helper ─────────────────────────────────────────────
    async function runPrettier() {
      if (typeof prettier === 'undefined' || !prettier || !editor) return false;
      var model = editor.getModel();
      if (!model) return false;
      var langId = model.getLanguageId();
      var parser = PARSER_MAP[langId];
      if (!parser) return false;
      try {
        var content = editor.getValue();
        var plugins = typeof prettierPlugins !== 'undefined' ? Object.values(prettierPlugins || {}) : [];
        var formatted = await prettier.format(content, Object.assign({}, prettierConfig, { parser: parser, plugins: plugins }));
        if (formatted === content) return true;
        var fullRange = model.getFullModelRange();
        editor.executeEdits('prettier', [{ range: fullRange, text: formatted }]);
        return true;
      } catch (e) {
        return false;
      }
    }

    // ── Breadcrumb: symbol on cursor move (debounced 150ms) ───────────────────
    var breadcrumbTimer = null;
    var completionContextTimer = null;
    var pendingCompletion = null;
    // SYNC-NOTE: SYMBOL_PATTERNS_BC mirrors symbolExtractor.ts — update both when adding language patterns.
    var SYMBOL_PATTERNS_BC = [
      /^(?:export\\s+)?(?:default\\s+)?(?:async\\s+)?function\\s+(\\w+)/m,
      /^(?:export\\s+)?(?:abstract\\s+)?class\\s+(\\w+)/m,
      /^(?:export\\s+)?const\\s+(\\w+)\\s*=\\s*(?:async\\s+)?\\(/m,
      /^def\\s+(\\w+)/m,
      /^fn\\s+(\\w+)/m,
      /^func\\s+(\\w+)/m,
    ];
    function getSymbolForBreadcrumb(content, cursorLine) {
      var lines = content.split('\n').slice(0, cursorLine);
      var sliced = lines.join('\n');
      var lastMatch = null;
      var lastOffset = -1;
      for (var i = 0; i < SYMBOL_PATTERNS_BC.length; i++) {
        var gp = new RegExp(SYMBOL_PATTERNS_BC[i].source, 'gm');
        var m;
        while ((m = gp.exec(sliced)) !== null) {
          if (m.index > lastOffset) {
            lastOffset = m.index;
            lastMatch = m[1];
          }
        }
      }
      return lastMatch;
    }

    // ── Loader error fallback (offline → CDN) ─────────────────────────────
    function onLoaderError() {
      var s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/monaco-editor@${MONACO_VERSION}/min/vs/loader.js';
      s.onload = bootEditor;
      document.head.appendChild(s);
    }

    // ── Loading bar progress ───────────────────────────────────────────────
    function setLoadPct(pct) {
      document.getElementById('loading-bar').style.width = pct + '%';
    }
    setLoadPct(20);

    // ── Boot ──────────────────────────────────────────────────────────────
    function bootEditor() {
      require.config({ paths: { vs: ${safeBase} } });
      setLoadPct(50);

      require(['vs/editor/editor.main'], function () {
        setLoadPct(90);
        document.getElementById('loading').remove();

        // ── Register NomadCode custom themes ─────────────────────────────
${defineThemesScript}

        editor = monaco.editor.create(document.getElementById('container'), {
          value: '',
          language: 'plaintext',
          theme: ${safeTheme},
          fontSize: currentFontSize,
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
          scrollbar: { verticalScrollbarSize: 4, horizontalScrollbarSize: 4 },
          overviewRulerLanes: 0,
          // Code folding — gutter chevrons always visible
          folding: true,
          showFoldingControls: 'always',
          // Alt+click adds cursor on external keyboards
          multiCursorModifier: 'alt',
          // Needed for pointer-event pinch detection
          mouseWheelZoom: false,
        });

        // ── Content changes → RN ─────────────────────────────────────────
        editor.onDidChangeModelContent(function () {
          post({ type: 'contentChanged', content: editor.getValue() });

          if (completionContextTimer) clearTimeout(completionContextTimer);
          completionContextTimer = setTimeout(function () {
            var pos = editor.getPosition();
            if (!pos) return;
            var content = editor.getValue();
            var model = editor.getModel();
            var offset = model.getOffsetAt(pos);
            post({
              type: 'COMPLETION_CONTEXT',
              prefix: content.slice(0, offset),
              suffix: content.slice(offset),
              language: model.getLanguageId ? model.getLanguageId() : 'plaintext',
            });
          }, 100);
        });

        // ── Breadcrumb: post symbol on cursor position change ────────────
        editor.onDidChangeCursorPosition(function(e) {
          if (breadcrumbTimer) clearTimeout(breadcrumbTimer);
          breadcrumbTimer = setTimeout(function() {
            var content = editor.getValue();
            var line    = e.position.lineNumber;
            var symbol  = getSymbolForBreadcrumb(content, line);
            var pos     = editor.getPosition();
            var model   = editor.getModel();
            var word    = model ? model.getWordAtPosition(pos) : null;
            var lang    = model && model.getLanguageId ? model.getLanguageId() : 'plaintext';
            var isTsJs  = lang === 'typescript' || lang === 'javascript';

            var symbolAtCursor = {
              word:          word ? word.word : '',
              hasDefinition: false,
              canFindRefs:   !!(word && word.word.length > 1),
              position:      { line: pos.lineNumber, column: pos.column },
            };

            if (word && isTsJs) {
              var capturedLine = pos.lineNumber;
              var capturedCol  = pos.column;
              monaco.languages.typescript.getTypeScriptWorker()
                .then(function(worker) {
                  return worker.getDefinitionAtPosition(model.uri.toString(), model.getOffsetAt(pos));
                })
                .then(function(defs) { symbolAtCursor.hasDefinition = !!(defs && defs.length); })
                .catch(function() {})
                .finally(function() {
                  var cur = editor.getPosition();
                  if (cur && cur.lineNumber === capturedLine && cur.column === capturedCol) {
                    post({ type: 'BREADCRUMB_UPDATE', symbol: symbol, symbolAtCursor: symbolAtCursor });
                  }
                });
            } else {
              post({ type: 'BREADCRUMB_UPDATE', symbol: symbol, symbolAtCursor: symbolAtCursor });
            }
          }, 150);
        });

        // ── Cmd/Ctrl+S → save (with optional format-on-save) ─────────────
        editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, function () {
          if (formatOnSave) {
            runPrettier().then(function() {
              post({ type: 'save', content: editor.getValue() });
            });
          } else {
            post({ type: 'save', content: editor.getValue() });
          }
        });

        // ── Multi-cursor: click adds cursor when overlay is active ────────
        mcOverlay.addEventListener('click', function (e) {
          var target = editor.getTargetAtClientPoint(e.clientX, e.clientY);
          if (!target || !target.position) return;
          var pos = target.position;
          var existing = editor.getSelections() || [];
          existing.push(new monaco.Selection(
            pos.lineNumber, pos.column, pos.lineNumber, pos.column
          ));
          editor.setSelections(existing);
          editor.focus();
          post({ type: 'cursorAdded', count: existing.length });
        });

        // Android: Monaco's internal click handler doesn't reliably trigger
        // focus through React Native's WebView touch system. An explicit
        // pointerdown on the container ensures the soft keyboard appears.
        // window.focus() additionally requests Android View-level focus so that
        // hardware keyboard KeyEvents are routed to this WebView (not just IME).
        document.getElementById('container').addEventListener('pointerdown', function () {
          window.focus();
          editor.focus();
        }, { passive: true });

        // ── Context menu suppression (prevents iOS magnifier / Android menu) ──
        document.addEventListener('contextmenu', function(e) { e.preventDefault(); }, true);

        // ── Long-press detector (500ms) ───────────────────────────────────────
        var longPressTimer = null;
        var longPressStart = null;

        document.getElementById('container').addEventListener('touchstart', function(e) {
          if (e.touches.length !== 1) return;
          var touch = e.touches[0];
          longPressStart = { x: touch.clientX, y: touch.clientY };
          longPressTimer = setTimeout(function() {
            var target = editor.getTargetAtClientPoint(longPressStart.x, longPressStart.y);
            if (!target || !target.position) return;
            editor.setPosition(target.position);
            var m = editor.getModel();
            var word = m ? m.getWordAtPosition(target.position) : null;
            post({ type: 'LONG_PRESS', x: longPressStart.x, y: longPressStart.y,
                   word: word ? word.word : '' });
            longPressTimer = null;
          }, 500);
        }, { passive: true });

        ['touchmove', 'touchend'].forEach(function(evt) {
          document.getElementById('container').addEventListener(evt, function() {
            if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
          }, { passive: true });
        });

        // ── ⌘Click detector ───────────────────────────────────────────────────
        editor.onMouseDown(function(e) {
          if (e.event.metaKey && e.target && e.target.position) {
            var m = editor.getModel();
            var word = m ? m.getWordAtPosition(e.target.position) : null;
            post({ type: 'CMD_CLICK_SYMBOL', x: e.event.clientX, y: e.event.clientY,
                   word: word ? word.word : '' });
          }
        });

        // ── Inline completions provider ──────────────────────────────────
        monaco.languages.registerInlineCompletionsProvider({ pattern: '**' }, {
          provideInlineCompletions: function (model, position) {
            if (!pendingCompletion) return { items: [] };
            return {
              items: [{
                insertText: pendingCompletion,
                range: new monaco.Range(
                  position.lineNumber, position.column,
                  position.lineNumber, position.column
                )
              }]
            };
          },
          freeInlineCompletions: function () { pendingCompletion = null; }
        });

        post({ type: 'ready', offline: ${safeBase}.startsWith('file') });
        setLoadPct(100);
      });
    }

    if (typeof require !== 'undefined') {
      bootEditor();
    }
    // If loader.js failed synchronously, onLoaderError() will call bootEditor.

    // ── Pinch-to-zoom (Pointer Events API) ────────────────────────────────
    var pointers = {};
    var pinchDist0 = 0;
    var fontSize0  = currentFontSize;

    document.addEventListener('pointerdown', function (e) {
      pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
      var ids = Object.keys(pointers);
      if (ids.length === 2) {
        var a = pointers[ids[0]], b = pointers[ids[1]];
        pinchDist0 = Math.hypot(b.x - a.x, b.y - a.y);
        fontSize0  = currentFontSize;
      }
    }, { passive: true });

    document.addEventListener('pointermove', function (e) {
      if (!pointers[e.pointerId]) return;
      pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
      var ids = Object.keys(pointers);
      if (ids.length !== 2 || pinchDist0 === 0) return;

      var a = pointers[ids[0]], b = pointers[ids[1]];
      var dist  = Math.hypot(b.x - a.x, b.y - a.y);
      var scale = dist / pinchDist0;
      var next  = Math.min(32, Math.max(8, Math.round(fontSize0 * scale)));

      if (next !== currentFontSize && editor) {
        currentFontSize = next;
        editor.updateOptions({ fontSize: currentFontSize });
        post({ type: 'fontSizeChanged', fontSize: currentFontSize });
      }
    }, { passive: true });

    document.addEventListener('pointerup', function (e) {
      delete pointers[e.pointerId];
      if (Object.keys(pointers).length < 2) { pinchDist0 = 0; }
    }, { passive: true });

    document.addEventListener('pointercancel', function (e) {
      delete pointers[e.pointerId];
      pinchDist0 = 0;
    }, { passive: true });

    // ── Messages from React Native ────────────────────────────────────────
    window.addEventListener('message', function (e) {
      try {
        var msg = JSON.parse(e.data);
        if (!editor && msg.type !== 'ping') return;

        switch (msg.type) {
          case 'setContent': {
            var viewState = msg.resetView ? null : editor.saveViewState();
            editor.setValue(msg.content || '');
            monaco.editor.setModelLanguage(editor.getModel(), msg.language || 'plaintext');
            if (viewState) { editor.restoreViewState(viewState); }
            if (msg.resetView) {
              editor.revealLine(1);
              editor.setPosition({ lineNumber: 1, column: 1 });
            }
            // Apply per-language rules when supplied inline (primary path)
            if (msg.rules) {
              var m2 = editor.getModel();
              if (m2 && msg.rules.indent) {
                m2.updateOptions({
                  tabSize:           msg.rules.indent.tabSize,
                  insertSpaces:      msg.rules.indent.insertSpaces,
                  detectIndentation: false,
                });
              }
              if (msg.rules.autoClose) {
                editor.updateOptions({
                  autoClosingBrackets: msg.rules.autoClose.autoClosingBrackets,
                  autoClosingQuotes:   msg.rules.autoClose.autoClosingQuotes,
                });
              }
            }
            if (msg.scrollTo) {
              editor.revealLineInCenter(msg.scrollTo.line);
              var sdec = editor.deltaDecorations([], [{
                range: new monaco.Range(msg.scrollTo.line, msg.scrollTo.matchStart, msg.scrollTo.line, msg.scrollTo.matchEnd),
                options: { inlineClassName: 'search-match-highlight' }
              }]);
              setTimeout(function() { editor.deltaDecorations(sdec, []); }, 4000);
            }
            // window.focus() claims Android View-level focus so hardware keyboard
            // KeyEvents reach the WebView immediately after content is loaded.
            window.focus();
            editor.focus();
            break;
          }
          case 'format':
            runPrettier().then(function(ok) {
              post({ type: 'FORMAT_COMPLETE', success: ok });
            });
            break;
          case 'findReplace':
            editor.getAction('editor.action.startFindReplaceAction').run(); break;
          case 'goToLine':
            editor.getAction('editor.action.gotoLine').run(); break;
          case 'undo':
            editor.trigger('toolbar', 'undo', null); break;
          case 'redo':
            editor.trigger('toolbar', 'redo', null); break;
          case 'indent':
            editor.trigger('toolbar', 'tab', null); break;
          case 'dedent':
            editor.trigger('toolbar', 'outdent', null); break;
          case 'selectAll':
            editor.trigger('toolbar', 'editor.action.selectAll', null); break;
          case 'comment':
            editor.getAction('editor.action.commentLine').run(); break;
          case 'setFontSize':
            currentFontSize = msg.fontSize;
            editor.updateOptions({ fontSize: currentFontSize }); break;
          case 'setAddCursorMode':
            addCursorMode = msg.active;
            if (addCursorMode) {
              mcOverlay.classList.add('active');
            } else {
              mcOverlay.classList.remove('active');
              // Reset to single cursor
              var pos = editor.getPosition();
              if (pos) editor.setPosition(pos);
            }
            break;
          case 'clearCursors':
            var p = editor.getPosition();
            if (p) editor.setSelections([
              new monaco.Selection(p.lineNumber, p.column, p.lineNumber, p.column)
            ]);
            break;
          case 'applyLanguageRules': {
            if (!msg.rules) break;
            var model3 = editor.getModel();
            if (model3 && msg.rules.indent) {
              model3.updateOptions({
                tabSize:           msg.rules.indent.tabSize,
                insertSpaces:      msg.rules.indent.insertSpaces,
                detectIndentation: false,
              });
            }
            if (msg.rules.autoClose) {
              editor.updateOptions({
                autoClosingBrackets: msg.rules.autoClose.autoClosingBrackets,
                autoClosingQuotes:   msg.rules.autoClose.autoClosingQuotes,
              });
            }
            break;
          }
          case 'FOLD_ALL':
            if (editor) editor.getAction('editor.foldAll').run();
            break;
          case 'UNFOLD_ALL':
            if (editor) editor.getAction('editor.unfoldAll').run();
            break;
          case 'REQUEST_VIEW_STATE': {
            var vs = editor ? editor.saveViewState() : null;
            post({ type: 'SAVE_VIEW_STATE', path: msg.path, viewState: vs ? JSON.stringify(vs) : null });
            break;
          }
          case 'RESTORE_VIEW_STATE': {
            if (editor && msg.viewState) {
              try {
                editor.restoreViewState(JSON.parse(msg.viewState));
              } catch (e) { /* ignore invalid state */ }
            }
            break;
          }
          case 'scrollToLine': {
            if (!editor || !msg.line) break;
            editor.revealLineInCenter(msg.line);
            var dec2 = editor.deltaDecorations([], [{
              range: new monaco.Range(msg.line, msg.matchStart || 1, msg.line, msg.matchEnd || 1),
              options: { inlineClassName: 'search-match-highlight' }
            }]);
            setTimeout(function() { editor.deltaDecorations(dec2, []); }, 4000);
            break;
          }
          case 'SET_OPTIONS': {
            if (typeof msg.formatOnSave === 'boolean') { formatOnSave = msg.formatOnSave; }
            if (msg.snippets) { registerSnippets(msg.snippets, msg.language || 'plaintext'); }
            break;
          }
          case 'FORMAT': {
            runPrettier().then(function(ok) {
              post({ type: 'FORMAT_COMPLETE', success: ok });
            });
            break;
          }
          case 'PRETTIER_CONFIG': {
            prettierConfig = msg.config || {};
            break;
          }

          case 'SET_GUTTER_DECORATIONS': {
            if (!editor) break;
            var lines = msg.lines || [];
            var decorations = lines.map(function(l) {
              var cls = l.type === 'added' ? 'gutter-added'
                      : l.type === 'modified' ? 'gutter-modified'
                      : 'gutter-deleted';
              return {
                range: new monaco.Range(l.lineNumber, 1, l.lineNumber, 1),
                options: { glyphMarginClassName: cls },
              };
            });
            window._gutterDecorations = editor.deltaDecorations(
              window._gutterDecorations || [], decorations);
            break;
          }

          case 'CLEAR_GUTTER_DECORATIONS': {
            if (!editor) break;
            window._gutterDecorations = editor.deltaDecorations(
              window._gutterDecorations || [], []);
            break;
          }

          case 'SET_BLAME_DECORATIONS': {
            if (!editor) break;
            var blameLines = msg.lines || [];
            var blameDecorations = blameLines.map(function(b) {
              var label = '● ' + b.commitHash + ' · ' + b.author + ' · ' + formatRelTime(b.timestamp);
              return {
                range: new monaco.Range(b.lineNumber, 1, b.lineNumber, 1),
                options: {
                  after: { content: '  ' + label, inlineClassName: 'blame-annotation' },
                  isWholeLine: false,
                },
              };
            });
            window._blameDecorations = editor.deltaDecorations(
              window._blameDecorations || [], blameDecorations);
            break;
          }

          case 'CLEAR_BLAME_DECORATIONS': {
            if (!editor) break;
            window._blameDecorations = editor.deltaDecorations(
              window._blameDecorations || [], []);
            break;
          }

          case 'SET_INLINE_COMPLETION': {
            pendingCompletion = data.text || null;
            if (pendingCompletion) {
              editor.trigger('keyboard', 'editor.action.inlineSuggest.trigger', {});
            }
            break;
          }

          case 'GO_TO_DEFINITION': {
            var gtdPos   = editor.getPosition();
            var gtdModel = editor.getModel();
            var gtdWord  = gtdModel ? gtdModel.getWordAtPosition(gtdPos) : null;
            if (!gtdWord) break;
            var gtdLang   = gtdModel.getLanguageId ? gtdModel.getLanguageId() : 'plaintext';
            var gtdIsTsJs = gtdLang === 'typescript' || gtdLang === 'javascript';
            if (!gtdIsTsJs) {
              post({ type: 'GO_TO_DEF_RESULT', resolved: false, word: gtdWord.word });
              break;
            }
            monaco.languages.typescript.getTypeScriptWorker()
              .then(function(worker) {
                return worker.getDefinitionAtPosition(gtdModel.uri.toString(), gtdModel.getOffsetAt(gtdPos));
              })
              .then(function(defs) {
                if (!defs || !defs.length) {
                  post({ type: 'GO_TO_DEF_RESULT', resolved: false, word: gtdWord.word });
                  return;
                }
                var def        = defs[0];
                var isSameFile = def.fileName === gtdModel.uri.toString();
                var isBuiltin  = def.fileName.indexOf('ts:') === 0 ||
                                 def.fileName.indexOf('node_modules') !== -1;
                if (isSameFile) {
                  var defPos = gtdModel.getPositionAt(def.textSpan.start);
                  editor.revealPositionInCenter(defPos);
                  editor.setPosition(defPos);
                  post({ type: 'GO_TO_DEF_RESULT', resolved: true, sameFile: true });
                } else if (isBuiltin) {
                  post({ type: 'GO_TO_DEF_RESULT', resolved: true, builtin: true,
                         fileName: def.fileName, offset: def.textSpan.start });
                } else {
                  post({ type: 'GO_TO_DEF_RESULT', resolved: false, word: gtdWord.word });
                }
              })
              .catch(function() {
                post({ type: 'GO_TO_DEF_RESULT', resolved: false, word: gtdWord.word });
              });
            break;
          }

          case 'GET_MONACO_REFS': {
            var refsPos   = editor.getPosition();
            var refsModel = editor.getModel();
            var refsLang  = refsModel && refsModel.getLanguageId ? refsModel.getLanguageId() : 'plaintext';
            if (refsLang !== 'typescript' && refsLang !== 'javascript') {
              post({ type: 'MONACO_REFS_RESULT', matches: [] });
              break;
            }
            monaco.languages.typescript.getTypeScriptWorker()
              .then(function(worker) {
                return worker.getReferencesAtPosition(refsModel.uri.toString(), refsModel.getOffsetAt(refsPos));
              })
              .then(function(refs) {
                var matches = (refs || [])
                  .filter(function(r) { return r.fileName === refsModel.uri.toString(); })
                  .map(function(r) {
                    var p = refsModel.getPositionAt(r.textSpan.start);
                    return { line: p.lineNumber, column: p.column,
                             lineText: refsModel.getLineContent(p.lineNumber) };
                  });
                post({ type: 'MONACO_REFS_RESULT', matches: matches });
              })
              .catch(function() { post({ type: 'MONACO_REFS_RESULT', matches: [] }); });
            break;
          }

          case 'REVEAL_LINE': {
            if (editor && data.line) {
              editor.revealLineInCenter(data.line);
              editor.setPosition({ lineNumber: data.line, column: 1 });
            }
            break;
          }

          default:
            break;
        }
      } catch (err) { /* ignore parse errors */ }
    });

    // ── Helpers ───────────────────────────────────────────────────────────
    function post(obj) {
      window.ReactNativeWebView.postMessage(JSON.stringify(obj));
    }
  })();
  </script>
</body>
</html>`;
}
