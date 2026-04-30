import AsyncStorage from '@react-native-async-storage/async-storage';
import { GitBridge } from './gitBridge';
import { FileSystemBridge } from '../utils/FileSystemBridge';

export interface StashEntry {
  id: string;
  repoDir: string;
  message: string;
  timestamp: number;
  files: { path: string; content: string }[];
}

function storageKey(repoDir: string): string {
  return `nomadcode_stash_${repoDir.replace(/[^a-zA-Z0-9]/g, '_')}`;
}

/** Returns all stash entries for this repo, newest-first. */
export async function stashList(repoDir: string): Promise<StashEntry[]> {
  const raw = await AsyncStorage.getItem(storageKey(repoDir));
  if (!raw) return [];
  const entries: StashEntry[] = JSON.parse(raw);
  return entries.sort((a, b) => b.timestamp - a.timestamp);
}

/**
 * Stashes all unstaged modified files. Saves current content, then
 * restores each file to HEAD. Untracked files (no HEAD version) are skipped.
 */
export async function stash(repoDir: string, message = ''): Promise<void> {
  const status = await GitBridge.status(repoDir);
  const unstaged = status.modified.filter(f => !status.staged.includes(f));
  if (unstaged.length === 0) throw new Error('Nothing to stash: no unstaged modifications.');

  const files: StashEntry['files'] = [];
  for (const relPath of unstaged) {
    const headContent = await GitBridge.readHeadFile(repoDir, relPath);
    if (headContent === null) continue; // untracked — skip

    const fullPath = `${repoDir}/${relPath}`;
    const currentContent = await FileSystemBridge.readFile(fullPath);
    files.push({ path: relPath, content: currentContent });
    await FileSystemBridge.writeFile(fullPath, headContent);
  }

  const entry: StashEntry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    repoDir,
    message: message || `WIP on ${new Date().toISOString()}`,
    timestamp: Date.now(),
    files,
  };

  const existing = await stashList(repoDir);
  await AsyncStorage.setItem(storageKey(repoDir), JSON.stringify([entry, ...existing]));
}

async function applyEntry(repoDir: string, entry: StashEntry): Promise<void> {
  for (const file of entry.files) {
    await FileSystemBridge.writeFile(`${repoDir}/${file.path}`, file.content);
  }
}

/** Applies a stash entry (restores files) and removes it from the list. */
export async function stashPop(repoDir: string, id: string): Promise<void> {
  const entries = await stashList(repoDir);
  const entry = entries.find(e => e.id === id);
  if (!entry) throw new Error(`Stash entry not found: ${id}`);
  await applyEntry(repoDir, entry);
  await AsyncStorage.setItem(
    storageKey(repoDir),
    JSON.stringify(entries.filter(e => e.id !== id)),
  );
}

/** Applies a stash entry (restores files) but keeps it in the list. */
export async function stashApply(repoDir: string, id: string): Promise<void> {
  const entries = await stashList(repoDir);
  const entry = entries.find(e => e.id === id);
  if (!entry) throw new Error(`Stash entry not found: ${id}`);
  await applyEntry(repoDir, entry);
}
