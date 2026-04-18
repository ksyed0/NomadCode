// tests/unit/useKeyboardShortcuts.test.ts
import { renderHook } from '@testing-library/react-native';
import { NativeModules, NativeEventEmitter } from 'react-native';
import { useKeyboardShortcuts } from '../../src/hooks/useKeyboardShortcuts';
import type { ShortcutDefinition } from '../../src/hooks/useKeyboardShortcuts';

// Mock the native module
const mockAddListener = jest.fn(() => ({ remove: jest.fn() }));
jest.mock('react-native', () => {
  return {
    NativeModules: { KeyboardShortcuts: {} },
    NativeEventEmitter: jest.fn().mockImplementation(() => ({
      addListener: mockAddListener,
    })),
  };
});

describe('useKeyboardShortcuts', () => {
  beforeEach(() => jest.clearAllMocks());

  it('subscribes to onShortcut event on mount', () => {
    const shortcuts: ShortcutDefinition[] = [
      { key: 's', modifiers: ['cmd'], label: 'Save File', action: jest.fn() },
    ];
    renderHook(() => useKeyboardShortcuts(shortcuts));
    expect(mockAddListener).toHaveBeenCalledWith('onShortcut', expect.any(Function));
  });

  it('calls the matching action when shortcut fires', () => {
    const saveAction = jest.fn();
    const shortcuts: ShortcutDefinition[] = [
      { key: 's', modifiers: ['cmd'], label: 'Save File', action: saveAction },
    ];
    renderHook(() => useKeyboardShortcuts(shortcuts));
    // Get the registered handler
    const handler = mockAddListener.mock.calls[0][1] as Function;
    handler({ key: 's', modifiers: ['cmd'] });
    expect(saveAction).toHaveBeenCalledTimes(1);
  });

  it('does not call action for unregistered combo', () => {
    const saveAction = jest.fn();
    const shortcuts: ShortcutDefinition[] = [
      { key: 's', modifiers: ['cmd'], label: 'Save File', action: saveAction },
    ];
    renderHook(() => useKeyboardShortcuts(shortcuts));
    const handler = mockAddListener.mock.calls[0][1] as Function;
    handler({ key: 'z', modifiers: ['cmd'] });
    expect(saveAction).not.toHaveBeenCalled();
  });

  it('cleans up subscription on unmount', () => {
    const removeMock = jest.fn();
    mockAddListener.mockReturnValueOnce({ remove: removeMock });
    const shortcuts: ShortcutDefinition[] = [
      { key: 's', modifiers: ['cmd'], label: 'Save File', action: jest.fn() },
    ];
    const { unmount } = renderHook(() => useKeyboardShortcuts(shortcuts));
    unmount();
    expect(removeMock).toHaveBeenCalled();
  });

  it('does not subscribe when native module is absent', () => {
    const savedModule = NativeModules.KeyboardShortcuts;
    // @ts-ignore
    delete NativeModules.KeyboardShortcuts;
    const MockNativeEventEmitter = NativeEventEmitter as jest.Mock;
    MockNativeEventEmitter.mockClear();

    renderHook(() => useKeyboardShortcuts([
      { key: 's', modifiers: ['cmd'], label: 'Save', action: jest.fn() },
    ]));

    expect(MockNativeEventEmitter).not.toHaveBeenCalled();
    // Restore
    NativeModules.KeyboardShortcuts = savedModule;
  });
});
