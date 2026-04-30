export type GutterType = 'added' | 'modified' | 'deleted';

export interface GutterLine {
  /** 1-based Monaco line number. */
  lineNumber: number;
  type: GutterType;
}

/**
 * Position-aligned diff: compares HEAD content to working content line-by-line.
 * Suitable for gutter indicators on typical source files (<1000 lines).
 *
 * Note: This is a positional diff, not a true Myers diff. It does not account
 * for line insertions/deletions shifting alignment. For display-only gutter
 * indicators this trade-off is acceptable.
 *
 * Returns GutterLine[] with 1-based line numbers matching Monaco's coordinate system.
 */
export function computeGutterLines(headContent: string, workingContent: string): GutterLine[] {
  if (headContent === workingContent) return [];

  const headLines = headContent === '' ? [] : headContent.split('\n');
  const workLines = workingContent === '' ? [] : workingContent.split('\n');
  const result: GutterLine[] = [];
  const maxLen = Math.max(headLines.length, workLines.length);

  for (let i = 0; i < maxLen; i++) {
    const lineNumber = i + 1; // Monaco is 1-based
    if (i >= headLines.length) {
      result.push({ lineNumber, type: 'added' });
    } else if (i >= workLines.length) {
      result.push({ lineNumber, type: 'deleted' });
    } else if (headLines[i] !== workLines[i]) {
      result.push({ lineNumber, type: 'modified' });
    }
  }

  return result;
}
