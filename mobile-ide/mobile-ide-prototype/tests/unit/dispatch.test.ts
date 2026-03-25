/**
 * @jest-environment jsdom
 */

/**
 * Unit tests — dispatch() shell dispatcher
 *
 * EPIC-0003 / src/terminal/bundle/index.ts
 *
 * TC-0325: touch /tmp/a.txt — vfsWrite called with '', exitCode 0
 * TC-0326: touch existing file — vfsWrite NOT called, exitCode 0
 * TC-0327: cp src dest — vfsCopy called, exitCode 0
 * TC-0328: cp no args — exitCode 1, output contains 'usage'
 * TC-0329: mv old new — vfsMove called, exitCode 0
 * TC-0330: mv no args — exitCode 1
 * TC-0333: clear — exitCode 0, clearScreen: true
 * TC-0334: node file.js with console.log — output 'hi', exitCode 0
 * TC-0335: node file.js with require() — output contains 'require() is not available', exitCode 1
 * TC-0336: npm run build (echo ok) — output 'ok', exitCode 0
 * TC-0337: npm run missing — output 'not found in package.json', exitCode 1
 * TC-0338: npm install — exact error string, exitCode 1
 * TC-0339: npm i — same error, exitCode 1
 * TC-0340: npx prettier index.js — vfsWrite called with formatted result, exitCode 0
 * TC-0341: npx unknown-tool — contains 'not available', 'Bundled tools: prettier', exitCode 1
 * TC-0342: npm run with script chain > 5 levels deep — exitCode 1, 'maximum script recursion depth'
 * TC-0343: npm run with script chain exactly 4 levels deep — exitCode 0, output 'ok'
 * TC-0344: unknown command — 'command not found', exitCode 127
 */

/* -------------------------------------------------------------------------- */
/*  Environment bootstrap — must run before any import of index.ts             */
/* -------------------------------------------------------------------------- */

// jest-expo uses jsdom, so `window` exists. We only need to attach
// ReactNativeWebView.postMessage and receiveFromRN shims.

/**
 * Builds a mock `window.ReactNativeWebView.postMessage` that automatically
 * satisfies pending VFS promises by calling `window.receiveFromRN` with the
 * supplied `resultFactory`.
 *
 * `resultFactory(msg)` receives the parsed outbound message and returns the
 * value that should be placed in the FILE_RESULT `result` field (or an
 * Error to simulate a VFS error).
 */
function makeBridge(
  resultFactory: (msg: Record<string, unknown>) => unknown,
): jest.Mock {
  return jest.fn((data: string) => {
    const msg = JSON.parse(data) as Record<string, unknown>;
    const requestId = msg.requestId as string;

    let result: string | null = null;
    let error: string | undefined;

    const outcome = resultFactory(msg);
    if (outcome instanceof Error) {
      error = outcome.message;
    } else if (outcome !== undefined && outcome !== null) {
      result = typeof outcome === 'string' ? outcome : JSON.stringify(outcome);
    }

    // Resolve the pending promise by calling receiveFromRN synchronously.
    // index.ts registers window.receiveFromRN at module load time.
    (window as unknown as Record<string, (s: string) => void>).receiveFromRN(
      JSON.stringify({ type: 'FILE_RESULT', requestId, result, error }),
    );
  });
}

/* -------------------------------------------------------------------------- */
/*  Mock isomorphic-git (not under test, and causes ESM issues in Jest)        */
/* -------------------------------------------------------------------------- */

jest.mock('isomorphic-git', () => ({
  __esModule: true,
  default: {},
}));
jest.mock('isomorphic-git/http/web', () => ({ __esModule: true, default: {} }));

/* -------------------------------------------------------------------------- */
/*  Mock prettier — replace with deterministic synchronous formatter           */
/* -------------------------------------------------------------------------- */

jest.mock('prettier/standalone', () => ({
  format: jest.fn(async (code: string) => `formatted:${code}`),
}));
jest.mock('prettier/plugins/babel', () => ({}));
jest.mock('prettier/plugins/estree', () => ({}));

/* -------------------------------------------------------------------------- */
/*  Import dispatch AFTER mocks are in place                                   */
/* -------------------------------------------------------------------------- */

import { dispatch } from '../../src/terminal/bundle/index';

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                    */
/* -------------------------------------------------------------------------- */

/** Set up a fresh bridge before each test and tear it down after. */
function setupBridge(
  factory: (msg: Record<string, unknown>) => unknown,
): jest.Mock {
  const mock = makeBridge(factory);
  (window as unknown as Record<string, unknown>).ReactNativeWebView = {
    postMessage: mock,
  };
  return mock;
}

