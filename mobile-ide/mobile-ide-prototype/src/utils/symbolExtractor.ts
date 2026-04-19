const SYMBOL_PATTERNS: RegExp[] = [
  /^(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s+(\w+)/m,
  /^(?:export\s+)?(?:abstract\s+)?class\s+(\w+)/m,
  /^(?:export\s+)?const\s+(\w+)\s*=\s*(?:async\s+)?\(/m,
  /^def\s+(\w+)/m,
  /^fn\s+(\w+)/m,
  /^func\s+(\w+)/m,
];

export function getCurrentSymbol(content: string, cursorLine: number): string | null {
  const lines = content.split('\n').slice(0, cursorLine);
  const sliced = lines.join('\n');
  let lastMatch: string | null = null;
  for (const pattern of SYMBOL_PATTERNS) {
    const globalPat = new RegExp(pattern.source, 'gm');
    let m: RegExpExecArray | null;
    while ((m = globalPat.exec(sliced)) !== null) {
      lastMatch = m[1];
    }
  }
  return lastMatch;
}
