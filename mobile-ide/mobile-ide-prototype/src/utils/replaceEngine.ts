import type { FileSearchResult } from './searchEngine';

interface FileBridge {
  readFile: (path: string) => Promise<string>;
  writeFile: (path: string, content: string) => Promise<void>;
}

export async function replaceInFiles(
  results: FileSearchResult[],
  pattern: RegExp,
  replacement: string,
  excluded: Set<string>,
  bridge: FileBridge,
): Promise<{ filesChanged: number; matchesReplaced: number }> {
  let filesChanged = 0;
  let matchesReplaced = 0;

  const globalPattern = new RegExp(
    pattern.source,
    pattern.flags.includes('g') ? pattern.flags : pattern.flags + 'g',
  );

  for (const { filePath } of results) {
    const original = await bridge.readFile(filePath);

    const newContent = original.replace(globalPattern, (...args) => {
      const fullMatch = args[0] as string;
      const offset = args[args.length - 2] as number;
      const upTo = original.slice(0, offset);
      const matchLine = upTo.split('\n').length;
      const lastNl = upTo.lastIndexOf('\n');
      const matchStart = Math.min(
        lastNl === -1 ? offset : offset - lastNl - 1,
        120,
      );
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
