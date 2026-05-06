import { buildActions } from '../../src/codeNav/symbolContextMenu';

describe('buildActions', () => {
  it('includes goToDefinition + peekDefinition when hasDefinition is true', () => {
    const actions = buildActions({ word: 'foo', hasDefinition: true, canFindRefs: true });
    expect(actions).toContain('goToDefinition');
    expect(actions).toContain('peekDefinition');
  });

  it('includes findReferences when canFindRefs is true', () => {
    const actions = buildActions({ word: 'foo', hasDefinition: false, canFindRefs: true });
    expect(actions).toContain('findReferences');
  });

  it('always includes copySymbol when word is non-empty', () => {
    const actions = buildActions({ word: 'foo', hasDefinition: false, canFindRefs: false });
    expect(actions).toContain('copySymbol');
  });

  it('returns only [findReferences, copySymbol] when hasDefinition is false', () => {
    const actions = buildActions({ word: 'foo', hasDefinition: false, canFindRefs: true });
    expect(actions).not.toContain('goToDefinition');
    expect(actions).not.toContain('peekDefinition');
    expect(actions).toContain('findReferences');
    expect(actions).toContain('copySymbol');
  });

  it('returns empty array when word is empty', () => {
    expect(buildActions({ word: '', hasDefinition: false, canFindRefs: false })).toEqual([]);
  });
});
