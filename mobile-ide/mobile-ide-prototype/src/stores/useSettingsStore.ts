import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ThemeId } from '../theme/tokens';

interface SettingsState {
  theme: ThemeId;
  fontSize: number;
  workspacePath: string;
  hasCompletedSetup: boolean;
  setTheme: (id: ThemeId) => void;
  setFontSize: (n: number) => void;
  setWorkspacePath: (p: string) => void;
  completeSetup: () => void;
}

const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      theme: 'nomad-dark',
      fontSize: 14,
      workspacePath: '',
      hasCompletedSetup: false,
      setTheme: (theme) => set({ theme }),
      setFontSize: (n) => set({ fontSize: Math.min(32, Math.max(8, n)) }),
      setWorkspacePath: (p) => set({ workspacePath: p }),
      completeSetup: () => set({ hasCompletedSetup: true }),
    }),
    {
      name: 'nomadcode-settings',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);

export default useSettingsStore;
