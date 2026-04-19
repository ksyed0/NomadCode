const js = require('@eslint/js');
const tsPlugin = require('@typescript-eslint/eslint-plugin');
const tsParser = require('@typescript-eslint/parser');
const reactPlugin = require('eslint-plugin-react');
const reactHooksPlugin = require('eslint-plugin-react-hooks');
const globals = require('globals');

module.exports = [
  // Ignore patterns (replaces ignorePatterns in legacy config)
  {
    ignores: [
      'node_modules/**',
      'coverage/**',
      'dist/**',
      '.expo/**',
      'android/**',
      'ios/**',
    ],
  },

  // Base JS recommended rules
  js.configs.recommended,

  // TypeScript-ESLint flat/recommended (array — spread it)
  ...tsPlugin.configs['flat/recommended'],

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
      react: { version: 'detect' },
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
