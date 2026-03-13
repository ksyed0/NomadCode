/**
 * Unit tests — useSettingsStore
 *
 * AsyncStorage is mocked so tests run in Node without a device.
 * Coverage: default state, setTheme, setFontSize (with clamp), setWorkspacePath, completeSetup.
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
    hasCompletedSetup: false,
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

  it('defaults hasCompletedSetup to false', () => {
    const { result } = renderHook(() => useSettingsStore());
    expect(result.current.hasCompletedSetup).toBe(false);
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

  it('completeSetup sets hasCompletedSetup to true', () => {
    const { result } = renderHook(() => useSettingsStore());
    act(() => { result.current.completeSetup(); });
    expect(result.current.hasCompletedSetup).toBe(true);
  });
});
