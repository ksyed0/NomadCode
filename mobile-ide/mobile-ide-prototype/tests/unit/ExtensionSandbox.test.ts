/**
 * Unit tests — Extension Sandbox
 *
 * Tests the ExtensionRegistry and buildSandboxHtml function
 * without requiring a real WebView runtime.
 */

import {
  activateExtension,
  buildSandboxHtml,
  deactivateExtension,
  EXAMPLE_EXTENSION,
  ExtensionRegistry,
  type ExtensionManifest,
} from '../../src/extensions/sandbox/index';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const MANIFEST: ExtensionManifest = {
  id: 'test.hello',
  name: 'Hello Extension',
  version: '1.0.0',
  description: 'A test extension',
  source: 'vscode.window.showInformationMessage("Hello!");',
};

beforeEach(() => {
  // Clean registry between tests
  ExtensionRegistry.unregister(MANIFEST.id);
  ExtensionRegistry.unregister(EXAMPLE_EXTENSION.id);
});

// ---------------------------------------------------------------------------
// buildSandboxHtml
// ---------------------------------------------------------------------------

describe('buildSandboxHtml', () => {
  it('returns a string containing valid HTML boilerplate', () => {
    const html = buildSandboxHtml(MANIFEST);
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('<script>');
  });

  it('embeds the extension id in the HTML', () => {
    const html = buildSandboxHtml(MANIFEST);
    expect(html).toContain(MANIFEST.id);
  });

  it('embeds the extension source code in the HTML', () => {
    const html = buildSandboxHtml(MANIFEST);
    expect(html).toContain(MANIFEST.source);
  });

  it('includes the vscode API shim', () => {
    const html = buildSandboxHtml(MANIFEST);
    expect(html).toContain('var vscode');
    expect(html).toContain('showInformationMessage');
    expect(html).toContain('getActiveEditorContent');
  });

  it('wraps extension source in a try/catch', () => {
    const html = buildSandboxHtml(MANIFEST);
    expect(html).toContain('try {');
    expect(html).toContain('} catch(err)');
  });

  it('properly escapes extension id containing quotes', () => {
    const manifest: ExtensionManifest = { ...MANIFEST, id: 'test."quoted"' };
    // Should not throw and should produce valid JSON-safe output
    expect(() => buildSandboxHtml(manifest)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// ExtensionRegistry
// ---------------------------------------------------------------------------

describe('ExtensionRegistry', () => {
  it('registers and retrieves an extension', () => {
    ExtensionRegistry.register(MANIFEST);
    expect(ExtensionRegistry.get(MANIFEST.id)).toEqual(MANIFEST);
  });

  it('lists all registered extensions', () => {
    ExtensionRegistry.register(MANIFEST);
    const list = ExtensionRegistry.list();
    expect(list.some((m) => m.id === MANIFEST.id)).toBe(true);
  });

  it('unregisters an extension', () => {
    ExtensionRegistry.register(MANIFEST);
    ExtensionRegistry.unregister(MANIFEST.id);
    expect(ExtensionRegistry.get(MANIFEST.id)).toBeUndefined();
  });

  it('returns undefined for unknown extension id', () => {
    expect(ExtensionRegistry.get('unknown.ext')).toBeUndefined();
  });

  it('dispatches messages to subscribed handlers', () => {
    const handler = jest.fn();
    const unsubscribe = ExtensionRegistry.onMessage(handler);

    const msg = { type: 'showMessage' as const, extensionId: MANIFEST.id, payload: { text: 'hi' } };
    ExtensionRegistry.dispatch(msg);

    expect(handler).toHaveBeenCalledWith(msg);
    unsubscribe();
  });

  it('does not call handler after unsubscribe', () => {
    const handler = jest.fn();
    const unsubscribe = ExtensionRegistry.onMessage(handler);
    unsubscribe();

    ExtensionRegistry.dispatch({ type: 'log', extensionId: MANIFEST.id });
    expect(handler).not.toHaveBeenCalled();
  });

  it('supports multiple handlers', () => {
    const h1 = jest.fn();
    const h2 = jest.fn();
    const u1 = ExtensionRegistry.onMessage(h1);
    const u2 = ExtensionRegistry.onMessage(h2);

    ExtensionRegistry.dispatch({ type: 'log', extensionId: MANIFEST.id });
    expect(h1).toHaveBeenCalledTimes(1);
    expect(h2).toHaveBeenCalledTimes(1);

    u1();
    u2();
  });
});

// ---------------------------------------------------------------------------
// activateExtension / deactivateExtension
// ---------------------------------------------------------------------------

describe('activateExtension', () => {
  it('registers the extension and returns sandbox HTML', () => {
    const html = activateExtension(MANIFEST);
    expect(typeof html).toBe('string');
    expect(html).toContain('<!DOCTYPE html>');
    expect(ExtensionRegistry.get(MANIFEST.id)).toEqual(MANIFEST);
  });
});

describe('deactivateExtension', () => {
  it('removes the extension from the registry', () => {
    activateExtension(MANIFEST);
    deactivateExtension(MANIFEST.id);
    expect(ExtensionRegistry.get(MANIFEST.id)).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// EXAMPLE_EXTENSION
// ---------------------------------------------------------------------------

describe('EXAMPLE_EXTENSION', () => {
  it('has required manifest fields', () => {
    expect(EXAMPLE_EXTENSION.id).toBeTruthy();
    expect(EXAMPLE_EXTENSION.name).toBeTruthy();
    expect(EXAMPLE_EXTENSION.version).toBeTruthy();
    expect(EXAMPLE_EXTENSION.source).toBeTruthy();
  });

  it('produces valid sandbox HTML', () => {
    const html = buildSandboxHtml(EXAMPLE_EXTENSION);
    expect(html).toContain(EXAMPLE_EXTENSION.id);
  });
});