function teardownBridge(): void {
  delete (window as unknown as Record<string, unknown>).ReactNativeWebView;
}

afterEach(() => {
  teardownBridge();
  jest.restoreAllMocks();
});

/* -------------------------------------------------------------------------- */
/*  TC-0325 — touch new file                                                   */
/* -------------------------------------------------------------------------- */

describe('TC-0325: touch /tmp/a.txt (new file)', () => {
  it('calls vfsWrite with empty string and returns exitCode 0', async () => {
    // FILE_READ rejects (file does not exist), FILE_WRITE succeeds.
    const mock = setupBridge((msg) => {
      if (msg.type === 'FILE_READ') return new Error('No such file');
      if (msg.type === 'FILE_WRITE') return 'ok';
      return null;
    });

    const result = await dispatch('touch /tmp/a.txt');

    expect(result.exitCode).toBe(0);
    // Verify vfsWrite was called with the correct path and empty content.
    const writeCall = (mock.mock.calls as string[][]).find((args) => {
      const m = JSON.parse(args[0]) as Record<string, unknown>;
      return m.type === 'FILE_WRITE';
    });
    expect(writeCall).toBeDefined();
    const writtenMsg = JSON.parse((writeCall as string[])[0]) as Record<string, unknown>;
    expect(writtenMsg.path).toBe('/tmp/a.txt');
    expect(writtenMsg.content).toBe('');
  });
});

/* -------------------------------------------------------------------------- */
/*  TC-0326 — touch existing file                                              */
/* -------------------------------------------------------------------------- */

describe('TC-0326: touch /tmp/existing.txt (file exists)', () => {
  it('does NOT call vfsWrite and returns exitCode 0', async () => {
    // FILE_READ succeeds (file already exists).
    const mock = setupBridge((msg) => {
      if (msg.type === 'FILE_READ') return 'existing content';
      return null;
    });

    const result = await dispatch('touch /tmp/existing.txt');

    expect(result.exitCode).toBe(0);
    const writeCall = (mock.mock.calls as string[][]).find((args) => {
      const m = JSON.parse(args[0]) as Record<string, unknown>;
      return m.type === 'FILE_WRITE';
    });
    expect(writeCall).toBeUndefined();
  });
});

/* -------------------------------------------------------------------------- */
/*  TC-0327 — cp src dest                                                      */
/* -------------------------------------------------------------------------- */

describe('TC-0327: cp src.txt dest.txt', () => {
  it('calls vfsCopy and returns exitCode 0', async () => {
    const mock = setupBridge((msg) => {
      if (msg.type === 'FILE_COPY') return 'ok';
      return null;
    });

    const result = await dispatch('cp /src.txt /dest.txt');

    expect(result.exitCode).toBe(0);
    const copyCall = (mock.mock.calls as string[][]).find((args) => {
      const m = JSON.parse(args[0]) as Record<string, unknown>;
      return m.type === 'FILE_COPY';
    });
    expect(copyCall).toBeDefined();
  });
});

/* -------------------------------------------------------------------------- */
/*  TC-0328 — cp with no args                                                  */
/* -------------------------------------------------------------------------- */

describe('TC-0328: cp (no args)', () => {
  it('returns exitCode 1 and output contains "usage"', async () => {
    const result = await dispatch('cp');

    expect(result.exitCode).toBe(1);
    expect(result.output.toLowerCase()).toContain('usage');
  });
});

/* -------------------------------------------------------------------------- */
/*  TC-0329 — mv old new                                                       */
/* -------------------------------------------------------------------------- */

describe('TC-0329: mv old.txt new.txt', () => {
  it('calls vfsMove and returns exitCode 0', async () => {
    const mock = setupBridge((msg) => {
      if (msg.type === 'FILE_MOVE') return 'ok';
      return null;
    });

    const result = await dispatch('mv /old.txt /new.txt');

    expect(result.exitCode).toBe(0);
    const moveCall = (mock.mock.calls as string[][]).find((args) => {
      const m = JSON.parse(args[0]) as Record<string, unknown>;
      return m.type === 'FILE_MOVE';
    });
    expect(moveCall).toBeDefined();
  });
});

/* -------------------------------------------------------------------------- */
/*  TC-0330 — mv with no args                                                  */
/* -------------------------------------------------------------------------- */

