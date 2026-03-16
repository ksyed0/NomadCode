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
export function buildMonacoHtml(vsBaseUrl: string): string {
  // Safely embed the URL in JS (no injection vector since it's our own constant)
  const safeBase = JSON.stringify(vsBaseUrl);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body  { height: 100%; background: #1e1e1e; overflow: hidden; }
    #container  { position: absolute; inset: 0; }
    #loading    {
      position: absolute; inset: 0; display: flex; flex-direction: column;
      align-items: center; justify-content: center; gap: 12px;
      color: #6b7280; font: 13px/1 -apple-system, sans-serif; background: #1e1e1e;
    }
    #loading-bar-wrap { width: 160px; height: 3px; background: #1f2937; border-radius: 2px; }
    #loading-bar      { height: 100%; width: 0%; background: #2563eb; border-radius: 2px;
                        transition: width 0.2s ease; }

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

  <script src="${vsBaseUrl}/loader.js" onerror="onLoaderError()"></script>
  <script>
  (function () {
    'use strict';

    // ── Globals ────────────────────────────────────────────────────────────
    var editor;
    var currentFontSize = 14;
    var addCursorMode   = false;
    var mcOverlay       = document.getElementById('mc-overlay');

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
          theme: 'vs-dark',
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
          // Alt+click adds cursor on external keyboards
          multiCursorModifier: 'alt',
          // Needed for pointer-event pinch detection
          mouseWheelZoom: false,
        });

        // ── Content changes → RN ─────────────────────────────────────────
        editor.onDidChangeModelContent(function () {
          post({ type: 'contentChanged', content: editor.getValue() });
        });

        // ── Cmd/Ctrl+S → save ────────────────────────────────────────────
        editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, function () {
          post({ type: 'save', content: editor.getValue() });
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
            break;
          }
          case 'format':
            editor.getAction('editor.action.formatDocument').run(); break;
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
