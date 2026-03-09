/**
 * Unit tests — Editor utilities (getLanguageForFile)
 */

jest.mock('react-native-webview', () => ({ WebView: 'WebView' }));

import { getLanguageForFile } from '../../src/components/Editor';

describe('getLanguageForFile', () => {
  it.each([
    ['App.tsx',            'typescript'],
    ['index.ts',           'typescript'],
    ['main.js',            'javascript'],
    ['component.jsx',      'javascript'],
    ['package.json',       'json'],
    ['README.md',          'markdown'],
    ['styles.css',         'css'],
    ['index.html',         'html'],
    ['main.py',            'python'],
    ['main.rs',            'rust'],
    ['main.go',            'go'],
    ['build.sh',           'shell'],
    ['docker-compose.yml', 'yaml'],
    ['Dockerfile',         'dockerfile'],
    ['dockerfile.prod',    'dockerfile'],
    ['unknown.xyz',        'plaintext'],
    ['no-extension',       'plaintext'],
  ])('maps %s → %s', (filename, expected) => {
    expect(getLanguageForFile(filename)).toBe(expected);
  });

  it('is case-insensitive for extensions', () => {
    expect(getLanguageForFile('App.TSX')).toBe('typescript');
    expect(getLanguageForFile('App.TS')).toBe('typescript');
  });
});
