// @ts-check
'use strict';

const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

async function build() {
  const distDir = path.join(__dirname, 'dist');
  if (!fs.existsSync(distDir)) fs.mkdirSync(distDir, { recursive: true });

  // Build the TypeScript bundle
  await esbuild.build({
    entryPoints: [path.join(__dirname, 'index.ts')],
    bundle: true,
    outfile: path.join(distDir, 'terminal.js'),
    format: 'iife',
    platform: 'browser',
    target: ['es2017'],
    minify: false,
    // Provide minimal node built-ins that isomorphic-git may reference
    define: {
      'process.env.NODE_ENV': JSON.stringify('production'),
    },
  });

  // Read the built JS
  const js = fs.readFileSync(path.join(distDir, 'terminal.js'), 'utf8');

  // Generate the HTML file with the JS inlined
  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: #0F172A; color: #E2E8F0; font-family: monospace; font-size: 13px; height: 100vh; display: flex; flex-direction: column; overflow: hidden; }
    #output { flex: 1; overflow-y: auto; padding: 12px; }
    .line { line-height: 20px; white-space: pre-wrap; word-break: break-all; }
    .command { color: #22C55E; }
    .error { color: #EF4444; }
    .info { color: #94A3B8; }
    #input-row { display: flex; align-items: center; padding: 8px 12px; border-top: 1px solid #1E293B; }
    #prompt { color: #22C55E; margin-right: 8px; }
    #input { flex: 1; background: transparent; border: none; outline: none; color: #E2E8F0; font-family: monospace; font-size: 13px; }
  </style>
</head>
<body>
  <div id="output"></div>
  <div id="input-row">
    <span id="prompt">$</span>
    <input id="input" type="text" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" />
  </div>
  <script>${js}</script>
</body>
</html>`;

  fs.writeFileSync(path.join(distDir, 'terminal.html'), html, 'utf8');

  const htmlSize = fs.statSync(path.join(distDir, 'terminal.html')).size;
  const jsSize = fs.statSync(path.join(distDir, 'terminal.js')).size;
  console.log(
    `✓ terminal.html built successfully (${(htmlSize / 1024).toFixed(1)} KB, JS: ${(jsSize / 1024).toFixed(1)} KB)`,
  );
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
