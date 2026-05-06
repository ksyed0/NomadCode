// metro.config.js
// Pins Metro's projectRoot to this directory, overriding workspace root walk-up.
// Without this, npm workspaces cause Metro to use mobile-ide/ as origin,
// which breaks expo/virtual-metro-entry resolution.

const { getDefaultConfig } = require('@expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const config = getDefaultConfig(projectRoot);

// Explicitly override in case workspace root detection overrides the above
config.projectRoot = projectRoot;

// Watch the prototype dir and its node_modules (hoisted to workspace root).
// Also include the monorepo root node_modules so packages installed at the
// top level (e.g. @sentry/react-native hoisted by npm workspaces) are visible
// to Metro's file watcher and resolver.
config.watchFolders = [
  projectRoot,
  path.resolve(projectRoot, '..', 'node_modules'),         // mobile-ide/node_modules
  path.resolve(projectRoot, '..', '..', 'node_modules'),  // NomadCode/node_modules
];

// Tell Metro's resolver to also look in the monorepo root node_modules.
// Without this, packages hoisted above mobile-ide/ are invisible to Metro.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(projectRoot, '..', 'node_modules'),
  path.resolve(projectRoot, '..', '..', 'node_modules'),
];

// Resolve native-only packages to empty stubs for web builds.
// react-native-document-picker has no web entry point; expo export (web) fails
// without this stub because Metro cannot find a web-compatible module.
// Locate the isomorphic-git ESM entry at config load time.
// The exports field only declares CJS (requires Node 'crypto'), but the ESM
// entry (index.js) uses globalThis.crypto and is browser-safe.
const isoGitEsm = path.join(
  path.dirname(require.resolve('isomorphic-git')),
  'index.js',
);

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web' && moduleName === 'react-native-document-picker') {
    return { type: 'empty' };
  }
  // Apply to all platforms — Metro doesn't have Node 'crypto' built-in.
  if (moduleName === 'isomorphic-git') {
    return { type: 'sourceFile', filePath: isoGitEsm };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
