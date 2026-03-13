/**
 * Unit tests — Editor utilities (getLanguageForFile)
 */

jest.mock('react-native-webview', () => ({ WebView: 'WebView' }));

jest.mock('../../src/theme/tokens', () => ({
  useTheme: () => ({
    bg: '#0F172A', bgElevated: '#1E293B', bgHighlight: '#1D3461',
    text: '#E2E8F0', textMuted: '#64748B', border: '#334155',
    accent: '#2563EB', keyword: '#7C3AED', string: '#0D9488',
    error: '#EF4444', success: '#22C55E',
  }),
  getMonacoTheme: () => 'vs-dark',
}));

jest.mock('../../src/stores/useSettingsStore', () => ({
  __esModule: true,
  default: jest.fn((sel: (s: object) => unknown) =>
    sel({ fontSize: 14, theme: 'nomad-dark', setFontSize: jest.fn() })
  ),
}));

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
