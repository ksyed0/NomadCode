/**
 * WebView-side terminal bundle
 * Runs in browser context inside WKWebView/Android WebView — NOT in React Native.
 *
 * Provides:
 *   - DOM-based terminal UI (Xterm.js integration deferred to Phase 2.1)
 *   - Shell dispatcher (pwd, cd, echo, ls, cat, mkdir, rm, git)
 *   - VFS bridge (async request/response over postMessage)
 *   - isomorphic-git integration for git commands
 */

import git from 'isomorphic-git';
import http from 'isomorphic-git/http/web';

/* -------------------------------------------------------------------------- */
/*  Global type declarations for the WebView environment                       */
/* -------------------------------------------------------------------------- */

declare const window: Window & {
  ReactNativeWebView: { postMessage: (data: string) => void };
  receiveFromRN: (msgJson: string) => void;
};

/* -------------------------------------------------------------------------- */
/*  State                                                                       */
/* -------------------------------------------------------------------------- */

let cwd = '/';
const pendingRequests = new Map<
  string,
  (result: string | null, error?: string) => void
>();

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                     */
/* -------------------------------------------------------------------------- */

function generateId(): string {
  return Math.random().toString(36).slice(2);
}

function sendToRN(msg: object): void {
  window.ReactNativeWebView.postMessage(JSON.stringify(msg));
}

/**
 * Resolve a shell argument to an absolute path.
 * If `arg` already starts with '/' it is returned as-is;
 * otherwise it is joined with `cwd` and duplicate slashes are collapsed.
 */
function resolvePath(arg: string, baseCwd: string): string {
  return arg.startsWith('/') ? arg : `${baseCwd}/${arg}`.replace(/\/+/g, '/');
}

/* -------------------------------------------------------------------------- */
/*  VFS bridge — wraps each RN file operation as an async promise              */
/* -------------------------------------------------------------------------- */

async function vfsRead(path: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const requestId = generateId();
    pendingRequests.set(requestId, (result, error) => {
      if (error) reject(new Error(error));
      else resolve(result ?? '');
    });
    sendToRN({ type: 'FILE_READ', requestId, path });
  });
}

async function vfsWrite(path: string, content: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const requestId = generateId();
    pendingRequests.set(requestId, (_result, error) => {
      if (error) reject(new Error(error));
      else resolve();
    });
    sendToRN({ type: 'FILE_WRITE', requestId, path, content });
  });
}

async function vfsList(path: string): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const requestId = generateId();
    pendingRequests.set(requestId, (result, error) => {
      if (error) reject(new Error(error));
      else {
        try {
          resolve(JSON.parse(result ?? '[]') as string[]);
        } catch {
          resolve([]);
        }
      }
    });
    sendToRN({ type: 'FILE_LIST', requestId, path });
  });
}

async function vfsMkdir(path: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const requestId = generateId();
    pendingRequests.set(requestId, (_result, error) => {
      if (error) reject(new Error(error));
      else resolve();
    });
    sendToRN({ type: 'FILE_MKDIR', requestId, path });
  });
}

async function vfsDelete(path: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const requestId = generateId();
    pendingRequests.set(requestId, (_result, error) => {
      if (error) reject(new Error(error));
      else resolve();
    });
    sendToRN({ type: 'FILE_DELETE', requestId, path });
  });
}

async function vfsCopy(src: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const requestId = generateId();
    pendingRequests.set(requestId, (_result, error) => {
      if (error) reject(new Error(error));
      else resolve();
    });
    sendToRN({ type: 'FILE_COPY', requestId, src, dest });
  });
}

async function vfsMove(src: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const requestId = generateId();
    pendingRequests.set(requestId, (_result, error) => {
      if (error) reject(new Error(error));
      else resolve();
    });
    sendToRN({ type: 'FILE_MOVE', requestId, src, dest });
  });
}

/* -------------------------------------------------------------------------- */
/*  isomorphic-git fs adapter                                                  */
/* -------------------------------------------------------------------------- */

const gitFs = {
  promises: {
    readFile: async (
      path: string,
      options?: { encoding?: string },
    ): Promise<string | Uint8Array> => {
      const content = await vfsRead(path);
      if (options?.encoding) return content;
      return new TextEncoder().encode(content);
    },

    writeFile: async (
      path: string,
      data: string | Uint8Array,
    ): Promise<void> => {
      const text =
        typeof data === 'string' ? data : new TextDecoder().decode(data);
      await vfsWrite(path, text);
    },

    unlink: async (path: string): Promise<void> => {
      await vfsDelete(path);
    },

    readdir: async (path: string): Promise<string[]> => {
      const entries = await vfsList(path);
      return entries.map((e) => e.replace(/\/$/, ''));
    },

    mkdir: async (path: string): Promise<void> => {
      await vfsMkdir(path);
    },

    rmdir: async (path: string): Promise<void> => {
      await vfsDelete(path);
    },

    stat: async (path: string) => {
      const entries = await vfsList(path).catch(() => null);
      return {
        isFile: () => entries === null,
        isDirectory: () => entries !== null,
        isSymbolicLink: () => false,
        size: 0,
        mode: 0o100644,
        mtimeMs: Date.now(),
        ctimeMs: Date.now(),
        uid: 0,
        gid: 0,
      };
    },

    lstat: async (path: string) => {
      const entries = await vfsList(path).catch(() => null);
      return {
        isFile: () => entries === null,
        isDirectory: () => entries !== null,
        isSymbolicLink: () => false,
        size: 0,
        mode: 0o100644,
        mtimeMs: Date.now(),
        ctimeMs: Date.now(),
        uid: 0,
        gid: 0,
      };
    },
  },
};

