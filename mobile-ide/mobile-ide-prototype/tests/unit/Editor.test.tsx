/**
 * Unit tests — Editor component
 *
 * react-native-webview is mocked (no real WebView in Jest).
 * Tests cover: empty state, tab bar rendering, tab switching,
 * tab closing, dirty indicator, and the onSave / onContentChange callbacks.
 */

import React from 'react';
import { Platform } from 'react-native';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import Editor, { EditorHandle, EditorTab, buildPreviewHtml, canPreview, getLanguageForFile, detectLanguageFromContent, TOOLBAR_ITEMS } from '../../src/components/Editor';

// ---------------------------------------------------------------------------
// Mock theme tokens
// ---------------------------------------------------------------------------

jest.mock('../../src/theme/tokens', () => {
  const actual = jest.requireActual('../../src/theme/tokens');
  return {
    ...actual,
    useTheme: () => actual.THEMES['nomad-dark'],
    getMonacoTheme: () => 'vs-dark',
  };
});

// ---------------------------------------------------------------------------
// Mock useSettingsStore
// ---------------------------------------------------------------------------

const mockSetFontSize = jest.fn();
let mockFontSize = 14;

jest.mock('../../src/stores/useSettingsStore', () => ({
  __esModule: true,
  default: jest.fn((sel: (s: object) => unknown) =>
    sel({
      fontSize: mockFontSize,
      theme: 'nomad-dark',
      setFontSize: mockSetFontSize,
      snippets: [],
    })
  ),
}));

// ---------------------------------------------------------------------------
// Mock MonacoAssetManager so monacoHtml is set synchronously after mount
// ---------------------------------------------------------------------------

jest.mock('../../src/utils/MonacoAssetManager', () => ({
  MonacoAssetManager: {
    resolve: jest.fn().mockResolvedValue({ baseUrl: 'https://cdn.test', isOffline: false }),
    loadPrettierSource: jest.fn().mockResolvedValue(null),
  },
  buildMonacoHtml: jest.fn().mockReturnValue('<html>monaco</html>'),
}));

// ---------------------------------------------------------------------------
// Mock react-native-webview
// ---------------------------------------------------------------------------

// Captured onMessage handler — set by the mock, used in tests to fire messages
let capturedOnMessage: ((e: object) => void) | undefined;
// Captured injectJavaScript mock — used in tests to inspect dispatched payloads
let capturedInjectJS: jest.Mock | undefined;

