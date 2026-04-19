const js = require('@eslint/js');
const tsPlugin = require('@typescript-eslint/eslint-plugin');
const tsParser = require('@typescript-eslint/parser');
const reactPlugin = require('eslint-plugin-react');
const reactHooksPlugin = require('eslint-plugin-react-hooks');
const globals = require('globals');

module.exports = [
  // Ignore patterns (replaces ignorePatterns in legacy config).
  // Note: ESLint 10 flat config globs do NOT use matchBase, so `dist/**` only
  // ignores a root-level dist/. Use `**/dist/**` to match nested dirs (e.g.
  // src/terminal/bundle/dist/). The terminal bundle directory is fully excluded
  // because it contains large generated/compiled artefacts, not hand-written source.
  {
    ignores: [
      'node_modules/**',
      '**/node_modules/**',
      'coverage/**',
      '**/dist/**',
      '.expo/**',
      'android/**',
      'ios/**',
      // Terminal bundle: contains generated JS bundles and build scripts.
      // The old ESLint 8 config implicitly excluded these via --ext .ts,.tsx
      // (which skipped all .js files). Explicitly list them here for ESLint 10.
      'src/terminal/bundle/**',
    ],
  },

  // Base JS recommended rules — scoped to TS/TSX only so that generated .js
  // artefacts outside the ignores list don't surface false positives.
  { ...js.configs.recommended, files: ['**/*.ts', '**/*.tsx'] },

  // TypeScript-ESLint flat/recommended (array — spread it, files-restricted)
  ...tsPlugin.configs['flat/recommended'].map((c) =>
    c.files ? c : { ...c, files: ['**/*.ts', '**/*.tsx'] }
  ),

  // Main config for TS/TSX source files
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaFeatures: { jsx: true },
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
      globals: {
        ...globals.browser,
        ...globals.es2021,
        ...globals.node,
      },
    },
    plugins: {
      react: reactPlugin,
      'react-hooks': reactHooksPlugin,
    },
    settings: {
      // Pin the React version explicitly. Using 'detect' triggers context.getFilename()
      // inside eslint-plugin-react@7.x's version-detection utility, which was removed
      // in ESLint 10. Pinning avoids that code path entirely.
      react: { version: '19.1.0' },
    },
    rules: {
      // React recommended rules (manually spread — eslint-plugin-react@7.34 predates flat config)
      ...reactPlugin.configs.recommended.rules,

      // React Hooks recommended rules
      ...reactHooksPlugin.configs.recommended.rules,

      // Project-specific overrides
      'react/react-in-jsx-scope': 'off', // Not needed with React 17+ JSX transform
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
];
