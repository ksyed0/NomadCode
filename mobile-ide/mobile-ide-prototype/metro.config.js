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

module.exports = config;
