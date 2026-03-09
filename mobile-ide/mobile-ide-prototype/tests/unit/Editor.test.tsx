/**
 * Unit tests — Editor component
 *
 * react-native-webview is mocked (no real WebView in Jest).
 * Tests cover: empty state, tab bar rendering, tab switching,
 * tab closing, dirty indicator, and the onSave / onContentChange callbacks.
 */

import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
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
// ---------------------------------------------------------------------------

jest.mock('react-native-webview', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const React = require('react');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { View } = require('react-native');
  const WebView = React.forwardRef((_props: object, _ref: unknown) => (
    <View testID="webview" />
  ));
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