jest.mock('react-native-webview', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require('react');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View } = require('react-native');
  const WebView = React.forwardRef((props: { onMessage?: (e: object) => void }, ref: unknown) => {
    // Expose injectJavaScript via ref so webViewRef.current is non-null
    React.useImperativeHandle(ref, () => {
      const fn = jest.fn();
      capturedInjectJS = fn;
      return { injectJavaScript: fn };
    });
    // Capture onMessage so tests can fire arbitrary messages
    capturedOnMessage = props.onMessage;
    // Fire the 'ready' message so editorReady becomes true
    React.useEffect(() => {
      props.onMessage?.({ nativeEvent: { data: JSON.stringify({ type: 'ready' }) } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return <View testID="webview" />;
  });
  WebView.displayName = 'WebView';
  return { WebView };
});

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeTab(overrides: Partial<EditorTab> = {}): EditorTab {
  return {
    path: '/docs/App.tsx',
    name: 'App.tsx',
    content: 'const x = 1;',
    language: 'typescript',
    isDirty: false,
    ...overrides,
  };
}

const TAB_A = makeTab({ path: '/docs/App.tsx',   name: 'App.tsx' });
const TAB_B = makeTab({ path: '/docs/index.ts',  name: 'index.ts' });
const DIRTY = makeTab({ path: '/docs/dirty.ts',  name: 'dirty.ts', isDirty: true });

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderEditor(
  tabs: EditorTab[],
  activeTabPath: string | null,
  handlers: {
    onTabChange?: jest.Mock;
    onTabClose?: jest.Mock;
    onContentChange?: jest.Mock;
    onSave?: jest.Mock;
  } = {},
) {
  const {
    onTabChange    = jest.fn(),
    onTabClose     = jest.fn(),
    onContentChange = jest.fn(),
    onSave         = jest.fn(),
  } = handlers;

  return render(
    <Editor
      tabs={tabs}
      activeTabPath={activeTabPath}
      onTabChange={onTabChange}
      onTabClose={onTabClose}
      onContentChange={onContentChange}
      onSave={onSave}
    />,
  );
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

describe('Editor — empty state', () => {
  it('shows "No file open" when tabs array is empty', () => {
    renderEditor([], null);
    expect(screen.getByText('No file open')).toBeTruthy();
  });

  it('shows hint text when tabs array is empty', () => {
    renderEditor([], null);
    expect(screen.getByText(/Select a file from the Explorer/i)).toBeTruthy();
  });

  it('does not render the WebView when tabs are empty', () => {
    renderEditor([], null);
    expect(screen.queryByTestId('webview')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Tab bar rendering
// ---------------------------------------------------------------------------

describe('Editor — tab bar', () => {
  it('renders tab labels for all open tabs', () => {
    renderEditor([TAB_A, TAB_B], TAB_A.path);
    // Active tab name also appears in the breadcrumb, so use getAllByText
    expect(screen.getAllByText('App.tsx').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('index.ts')).toBeTruthy();
  });

  it('renders the WebView when at least one tab is open', async () => {
    renderEditor([TAB_A], TAB_A.path);
    await waitFor(() => expect(screen.getByTestId('webview')).toBeTruthy());
  });

  it('renders a close button for each tab', () => {
    renderEditor([TAB_A, TAB_B], TAB_A.path);
    // × character is the close icon
    expect(screen.getAllByText('×')).toHaveLength(2);
  });

  it('shows a dirty indicator (●) prefix on dirty tabs', () => {
    renderEditor([DIRTY], DIRTY.path);
    expect(screen.getByText(/●\s*dirty\.ts/)).toBeTruthy();
  });

  it('does not show dirty indicator on clean tabs', () => {
    renderEditor([TAB_A], TAB_A.path);
    expect(screen.queryByText(/●/)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Tab interactions
// ---------------------------------------------------------------------------

describe('Editor — tab interactions', () => {
  it('calls onTabChange with the path when a tab is pressed', () => {
    const onTabChange = jest.fn();
    renderEditor([TAB_A, TAB_B], TAB_A.path, { onTabChange });
    fireEvent.press(screen.getByText('index.ts'));
    expect(onTabChange).toHaveBeenCalledWith('/docs/index.ts');
  });

  it('calls onTabClose with the path when the × button is pressed', () => {
    const onTabClose = jest.fn();
    renderEditor([TAB_A], TAB_A.path, { onTabClose });
    fireEvent.press(screen.getByText('×'));
    expect(onTabClose).toHaveBeenCalledWith('/docs/App.tsx');
  });

  it('calls onTabClose for the correct tab when multiple tabs are open', () => {
    const onTabClose = jest.fn();
    renderEditor([TAB_A, TAB_B], TAB_A.path, { onTabClose });
    // Press the second ×
    const closeButtons = screen.getAllByText('×');
    fireEvent.press(closeButtons[1]);
    expect(onTabClose).toHaveBeenCalledWith('/docs/index.ts');
  });
});

// ---------------------------------------------------------------------------
// Multiple tabs
// ---------------------------------------------------------------------------

describe('Editor — multiple tabs', () => {
  it('renders correctly with many tabs', () => {
    const tabs = Array.from({ length: 8 }, (_, i) =>
      makeTab({ path: `/docs/file${i}.ts`, name: `file${i}.ts` }),
    );
    renderEditor(tabs, tabs[0].path);
    // Tab bar + breadcrumb both render the active file name, so use getAllByText
    expect(screen.getAllByText('file0.ts').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('file7.ts')).toBeTruthy();
  });

  it('renders with null activeTabPath without crashing', () => {
    expect(() => renderEditor([TAB_A, TAB_B], null)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Path breadcrumb
// ---------------------------------------------------------------------------

describe('Editor — path breadcrumb', () => {
  it('shows the active file path below the tab bar', () => {
    renderEditor([TAB_A], TAB_A.path);
    expect(screen.getByTestId('editor-path-breadcrumb')).toBeTruthy();
    // Breadcrumb renders each segment as a separate Text node;
    // both 'docs' and 'App.tsx' may appear elsewhere (tab bar), so use getAllByText
    expect(screen.getAllByText('docs').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('App.tsx').length).toBeGreaterThanOrEqual(1);
  });

  it('updates path when a different tab is active', () => {
    renderEditor([TAB_A, TAB_B], TAB_B.path);
    // Breadcrumb renders 'docs' and 'index.ts' as separate segments
    // (index.ts also appears in the tab bar, so use getAllByText)
    expect(screen.getAllByText('index.ts').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByTestId('editor-path-breadcrumb')).toBeTruthy();
  });

  it('does not render path bar in empty state', () => {
    renderEditor([], null);
    expect(screen.queryByTestId('editor-path-breadcrumb')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Preview utilities
// ---------------------------------------------------------------------------

describe('canPreview', () => {
  it.each([
    ['markdown', true],
    ['html',     true],
    ['json',     true],
    ['typescript', false],
    ['javascript', false],
    ['plaintext',  false],
  ])('%s → %s', (lang, expected) => {
    expect(canPreview(lang)).toBe(expected);
  });
});

describe('buildPreviewHtml', () => {
  // BUG-0036: markdown preview must not load marked.js from a CDN
  it('does not load any script from a CDN (BUG-0036)', () => {
    const html = buildPreviewHtml('markdown', '# Hello');
    expect(html).not.toContain('cdn.');
    expect(html).not.toContain('jsdelivr');
    expect(html).not.toContain('<script src=');
  });

  // BUG-0036: markdown is pre-rendered to real HTML on the JS side
  it('pre-renders markdown headings to HTML elements (BUG-0036)', () => {
    const html = buildPreviewHtml('markdown', '# Hello World');
    expect(html).toContain('<h1>');
    expect(html).toContain('Hello World');
  });

  it('pre-renders markdown bold text to HTML (BUG-0036)', () => {
    const html = buildPreviewHtml('markdown', '**bold**');
    expect(html).toContain('<strong>');
  });

  // BUG-0038: markdown preview CSS must use theme tokens (nomad-dark defaults)
  it('uses theme background color in markdown preview CSS (BUG-0038)', () => {
    const html = buildPreviewHtml('markdown', '# Test');
    expect(html).toContain('#0F172A'); // nomad-dark bg
  });

  it('uses theme text color in markdown preview CSS (BUG-0038)', () => {
    const html = buildPreviewHtml('markdown', '# Test');
    expect(html).toContain('#E2E8F0'); // nomad-dark text
  });

  // BUG-0039: JSON preview CSS must use theme tokens (nomad-dark defaults)
  it('uses theme background color in JSON preview CSS (BUG-0039)', () => {
    const html = buildPreviewHtml('json', '{"key":"value"}');
    expect(html).toContain('#0F172A'); // nomad-dark bg
  });

  it('uses theme text color in JSON preview CSS (BUG-0039)', () => {
    const html = buildPreviewHtml('json', '{"key":"value"}');
    expect(html).toContain('#E2E8F0'); // nomad-dark text
  });

  it('returns HTML preview HTML for html language', () => {
    const html = buildPreviewHtml('html', '<p>test</p>');
    expect(html).toContain('iframe');
    expect(html).toContain('sandbox');
  });

  it('returns JSON tree preview HTML for json language', () => {
    const html = buildPreviewHtml('json', '{"key":"value"}');
    expect(html).toContain('key');
  });

  it('returns JSON error preview when json is invalid', () => {
    const html = buildPreviewHtml('json', 'not valid json');
    expect(html).toContain('err');
  });

  it('returns no-preview message for unsupported language', () => {
    const html = buildPreviewHtml('typescript', 'const x = 1;');
    expect(html).toContain('No preview available');
  });
});

// ---------------------------------------------------------------------------
// BUG-0047: toolbar preview label must not be an emoji character
// ---------------------------------------------------------------------------

describe('TOOLBAR_ITEMS', () => {
  it('preview toolbar item label is not an emoji character (BUG-0047)', () => {
    const previewItem = TOOLBAR_ITEMS.find((i) => i.id === 'preview');
    expect(previewItem).toBeDefined();
    expect(previewItem!.label).not.toMatch(/\p{Emoji_Presentation}/u);
  });
});

// ---------------------------------------------------------------------------
// Toolbar interactions — covers changeFontSize, handleToolbarAction branches
// ---------------------------------------------------------------------------

describe('Editor — toolbar interactions', () => {
  beforeEach(() => {
    mockSetFontSize.mockClear();
    mockFontSize = 14;
  });

  it('displays font size from the settings store', async () => {
    mockFontSize = 14;
    renderEditor([TAB_A], TAB_A.path);
    await waitFor(() => screen.getByTestId('webview'));
    expect(screen.getByText('14')).toBeTruthy();
  });

  it('calls store setFontSize when A- is pressed', async () => {
    mockFontSize = 14;
    renderEditor([TAB_A], TAB_A.path);
    await waitFor(() => screen.getByTestId('webview'));
    fireEvent.press(screen.getByText('A-'));
    expect(mockSetFontSize).toHaveBeenCalledWith(13);
  });

  it('calls store setFontSize when A+ is pressed', async () => {
    mockFontSize = 14;
    renderEditor([TAB_A], TAB_A.path);
    await waitFor(() => screen.getByTestId('webview'));
    fireEvent.press(screen.getByText('A+'));
    expect(mockSetFontSize).toHaveBeenCalledWith(15);
  });

  it('does not go below fontSize 8 — A- calls setFontSize(8) (clamped locally)', async () => {
    mockFontSize = 8;
    renderEditor([TAB_A], TAB_A.path);
    await waitFor(() => screen.getByTestId('webview'));
    fireEvent.press(screen.getByText('A-'));
    expect(mockSetFontSize).toHaveBeenCalledWith(8);
  });

  it('does not go above fontSize 32 — A+ calls setFontSize(32) (clamped locally)', async () => {
    mockFontSize = 32;
    renderEditor([TAB_A], TAB_A.path);
    await waitFor(() => screen.getByTestId('webview'));
    fireEvent.press(screen.getByText('A+'));
    expect(mockSetFontSize).toHaveBeenCalledWith(32);
  });

  it('sends a command when a toolbar action button is pressed', async () => {
    renderEditor([TAB_A], TAB_A.path);
    await waitFor(() => screen.getByTestId('webview'));
    expect(() => fireEvent.press(screen.getByLabelText('Undo'))).not.toThrow();
  });

  it('toggles multicursor mode on and shows the badge', async () => {
    renderEditor([TAB_A], TAB_A.path);
    await waitFor(() => screen.getByTestId('webview'));
    fireEvent.press(screen.getByLabelText('Add cursor mode'));
    expect(screen.getByText('+ CURSOR')).toBeTruthy();
  });

  it('dismisses multicursor badge when its close button is pressed', async () => {
    renderEditor([TAB_A], TAB_A.path);
    await waitFor(() => screen.getByTestId('webview'));
    fireEvent.press(screen.getByLabelText('Add cursor mode'));
    expect(screen.getByText('+ CURSOR')).toBeTruthy();
    fireEvent.press(screen.getByText('✕'));
    expect(screen.queryByText('+ CURSOR')).toBeNull();
  });

  it('preview button is disabled for non-previewable language', async () => {
    renderEditor([TAB_A], TAB_A.path); // TypeScript — not previewable
    await waitFor(() => screen.getByTestId('webview'));
    // isDisabled=true → onPress short-circuits, no crash
    expect(() => fireEvent.press(screen.getByLabelText('Toggle preview'))).not.toThrow();
    expect(screen.queryByText('PREVIEW')).toBeNull();
  });

  it('shows preview pane when preview is toggled for a markdown file', async () => {
    const mdTab = makeTab({
      path: '/docs/doc.md', name: 'doc.md', language: 'markdown', content: '# Hi',
    });
    renderEditor([mdTab], mdTab.path);
    await waitFor(() => screen.getByTestId('webview'));
    fireEvent.press(screen.getByLabelText('Toggle preview'));
    expect(screen.getByText('PREVIEW')).toBeTruthy();
  });

  it('handles fontSizeChanged WebView message by calling setFontSize', async () => {
    capturedOnMessage = undefined;
    renderEditor([TAB_A], TAB_A.path);
    await waitFor(() => screen.getByTestId('webview'));
    mockSetFontSize.mockClear();
    (capturedOnMessage as unknown as (e: object) => void)({
      nativeEvent: { data: JSON.stringify({ type: 'fontSizeChanged', fontSize: 16 }) },
    });
    expect(mockSetFontSize).toHaveBeenCalledWith(16);
  });
});

// ---------------------------------------------------------------------------
// Toolbar tooltips — TC-0325 – TC-0329
// ---------------------------------------------------------------------------

describe('Editor — toolbar tooltips', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  // TC-0325: long-press shows tooltip title
  it('shows tooltip title on long-press of a toolbar action button', async () => {
    renderEditor([TAB_A], TAB_A.path);
    await waitFor(() => screen.getByTestId('webview'));
    fireEvent(screen.getByLabelText('Undo'), 'longPress');
    expect(screen.getByTestId('toolbar-tooltip')).toBeTruthy();
    expect(screen.getByText('Undo')).toBeTruthy();
  });

  // TC-0326: tooltip auto-dismisses after 1500ms
  it('tooltip auto-dismisses after 1500ms', () => {
    jest.useFakeTimers();
    renderEditor([TAB_A], TAB_A.path);
    fireEvent(screen.getByLabelText('Undo'), 'longPress');
    expect(screen.getByTestId('toolbar-tooltip')).toBeTruthy();
    act(() => { jest.advanceTimersByTime(1500); });
    expect(screen.queryByTestId('toolbar-tooltip')).toBeNull();
  });

  // TC-0327: A- long-press shows "Decrease font size"
  it('shows "Decrease font size" tooltip on long-press of A-', async () => {
    renderEditor([TAB_A], TAB_A.path);
    await waitFor(() => screen.getByTestId('webview'));
    fireEvent(screen.getByLabelText('Decrease font size'), 'longPress');
    expect(screen.getByText('Decrease font size')).toBeTruthy();
  });

  // TC-0328: A+ long-press shows "Increase font size"
  it('shows "Increase font size" tooltip on long-press of A+', async () => {
    renderEditor([TAB_A], TAB_A.path);
    await waitFor(() => screen.getByTestId('webview'));
    fireEvent(screen.getByLabelText('Increase font size'), 'longPress');
    expect(screen.getByText('Increase font size')).toBeTruthy();
  });

  // TC-0329: tooltip strip absent on initial render
  it('tooltip strip is not shown initially', () => {
    renderEditor([TAB_A], TAB_A.path);
    expect(screen.queryByTestId('toolbar-tooltip')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// getLanguageForFile
// ---------------------------------------------------------------------------

describe('getLanguageForFile', () => {
  it.each([
    // TypeScript / JavaScript
    ['App.tsx',        'typescript'],
    ['index.ts',       'typescript'],
    ['App.jsx',        'javascript'],
    ['index.js',       'javascript'],
    ['module.mjs',     'javascript'],
    ['lib.cjs',        'javascript'],
    // Web
    ['style.css',      'css'],
    ['theme.scss',     'scss'],
    ['vars.less',      'less'],
    ['index.html',     'html'],
    ['page.htm',       'html'],
    ['feed.xml',       'xml'],
    // Data / config
    ['config.json',    'json'],
    ['settings.jsonc', 'jsonc'],
    ['README.md',      'markdown'],
    ['post.mdx',       'markdown'],
    ['ci.yaml',        'yaml'],
    ['ci.yml',         'yaml'],
    ['config.toml',    'toml'],
    ['.env',           'ini'],
    ['config.ini',     'ini'],
    ['app.cfg',        'ini'],
    ['schema.sql',     'sql'],
    ['query.graphql',  'graphql'],
    ['service.proto',  'proto'],
    // Systems languages
    ['main.rs',        'rust'],
    ['main.go',        'go'],
    ['App.swift',      'swift'],
    ['main.c',         'c'],
    ['main.cpp',       'cpp'],
    ['header.h',       'c'],
    ['header.hpp',     'cpp'],
    ['Main.java',      'java'],
    ['Main.kt',        'kotlin'],
    ['Program.cs',     'csharp'],
    ['Module.fs',      'fsharp'],
    ['Module.fsx',     'fsharp'],
    ['Main.scala',     'scala'],
    ['widget.dart',    'dart'],
    ['main.zig',       'zig'],
    ['AppDelegate.m',  'objective-c'],
    ['Module.vb',      'vb'],
    ['script.py',      'python'],
    ['app.rb',         'ruby'],
    ['index.php',      'php'],
    ['init.lua',       'lua'],
    ['router.ex',      'elixir'],
    ['config.exs',     'elixir'],
    ['analysis.r',     'r'],
    ['report.R',       'r'],
    ['parse.pl',       'perl'],
    ['utils.pm',       'perl'],
    // Shell / infra
    ['build.sh',       'shell'],
    ['run.bash',       'shell'],
    ['setup.zsh',      'shell'],
    ['deploy.ps1',     'powershell'],
    ['module.psm1',    'powershell'],
    ['main.tf',        'hcl'],
    ['vars.hcl',       'hcl'],
    // Dockerfile
    ['Dockerfile',     'dockerfile'],
    ['Dockerfile.dev', 'dockerfile'],
    // Vue SFCs → html fallback
    ['App.vue',        'html'],
    // Unknown → plaintext
    ['notes.txt',      'plaintext'],
    ['binary.bin',     'plaintext'],
    ['no-extension',   'plaintext'],
    // No dot at all → plaintext (not the whole filename as ext)
    ['test',           'plaintext'],
    ['README',         'plaintext'],
  ])('%s → %s', (filename, expected) => {
    expect(getLanguageForFile(filename)).toBe(expected);
  });

  it('is case-insensitive for extensions', () => {
    expect(getLanguageForFile('APP.TSX')).toBe('typescript');
    expect(getLanguageForFile('Index.JS')).toBe('javascript');
    expect(getLanguageForFile('DOCKERFILE')).toBe('dockerfile');
    // New languages — uppercase extensions
    expect(getLanguageForFile('Program.CS')).toBe('csharp');
    expect(getLanguageForFile('Module.FS')).toBe('fsharp');
    expect(getLanguageForFile('App.ZIG')).toBe('zig');
    expect(getLanguageForFile('Widget.DART')).toBe('dart');
    expect(getLanguageForFile('Analysis.R')).toBe('r');
    expect(getLanguageForFile('Router.EX')).toBe('elixir');
    expect(getLanguageForFile('Init.LUA')).toBe('lua');
  });

  it('handles files with multiple dots correctly', () => {
    expect(getLanguageForFile('index.test.ts')).toBe('typescript');
    expect(getLanguageForFile('config.prod.json')).toBe('json');
  });
});

// ---------------------------------------------------------------------------
// detectLanguageFromContent
// ---------------------------------------------------------------------------

describe('detectLanguageFromContent', () => {
  it('detects JSON from object literal', () => {
    expect(detectLanguageFromContent('{ "name": "test", "version": "1.0" }')).toBe('json');
  });

  it('detects JSON from array literal', () => {
    expect(detectLanguageFromContent('[1, 2, 3]')).toBe('json');
  });

  it('returns plaintext for invalid JSON starting with {', () => {
    // Starts with { but is not valid JSON — should not claim json
    expect(detectLanguageFromContent('{ not valid json at all }')).toBe('plaintext');
  });

  it('detects HTML from <!DOCTYPE html>', () => {
    expect(detectLanguageFromContent('<!DOCTYPE html>\n<html><body></body></html>')).toBe('html');
  });

  it('detects HTML from <html> tag', () => {
    expect(detectLanguageFromContent('<html lang="en"><head></head></html>')).toBe('html');
  });

  it('detects markdown with ATX heading + list (score ≥ 2)', () => {
    const md = '# Title\n\n- item one\n- item two\n\nSome text.';
    expect(detectLanguageFromContent(md)).toBe('markdown');
  });

  it('detects markdown with heading + bold', () => {
    const md = '## Section\n\nThis is **important** content.';
    expect(detectLanguageFromContent(md)).toBe('markdown');
  });

  it('does NOT detect markdown from a single heading with no other markers', () => {
    // Score < 2 → not confident enough → plaintext
    expect(detectLanguageFromContent('# Just a heading')).toBe('plaintext');
  });

  it('returns plaintext for empty content', () => {
    expect(detectLanguageFromContent('')).toBe('plaintext');
  });

  it('returns plaintext for plain prose', () => {
    expect(detectLanguageFromContent('This is just some plain text without any markers.')).toBe('plaintext');
  });
});

// ---------------------------------------------------------------------------
// Keyboard avoidance
// ---------------------------------------------------------------------------

describe('Editor — keyboard avoidance', () => {
  it('wraps the editor in a KeyboardAvoidingView with correct behavior and offset', async () => {
    const { UNSAFE_getByProps } = renderEditor([TAB_A], TAB_A.path);
    const kav = UNSAFE_getByProps({ testID: 'editor-keyboard-avoiding-view' });
    expect(kav).toBeTruthy();
    expect(kav.props.behavior).toBe(Platform.OS === 'ios' ? 'padding' : 'height');
    expect(kav.props.keyboardVerticalOffset).toBe(0);
  });

  it('wraps the empty state in a KeyboardAvoidingView with correct behavior', () => {
    const { UNSAFE_getByProps } = renderEditor([], null);
    const kav = UNSAFE_getByProps({ testID: 'editor-keyboard-avoiding-view' });
    expect(kav).toBeTruthy();
    expect(kav.props.behavior).toBe(Platform.OS === 'ios' ? 'padding' : 'height');
    expect(kav.props.keyboardVerticalOffset).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Language rules dispatch
// ---------------------------------------------------------------------------

/** Extract the parsed payload from the first setContent injectJavaScript call. */
function getSetContentPayload(): Record<string, unknown> | null {
  if (!capturedInjectJS) return null;
  for (const [callArg] of capturedInjectJS.mock.calls) {
    if (typeof callArg !== 'string') continue;
    // The injected JS is: window.dispatchEvent(new MessageEvent('message',{data:<JSON>}));true;
    const match = callArg.match(/data:(.*?)\}\)\);true;/s);
    if (!match) continue;
    try {
      const outerJson = JSON.parse(match[1]);
      const inner = JSON.parse(outerJson);
      if (inner?.type === 'setContent') return inner;
    } catch {
      // ignore parse errors from other injected JS
    }
  }
  return null;
}

describe('Editor — language rules dispatch', () => {
  beforeEach(() => {
    capturedInjectJS = undefined;
  });

  it('includes rules in the setContent payload for a TypeScript file (tabSize 2)', async () => {
    const tsTab = makeTab({ path: '/src/App.tsx', name: 'App.tsx', language: 'typescript' });
    renderEditor([tsTab], tsTab.path);
    await waitFor(() => expect(capturedInjectJS).toBeDefined());
    await waitFor(() => expect(capturedInjectJS?.mock.calls.length).toBeGreaterThan(0));
    const payload = getSetContentPayload();
    expect(payload).not.toBeNull();
    expect(payload?.rules).toBeDefined();
    expect((payload?.rules as Record<string, unknown>)?.indent).toMatchObject({
      tabSize: 2,
      insertSpaces: true,
      detectIndentation: false,
    });
  });

  it('includes rules for a Go file (insertSpaces: false — hard tabs)', async () => {
    const goTab = makeTab({ path: '/src/main.go', name: 'main.go', language: 'go' });
    renderEditor([goTab], goTab.path);
    await waitFor(() => expect(capturedInjectJS).toBeDefined());
    await waitFor(() => expect(capturedInjectJS?.mock.calls.length).toBeGreaterThan(0));
    const payload = getSetContentPayload();
    expect((payload?.rules as Record<string, unknown>)?.indent).toMatchObject({
      tabSize: 4,
      insertSpaces: false,
      detectIndentation: false,
    });
  });

  it('includes rules for a Python file (autoClosingQuotes: languageDefined)', async () => {
    const pyTab = makeTab({ path: '/src/main.py', name: 'main.py', language: 'python' });
    renderEditor([pyTab], pyTab.path);
    await waitFor(() => expect(capturedInjectJS).toBeDefined());
    await waitFor(() => expect(capturedInjectJS?.mock.calls.length).toBeGreaterThan(0));
    const payload = getSetContentPayload();
    expect((payload?.rules as Record<string, unknown>)?.autoClose).toMatchObject({
      autoClosingQuotes: 'languageDefined',
    });
  });

  it('includes rules for a C# file (tabSize 4)', async () => {
    const csTab = makeTab({ path: '/src/Program.cs', name: 'Program.cs', language: 'csharp' });
    renderEditor([csTab], csTab.path);
    await waitFor(() => expect(capturedInjectJS).toBeDefined());
    await waitFor(() => expect(capturedInjectJS?.mock.calls.length).toBeGreaterThan(0));
    const payload = getSetContentPayload();
    expect((payload?.rules as Record<string, unknown>)?.indent).toMatchObject({
      tabSize: 4,
      insertSpaces: true,
    });
  });

  it('falls back to default rules (tabSize 4, spaces) for a plaintext file', async () => {
    const txtTab = makeTab({ path: '/notes.txt', name: 'notes.txt', language: 'plaintext' });
    renderEditor([txtTab], txtTab.path);
    await waitFor(() => expect(capturedInjectJS).toBeDefined());
    await waitFor(() => expect(capturedInjectJS?.mock.calls.length).toBeGreaterThan(0));
    const payload = getSetContentPayload();
    expect((payload?.rules as Record<string, unknown>)?.indent).toMatchObject({
      tabSize: 4,
      insertSpaces: true,
      detectIndentation: false,
    });
    expect((payload?.rules as Record<string, unknown>)?.autoClose).toMatchObject({
      autoClosingQuotes: 'always',
    });
  });

  it('does not throw when handleMessage receives an unknown message type', async () => {
    renderEditor([TAB_A], TAB_A.path);
    await waitFor(() => screen.getByTestId('webview'));
    expect(() =>
      (capturedOnMessage as (e: object) => void)({
        nativeEvent: { data: JSON.stringify({ type: 'unknownFutureType', payload: {} }) },
      })
    ).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// fold commands
// ---------------------------------------------------------------------------

describe('fold commands', () => {
  beforeEach(() => {
    capturedInjectJS = undefined;
  });

  it('injects FOLD_ALL when sendFoldAll is called via ref', async () => {
    const ref = React.createRef<EditorHandle>();
    render(
      <Editor
        ref={ref}
        tabs={[TAB_A]}
        activeTabPath={TAB_A.path}
        onTabChange={jest.fn()}
        onTabClose={jest.fn()}
        onContentChange={jest.fn()}
        onSave={jest.fn()}
      />,
    );
    await waitFor(() => screen.getByTestId('webview'));
    act(() => { ref.current?.sendFoldAll(); });
    const calls = (capturedInjectJS as jest.Mock).mock.calls.flat().join(' ');
    expect(calls).toContain('FOLD_ALL');
  });

  it('injects UNFOLD_ALL when sendUnfoldAll is called via ref', async () => {
    const ref = React.createRef<EditorHandle>();
    render(
      <Editor
        ref={ref}
        tabs={[TAB_A]}
        activeTabPath={TAB_A.path}
        onTabChange={jest.fn()}
        onTabClose={jest.fn()}
        onContentChange={jest.fn()}
        onSave={jest.fn()}
      />,
    );
    await waitFor(() => screen.getByTestId('webview'));
    act(() => { ref.current?.sendUnfoldAll(); });
    const calls = (capturedInjectJS as jest.Mock).mock.calls.flat().join(' ');
    expect(calls).toContain('UNFOLD_ALL');
  });
});

// ---------------------------------------------------------------------------
// view state persistence
// ---------------------------------------------------------------------------

describe('view state persistence', () => {
  beforeEach(() => {
    capturedInjectJS = undefined;
    capturedOnMessage = undefined;
  });

  it('stores viewState when SAVE_VIEW_STATE message received', async () => {
    const onTabViewStateChange = jest.fn();
    render(
      <Editor
        tabs={[TAB_A]}
        activeTabPath={TAB_A.path}
        onTabChange={jest.fn()}
        onTabClose={jest.fn()}
        onContentChange={jest.fn()}
        onSave={jest.fn()}
        onTabViewStateChange={onTabViewStateChange}
      />,
    );
    await waitFor(() => screen.getByTestId('webview'));

    await act(async () => {
      capturedOnMessage?.({
        nativeEvent: { data: JSON.stringify({ type: 'SAVE_VIEW_STATE', path: TAB_A.path, viewState: '{"scrollTop":100}' }) },
      } as any);
    });

    expect(onTabViewStateChange).toHaveBeenCalledWith(TAB_A.path, '{"scrollTop":100}');
  });

  it('sends RESTORE_VIEW_STATE when tab with viewState becomes active', async () => {
    const tabWithState = { ...TAB_A, viewState: '{"scrollTop":50}' };
    render(
      <Editor
        tabs={[tabWithState]}
        activeTabPath={tabWithState.path}
        onTabChange={jest.fn()}
        onTabClose={jest.fn()}
        onContentChange={jest.fn()}
        onSave={jest.fn()}
      />,
    );

    await waitFor(() => {
      const calls = (capturedInjectJS as jest.Mock)?.mock.calls.flat().join(' ') ?? '';
      expect(calls).toContain('RESTORE_VIEW_STATE');
    });
  });
});

// ---------------------------------------------------------------------------
// scrollTo in setContent
// ---------------------------------------------------------------------------

describe('scrollTo in setContent', () => {
  beforeEach(() => {
    capturedInjectJS = undefined;
  });

  it('includes scrollTo fields in injectJavaScript payload when tab has scrollTo', async () => {
    const scrollTab = makeTab({
      path: '/workspace/src/App.tsx',
      name: 'App.tsx',
      language: 'typescript',
      content: 'const x = 1;',
      isDirty: false,
      scrollTo: { line: 42, matchStart: 6, matchEnd: 9 },
    });
    renderEditor([scrollTab], scrollTab.path);
    await waitFor(() => expect(capturedInjectJS).toBeDefined());
    await waitFor(() => expect(capturedInjectJS?.mock.calls.length).toBeGreaterThan(0));
    const payload = getSetContentPayload();
    expect(payload).not.toBeNull();
    expect(payload?.scrollTo).toEqual({ line: 42, matchStart: 6, matchEnd: 9 });
  });

  it('includes scrollTo as null when tab has no scrollTo', async () => {
    const tab = makeTab({ path: '/workspace/src/plain.ts', name: 'plain.ts', language: 'typescript' });
    renderEditor([tab], tab.path);
    await waitFor(() => expect(capturedInjectJS).toBeDefined());
    await waitFor(() => expect(capturedInjectJS?.mock.calls.length).toBeGreaterThan(0));
    const payload = getSetContentPayload();
    expect(payload).not.toBeNull();
    expect(payload?.scrollTo).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Git gutter decorations
// ---------------------------------------------------------------------------

describe('git gutter decorations', () => {
  it('exposes sendGutterDecorations via ref', async () => {
    const ref = React.createRef<{ sendGutterDecorations: (diff: import('../../src/types/git').GutterDiff) => void }>();
    render(
      <Editor
        ref={ref as React.Ref<import('../../src/components/Editor').EditorHandle>}
        tabs={[TAB_A]}
        activeTabPath={TAB_A.path}
        onTabChange={jest.fn()}
        onTabClose={jest.fn()}
        onContentChange={jest.fn()}
        onSave={jest.fn()}
      />,
    );
    await waitFor(() => expect(typeof ref.current?.sendGutterDecorations).toBe('function'));
  });

  it('exposes sendBlameData via ref', async () => {
    const ref = React.createRef<{ sendBlameData: (lines: import('../../src/types/git').BlameLine[]) => void }>();
    render(
      <Editor
        ref={ref as React.Ref<import('../../src/components/Editor').EditorHandle>}
        tabs={[TAB_A]}
        activeTabPath={TAB_A.path}
        onTabChange={jest.fn()}
        onTabClose={jest.fn()}
        onContentChange={jest.fn()}
        onSave={jest.fn()}
      />,
    );
    await waitFor(() => expect(typeof ref.current?.sendBlameData).toBe('function'));
  });
});
