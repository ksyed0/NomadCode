import { useEffect } from 'react';
import { NativeModules, NativeEventEmitter } from 'react-native';

export interface ShortcutDefinition {
  key: string;
  modifiers: ('cmd' | 'shift' | 'alt' | 'ctrl')[];
  label: string;
  action: () => void;
}

export function useKeyboardShortcuts(shortcuts: ShortcutDefinition[]): void {
  useEffect(() => {
    if (!NativeModules.KeyboardShortcuts) return;
    const emitter = new NativeEventEmitter(NativeModules.KeyboardShortcuts);
    const subscription = emitter.addListener(
      'onShortcut',
      (event: { key: string; modifiers: string[] }) => {
        const match = shortcuts.find(
          (s) =>
            s.key === event.key &&
            s.modifiers.length === event.modifiers.length &&
            s.modifiers.every((m) => event.modifiers.includes(m)),
        );
        match?.action();
      },
    );
    return () => subscription.remove();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(shortcuts.map((s) => ({ key: s.key, modifiers: s.modifiers })))]);
}
