/**
 * Extension Sandbox — runs JS-only extensions in an isolated WebView context.
 *
 * Security model:
 *   - Each extension runs in a separate hidden WebView (no DOM access to the main UI)
 *   - Extensions communicate with the host via a restricted postMessage API
 *   - No native module access; no file system access by default
 *   - Extension code is treated as untrusted; the host validates every message
 *
 * Exposed extension API (vscode-compatible subset):
 *   vscode.window.showInformationMessage(text)
 *   vscode.window.showErrorMessage(text)
 *   vscode.workspace.getActiveEditorContent() → Promise<string>
 *   vscode.workspace.replaceActiveEditorContent(newText)
 *   vscode.commands.registerCommand(id, handler)
 *
 * Future extension points:
 *   - Add vscode.languages.registerCompletionProvider for AI completions (AI_HOOK)
 *   - Add vscode.workspace.fs bridge to read/write files via FileSystemBridge (CLOUD_HOOK)
 *   - Support wasm extensions by pre-compiling to JS via wasm2js
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ExtensionManifest {
  id: string;
  name: string;
  version: string;
  description?: string;
  /** Entry point source code (JS string, no imports/require) */
  source: string;
}

export interface ExtensionMessage {
  type:
    | 'showMessage'
    | 'showError'
    | 'getEditorContent'
    | 'replaceEditorContent'
    | 'registerCommand'
    | 'executeCommand'
    | 'log'
    | 'error';
  extensionId: string;
  payload?: unknown;
  requestId?: string;
}

export type ExtensionEventHandler = (msg: ExtensionMessage) => void;

// ---------------------------------------------------------------------------
// Sandbox HTML template
// Injected with extension source code and the limited vscode API shim.
// ---------------------------------------------------------------------------

export function buildSandboxHtml(manifest: ExtensionManifest): string {
  // The vscode API shim — only exposes permitted operations via postMessage
  const vsCodeShim = `
    var vscode = (function() {
      var _msgId = 0;
      var _pending = {};

      function send(type, payload, awaitResponse) {
        var id = String(++_msgId);
        var msg = { type: type, extensionId: ${JSON.stringify(manifest.id)}, payload: payload, requestId: id };
        window.ReactNativeWebView.postMessage(JSON.stringify(msg));
        if (awaitResponse) {
          return new Promise(function(resolve) { _pending[id] = resolve; });
        }
        return Promise.resolve();
      }

      // Host responses arrive via window.addEventListener('message', ...)
      window.addEventListener('message', function(e) {
        try {
          var data = JSON.parse(e.data);
          if (data.requestId && _pending[data.requestId]) {
            _pending[data.requestId](data.payload);
            delete _pending[data.requestId];
          }
        } catch(err) {}
      });

      var _commands = {};

      return {
        window: {
          showInformationMessage: function(text) { return send('showMessage', { text: text }); },
          showErrorMessage:       function(text) { return send('showError',   { text: text }); },
        },
        workspace: {
          getActiveEditorContent:    function()    { return send('getEditorContent',      null,    true); },
          replaceActiveEditorContent: function(text){ return send('replaceEditorContent', { text: text }); },
        },
        commands: {
          registerCommand: function(id, handler) {
            _commands[id] = handler;
            send('registerCommand', { commandId: id });
          },
          executeCommand: function(id) {
            if (_commands[id]) { _commands[id](); }
          },
        },
      };
    })();
  `;

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body>
<script>
(function() {
  'use strict';
  try {
    ${vsCodeShim}
    // ── Extension source ──────────────────────────────────────────────────
    (function(vscode) {
      ${manifest.source}
    })(vscode);
  } catch(err) {
    window.ReactNativeWebView.postMessage(JSON.stringify({
      type: 'error',
      extensionId: ${JSON.stringify(manifest.id)},
      payload: { message: err.message, stack: err.stack },
    }));
  }
})();
</script>
</body></html>`;
}

// ---------------------------------------------------------------------------
// ExtensionRegistry — manages loaded extensions and their manifests
// ---------------------------------------------------------------------------

class ExtensionRegistryClass {
  private manifests = new Map<string, ExtensionManifest>();
  private handlers = new Set<ExtensionEventHandler>();

  register(manifest: ExtensionManifest): void {
    this.manifests.set(manifest.id, manifest);
  }

  unregister(id: string): void {
    this.manifests.delete(id);
  }

  get(id: string): ExtensionManifest | undefined {
    return this.manifests.get(id);
  }

  list(): ExtensionManifest[] {
    return Array.from(this.manifests.values());
  }

  /** Subscribe to messages from any extension. */
  onMessage(handler: ExtensionEventHandler): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  /** Called by the sandbox WebView's onMessage handler. */
  dispatch(msg: ExtensionMessage): void {
    this.handlers.forEach((h) => h(msg));
  }
}

export const ExtensionRegistry = new ExtensionRegistryClass();

// ---------------------------------------------------------------------------
// Built-in example extension — demonstrates the sandbox API
// ---------------------------------------------------------------------------

export const EXAMPLE_EXTENSION: ExtensionManifest = {
  id: 'nomadcode.word-count',
  name: 'Word Count',
  version: '0.1.0',
  description: 'Counts words in the active editor and displays the result.',
  source: `
    vscode.commands.registerCommand('nomadcode.wordCount', function() {
      vscode.workspace.getActiveEditorContent().then(function(content) {
        var words = content ? content.trim().split(/\\s+/).filter(Boolean).length : 0;
        vscode.window.showInformationMessage('Word count: ' + words);
      });
    });

    // Auto-run on load
    vscode.commands.executeCommand('nomadcode.wordCount');
  `,
};

// ---------------------------------------------------------------------------
// activateExtension / deactivateExtension — legacy exports for compatibility
// ---------------------------------------------------------------------------

/** Load an extension into the registry and return its sandbox HTML. */
export function activateExtension(manifest: ExtensionManifest): string {
  ExtensionRegistry.register(manifest);
  return buildSandboxHtml(manifest);
}

/** Remove an extension from the registry. */
export function deactivateExtension(id: string): void {
  ExtensionRegistry.unregister(id);
}
