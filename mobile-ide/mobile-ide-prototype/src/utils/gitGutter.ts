import type { GutterDiff } from '../types/git';

interface DiffOp {
  type: 'equal' | 'insert' | 'delete' | 'replace';
  headStart: number;
  headEnd: number;
  workStart: number;
  workEnd: number;
}

/**
 * Simple LCS-based diff that identifies added, modified, and deleted lines.
 */
function computeDiff(headLines: string[], workLines: string[]): DiffOp[] {
  const m = headLines.length;
  const n = workLines.length;

  // Build LCS matrix
  const dp: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (headLines[i - 1] === workLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack to find operations
  const ops: DiffOp[] = [];
  let i = m;
  let j = n;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && headLines[i - 1] === workLines[j - 1]) {
      i--;
      j--;
      ops.unshift({ type: 'equal', headStart: i, headEnd: i + 1, workStart: j, workEnd: j + 1 });
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      j--;
      ops.unshift({ type: 'insert', headStart: i, headEnd: i, workStart: j, workEnd: j + 1 });
    } else {
      i--;
      ops.unshift({ type: 'delete', headStart: i, headEnd: i + 1, workStart: j, workEnd: j });
    }
  }

  // Post-process: merge adjacent delete + insert into replace
  const merged: DiffOp[] = [];
  for (let idx = 0; idx < ops.length; idx++) {
    const curr = ops[idx];
    const next = ops[idx + 1];

    if (
      curr.type === 'delete' &&
      next &&
      next.type === 'insert' &&
      curr.workStart === next.workStart &&
      curr.headEnd - curr.headStart === next.workEnd - next.workStart
    ) {
      // Merge delete + insert into replace
      merged.push({
        type: 'replace',
        headStart: curr.headStart,
        headEnd: curr.headEnd,
        workStart: next.workStart,
        workEnd: next.workEnd,
      });
      idx++; // Skip next since we merged it
    } else {
      merged.push(curr);
    }
  }

  return merged;
}

export function parseDiffToGutter(headText: string, workText: string): GutterDiff {
  if (!workText) return { added: [], modified: [], deleted: [] };
  if (!headText) {
    const lines = workText.split('\n').map((_, i) => i + 1);
    return { added: lines, modified: [], deleted: [] };
  }

  const headLines = headText.split('\n');
  const workLines = workText.split('\n');

  const added: number[] = [];
  const modified: number[] = [];
  const deleted: number[] = [];

  const ops = computeDiff(headLines, workLines);

  for (const op of ops) {
    if (op.type === 'insert') {
      // Mark all work lines in this insert as added
      for (let i = op.workStart; i < op.workEnd; i++) {
        added.push(i + 1);
      }
    } else if (op.type === 'delete') {
      // Mark deleted position
      deleted.push(op.workStart);
    } else if (op.type === 'replace') {
      // Lines that were modified: mark work lines as modified
      for (let i = op.workStart; i < op.workEnd; i++) {
        modified.push(i + 1);
      }
    }
  }

  return { added, modified, deleted };
}