describe('TC-0330: mv (no args)', () => {
  it('returns exitCode 1', async () => {
    const result = await dispatch('mv');

    expect(result.exitCode).toBe(1);
  });
});

/* -------------------------------------------------------------------------- */
/*  TC-0333 — clear                                                            */
/* -------------------------------------------------------------------------- */

describe('TC-0333: clear', () => {
  it('returns exitCode 0 and clearScreen: true', async () => {
    const result = await dispatch('clear');

    expect(result.exitCode).toBe(0);
    expect(result.clearScreen).toBe(true);
  });
});

/* -------------------------------------------------------------------------- */
/*  TC-0334 — node file.js with console.log                                   */
/* -------------------------------------------------------------------------- */

describe('TC-0334: node file.js with console.log("hi")', () => {
  it('returns output "hi" and exitCode 0', async () => {
    setupBridge((msg) => {
      if (msg.type === 'FILE_READ') return 'console.log("hi");';
      return null;
    });

    const result = await dispatch('node /file.js');

    expect(result.exitCode).toBe(0);
    expect(result.output).toBe('hi');
  });
});

/* -------------------------------------------------------------------------- */
/*  TC-0335 — node file.js with require()                                      */
/* -------------------------------------------------------------------------- */

describe('TC-0335: node file.js with require("fs")', () => {
  it('returns output containing "require() is not available" and exitCode 1', async () => {
    setupBridge((msg) => {
      if (msg.type === 'FILE_READ') return "require('fs');";
      return null;
    });

    const result = await dispatch('node /file.js');

    expect(result.exitCode).toBe(1);
    expect(result.output).toContain('require() is not available');
  });
});

/* -------------------------------------------------------------------------- */
/*  TC-0336 — npm run build                                                    */
/* -------------------------------------------------------------------------- */

describe('TC-0336: npm run build (package.json has "build": "echo ok")', () => {
  it('returns output "ok" and exitCode 0', async () => {
    setupBridge((msg) => {
      if (msg.type === 'FILE_READ') {
        // package.json read
        return JSON.stringify({ scripts: { build: 'echo ok' } });
      }
      return null;
    });

    const result = await dispatch('npm run build');

    expect(result.exitCode).toBe(0);
    expect(result.output).toBe('ok');
  });
});

/* -------------------------------------------------------------------------- */
/*  TC-0337 — npm run missing                                                  */
/* -------------------------------------------------------------------------- */

describe('TC-0337: npm run missing', () => {
  it('returns output containing "not found in package.json" and exitCode 1', async () => {
    setupBridge((msg) => {
      if (msg.type === 'FILE_READ') {
        return JSON.stringify({ scripts: { build: 'echo ok' } });
      }
      return null;
    });

    const result = await dispatch('npm run missing');

    expect(result.exitCode).toBe(1);
    expect(result.output).toContain('not found in package.json');
  });
});

/* -------------------------------------------------------------------------- */
/*  TC-0338 — npm install                                                      */
/* -------------------------------------------------------------------------- */

describe('TC-0338: npm install', () => {
  it('returns exact error string "npm install is not supported" and exitCode 1', async () => {
    const result = await dispatch('npm install');

    expect(result.exitCode).toBe(1);
    expect(result.output).toContain('npm install is not supported');
  });
});

/* -------------------------------------------------------------------------- */
/*  TC-0339 — npm i                                                            */
/* -------------------------------------------------------------------------- */

describe('TC-0339: npm i', () => {
  it('returns the same install-blocked error and exitCode 1', async () => {
    const result = await dispatch('npm i');

    expect(result.exitCode).toBe(1);
    expect(result.output).toContain('npm install is not supported');
  });
});

/* -------------------------------------------------------------------------- */
/*  TC-0340 — npx prettier index.js                                            */
/* -------------------------------------------------------------------------- */

describe('TC-0340: npx prettier index.js', () => {
  it('calls vfsWrite with formatted result and returns exitCode 0', async () => {
    const originalCode = 'const x=1';
    const mock = setupBridge((msg) => {
      if (msg.type === 'FILE_READ') return originalCode;
      if (msg.type === 'FILE_WRITE') return 'ok';
      return null;
    });

    const result = await dispatch('npx prettier /index.js');

    expect(result.exitCode).toBe(0);
    // Verify vfsWrite was called with the prettier-formatted content.
    const writeCall = (mock.mock.calls as string[][]).find((args) => {
      const m = JSON.parse(args[0]) as Record<string, unknown>;
      return m.type === 'FILE_WRITE';
    });
    expect(writeCall).toBeDefined();
    const writtenMsg = JSON.parse((writeCall as string[])[0]) as Record<string, unknown>;
    expect(writtenMsg.content).toBe(`formatted:${originalCode}`);
  });
});

