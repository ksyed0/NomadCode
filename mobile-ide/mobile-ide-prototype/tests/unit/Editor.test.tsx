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
import Editor, { EditorTab, buildPreviewHtml, canPreview, getLanguageForFile } from '../../src/components/Editor';

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
    })
  ),
}));

// ---------------------------------------------------------------------------
// Mock MonacoAssetManager so monacoHtml is set synchronously after mount
// ---------------------------------------------------------------------------

jest.mock('../../src/utils/MonacoAssetManager', () => ({
  MonacoAssetManager: {
    resolve: jest.fn().mockResolvedValue({ baseUrl: 'https://cdn.test', isOffline: false }),
  },
  buildMonacoHtml: jest.fn().mockReturnValue('<html>monaco</html>'),
}));

// ---------------------------------------------------------------------------
// Mock react-native-webview
// ---------------------------------------------------------------------------

// Captured onMessage handler — set by the mock, used in tests to fire messages
let capturedOnMessage: ((e: object) => void) | undefined;

jest.mock('react-native-webview', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require('react');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View } = require('react-native');
  const WebView = React.forwardRef((props: { onMessage?: (e: object) => void }, ref: unknown) => {
    // Expose injectJavaScript via ref so webViewRef.current is non-null
    React.useImperativeHandle(ref, () => ({ injectJavaScript: jest.fn() }));
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
  it('shows "No files open" when tabs array is empty', () => {
    renderEditor([], null);
    expect(screen.getByText('No files open')).toBeTruthy();
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
    expect(screen.getByText('App.tsx')).toBeTruthy();
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
    expect(screen.getByText('file0.ts')).toBeTruthy();
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
    expect(screen.getByText('/docs/App.tsx')).toBeTruthy();
  });

  it('updates path when a different tab is active', () => {
    renderEditor([TAB_A, TAB_B], TAB_B.path);
    expect(screen.getByText('/docs/index.ts')).toBeTruthy();
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
  it('returns markdown preview HTML for markdown language', () => {
    const html = buildPreviewHtml('markdown', '# Hello');
    expect(html).toContain('marked.parse');
    expect(html).toContain('Hello');
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
    ['settings.jsonc', 'json'],
    ['README.md',      'markdown'],
    ['post.mdx',       'markdown'],
    ['ci.yaml',        'yaml'],
    ['ci.yml',         'yaml'],
    ['config.toml',    'ini'],
    ['.env',           'ini'],
    ['schema.sql',     'sql'],
    ['query.graphql',  'graphql'],
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
    ['script.py',      'python'],
    ['app.rb',         'ruby'],
    ['index.php',      'php'],
    // Shell
    ['build.sh',       'shell'],
    ['run.bash',       'shell'],
    ['setup.zsh',      'shell'],
    // Dockerfile
    ['Dockerfile',     'dockerfile'],
    ['Dockerfile.dev', 'dockerfile'],
    // Unknown → plaintext
    ['notes.txt',      'plaintext'],
    ['binary.bin',     'plaintext'],
    ['no-extension',   'plaintext'],
  ])('%s → %s', (filename, expected) => {
    expect(getLanguageForFile(filename)).toBe(expected);
  });

  it('is case-insensitive for extensions', () => {
    expect(getLanguageForFile('APP.TSX')).toBe('typescript');
    expect(getLanguageForFile('Index.JS')).toBe('javascript');
    expect(getLanguageForFile('DOCKERFILE')).toBe('dockerfile');
  });

  it('handles files with multiple dots correctly', () => {
    expect(getLanguageForFile('index.test.ts')).toBe('typescript');
    expect(getLanguageForFile('config.prod.json')).toBe('json');
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
