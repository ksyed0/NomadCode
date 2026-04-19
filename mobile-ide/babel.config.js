// Workspace-root babel config — used when jest rootDir is set to mobile-ide/
// (rootDir: ".." in the sub-package jest config expands to this directory).
// babel-jest passes rootDir as the babel `cwd`, so babel looks here first for
// the project-wide config. We simply re-export the prototype's config so there
// is exactly one source of truth.
module.exports = require('./mobile-ide-prototype/babel.config.js');
