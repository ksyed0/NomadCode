import { parseDiffToGutter } from '../../../src/utils/gitGutter';

describe('parseDiffToGutter', () => {
  const base = [
    'line 1',
    'line 2',
    'line 3',
    'line 4',
    'line 5',
  ].join('\n');

  it('returns empty GutterDiff for identical files', () => {
    const result = parseDiffToGutter(base, base);
    expect(result.added).toEqual([]);
    expect(result.modified).toEqual([]);
    expect(result.deleted).toEqual([]);
  });

  it('detects added lines', () => {
    const work = ['line 1', 'line 2', 'NEW LINE', 'line 3', 'line 4', 'line 5'].join('\n');
    const result = parseDiffToGutter(base, work);
    expect(result.added).toContain(3);
  });

  it('detects modified lines', () => {
    const work = ['line 1', 'CHANGED', 'line 3', 'line 4', 'line 5'].join('\n');
    const result = parseDiffToGutter(base, work);
    expect(result.modified).toContain(2);
  });

  it('detects deleted lines — marks position with a deleted indicator', () => {
    const work = ['line 1', 'line 3', 'line 4', 'line 5'].join('\n');
    const result = parseDiffToGutter(base, work);
    expect(result.deleted.length).toBeGreaterThan(0);
  });

  it('handles empty head (new file) — all lines are added', () => {
    const result = parseDiffToGutter('', 'a\nb\nc');
    expect(result.added).toEqual([1, 2, 3]);
    expect(result.modified).toEqual([]);
    expect(result.deleted).toEqual([]);
  });

  it('handles empty work (deleted file) — no decorations', () => {
    const result = parseDiffToGutter('a\nb', '');
    expect(result.added).toEqual([]);
  });
});
