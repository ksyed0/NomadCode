/**
 * Unit tests — Editor component
 *
 * react-native-webview is mocked (no real WebView in Jest).
 * Tests cover: empty state, tab bar rendering, tab switching,
 * tab closing, dirty indicator, and the onSave / onContentChange callbacks.
 */

import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import Editor, { EditorTab, buildPreviewHtml, canPreview } from '../../src/components/Editor';

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
// Captures onMessage + injectJavaScript so tests can simulate Monaco events.
// Variables must be prefixed with "mock" to satisfy jest.mock() hoisting rules.
// ---------------------------------------------------------------------------

let mockOnMessage: ((e: object) => void) | undefined;
let mockInjectJS: jest.Mock = jest.fn();

function fireWebViewMessage(data: object) {
  act(() => {
    mockOnMessage?.({ nativeEvent: { data: JSON.stringify(data) } });
  });
}

jest.mock('react-native-webview', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const React = require('react');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { View } = require('react-native');
  const WebView = React.forwardRef((props: { onMessage?: (e: object) => void }, ref: unknown) => {
    mockOnMessage = props.onMessage;
    React.useImperativeHandle(ref, () => {
      mockInjectJS = jest.fn();
      return { injectJavaScript: mockInjectJS };
    });
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
// US-0003 — Save: Monaco message callbacks
// ---------------------------------------------------------------------------

describe('Editor — save (US-0003)', () => {
  it('fires onSave with path and content when Monaco sends a save message', async () => {
    const onSave = jest.fn();
    renderEditor([TAB_A], TAB_A.path, { onSave });
    await waitFor(() => screen.getByTestId('webview'));
    fireWebViewMessage({ type: 'save', content: 'saved content' });
    expect(onSave).toHaveBeenCalledWith('/docs/App.tsx', 'saved content');
  });

  it('fires onContentChange with path and content when Monaco sends contentChanged', async () => {
    const onContentChange = jest.fn();
    renderEditor([TAB_A], TAB_A.path, { onContentChange });
    await waitFor(() => screen.getByTestId('webview'));
    fireWebViewMessage({ type: 'contentChanged', content: 'edited text' });
    expect(onContentChange).toHaveBeenCalledWith('/docs/App.tsx', 'edited text');
  });

  it('does not fire onSave when there is no active tab', async () => {
    const onSave = jest.fn();
    renderEditor([TAB_A, TAB_B], null, { onSave });
    await waitFor(() => screen.getByTestId('webview'));
    fireWebViewMessage({ type: 'save', content: 'anything' });
    expect(onSave).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// US-0004 — Undo / Redo: toolbar sends correct commands to Monaco
// ---------------------------------------------------------------------------

describe('Editor — undo / redo (US-0004)', () => {
  it('sends undo command to Monaco when ↩ is pressed', async () => {
    renderEditor([TAB_A], TAB_A.path);
    await waitFor(() => screen.getByTestId('webview'));
    fireEvent.press(screen.getByLabelText('Undo'));
    // injectJavaScript double-encodes JSON: "type":"undo" → \"type\":\"undo\"
    expect(mockInjectJS).toHaveBeenCalledWith(
      expect.stringContaining('\\"type\\":\\"undo\\"'),
    );
  });

  it('sends redo command to Monaco when ↪ is pressed', async () => {
    renderEditor([TAB_A], TAB_A.path);
    await waitFor(() => screen.getByTestId('webview'));
    fireEvent.press(screen.getByLabelText('Redo'));
    expect(mockInjectJS).toHaveBeenCalledWith(
      expect.stringContaining('\\"type\\":\\"redo\\"'),
    );
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
  it('decrements font size when A- is pressed', async () => {
    renderEditor([TAB_A], TAB_A.path);
    await waitFor(() => screen.getByTestId('webview'));
    fireEvent.press(screen.getByText('A-'));
    expect(screen.getByText('13')).toBeTruthy();
  });

  it('increments font size when A+ is pressed', async () => {
    renderEditor([TAB_A], TAB_A.path);
    await waitFor(() => screen.getByTestId('webview'));
    fireEvent.press(screen.getByText('A+'));
    expect(screen.getByText('15')).toBeTruthy();
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
});
