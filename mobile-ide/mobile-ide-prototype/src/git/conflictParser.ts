/**
 * Pure conflict parse/resolve utility for git conflict markers.
 * No side effects, no I/O, no external dependencies.
 * Handles <<<<<<< HEAD / ======= / >>>>>>> branch markers.
 */

export interface ConflictHunk {
  /** Lines from the file before the <<<<<<< marker (or after the previous >>>>>>>). */
  pre: string[];
  ours: string[];
  theirs: string[];
  choice: 'ours' | 'theirs' | 'both' | null;
}

export interface ConflictFile {
  hasConflicts: boolean;
  /** Each hunk represents one conflict block. */
  hunks: ConflictHunk[];
  /** Lines after the final >>>>>>> marker (or all lines if no conflicts). */
  trailing: string[];
}

/**
 * Parses git conflict markers (<<<<<<<, =======, >>>>>>>) from file content.
 * Returns a ConflictFile with each conflict as a hunk with pre/ours/theirs/choice.
 * Pure function — no side effects, no I/O.
 *
 * @param content - Raw file content with potential conflict markers
 * @returns ConflictFile object with parsed hunks and trailing content
 */
export function parseConflicts(content: string): ConflictFile {
  const lines = content.split('\n');
  const hunks: ConflictHunk[] = [];
  let accumulator: string[] = [];
  let i = 0;

  while (i < lines.length) {
    if (lines[i].startsWith('<<<<<<<')) {
      const pre = accumulator;
      accumulator = [];
      const ours: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('=======')) {
        ours.push(lines[i++]);
      }
      i++; // skip =======
      const theirs: string[] = [];
      while (i < lines.length && !lines[i].startsWith('>>>>>>>')) {
        theirs.push(lines[i++]);
      }
      i++; // skip >>>>>>>
      hunks.push({ pre, ours, theirs, choice: null });
    } else {
      accumulator.push(lines[i++]);
    }
  }

  return {
    hasConflicts: hunks.length > 0,
    hunks,
    trailing: accumulator,
  };
}

/**
 * Applies the chosen resolution for each hunk and returns the resolved file content.
 * Hunks with `choice === null` retain their conflict markers (defensive fallback).
 *
 * @param file - ConflictFile with hunks containing resolution choices
 * @returns Resolved file content as a string
 */
export function applyResolution(file: ConflictFile): string {
  const result: string[] = [];
  for (const hunk of file.hunks) {
    result.push(...hunk.pre);
    if (hunk.choice === null) {
      result.push('<<<<<<< HEAD', ...hunk.ours, '=======', ...hunk.theirs, '>>>>>>> branch');
    } else {
      if (hunk.choice === 'ours' || hunk.choice === 'both') result.push(...hunk.ours);
      if (hunk.choice === 'theirs' || hunk.choice === 'both') result.push(...hunk.theirs);
    }
  }
  result.push(...file.trailing);
  return result.join('\n');
}
