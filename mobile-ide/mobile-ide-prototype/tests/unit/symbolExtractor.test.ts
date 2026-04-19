import { getCurrentSymbol } from '../../src/utils/symbolExtractor';

describe('getCurrentSymbol', () => {
  it('finds a JS function', () => {
    const content = 'function myFunc() {\n  return 1;\n}';
    expect(getCurrentSymbol(content, 1)).toBe('myFunc');
  });

  it('finds an arrow const function', () => {
    const content = 'const myArrow = () => {\n  return 2;\n};';
    expect(getCurrentSymbol(content, 1)).toBe('myArrow');
  });

  it('finds a class', () => {
    const content = 'class MyClass {\n  constructor() {}\n}';
    expect(getCurrentSymbol(content, 2)).toBe('MyClass');
  });

  it('finds exported async function', () => {
    const content = 'export async function fetchData() {}';
    expect(getCurrentSymbol(content, 1)).toBe('fetchData');
  });

  it('finds Python def', () => {
    const content = 'def my_func(arg):\n    pass';
    expect(getCurrentSymbol(content, 1)).toBe('my_func');
  });

  it('finds Rust fn', () => {
    const content = 'fn compute(x: i32) -> i32 {\n    x * 2\n}';
    expect(getCurrentSymbol(content, 1)).toBe('compute');
  });

  it('finds Go func', () => {
    const content = 'func HandleRequest(w ResponseWriter, r *Request) {}';
    expect(getCurrentSymbol(content, 1)).toBe('HandleRequest');
  });

  it('returns null when cursor is above any symbol', () => {
    const content = 'const x = 1;';
    expect(getCurrentSymbol(content, 0)).toBeNull();
  });

  it('returns last symbol before cursor line', () => {
    const content = 'function first() {}\n\nconst second = () => {}';
    expect(getCurrentSymbol(content, 3)).toBe('second');
  });

  it('returns the symbol closest to cursor when patterns interleave', () => {
    // fn (Rust) on line 1, func (Go) on line 2 — cursor on line 3
    // Should return 'Handle' (Go func, line 2) not 'compute' (Rust fn, line 1)
    const content = 'fn compute(x: i32) -> i32 {\n}\nfunc Handle() {}';
    expect(getCurrentSymbol(content, 3)).toBe('Handle');
  });
});
