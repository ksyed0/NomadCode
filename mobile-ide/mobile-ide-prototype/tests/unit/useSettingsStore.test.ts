/**
 * Unit tests — useSettingsStore
 *
 * AsyncStorage is mocked so tests run in Node without a device.
 * Coverage: default state, setTheme, setFontSize (with clamp), setWorkspacePath,
 * setWorkspaceRoot (atomic workspace root), completeSetup.
 */

import { act, renderHook } from '@testing-library/react-native';

// Mock AsyncStorage before importing the store
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
  removeItem: jest.fn(() => Promise.resolve()),
}));

import useSettingsStore from '../../src/stores/useSettingsStore';

beforeEach(() => {
  useSettingsStore.setState({
    theme: 'nomad-dark',
    fontSize: 14,
    workspacePath: '',
    workspaceUri: '',
    workspaceUriType: 'file',
    workspaceDisplayName: '',
    hasCompletedSetup: false,
    installedExtensions: [],
  });
  jest.clearAllMocks();
});

describe('useSettingsStore — default state', () => {
  it('defaults theme to nomad-dark', () => {
    const { result } = renderHook(() => useSettingsStore());
    expect(result.current.theme).toBe('nomad-dark');
  });

  it('defaults fontSize to 14', () => {
    const { result } = renderHook(() => useSettingsStore());
    expect(result.current.fontSize).toBe(14);
  });

  it('defaults workspacePath to empty string', () => {
    const { result } = renderHook(() => useSettingsStore());
    expect(result.current.workspacePath).toBe('');
  });

  it('defaults workspaceUri to empty string', () => {
    const { result } = renderHook(() => useSettingsStore());
    expect(result.current.workspaceUri).toBe('');
  });

  it('defaults workspaceUriType to file', () => {
    const { result } = renderHook(() => useSettingsStore());
    expect(result.current.workspaceUriType).toBe('file');
  });

  it('defaults workspaceDisplayName to empty string', () => {
    const { result } = renderHook(() => useSettingsStore());
    expect(result.current.workspaceDisplayName).toBe('');
  });

  it('defaults hasCompletedSetup to false', () => {
    const { result } = renderHook(() => useSettingsStore());
    expect(result.current.hasCompletedSetup).toBe(false);
  });

  it('defaults installedExtensions to empty array', () => {
    const { result } = renderHook(() => useSettingsStore());
    expect(result.current.installedExtensions).toEqual([]);
  });
});

describe('useSettingsStore — actions', () => {
  it('setTheme updates the theme id', () => {
    const { result } = renderHook(() => useSettingsStore());
    act(() => { result.current.setTheme('dracula'); });
    expect(result.current.theme).toBe('dracula');
  });

  it('setFontSize updates fontSize', () => {
    const { result } = renderHook(() => useSettingsStore());
    act(() => { result.current.setFontSize(18); });
    expect(result.current.fontSize).toBe(18);
  });

  it('setFontSize clamps to minimum 8', () => {
    const { result } = renderHook(() => useSettingsStore());
    act(() => { result.current.setFontSize(4); });
    expect(result.current.fontSize).toBe(8);
  });

  it('setFontSize clamps to maximum 32', () => {
    const { result } = renderHook(() => useSettingsStore());
    act(() => { result.current.setFontSize(99); });
    expect(result.current.fontSize).toBe(32);
  });

  it('setWorkspacePath updates workspacePath', () => {
    const { result } = renderHook(() => useSettingsStore());
    act(() => { result.current.setWorkspacePath('/projects/myapp'); });
    expect(result.current.workspacePath).toBe('/projects/myapp');
  });

  describe('setWorkspaceRoot', () => {
    it('sets workspaceUri, workspaceUriType, and workspaceDisplayName atomically (file://)', () => {
      const { result } = renderHook(() => useSettingsStore());
      act(() => {
        result.current.setWorkspaceRoot({
          uri: 'file:///var/mobile/Documents/Projects',
          uriType: 'file',
          displayName: 'Projects',
        });
      });
      expect(result.current.workspaceUri).toBe('file:///var/mobile/Documents/Projects');
      expect(result.current.workspaceUriType).toBe('file');
      expect(result.current.workspaceDisplayName).toBe('Projects');
    });

    it('sets workspaceUri, workspaceUriType, and workspaceDisplayName atomically (SAF content://)', () => {
      const { result } = renderHook(() => useSettingsStore());
      act(() => {
        result.current.setWorkspaceRoot({
          uri: 'content://com.android.externalstorage.documents/tree/primary%3AProjects',
          uriType: 'saf',
          displayName: 'Projects',
        });
      });
      expect(result.current.workspaceUri).toBe('content://com.android.externalstorage.documents/tree/primary%3AProjects');
      expect(result.current.workspaceUriType).toBe('saf');
      expect(result.current.workspaceDisplayName).toBe('Projects');
    });

    it('also mirrors uri to workspacePath for backward compat', () => {
      const { result } = renderHook(() => useSettingsStore());
      act(() => {
        result.current.setWorkspaceRoot({
          uri: 'file:///var/mobile/Documents/Projects',
          uriType: 'file',
          displayName: 'Projects',
        });
      });
      expect(result.current.workspacePath).toBe('file:///var/mobile/Documents/Projects');
    });
  });

  it('completeSetup sets hasCompletedSetup to true', () => {
    const { result } = renderHook(() => useSettingsStore());
    act(() => { result.current.completeSetup(); });
    expect(result.current.hasCompletedSetup).toBe(true);
  });

  it('addExtension appends a manifest', () => {
    const { result } = renderHook(() => useSettingsStore());
    const manifest = { id: 'test.ext', name: 'Test', version: '1.0.0', source: 'void 0;' };
    act(() => { result.current.addExtension(manifest); });
    expect(result.current.installedExtensions).toHaveLength(1);
    expect(result.current.installedExtensions[0].id).toBe('test.ext');
  });

  it('addExtension replaces manifest with same id', () => {
    const { result } = renderHook(() => useSettingsStore());
    const m1 = { id: 'test.ext', name: 'Test', version: '1.0.0', source: 'void 0;' };
    const m2 = { id: 'test.ext', name: 'Test v2', version: '2.0.0', source: 'void 0;' };
    act(() => { result.current.addExtension(m1); });
    act(() => { result.current.addExtension(m2); });
    expect(result.current.installedExtensions).toHaveLength(1);
    expect(result.current.installedExtensions[0].name).toBe('Test v2');
  });

  it('removeExtension removes by id', () => {
    const { result } = renderHook(() => useSettingsStore());
    const manifest = { id: 'test.ext', name: 'Test', version: '1.0.0', source: 'void 0;' };
    act(() => { result.current.addExtension(manifest); });
    act(() => { result.current.removeExtension('test.ext'); });
    expect(result.current.installedExtensions).toHaveLength(0);
  });

  it('removeExtension is a no-op for unknown id', () => {
    const { result } = renderHook(() => useSettingsStore());
    expect(() => {
      act(() => { result.current.removeExtension('unknown.id'); });
    }).not.toThrow();
    expect(result.current.installedExtensions).toHaveLength(0);
  });
});
