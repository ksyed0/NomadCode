// src/codeNav/symbolContextMenu.ts

export interface SymbolAtCursor {
  word:          string;
  hasDefinition: boolean;
  canFindRefs:   boolean;
  position?:     { line: number; column: number };
}

export type SymbolAction =
  | 'goToDefinition'
  | 'peekDefinition'
  | 'findReferences'
  | 'copySymbol';

export interface ContextMenuState {
  visible:  boolean;
  screenX:  number;
  screenY:  number;
  word:     string;
  actions:  SymbolAction[];
}

export function buildActions(s: SymbolAtCursor): SymbolAction[] {
  if (!s.word) return [];
  const actions: SymbolAction[] = [];
  if (s.hasDefinition) actions.push('goToDefinition', 'peekDefinition');
  if (s.canFindRefs)   actions.push('findReferences');
  actions.push('copySymbol');
  return actions;
}