/* -------------------------------------------------------------------------- */
/*  TC-0341 — npx unknown-tool                                                 */
/* -------------------------------------------------------------------------- */

describe('TC-0341: npx unknown-tool', () => {
  it('returns exitCode 1, contains "not available", lists "prettier" but not "eslint" or "tsc"', async () => {
    const result = await dispatch('npx unknown-tool');

    expect(result.exitCode).toBe(1);
    expect(result.output).toContain('not available');
    expect(result.output).toContain('Bundled tools: prettier');
    expect(result.output).not.toContain('eslint');
    expect(result.output).not.toContain('tsc');
  });
});

/* -------------------------------------------------------------------------- */
/*  TC-0342 — npm run depth guard fires at > 5 levels                         */
/* -------------------------------------------------------------------------- */

describe('TC-0342: npm run with script that recurses > 5 levels', () => {
  it('returns exitCode 1 and output contains "maximum script recursion depth"', async () => {
    // Chain a→b→c→d→e→f→f: depth 0→1→2→3→4→5 — guard fires at depth >= 5.
    setupBridge((msg) => {
      if (msg.type === 'FILE_READ') {
        return JSON.stringify({
          scripts: {
            a: 'npm run b',
            b: 'npm run c',
            c: 'npm run d',
            d: 'npm run e',
            e: 'npm run f',
            f: 'npm run f',
          },
        });
      }
      return null;
    });

    const result = await dispatch('npm run a');

    expect(result.exitCode).toBe(1);
    expect(result.output).toContain('maximum script recursion depth');
  });
});

/* -------------------------------------------------------------------------- */
/*  TC-0343 — npm run chain that terminates at exactly depth 4 succeeds       */
/* -------------------------------------------------------------------------- */

describe('TC-0343: npm run chain that terminates at depth 4 (a→b→c→d→echo ok)', () => {
  it('returns exitCode 0 and output "ok"', async () => {
    // Chain a→b→c→d→echo ok: depth 0→1→2→3→4, echo executes at depth 4, guard not triggered.
    setupBridge((msg) => {
      if (msg.type === 'FILE_READ') {
        return JSON.stringify({
          scripts: {
            a: 'npm run b',
            b: 'npm run c',
            c: 'npm run d',
            d: 'echo ok',
          },
        });
      }
      return null;
    });

    const result = await dispatch('npm run a');

    expect(result.exitCode).toBe(0);
    expect(result.output).toBe('ok');
  });
});

/* -------------------------------------------------------------------------- */
/*  TC-0344 — unknown command                                                  */
/* -------------------------------------------------------------------------- */

describe('TC-0344: somethingweird (unknown command)', () => {
  it('returns output containing "command not found" and exitCode 127', async () => {
    const result = await dispatch('somethingweird');

    expect(result.exitCode).toBe(127);
    expect(result.output).toContain('command not found');

describe('dispatch — git init (AC-0130)', () => {
  // TC-0345
  it('git init calls git.init and returns initialized message', async () => {
    const result = await dispatch('git init');

    expect(mockInit).toHaveBeenCalledTimes(1);
    expect(result.exitCode).toBe(0);
    expect(result.output).toContain('Initialized empty Git repository');
  });
});

describe('dispatch — git friendly errors (AC-0135)', () => {
  // TC-0346
  it('git status ENOENT returns friendly "not a git repository" message', async () => {
    mockStatusMatrix.mockRejectedValue(
      new Error(
        "Call to function 'ExponentFileSystem.readFileAsync' has been rejected - Caused by: java.io.FileNotFoundException: /data/user/0/com.example/.git ENOENT",
      ),
    );

    const result = await dispatch('git status');

    expect(result.exitCode).toBe(128);
    expect(result.output).toContain(
      'fatal: not a git repository (or any of the parent directories): .git',
    );
    expect(result.output).toContain("Run 'git init' to create one.");
  });

  // TC-0346
  it('git status "Could not find git repo" returns friendly message', async () => {
    mockStatusMatrix.mockRejectedValue(
      new Error('Could not find git repo at path /'),
    );

    const result = await dispatch('git status');

    expect(result.exitCode).toBe(128);
    expect(result.output).toContain(
      'fatal: not a git repository (or any of the parent directories): .git',
    );
  });
});
