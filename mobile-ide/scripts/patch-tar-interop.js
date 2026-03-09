#!/usr/bin/env node
'use strict';

/**
 * patch-tar-interop.js  —  run via "postinstall"
 *
 * Problem: @expo/cli (bundled CJS) uses the TypeScript _interopRequireDefault
 * pattern:
 *
 *   const _tar = _interopRequireDefault(require('tar'));
 *   await _tar().default.extract({ ... });
 *
 * _interopRequireDefault checks `obj.__esModule`. tar@7 sets __esModule:true
 * but does NOT export `module.exports.default`, so `_tar().default` is
 * undefined → crash: "Cannot read properties of undefined (reading 'extract')".
 *
 * Fix: append `exports.default = exports;` to tar's CJS entry point when
 * tar@7+ is installed. This makes `_tar().default` === the tar module.
 *
 * Safe to run repeatedly (idempotent check: if '.default' already present,
 * skip). Safe to fail silently (non-zero exit never propagated to npm).
 */

const path = require('path');
const fs = require('fs');

const ROOT = path.join(__dirname, '..');
const TAR_PKG = path.join(ROOT, 'node_modules', 'tar', 'package.json');

try {
  if (!fs.existsSync(TAR_PKG)) {
    process.stdout.write('[patch-tar-interop] tar not found in node_modules, skipping\n');
    process.exit(0);
  }

  const tarPkg = JSON.parse(fs.readFileSync(TAR_PKG, 'utf8'));
  const major = parseInt(tarPkg.version.split('.')[0], 10);

  if (major < 7) {
    process.stdout.write('[patch-tar-interop] tar@' + tarPkg.version + ' does not set __esModule, no shim needed\n');
    process.exit(0);
  }

  // Resolve the CJS entry point.
  // tar@7 exports['.'].require is a conditional-exports object, not a string.
  // Fall back to tarPkg.main which is always the CJS entry.
  let main = tarPkg.main || 'index.js';
  const exp = tarPkg.exports?.['.'];
  if (typeof exp?.require === 'string') main = exp.require;
  else if (typeof exp?.require?.default === 'string') main = exp.require.default;

  const mainPath = path.isAbsolute(main)
    ? main
    : path.join(ROOT, 'node_modules', 'tar', main);

  const content = fs.readFileSync(mainPath, 'utf8');

  if (content.includes('exports.default') || content.includes('module.exports.default')) {
    process.stdout.write('[patch-tar-interop] tar@' + tarPkg.version + ' already exports .default, skipping\n');
    process.exit(0);
  }

  const SHIM = '\n// CJS interop shim for @expo/cli _interopRequireDefault compatibility\nexports.default = exports;\n';
  fs.writeFileSync(mainPath, content + SHIM, 'utf8');
  process.stdout.write('[patch-tar-interop] Added .default shim to tar@' + tarPkg.version + ' at ' + mainPath + '\n');

} catch (e) {
  // Never fail the install — just warn
  process.stderr.write('[patch-tar-interop] Warning: ' + e.message + '\n');
}
