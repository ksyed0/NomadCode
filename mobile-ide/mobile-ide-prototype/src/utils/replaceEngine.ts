import type { FileSearchResult } from './searchEngine';
import type { FileSystemBridge } from './FileSystemBridge';

export async function replaceInFiles(
  results: FileSearchResult[],
  pattern: RegExp,
  replacement: string,
  excluded: Set<string>,
  bridge: Pick<typeof FileSystemBridge, 'readFile' | 'writeFile'>,
): Promise<{ filesChanged: number; matchesReplaced: number }> {
  let filesChanged = 0;
  let matchesReplaced = 0;

  const globalPattern = new RegExp(
    pattern.source,
    pattern.flags.includes('g') ? pattern.flags : pattern.flags + 'g',
  );

  for (const { filePath } of results) {
    const original = await bridge.readFile(filePath);
    let content = original;

    const newContent = content.replace(globalPattern, (...args) => {
      const fullMatch = args[0] as string;
      const offset = args[args.length - 2] as number;
      const upTo = content.slice(0, offset);
      const matchLine = upTo.split('\n').length;
      const lastNl = upTo.lastIndexOf('\n');
      const matchStart = lastNl === -1 ? offset : offset - lastNl - 1;
      const key = `${filePath}:${matchLine}:${matchStart}`;
      if (excluded.has(key)) return fullMatch;
      matchesReplaced++;
      return fullMatch.replace(pattern, replacement);
    });

    if (newContent !== original) {
      await bridge.writeFile(filePath, newContent);
      filesChanged++;
    }
  }

  return { filesChanged, matchesReplaced };
}
