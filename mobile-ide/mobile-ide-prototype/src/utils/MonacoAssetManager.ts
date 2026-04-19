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
export function buildMonacoHtml(vsBaseUrl: string, initialTheme: 'vs' | 'vs-dark' = 'vs-dark', prettierSource?: string): string {
  // Safely embed the URL in JS (no injection vector since it's our own constant)
  const safeBase = JSON.stringify(vsBaseUrl);
  const safeTheme = JSON.stringify(initialTheme);
  // Match the chrome (loading screen + body bg) to the editor theme so users
  // don't see a flash of the wrong colour while Monaco bootstraps.
  const chromeBg = initialTheme === 'vs' ? '#ffffff' : '#1e1e1e';
  const chromeText = initialTheme === 'vs' ? '#374151' : '#6b7280';

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
