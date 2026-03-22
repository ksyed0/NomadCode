/**
 * terminalHtmlContent.ts
 *
 * Auto-generated content wrapper for the terminal WebView bundle.
 * The HTML is stored here as a TypeScript string constant so that Metro
 * bundler can include it without requiring native file-system access at
 * runtime on the device.
 *
 * To regenerate: run `npm run build:terminal` (copies dist/terminal.html here).
 *
 * DO NOT edit the HTML content manually — edit src/terminal/bundle/src/ and rebuild.
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const _fs = require('fs') as typeof import('fs');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const _path = require('path') as typeof import('path');

// Read at bundle time (Metro / Node.js context). The result is a static string
// baked into the bundle — no file I/O happens on-device.
export const TERMINAL_HTML: string = _fs.readFileSync(
  _path.join(__dirname, 'dist', 'terminal.html'),
  'utf8',
);