/* -------------------------------------------------------------------------- */
/*  Git handler                                                                 */
/* -------------------------------------------------------------------------- */

async function handleGit(
  args: string[],
): Promise<{ output: string; exitCode: number }> {
  const [subcommand, ...rest] = args;

  try {
    switch (subcommand) {
      case 'status': {
        const statusMatrix = await git.statusMatrix({ fs: gitFs, dir: cwd });
        if (statusMatrix.length === 0) {
          return { output: 'nothing to commit, working tree clean', exitCode: 0 };
        }
        const lines = statusMatrix.map(([filepath, head, workdir, stage]) => {
          if (head === 0 && workdir === 2) return `?? ${filepath}`;
          if (head === 1 && workdir === 2 && stage === 2) return `M  ${filepath}`;
          if (head === 1 && workdir === 2 && stage === 1) return ` M ${filepath}`;
          if (head === 0 && workdir === 2 && stage === 2) return `A  ${filepath}`;
          if (head === 1 && workdir === 0) return ` D ${filepath}`;
          return `   ${filepath}`;
        });
        return { output: lines.join('\n'), exitCode: 0 };
      }

      case 'log': {
        const commits = await git.log({ fs: gitFs, dir: cwd, depth: 10 });
        if (commits.length === 0) {
          return { output: '(no commits)', exitCode: 0 };
        }
        const lines = commits.map(
          (c) => `${c.oid.slice(0, 7)} ${c.commit.message.split('\n')[0]}`,
        );
        return { output: lines.join('\n'), exitCode: 0 };
      }

      case 'add': {
        const filepath = rest[0];
        if (!filepath) {
          return { output: 'usage: git add <file>', exitCode: 1 };
        }
        await git.add({ fs: gitFs, dir: cwd, filepath });
        return { output: '', exitCode: 0 };
      }

      case 'commit': {
        // Expect: git commit -m "message"
        const mIdx = rest.indexOf('-m');
        const message =
          mIdx !== -1 && rest[mIdx + 1] ? rest[mIdx + 1] : 'commit';
        const sha = await git.commit({
          fs: gitFs,
          dir: cwd,
          message,
          author: { name: 'NomadCode', email: 'nomadcode@local' },
        });
        return { output: `[${sha.slice(0, 7)}] ${message}`, exitCode: 0 };
      }

      case 'push': {
        const remote = rest[0] || 'origin';
        const branch = rest[1] || 'main';
        await git.push({
          fs: gitFs,
          http,
          dir: cwd,
          remote,
          remoteRef: branch,
        });
        return {
          output: `Pushed to ${remote}/${branch}`,
          exitCode: 0,
        };
      }

      case 'clone': {
        const url = rest[0];
        const dir = rest[1] || cwd;
        if (!url) {
          return { output: 'usage: git clone <url> [dir]', exitCode: 1 };
        }
        await git.clone({
          fs: gitFs,
          http,
          dir,
          url,
        });
        return { output: `Cloned ${url} into ${dir}`, exitCode: 0 };
      }

      default:
        return {
          output: `git: '${subcommand}' is not a supported command`,
          exitCode: 1,
        };
    }
  } catch (e) {
    return { output: `git: ${(e as Error).message}`, exitCode: 1 };
  }
}

/* -------------------------------------------------------------------------- */
/*  Shell dispatcher                                                            */
/* -------------------------------------------------------------------------- */

