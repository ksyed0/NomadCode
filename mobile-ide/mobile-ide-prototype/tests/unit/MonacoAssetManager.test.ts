/**
 * Unit tests — MonacoAssetManager
 *
 * All expo-file-system calls are mocked so tests run without a device.
 * Covers: resolve(), isOfflineAvailable(), downloadForOffline(),
 *         clearCache(), cacheDir getter, and buildMonacoHtml().
 */

import {
  MonacoAssetManager,
  buildMonacoHtml,
  MONACO_VERSION,
} from '../../src/utils/MonacoAssetManager';

// ---------------------------------------------------------------------------
// Mock expo-file-system
// ---------------------------------------------------------------------------

const mockGetInfoAsync = jest.fn();
const mockMakeDirectoryAsync = jest.fn();
const mockDownloadAsync = jest.fn();
const mockDeleteAsync = jest.fn();

jest.mock('expo-file-system/legacy', () => ({
  getInfoAsync: (...args: unknown[]) => mockGetInfoAsync(...args),
  makeDirectoryAsync: (...args: unknown[]) => mockMakeDirectoryAsync(...args),
  downloadAsync: (...args: unknown[]) => mockDownloadAsync(...args),
  deleteAsync: (...args: unknown[]) => mockDeleteAsync(...args),
  documentDirectory: 'file:///data/user/0/com.test/',
}));

const CDN_BASE = `https://cdn.jsdelivr.net/npm/monaco-editor@${MONACO_VERSION}/min/vs`;

beforeEach(() => {
  jest.clearAllMocks();
  mockMakeDirectoryAsync.mockResolvedValue(undefined);
  mockDownloadAsync.mockResolvedValue(undefined);
  mockDeleteAsync.mockResolvedValue(undefined);
});

// ---------------------------------------------------------------------------
// resolve()
// ---------------------------------------------------------------------------

describe('MonacoAssetManager.resolve()', () => {
  it('returns local baseUrl and isOffline=true when both core files are cached', async () => {
    mockGetInfoAsync.mockResolvedValue({ exists: true });

    const result = await MonacoAssetManager.resolve();

    expect(result.isOffline).toBe(true);
    expect(result.baseUrl).toContain('monaco');
    expect(result.baseUrl).toContain(MONACO_VERSION);
  });

  it('falls back to CDN when loader.js is not cached', async () => {
    mockGetInfoAsync
      .mockResolvedValueOnce({ exists: false })
      .mockResolvedValueOnce({ exists: true });

    const result = await MonacoAssetManager.resolve();

    expect(result.isOffline).toBe(false);
    expect(result.baseUrl).toBe(CDN_BASE);
  });

  it('falls back to CDN when editor.main.js is not cached', async () => {
    mockGetInfoAsync
      .mockResolvedValueOnce({ exists: true })
      .mockResolvedValueOnce({ exists: false });

    const result = await MonacoAssetManager.resolve();

    expect(result.isOffline).toBe(false);
    expect(result.baseUrl).toBe(CDN_BASE);
  });

  it('falls back to CDN when getInfoAsync throws', async () => {
    mockGetInfoAsync.mockRejectedValue(new Error('FS error'));

    const result = await MonacoAssetManager.resolve();

    expect(result.isOffline).toBe(false);
    expect(result.baseUrl).toBe(CDN_BASE);
  });
});

// ---------------------------------------------------------------------------
// isOfflineAvailable()
// ---------------------------------------------------------------------------

