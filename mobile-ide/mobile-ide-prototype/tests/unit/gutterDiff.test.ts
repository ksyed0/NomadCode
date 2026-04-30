import { computeGutterLines } from '../../src/git/gutterDiff';

describe('computeGutterLines', () => {
  it('returns empty array when content is identical', () => {
    expect(computeGutterLines('a\nb\nc', 'a\nb\nc')).toEqual([]);
  });

  it('marks a new line at the end as added', () => {
    const result = computeGutterLines('a\nb', 'a\nb\nc');
    expect(result).toContainEqual({ lineNumber: 3, type: 'added' });
  });

  it('marks a changed line as modified', () => {
    const result = computeGutterLines('a\nb\nc', 'a\nX\nc');
    expect(result).toContainEqual({ lineNumber: 2, type: 'modified' });
  });

  it('marks a removed line as deleted at its former position', () => {
    const result = computeGutterLines('a\nb\nc', 'a\nc');
    // Positional diff: line 2 differs ('b' vs 'c' = modified), line 3 missing (deleted)
    expect(result).toContainEqual({ lineNumber: 3, type: 'deleted' });
  });

  it('handles empty head content (new file)', () => {
    const result = computeGutterLines('', 'a\nb');
    expect(result.every(l => l.type === 'added')).toBe(true);
    expect(result).toHaveLength(2);
  });

  it('handles empty working content (file cleared)', () => {
    const result = computeGutterLines('a\nb', '');
    expect(result.every(l => l.type === 'deleted')).toBe(true);
  });

  it('returns 1-based line numbers', () => {
    const result = computeGutterLines('a', 'X');
    expect(result[0].lineNumber).toBe(1);
  });

  it('does not return duplicate line numbers', () => {
    const result = computeGutterLines('a\nb\nc', 'X\nY\nZ');
    const nums = result.map(r => r.lineNumber);
    expect(new Set(nums).size).toBe(nums.length);
  });
});
