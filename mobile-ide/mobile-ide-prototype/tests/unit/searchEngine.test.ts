import {
  globToRegex,
  buildPattern,
  matchFile,
  searchFiles,
  SearchOptions,
  FileSearchResult,
  MAX_FILE_SIZE_BYTES,
  MAX_TOTAL_MATCHES,
} from '../../src/utils/searchEngine';

const DEFAULT_OPTS: SearchOptions = {
  caseSensitive: false,
  regex: false,
  wholeWord: false,
  glob: '',
};

// ── globToRegex ────────────────────────────────────────────────────────────

describe('globToRegex', () => {
  it('empty string matches everything', () => {
    expect(globToRegex('').test('src/foo.ts')).toBe(true);
    expect(globToRegex('').test('anything')).toBe(true);
  });

  it('**/*.ts matches nested .ts files', () => {
    const re = globToRegex('**/*.ts');
    expect(re.test('src/foo.ts')).toBe(true);
    expect(re.test('src/hooks/useSearch.ts')).toBe(true);
    expect(re.test('src/foo.js')).toBe(false);
    expect(re.test('src/foo.tsx')).toBe(false);
  });

  it('*.ts matches root-level .ts only (no slash crossing)', () => {
    const re = globToRegex('*.ts');
    expect(re.test('foo.ts')).toBe(true);
    expect(re.test('src/foo.ts')).toBe(false);
  });

  it('? matches exactly one non-slash character', () => {
    const re = globToRegex('src/?.ts');
    expect(re.test('src/a.ts')).toBe(true);
    expect(re.test('src/ab.ts')).toBe(false);
  });

  it('escapes regex special chars in glob', () => {
    const re = globToRegex('**/*.test.ts');
    expect(re.test('src/foo.test.ts')).toBe(true);
    expect(re.test('src/footestts')).toBe(false);
  });
});

// ── buildPattern ──────────────────────────────────────────────────────────

describe('buildPattern', () => {
  it('plain string, case-insensitive by default', () => {
    const re = buildPattern('foo', DEFAULT_OPTS);
    expect(re.test('FOO')).toBe(true);
    expect(re.test('foo')).toBe(true);
  });

  it('case-sensitive when caseSensitive=true', () => {
    const re = buildPattern('foo', { ...DEFAULT_OPTS, caseSensitive: true });
    expect(re.test('foo')).toBe(true);
    expect(re.test('FOO')).toBe(false);
  });

  it('treats query as regex when regex=true', () => {
    const re = buildPattern('use[A-Z]\\w+', { ...DEFAULT_OPTS, regex: true });
    expect(re.test('useState')).toBe(true);
    expect(re.test('usestate')).toBe(false);
  });

  it('escapes regex metacharacters when regex=false', () => {
    const re = buildPattern('foo.bar', DEFAULT_OPTS);
    expect(re.test('foo.bar')).toBe(true);
    expect(re.test('fooXbar')).toBe(false); // dot is literal
  });

  it('wraps with word boundaries when wholeWord=true', () => {
    const re = buildPattern('foo', { ...DEFAULT_OPTS, wholeWord: true });
    expect(re.test('foo')).toBe(true);
    expect(re.test('foobar')).toBe(false);
    expect(re.test('barfoo')).toBe(false);
  });

  it('throws on invalid regex', () => {
    expect(() => buildPattern('[invalid', { ...DEFAULT_OPTS, regex: true })).toThrow();
  });
});

// ── matchFile ─────────────────────────────────────────────────────────────

describe('matchFile', () => {
  it('returns empty array when no matches', () => {
    const pattern = buildPattern('xyz', DEFAULT_OPTS);
    expect(matchFile('const foo = 1;', pattern)).toEqual([]);
  });

  it('returns correct lineNumber (1-based) and preview', () => {
    const pattern = buildPattern('foo', DEFAULT_OPTS);
    const results = matchFile('line1\nconst foo = 1;\nline3', pattern);
    expect(results).toHaveLength(1);
    expect(results[0].lineNumber).toBe(2);
    expect(results[0].preview).toBe('const foo = 1;');
  });

  it('returns correct matchStart and matchEnd offsets', () => {
    const pattern = buildPattern('foo', DEFAULT_OPTS);
    const results = matchFile('const foo = 1;', pattern);
    expect(results[0].matchStart).toBe(6);
    expect(results[0].matchEnd).toBe(9);
  });

  it('matches multiple lines', () => {
    const pattern = buildPattern('foo', DEFAULT_OPTS);
    const results = matchFile('foo\nbar\nfoo again', pattern);
    expect(results).toHaveLength(2);
    expect(results[0].lineNumber).toBe(1);
    expect(results[1].lineNumber).toBe(3);
  });

  it('truncates preview to 120 characters', () => {
    const longLine = 'a'.repeat(200);
    const pattern = buildPattern('aaa', DEFAULT_OPTS);
    const results = matchFile(longLine, pattern);
    expect(results[0].preview.length).toBe(120);
  });

  it('handles empty content', () => {
    const pattern = buildPattern('foo', DEFAULT_OPTS);
    expect(matchFile('', pattern)).toEqual([]);
  });
});

