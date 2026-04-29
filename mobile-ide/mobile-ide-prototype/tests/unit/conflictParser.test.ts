import { parseConflicts, applyResolution } from '../../src/git/conflictParser';

const SINGLE_CONFLICT = `line before
<<<<<<< HEAD
ours content
=======
theirs content
>>>>>>> branch
line after`;

const TWO_CONFLICTS = `start
<<<<<<< HEAD
ours1
=======
theirs1
>>>>>>> branch
middle
<<<<<<< HEAD
ours2
=======
theirs2
>>>>>>> branch
end`;

const NO_CONFLICT = `just normal content\nno markers here`;

describe('parseConflicts', () => {
  it('detects a conflict', () => {
    expect(parseConflicts(SINGLE_CONFLICT).hasConflicts).toBe(true);
  });

  it('returns no conflicts for clean content', () => {
    const result = parseConflicts(NO_CONFLICT);
    expect(result.hasConflicts).toBe(false);
    expect(result.hunks).toHaveLength(0);
  });

  it('parses ours and theirs lines correctly', () => {
    const { hunks } = parseConflicts(SINGLE_CONFLICT);
    expect(hunks[0].ours).toEqual(['ours content']);
    expect(hunks[0].theirs).toEqual(['theirs content']);
  });

  it('captures pre-hunk context lines', () => {
    const { hunks } = parseConflicts(SINGLE_CONFLICT);
    expect(hunks[0].pre).toEqual(['line before']);
  });

  it('captures trailing lines after the last conflict', () => {
    const { trailing } = parseConflicts(SINGLE_CONFLICT);
    expect(trailing).toEqual(['line after']);
  });

  it('parses two conflicts correctly', () => {
    const { hunks } = parseConflicts(TWO_CONFLICTS);
    expect(hunks).toHaveLength(2);
    expect(hunks[0].ours).toEqual(['ours1']);
    expect(hunks[1].theirs).toEqual(['theirs2']);
  });

  it('captures inter-conflict lines as pre of the next hunk', () => {
    const { hunks } = parseConflicts(TWO_CONFLICTS);
    expect(hunks[1].pre).toEqual(['middle']);
  });

  it('initialises choice to null for all hunks', () => {
    const { hunks } = parseConflicts(TWO_CONFLICTS);
    hunks.forEach((h) => expect(h.choice).toBeNull());
  });
});

describe('applyResolution', () => {
  it('Accept Ours — produces ours lines only', () => {
    const file = parseConflicts(SINGLE_CONFLICT);
    file.hunks[0].choice = 'ours';
    expect(applyResolution(file)).toBe('line before\nours content\nline after');
  });

  it('Accept Theirs — produces theirs lines only', () => {
    const file = parseConflicts(SINGLE_CONFLICT);
    file.hunks[0].choice = 'theirs';
    expect(applyResolution(file)).toBe('line before\ntheirs content\nline after');
  });

  it('Accept Both — produces ours then theirs', () => {
    const file = parseConflicts(SINGLE_CONFLICT);
    file.hunks[0].choice = 'both';
    expect(applyResolution(file)).toBe('line before\nours content\ntheirs content\nline after');
  });

  it('preserves trailing lines after the last hunk', () => {
    const file = parseConflicts(SINGLE_CONFLICT);
    file.hunks[0].choice = 'ours';
    expect(applyResolution(file)).toContain('line after');
  });

  it('preserves inter-conflict context lines', () => {
    const file = parseConflicts(TWO_CONFLICTS);
    file.hunks[0].choice = 'ours';
    file.hunks[1].choice = 'theirs';
    const result = applyResolution(file);
    expect(result).toContain('middle');
    expect(result).toContain('ours1');
    expect(result).toContain('theirs2');
  });

  it('round-trips clean content unchanged', () => {
    const file = parseConflicts(NO_CONFLICT);
    expect(applyResolution(file)).toBe(NO_CONFLICT);
  });
});
