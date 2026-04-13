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

// Watch the prototype dir and its node_modules (hoisted to workspace root)
config.watchFolders = [
  projectRoot,
  path.resolve(projectRoot, '..', 'node_modules'),
];

// Resolve native-only packages to empty stubs for web builds.
// react-native-document-picker has no web entry point; expo export (web) fails
// without this stub because Metro cannot find a web-compatible module.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web' && moduleName === 'react-native-document-picker') {
    return { type: 'empty' };
  }
  // isomorphic-git v1.37.5's exports field only exposes CJS (requires Node
  // 'crypto'). Force Metro to use the ESM entry (globalThis.crypto) for web.
  if (platform === 'web' && moduleName === 'isomorphic-git') {
    const isoGitDir = path.dirname(require.resolve('isomorphic-git'));
    return { type: 'sourceFile', filePath: path.join(isoGitDir, 'index.js') };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