describe('MonacoAssetManager.isOfflineAvailable()', () => {
  it('returns true when all core files exist', async () => {
    mockGetInfoAsync.mockResolvedValue({ exists: true });

    expect(await MonacoAssetManager.isOfflineAvailable()).toBe(true);
  });

  it('returns false when any core file is missing', async () => {
    mockGetInfoAsync
      .mockResolvedValueOnce({ exists: true })
      .mockResolvedValueOnce({ exists: false });

    expect(await MonacoAssetManager.isOfflineAvailable()).toBe(false);
  });

  it('returns false when getInfoAsync throws', async () => {
    mockGetInfoAsync.mockRejectedValue(new Error('FS error'));

    expect(await MonacoAssetManager.isOfflineAvailable()).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// downloadForOffline()
// ---------------------------------------------------------------------------

describe('MonacoAssetManager.downloadForOffline()', () => {
  it('creates directories and downloads each core file', async () => {
    await MonacoAssetManager.downloadForOffline();

    expect(mockMakeDirectoryAsync).toHaveBeenCalled();
    expect(mockDownloadAsync).toHaveBeenCalled();
  });

  it('calls onProgress with 0–100 values', async () => {
    const progress: number[] = [];
    await MonacoAssetManager.downloadForOffline((pct) => progress.push(pct));

    expect(progress.length).toBeGreaterThan(0);
    expect(progress[progress.length - 1]).toBe(100);
    progress.forEach((p) => {
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThanOrEqual(100);
    });
  });

  it('works without an onProgress callback', async () => {
    await expect(MonacoAssetManager.downloadForOffline()).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// clearCache()
// ---------------------------------------------------------------------------

describe('MonacoAssetManager.clearCache()', () => {
  it('calls deleteAsync on the monaco base directory', async () => {
    await MonacoAssetManager.clearCache();

    expect(mockDeleteAsync).toHaveBeenCalledWith(
      expect.stringContaining('monaco'),
      { idempotent: true },
    );
  });
});

// ---------------------------------------------------------------------------
// cacheDir getter
// ---------------------------------------------------------------------------

describe('MonacoAssetManager.cacheDir', () => {
  it('returns a string containing the monaco version', () => {
    expect(MonacoAssetManager.cacheDir).toContain(MONACO_VERSION);
  });
});

// ---------------------------------------------------------------------------
// buildMonacoHtml()
// ---------------------------------------------------------------------------

describe('buildMonacoHtml()', () => {
  const CDN = CDN_BASE;
  const LOCAL = 'file:///data/user/0/com.test/monaco/vs';

  it('returns a non-empty HTML string', () => {
    const html = buildMonacoHtml(CDN);
    expect(typeof html).toBe('string');
    expect(html.length).toBeGreaterThan(0);
  });

  it('contains HTML5 doctype and body tags', () => {
    const html = buildMonacoHtml(CDN);
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('<body>');
  });

  it('embeds the vsBaseUrl in the loader script src', () => {
    const html = buildMonacoHtml(CDN);
    expect(html).toContain(CDN);
  });

  it('embeds a local file:// URL correctly', () => {
    const html = buildMonacoHtml(LOCAL);
    expect(html).toContain(LOCAL);
  });

  it('includes the Monaco require config', () => {
    const html = buildMonacoHtml(CDN);
    expect(html).toContain('require.config');
  });

  it('includes a loading indicator', () => {
    const html = buildMonacoHtml(CDN);
    expect(html).toContain('loading');
  });

  it('includes multi-cursor overlay element', () => {
    const html = buildMonacoHtml(CDN);
    expect(html).toContain('mc-overlay');
  });

  it('includes ReactNativeWebView.postMessage', () => {
    const html = buildMonacoHtml(CDN);
    expect(html).toContain('ReactNativeWebView');
    expect(html).toContain('postMessage');
  });

  it('handles CDN fallback loader error', () => {
    const html = buildMonacoHtml(CDN);
    expect(html).toContain('onLoaderError');
  });

  it('includes applyLanguageRules case in the message handler', () => {
    const html = buildMonacoHtml(CDN);
    expect(html).toContain('applyLanguageRules');
  });

  it('applyLanguageRules handler calls model.updateOptions and editor.updateOptions', () => {
    const html = buildMonacoHtml(CDN);
    // Both update paths must exist within the handler
    expect(html).toContain('model3.updateOptions');
    expect(html).toContain('autoClosingBrackets');
    expect(html).toContain('autoClosingQuotes');
  });

  it('includes default: break fallback in the message switch', () => {
    const html = buildMonacoHtml(CDN);
    expect(html).toContain('default:');
  });

  it('includes scrollToLine case in the message handler', () => {
    const html = buildMonacoHtml(CDN);
    expect(html).toContain('scrollToLine');
  });

  it('scrollToLine handler calls revealLineInCenter', () => {
    const html = buildMonacoHtml(CDN);
    expect(html).toContain('revealLineInCenter');
  });

  it('scrollToLine handler calls deltaDecorations', () => {
    const html = buildMonacoHtml(CDN);
    expect(html).toContain('deltaDecorations');
  });

  it('scrollToLine handler sets a cleanup timeout', () => {
    const html = buildMonacoHtml(CDN);
    expect(html).toContain('setTimeout');
  });

  it('injects search-match-highlight CSS class', () => {
    const html = buildMonacoHtml(CDN);
    expect(html).toContain('search-match-highlight');
  });

  it('setContent message with scrollTo calls revealLineInCenter', () => {
    const html = buildMonacoHtml(CDN);
    // The setContent handler should reference scrollTo
    expect(html).toContain('msg.scrollTo');
  });

  it('TC-0370: setContent message calls editor.focus() after setting content', () => {
    const html = buildMonacoHtml(CDN);
    // The setContent case must call editor.focus() so the Android soft keyboard
    // receives key events immediately after content is loaded.
    const setContentIdx = html.indexOf("case 'setContent':");
    const nextCaseIdx = html.indexOf("case 'format':", setContentIdx);
    const setContentBlock = html.slice(setContentIdx, nextCaseIdx);
    expect(setContentBlock).toContain('editor.focus()');
  });
});
