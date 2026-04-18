import { useEffect, useRef } from 'react';
import { NativeModules, NativeEventEmitter } from 'react-native';

export interface ShortcutDefinition {
  key: string;
  modifiers: ('cmd' | 'shift' | 'alt' | 'ctrl')[];
  label: string;
  action: () => void;
}

export function useKeyboardShortcuts(shortcuts: ShortcutDefinition[]): void {
  const shortcutsRef = useRef(shortcuts);
  useEffect(() => {
    shortcutsRef.current = shortcuts;
  });

  useEffect(() => {
    if (!NativeModules.KeyboardShortcuts) return;
    const emitter = new NativeEventEmitter(NativeModules.KeyboardShortcuts);
    const subscription = emitter.addListener(
      'onShortcut',
      (event: { key: string; modifiers: string[] }) => {
        const match = shortcutsRef.current.find(
          (s) =>
            s.key === event.key &&
            s.modifiers.length === event.modifiers.length &&
            s.modifiers.every((m) => event.modifiers.includes(m)),
        );
        match?.action();
      },
    );
    return () => subscription.remove();
  }, []);
}
