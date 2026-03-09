/**
 * Extension Sandbox — Placeholder
 *
 * This directory will contain the WASM-based extension sandbox runtime.
 *
 * Architecture:
 * - Extensions are loaded as isolated WASM workers.
 * - They communicate with the host IDE via a restricted message-passing API.
 * - No direct DOM or native API access is permitted.
 *
 * Extension API surface (planned):
 *   editor.getText()
 *   editor.setText(text)
 *   editor.insertSnippet(snippet)
 *   files.readFile(path)
 *   ui.showMessage(message)
 *   ui.registerCommand(id, label, handler)
 *
 * TODO:
 *   - Implement WASM worker loader
 *   - Define and enforce API capability manifest
 *   - Add extension signing and verification
 *   - Implement sandboxed file system proxy
 */

// eslint-disable-next-line no-undef
module.exports = {};
