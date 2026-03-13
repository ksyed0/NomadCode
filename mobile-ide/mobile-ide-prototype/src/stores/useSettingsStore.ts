import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ThemeId } from '../theme/tokens';
import type { ExtensionManifest } from '../extensions/sandbox';

interface SettingsState {
  theme: ThemeId;
  fontSize: number;
  workspacePath: string;
  hasCompletedSetup: boolean;
  installedExtensions: ExtensionManifest[];
  setTheme: (id: ThemeId) => void;
  setFontSize: (n: number) => void;
  setWorkspacePath: (p: string) => void;
  completeSetup: () => void;
  addExtension: (manifest: ExtensionManifest) => void;
  removeExtension: (id: string) => void;
}

const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      theme: 'nomad-dark',
      fontSize: 14,
      workspacePath: '',
      hasCompletedSetup: false,
      installedExtensions: [],
      setTheme: (theme) => set({ theme }),
      setFontSize: (n) => set({ fontSize: Math.min(32, Math.max(8, n)) }),
      setWorkspacePath: (p) => set({ workspacePath: p }),
      completeSetup: () => set({ hasCompletedSetup: true }),
      addExtension: (manifest) =>
        set((s) => ({
          installedExtensions: [
            ...s.installedExtensions.filter((m) => m.id !== manifest.id),
            manifest,
          ],
        })),
      removeExtension: (id) =>
        set((s) => ({
          installedExtensions: s.installedExtensions.filter((m) => m.id !== id),
        })),
    }),
    {
      name: 'nomadcode-settings',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);

export default useSettingsStore;