export async function dispatch(
  cmd: string,
): Promise<{ output: string; exitCode: number; clearScreen?: boolean }> {
  const trimmed = cmd.trim();
  if (!trimmed) return { output: '', exitCode: 0 };

  const parts = trimmed.split(/\s+/);
  const [base, ...args] = parts;

  switch (base) {
    case 'pwd':
      return { output: cwd, exitCode: 0 };

    case 'cd': {
      const target = args[0] || '/';
      cwd = resolvePath(target, cwd);
      return { output: '', exitCode: 0 };
    }

    case 'echo':
      return { output: args.join(' '), exitCode: 0 };

    case 'ls': {
      try {
        const entries = await vfsList(args[0] || cwd);
        return { output: entries.join('\n'), exitCode: 0 };
      } catch (e) {
        return { output: `ls: ${(e as Error).message}`, exitCode: 1 };
      }
    }

    case 'cat': {
      try {
        const content = await vfsRead(args[0] || '');
        return { output: content, exitCode: 0 };
      } catch (e) {
        return { output: `cat: ${(e as Error).message}`, exitCode: 1 };
      }
    }

    case 'mkdir': {
      try {
        await vfsMkdir(args[0] || '');
        return { output: '', exitCode: 0 };
      } catch (e) {
        return { output: `mkdir: ${(e as Error).message}`, exitCode: 1 };
      }
    }

    case 'rm': {
      try {
        await vfsDelete(args[0] || '');
        return { output: '', exitCode: 0 };
      } catch (e) {
        return { output: `rm: ${(e as Error).message}`, exitCode: 1 };
      }
    }

    case 'touch': {
      if (!args[0]) {
        return { output: 'usage: touch <file>', exitCode: 1 };
      }
      const touchPath = resolvePath(args[0], cwd);
      try {
        await vfsRead(touchPath);
        // File exists — no-op
        return { output: '', exitCode: 0 };
      } catch {
        // File does not exist — create it
        try {
          await vfsWrite(touchPath, '');
          return { output: '', exitCode: 0 };
        } catch (e) {
          return { output: `touch: ${(e as Error).message}`, exitCode: 1 };
        }
      }
    }

    case 'cp': {
      if (!args[0] || !args[1]) {
        return { output: 'usage: cp <src> <dest>', exitCode: 1 };
      }
      const cpSrc = resolvePath(args[0], cwd);
      const cpDest = resolvePath(args[1], cwd);
      try {
        await vfsCopy(cpSrc, cpDest);
        return { output: '', exitCode: 0 };
      } catch (e) {
        return { output: `cp: ${(e as Error).message}`, exitCode: 1 };
      }
    }

    case 'mv': {
      if (!args[0] || !args[1]) {
        return { output: 'usage: mv <src> <dest>', exitCode: 1 };
      }
      const mvSrc = resolvePath(args[0], cwd);
      const mvDest = resolvePath(args[1], cwd);
      try {
        await vfsMove(mvSrc, mvDest);
        return { output: '', exitCode: 0 };
      } catch (e) {
        return { output: `mv: ${(e as Error).message}`, exitCode: 1 };
      }
    }

    case 'clear':
      return { output: '', exitCode: 0, clearScreen: true };

    case 'npm': {
      if (!args[0]) {
        return { output: 'usage: npm run <script>', exitCode: 1 };
      }
      if (args[0] === 'install' || args[0] === 'i') {
        return { output: "npm install is not supported in NomadCode — packages are pre-bundled", exitCode: 1 };
      }
      // For 'npm run' and other subcommands — return unsupported for now (Task 3 will implement 'run')
      return { output: `npm: '${args[0]}' is not a supported npm command`, exitCode: 1 };
    }

    case 'git':
      return handleGit(args);

    default:
      return { output: `bash: ${base}: command not found`, exitCode: 127 };
  }
}

/* -------------------------------------------------------------------------- */
/*  DOM terminal UI                                                             */
/* -------------------------------------------------------------------------- */

function initTerminal(): void {
  const output = document.getElementById('output') as HTMLElement;
  const input = document.getElementById('input') as HTMLInputElement;

  function printLine(text: string, className = ''): void {
    const line = document.createElement('div');
    line.className = `line${className ? ' ' + className : ''}`;
    line.textContent = text;
    output.appendChild(line);
    output.scrollTop = output.scrollHeight;
  }

  printLine('NomadCode Terminal v0.1', 'info');
  printLine(`cwd: ${cwd}`, 'info');

  input.addEventListener('keydown', async (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      const cmd = input.value.trim();
      input.value = '';
      if (!cmd) return;
      printLine(`$ ${cmd}`, 'command');
      const { output: out, exitCode, clearScreen } = await dispatch(cmd);
      if (clearScreen) {
        // Clear the output before printing the new prompt
        output.innerHTML = '';
      }
      if (out) printLine(out, exitCode === 0 ? '' : 'error');
      sendToRN({ type: 'COMMAND_COMPLETE', exitCode });
    }
  });

  // Focus input on tap anywhere in the terminal area
  output.addEventListener('click', () => input.focus());
}

document.addEventListener('DOMContentLoaded', initTerminal);

/* -------------------------------------------------------------------------- */
/*  Receive messages from React Native                                          */
/* -------------------------------------------------------------------------- */

window.receiveFromRN = (msgJson: string): void => {
  try {
    const msg = JSON.parse(msgJson) as {
      type: string;
      requestId?: string;
      result?: string | null;
      error?: string;
      cwd?: string;
      cols?: number;
      rows?: number;
    };

    if (msg.type === 'FILE_RESULT' && msg.requestId) {
      const resolver = pendingRequests.get(msg.requestId);
      if (resolver) {
        pendingRequests.delete(msg.requestId);
        resolver(msg.result ?? null, msg.error);
      }
    } else if (msg.type === 'SET_CWD' && msg.cwd) {
      cwd = msg.cwd;
    }
    // RESIZE will be handled by Xterm.js in Phase 2.1
  } catch {
    console.error('Failed to parse RN message');
  }
};
