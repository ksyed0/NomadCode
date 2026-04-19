import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ThemeId } from '../theme/tokens';
import type { ExtensionManifest } from '../extensions/sandbox';
import type { WorkspaceRoot, WorkspaceUriType } from '../types/workspace';
import type { SnippetDefinition } from '../utils/builtinSnippets';

interface SettingsState {
  theme: ThemeId;
  fontSize: number;
  /** @deprecated Use workspaceUri + workspaceUriType via setWorkspaceRoot() */
  workspacePath: string;
  /** Absolute URI for the selected workspace root (file:// or content://). */
  workspaceUri: string;
  /** Routing hint: 'saf' for Android SAF content:// URIs, 'file' for everything else. */
  workspaceUriType: WorkspaceUriType;
  /** Human-readable label shown in the workspace picker (e.g. "iCloud Drive › Projects"). */
  workspaceDisplayName: string;
  hasCompletedSetup: boolean;
  installedExtensions: ExtensionManifest[];
  formatOnSave: boolean;
  snippets: SnippetDefinition[];
  setTheme: (id: ThemeId) => void;
  setFontSize: (n: number) => void;
  /** @deprecated Use setWorkspaceRoot() to keep URI and type in sync. */
  setWorkspacePath: (p: string) => void;
  /** Atomically set workspace URI, URI type, and display name from a picker result. */
  setWorkspaceRoot: (root: WorkspaceRoot) => void;
  completeSetup: () => void;
  addExtension: (manifest: ExtensionManifest) => void;
  removeExtension: (id: string) => void;
  setFormatOnSave: (v: boolean) => void;
  addSnippet: (s: SnippetDefinition) => void;
  removeSnippet: (prefix: string, language: string) => void;
}

const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      theme: 'nomad-dark',
      fontSize: 14,
      workspacePath: '',
      workspaceUri: '',
      workspaceUriType: 'file',
      workspaceDisplayName: '',
      hasCompletedSetup: false,
      installedExtensions: [],
      formatOnSave: false,
      snippets: [],
      setTheme: (theme) => set({ theme }),
      setFontSize: (n) => set({ fontSize: Math.min(32, Math.max(8, n)) }),
      setWorkspacePath: (p) => set({ workspacePath: p }),
      setWorkspaceRoot: ({ uri, uriType, displayName }: WorkspaceRoot) =>
        set({ workspaceUri: uri, workspaceUriType: uriType, workspaceDisplayName: displayName, workspacePath: uri }),
      completeSetup: () => set({ hasCompletedSetup: true }),
      // Note: updating an existing extension moves it to the end of the list.
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
      setFormatOnSave: (formatOnSave) => set({ formatOnSave }),
      addSnippet: (s) => set((state) => ({ snippets: [...state.snippets.filter((x) => !(x.prefix === s.prefix && x.language === s.language)), s] })),
      removeSnippet: (prefix, language) => set((state) => ({ snippets: state.snippets.filter((x) => !(x.prefix === prefix && x.language === language)) })),
    }),
    {
      name: 'nomadcode-settings',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);

export default useSettingsStore;