// ── searchFiles generator ─────────────────────────────────────────────────

const mockListDirectory = jest.fn();
const mockReadFile = jest.fn();
const mockGetFileSize = jest.fn();

jest.mock('../../src/utils/FileSystemBridge', () => ({
  FileSystemBridge: {
    listDirectory: (...args: unknown[]) => mockListDirectory(...args),
    readFile: (...args: unknown[]) => mockReadFile(...args),
    getFileSize: (...args: unknown[]) => mockGetFileSize(...args),
  },
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockGetFileSize.mockResolvedValue(1000); // small file
});

async function collectResults(
  gen: AsyncGenerator<FileSearchResult>,
): Promise<FileSearchResult[]> {
  const out: FileSearchResult[] = [];
  for await (const r of gen) out.push(r);
  return out;
}

describe('searchFiles', () => {
  it('yields nothing for empty query', async () => {
    const signal = new AbortController().signal;
    const results = await collectResults(
      searchFiles('file:///root', '', DEFAULT_OPTS, signal),
    );
    expect(results).toEqual([]);
    expect(mockListDirectory).not.toHaveBeenCalled();
  });

  it('yields matching file results', async () => {
    mockListDirectory.mockResolvedValue([
      { name: 'foo.ts', path: 'file:///root/foo.ts', isDirectory: false },
    ]);
    mockReadFile.mockResolvedValue('const foo = 1;\nconst bar = 2;');
    const signal = new AbortController().signal;
    const results = await collectResults(
      searchFiles('file:///root', 'foo', DEFAULT_OPTS, signal),
    );
    expect(results).toHaveLength(1);
    expect(results[0].filePath).toBe('file:///root/foo.ts');
    expect(results[0].matches[0].lineNumber).toBe(1);
  });

  it('skips excluded directories', async () => {
    mockListDirectory.mockResolvedValueOnce([
      { name: 'node_modules', path: 'file:///root/node_modules', isDirectory: true },
      { name: 'src', path: 'file:///root/src', isDirectory: true },
    ]);
    mockListDirectory.mockResolvedValueOnce([
      { name: 'index.ts', path: 'file:///root/src/index.ts', isDirectory: false },
    ]);
    mockReadFile.mockResolvedValue('foo');
    const signal = new AbortController().signal;
    await collectResults(searchFiles('file:///root', 'foo', DEFAULT_OPTS, signal));
    // node_modules dir should never be listed
    expect(mockListDirectory).toHaveBeenCalledTimes(2); // root + src
    expect(mockListDirectory).not.toHaveBeenCalledWith('file:///root/node_modules');
  });

  it('skips files larger than MAX_FILE_SIZE_BYTES', async () => {
    mockListDirectory.mockResolvedValue([
      { name: 'big.ts', path: 'file:///root/big.ts', isDirectory: false },
    ]);
    mockGetFileSize.mockResolvedValue(MAX_FILE_SIZE_BYTES + 1);
    const signal = new AbortController().signal;
    await collectResults(searchFiles('file:///root', 'foo', DEFAULT_OPTS, signal));
    expect(mockReadFile).not.toHaveBeenCalled();
  });

  it('skips unreadable files and continues', async () => {
    mockListDirectory.mockResolvedValue([
      { name: 'bad.ts', path: 'file:///root/bad.ts', isDirectory: false },
      { name: 'good.ts', path: 'file:///root/good.ts', isDirectory: false },
    ]);
    mockReadFile
      .mockRejectedValueOnce(new Error('permission denied'))
      .mockResolvedValueOnce('foo match');
    const signal = new AbortController().signal;
    const results = await collectResults(
      searchFiles('file:///root', 'foo', DEFAULT_OPTS, signal),
    );
    expect(results).toHaveLength(1);
    expect(results[0].filePath).toBe('file:///root/good.ts');
  });

  it('stops when signal is aborted', async () => {
    mockListDirectory.mockResolvedValue([
      { name: 'a.ts', path: 'file:///root/a.ts', isDirectory: false },
      { name: 'b.ts', path: 'file:///root/b.ts', isDirectory: false },
      { name: 'c.ts', path: 'file:///root/c.ts', isDirectory: false },
    ]);
    mockReadFile.mockImplementation(() => new Promise(res => setTimeout(() => res('foo'), 10)));
    const controller = new AbortController();
    const results: FileSearchResult[] = [];
    const gen = searchFiles('file:///root', 'foo', DEFAULT_OPTS, controller.signal);
    const first = await gen.next();
    if (!first.done) results.push(first.value);
    controller.abort();
    const second = await gen.next();
    expect(second.done).toBe(true);
  });

  it('applies glob filter — skips non-matching files', async () => {
    mockListDirectory.mockResolvedValue([
      { name: 'foo.ts', path: 'file:///root/foo.ts', isDirectory: false },
      { name: 'foo.js', path: 'file:///root/foo.js', isDirectory: false },
    ]);
    mockReadFile.mockResolvedValue('foo match');
    const signal = new AbortController().signal;
    const results = await collectResults(
      searchFiles('file:///root', 'foo', { ...DEFAULT_OPTS, glob: '**/*.ts' }, signal),
    );
    expect(results).toHaveLength(1);
    expect(results[0].filePath).toBe('file:///root/foo.ts');
  });

  it('caps results at MAX_TOTAL_MATCHES', async () => {
    // Create a file that produces 600 matches
    const bigContent = Array.from({ length: 600 }, (_, i) => `line ${i} foo`).join('\n');
    mockListDirectory.mockResolvedValueOnce([
      { name: 'a.ts', path: 'file:///root/a.ts', isDirectory: false },
      { name: 'b.ts', path: 'file:///root/b.ts', isDirectory: false },
    ]);
    mockReadFile.mockResolvedValue(bigContent);
    const signal = new AbortController().signal;
    const results = await collectResults(
      searchFiles('file:///root', 'foo', DEFAULT_OPTS, signal),
    );
    const total = results.reduce((s, r) => s + r.matches.length, 0);
    expect(total).toBeLessThanOrEqual(MAX_TOTAL_MATCHES);
  });

  it('returns nothing when buildPattern throws (invalid regex passed through)', async () => {
    // searchFiles should silently catch invalid regex from buildPattern and yield nothing
    const signal = new AbortController().signal;
    const results = await collectResults(
      searchFiles('file:///root', '[invalid', { ...DEFAULT_OPTS, regex: true }, signal),
    );
    expect(results).toEqual([]);
    expect(mockListDirectory).not.toHaveBeenCalled();
  });

  it('skips directories whose listDirectory call fails and continues', async () => {
    mockListDirectory
      .mockRejectedValueOnce(new Error('permission denied')) // root dir fails
      .mockResolvedValueOnce([
        { name: 'ok.ts', path: 'file:///root2/ok.ts', isDirectory: false },
      ]);
    mockReadFile.mockResolvedValue('foo match');
    const signal = new AbortController().signal;
    // This exercises the listDirectory catch → return path inside walkDir
    const results = await collectResults(
      searchFiles('file:///root', 'foo', DEFAULT_OPTS, signal),
    );
    expect(results).toEqual([]);
  });

  it('skips files whose getFileSize call fails and continues to the next file', async () => {
    // Reset to clear any unconsumed Once queues from prior tests.
    mockListDirectory.mockReset();
    mockListDirectory.mockResolvedValue([
      { name: 'noperm.ts', path: 'file:///root/noperm.ts', isDirectory: false },
      { name: 'ok.ts', path: 'file:///root/ok.ts', isDirectory: false },
    ]);
    // First file: getFileSize fails → skipped via continue. Second: succeeds.
    mockGetFileSize
      .mockRejectedValueOnce(new Error('stat failed'))
      .mockResolvedValueOnce(100);
    mockReadFile.mockResolvedValue('no match in this file');
    const signal = new AbortController().signal;
    await collectResults(searchFiles('file:///root', 'foo', DEFAULT_OPTS, signal));
    // noperm.ts is skipped entirely (no readFile call for it);
    // ok.ts proceeds to readFile — confirms the continue path was taken, not a return.
    expect(mockReadFile).toHaveBeenCalledWith('file:///root/ok.ts');
    expect(mockReadFile).not.toHaveBeenCalledWith('file:///root/noperm.ts');
  });
});
