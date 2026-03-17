# EPIC-0003 Phase 2 — WASI Terminal Runtime Design Spec

**Date:** 2026-03-17
**Epic:** EPIC-0003 — WASI Terminal Runtime
**Phase:** 2 — WebView-hosted Xterm.js terminal with real file system and git
**Status:** Draft
**Author:** Claude Code

---

## Table of Contents

1. [Overview & Context](#1-overview--context)
2. [Architecture Diagram](#2-architecture-diagram)
3. [Component List](#3-component-list)
4. [Message Protocol Types](#4-message-protocol-types)
5. [Shell Dispatcher Routing](#5-shell-dispatcher-routing)
6. [VFS Bridge (WebView Side)](#6-vfs-bridge-webview-side)
7. [Error Handling](#7-error-handling)
8. [New Artefact IDs](#8-new-artefact-ids)
9. [Testing Strategy](#9-testing-strategy)
10. [Files Created / Modified](#10-files-created--modified)

---

## 1. Overview & Context

### Current State

`src/components/Terminal.tsx` is a **mock terminal**. It renders a scrollable list of output lines and processes input through a hardcoded JavaScript `switch` statement. Commands like `ls`, `pwd`, `echo`, and a handful of others are simulated with static responses. There is:

- No real file system access — file listings are fabricated.
- No process execution — commands that would spawn processes simply print placeholder text.
- No git support — `git` commands return stub output.
- No terminal emulation — cursor movement, ANSI escape sequences, and interactive programs are not supported.

This mock implementation was intentional for Phase 1 (UI prototyping), but it is a blocker for delivering a developer-usable terminal experience.

### Goal

Replace `Terminal.tsx` with a production-quality terminal backed by real infrastructure:

| Concern | Solution |
|---|---|
| Terminal emulation (ANSI, cursor, resize) | Xterm.js hosted in a WebView |
| File system access | Expo FileSystem bridged into the WebView via postMessage |
| Git operations | isomorphic-git running inside the WebView |
| Shell built-ins (`ls`, `cd`, `cat`, etc.) | JavaScript implementations using the VFS bridge |
| Offline-first | All execution happens on-device; no server required |

The new component (`TerminalWebView.tsx`) replaces `Terminal.tsx` as the rendered terminal in the main IDE layout. The WebView bundle is self-contained — it is built at development time with esbuild and embedded as a static asset, so there is no runtime download and the terminal works fully offline.

---

## 2. Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  React Native Layer (TypeScript / Expo)                                      │
│                                                                               │
│  ┌──────────────────────────┐   ┌──────────────────────────────────────────┐ │
│  │  TerminalWebView.tsx     │   │  hooks/useTerminalBridge.ts              │ │
│  │  (replaces Terminal.tsx) │   │  - Owns WebView ref                      │ │
│  │  - Renders <WebView>     │◄──│  - injectJavaScript for RN→WebView       │ │
│  │  - Displays error state  │   │  - onMessage handler for WebView→RN      │ │
│  │  - "Restart" on crash    │   │  - Typed send/receive via protocol.ts    │ │
│  └──────────────────────────┘   └──────────────────────────────────────────┘ │
│           │                                       │                           │
│           │                      ┌────────────────▼─────────────────────┐    │
│           │                      │  terminal/protocol.ts                │    │
│           │                      │  - RNToWebView union type            │    │
│           │                      │  - WebViewToRN union type            │    │
│           │                      └──────────────────────────────────────┘    │
│           │                                       │                           │
│           │                      ┌────────────────▼─────────────────────┐    │
│           │                      │  terminal/FileBridge.ts              │    │
│           │                      │  - Services FILE_* messages          │    │
│           │                      │  - Calls expo-file-system API        │    │
│           │                      │  - Returns FILE_RESULT to WebView    │    │
│           │                      └──────────────────────────────────────┘    │
│                                                   │                           │
│                           ┌───────────────────────▼──────────────────────┐   │
│                           │  Expo FileSystem (expo-file-system ~18.0.12) │   │
│                           │  (already installed)                         │   │
│                           └──────────────────────────────────────────────┘   │
└───────────────────────────────────────────────────────────────────────────────┘
                               ↕  postMessage (JSON strings)
┌───────────────────────────────────────────────────────────────────────────────┐
│  WebView Layer  (WKWebView on iOS / Chrome WebView on Android)                │
│                                                                               │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │  terminal/bundle/index.html                                              │ │
│  │  Self-contained static asset (no network access at runtime)             │ │
│  │                                                                          │ │
│  │  ┌────────────────────┐  ┌─────────────────┐  ┌──────────────────────┐ │ │
│  │  │  Xterm.js          │  │  Shell           │  │  isomorphic-git      │ │ │
│  │  │  - Terminal UI     │  │  Dispatcher      │  │  - git clone         │ │ │
│  │  │  - ANSI support    │  │  - git → git lib │  │  - git commit        │ │ │
│  │  │  - resize support  │  │  - builtins → VFS│  │  - git log, diff...  │ │ │
│  │  └────────────────────┘  │  - unknown → 127 │  └──────────────────────┘ │ │
│  │                           └─────────────────┘                            │ │
│  │  ┌─────────────────────────────────────────────────────────────────────┐ │ │
│  │  │  VFS Bridge                                                          │ │ │
│  │  │  - pendingRequests Map<requestId, {resolve, reject}>                 │ │ │
│  │  │  - postMessage → RN for all FS ops                                   │ │ │
│  │  │  - window.onmessage resolves pending promises                        │ │ │
│  │  │  - isomorphic-git fs adapter wraps VFS bridge                        │ │ │
│  │  └─────────────────────────────────────────────────────────────────────┘ │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                               │
│  terminal/bundle/index.ts  ← TypeScript source, compiled by esbuild          │
│  terminal/bundle/build.js  ← esbuild build script                            │
└───────────────────────────────────────────────────────────────────────────────┘
```

### Data Flow Summary

```
User types command
    │
    ▼
Xterm.js captures keystroke
    │
    ▼
Shell Dispatcher parses command
    │
    ├─ git command ─────────────────► isomorphic-git
    │                                      │
    ├─ builtin command ─► VFS Bridge ◄─────┘ (git also uses VFS for FS ops)
    │                        │
    │                        ▼
    │               postMessage → RN (FILE_READ / FILE_WRITE / etc.)
    │                        │
    │                        ▼
    │               FileBridge.ts → expo-file-system
    │                        │
    │                        ▼
    │               postMessage → WebView (FILE_RESULT)
    │                        │
    │               VFS Bridge resolves promise
    │
    ▼
Output written to Xterm.js
```

---

## 3. Component List

### 3.1 `terminal/protocol.ts`

**Purpose:** Single source of truth for all typed messages that cross the React Native ↔ WebView boundary. Importing from this file on both sides ensures the protocol never drifts out of sync.

**Interface:**

```typescript
// Messages sent from React Native → WebView
export type RNToWebView =
  | { type: 'FILE_RESULT'; requestId: string; result: string | null; error?: string }
  | { type: 'RESIZE'; cols: number; rows: number }
  | { type: 'SET_CWD'; cwd: string };

// Messages sent from WebView → React Native
export type WebViewToRN =
  | { type: 'FILE_READ';   requestId: string; path: string }
  | { type: 'FILE_WRITE';  requestId: string; path: string; content: string }
  | { type: 'FILE_LIST';   requestId: string; path: string }
  | { type: 'FILE_MKDIR';  requestId: string; path: string }
  | { type: 'FILE_DELETE'; requestId: string; path: string }
  | { type: 'COMMAND_COMPLETE'; exitCode: number };
```

**Key dependencies:** None (pure types, no runtime imports).

---

### 3.2 `terminal/FileBridge.ts`

**Purpose:** Services `FILE_*` messages arriving from the WebView. Translates each message type into the appropriate `expo-file-system` API call and posts a `FILE_RESULT` response back to the WebView via the provided `sendToWebView` callback.

**Interface:**

```typescript
export interface FileBridgeOptions {
  /** Callback to post a RNToWebView message back to the WebView */
  sendToWebView: (msg: RNToWebView) => void;
}

export class FileBridge {
  constructor(options: FileBridgeOptions);

  /** Entry point — call this from the useTerminalBridge onMessage handler */
  handleMessage(msg: WebViewToRN): Promise<void>;
}
```

**Supported operations:**

| Message type | Expo FileSystem API | Result encoding |
|---|---|---|
| `FILE_READ` | `FileSystem.readAsStringAsync` | UTF-8 string |
| `FILE_WRITE` | `FileSystem.writeAsStringAsync` | `null` (no content) |
| `FILE_LIST` | `FileSystem.readDirectoryAsync` | JSON-encoded `string[]` |
| `FILE_MKDIR` | `FileSystem.makeDirectoryAsync` (recursive) | `null` |
| `FILE_DELETE` | `FileSystem.deleteAsync` | `null` |

All errors are caught and returned as `{ type: 'FILE_RESULT', requestId, result: null, error: errorMessage }`.

**Key dependencies:** `expo-file-system ~18.0.12`, `terminal/protocol.ts`.

---

### 3.3 `hooks/useTerminalBridge.ts`

**Purpose:** React hook that encapsulates all WebView bridge logic for use by `TerminalWebView.tsx`. Owns the `WebView` ref, provides a typed `sendToWebView` function, registers the `onMessage` handler, and delegates `FILE_*` messages to `FileBridge`.

**Interface:**

```typescript
export interface TerminalBridgeResult {
  /** Attach to <WebView ref={webViewRef}> */
  webViewRef: React.RefObject<WebView>;
  /** Called by <WebView onMessage={onMessage}> */
  onMessage: (event: WebViewMessageEvent) => void;
  /** Send a typed message to the WebView */
  sendToWebView: (msg: RNToWebView) => void;
  /** True while the terminal is initialising after mount */
  isLoading: boolean;
  /** Non-null when the WebView has crashed or reported an unrecoverable error */
  error: string | null;
  /** Call to destroy and remount the WebView after a crash */
  restart: () => void;
}

export function useTerminalBridge(cwd: string): TerminalBridgeResult;
```

**Behaviour:**

- On mount, sends `SET_CWD` to the WebView once it reports ready.
- Passes `RESIZE` messages through to the WebView whenever the container dimensions change (via `onLayout`).
- Delegates all `FILE_*` messages to `FileBridge.handleMessage`.
- Sets `error` state when the WebView fires `onError` or `onHttpError`.
- `restart()` increments an internal key that causes `TerminalWebView` to remount the WebView.

**Key dependencies:** `react-native-webview`, `terminal/FileBridge.ts`, `terminal/protocol.ts`.

---

### 3.4 `terminal/bundle/index.ts`

**Purpose:** Entry point for the self-contained WebView bundle. This TypeScript file is compiled by esbuild into a single JavaScript bundle that is inlined into `index.html`. It initialises Xterm.js, implements the VFS bridge, registers the shell dispatcher, and wires isomorphic-git to the VFS.

**Interface (internal, not exported):**

- Initialises an `xterm.Terminal` instance and calls `terminal.open(document.getElementById('terminal'))`.
- Registers `terminal.onData` to feed keystrokes into the shell's input buffer.
- Exposes `window.receiveMessage(jsonString)` as the entry point for messages arriving from React Native (called via `injectJavaScript` by `useTerminalBridge`).
- Implements `sendToRN(msg: WebViewToRN)` which calls `window.ReactNativeWebView.postMessage(JSON.stringify(msg))`.

**Key dependencies:** `xterm`, `isomorphic-git`, VFS bridge (internal module).

---

### 3.5 `terminal/bundle/build.js`

**Purpose:** esbuild build script that compiles `index.ts` and all its dependencies into a single self-contained JavaScript string, then wraps it in `index.html` with an inline `<script>` tag. The output file is placed at `src/assets/terminal/index.html` so it can be bundled by Metro as a static asset.

**Interface:**

```javascript
// Run as: node terminal/bundle/build.js
// Outputs: src/assets/terminal/index.html
```

**Build options:**

| Option | Value |
|---|---|
| `bundle` | `true` |
| `minify` | `true` (production) / `false` (development) |
| `platform` | `browser` |
| `target` | `es2017` (WebView compat) |
| `format` | `iife` |

**Key dependencies:** `esbuild` (dev dependency).

---

### 3.6 `components/TerminalWebView.tsx`

**Purpose:** React Native component that replaces `Terminal.tsx` in the IDE layout. Renders a `<WebView>` pointed at the self-contained `index.html` asset, wires up the bridge via `useTerminalBridge`, and displays an error state with a "Restart" button if the WebView crashes.

**Interface:**

```typescript
export interface TerminalWebViewProps {
  /** Initial working directory shown in the terminal prompt */
  cwd: string;
  /** Optional style override for the container */
  style?: StyleProp<ViewStyle>;
  /** Called when the user successfully executes a command */
  onCommandComplete?: (exitCode: number) => void;
}

export function TerminalWebView(props: TerminalWebViewProps): JSX.Element;
```

**Key dependencies:** `react-native-webview`, `hooks/useTerminalBridge.ts`.

---

## 4. Message Protocol Types

### Complete Type Definitions

```typescript
// terminal/protocol.ts

/**
 * Messages sent from the React Native layer to the WebView.
 * Delivered via injectJavaScript: `window.receiveMessage(JSON.stringify(msg))`
 */
export type RNToWebView =
  | {
      type: 'FILE_RESULT';
      /** Correlates with the requestId of the originating WebViewToRN FILE_* message */
      requestId: string;
      /** UTF-8 file content, JSON-encoded directory listing, or null for write/mkdir/delete */
      result: string | null;
      /** Present only when the operation failed */
      error?: string;
    }
  | {
      type: 'RESIZE';
      /** New terminal column count */
      cols: number;
      /** New terminal row count */
      rows: number;
    }
  | {
      type: 'SET_CWD';
      /** Absolute path to the initial working directory */
      cwd: string;
    };

/**
 * Messages sent from the WebView to the React Native layer.
 * Delivered via window.ReactNativeWebView.postMessage(JSON.stringify(msg))
 */
export type WebViewToRN =
  | {
      type: 'FILE_READ';
      requestId: string;
      /** Absolute path to read */
      path: string;
    }
  | {
      type: 'FILE_WRITE';
      requestId: string;
      /** Absolute path to write */
      path: string;
      /** UTF-8 string content to write */
      content: string;
    }
  | {
      type: 'FILE_LIST';
      requestId: string;
      /** Absolute path of directory to list */
      path: string;
    }
  | {
      type: 'FILE_MKDIR';
      requestId: string;
      /** Absolute path of directory to create (created recursively) */
      path: string;
    }
  | {
      type: 'FILE_DELETE';
      requestId: string;
      /** Absolute path to delete */
      path: string;
    }
  | {
      type: 'COMMAND_COMPLETE';
      /** POSIX-style exit code (0 = success, non-zero = error) */
      exitCode: number;
    };
```

### Request / Response Flow

The protocol uses a **request/response correlation pattern** via `requestId`. Every file operation message sent from the WebView includes a unique `requestId`. The React Native layer uses this ID to match the asynchronous `FILE_RESULT` response to the original request.

```
WebView                                        React Native
───────                                        ────────────

1. VFS bridge generates requestId = uuid()
2. postMessage({ type: 'FILE_READ',
                 requestId: 'abc-123',
                 path: '/project/index.ts' })
                                        ──────────►
                                        3. onMessage receives FILE_READ
                                        4. FileBridge.handleMessage(msg)
                                        5. FileSystem.readAsStringAsync(path)
                                        6. postMessage({ type: 'FILE_RESULT',
                                                         requestId: 'abc-123',
                                                         result: '<file content>' })
                                        ◄──────────
7. window.receiveMessage called with
   FILE_RESULT { requestId: 'abc-123' }
8. pendingRequests.get('abc-123').resolve(result)
9. Awaiting caller receives file content
```

**requestId generation:** The WebView generates a UUID v4 for each request. A simple implementation uses `Math.random().toString(36).slice(2) + Date.now().toString(36)`. A cryptographically strong UUID is not required because requestIds are only used for in-memory correlation within a single session.

**Timeout handling:** The VFS bridge sets a 30-second timeout per request. If no `FILE_RESULT` arrives within 30 seconds, the pending promise rejects with a timeout error, and stderr displays an appropriate message.

---

## 5. Shell Dispatcher Routing

The shell dispatcher is a function in the WebView bundle that parses a command line string into a command name and arguments, then routes execution to the appropriate handler.

### Routing Table

```
Input command string
      │
      ▼
Parse: argv = tokenize(input)
cmd   = argv[0]
args  = argv.slice(1)
      │
      ├─ cmd starts with "git" ──────────────────► isomorphic-git handler
      │                                             (see §5.1)
      │
      ├─ cmd in BUILTIN_COMMANDS ────────────────► JS built-in handler
      │   ls, cd, pwd, echo, cat,                  (see §5.2)
      │   mkdir, rm, cp, mv, clear,
      │   touch, which, help, exit
      │
      └─ all other commands ─────────────────────► "command not found"
                                                    exit code 127
```

### 5.1 Git Command Routing

All commands that begin with `git` are handed to isomorphic-git. The dispatcher maps subcommands to isomorphic-git API calls:

| Subcommand | isomorphic-git API |
|---|---|
| `git init` | `git.init` |
| `git clone` | `git.clone` |
| `git status` | `git.status` / `git.statusMatrix` |
| `git add` | `git.add` |
| `git commit` | `git.commit` |
| `git log` | `git.log` |
| `git diff` | `git.walk` (diff walk) |
| `git push` | `git.push` |
| `git pull` | `git.pull` |
| `git branch` | `git.listBranches` / `git.branch` |
| `git checkout` | `git.checkout` |
| `git fetch` | `git.fetch` |

isomorphic-git uses the VFS bridge as its `fs` adapter, so all git file operations flow through the Expo FileSystem bridge. Network operations (clone, push, pull, fetch) use isomorphic-git's built-in HTTP plugin (`@isomorphic-git/http`), which runs inside the WebView using the WebView's own network stack.

### 5.2 Built-in Command Implementations

Built-ins are pure JavaScript implementations that use the VFS bridge for file system access:

| Command | Implementation |
|---|---|
| `pwd` | Returns current working directory string (tracked in VFS bridge state) |
| `cd <path>` | Resolves path, calls `FILE_LIST` to verify directory exists, updates cwd |
| `ls [path]` | Calls `FILE_LIST`, formats output as column-aligned names |
| `ls -la [path]` | Calls `FILE_LIST`, formats as long listing (name only — size/mtime not yet supported) |
| `echo <args>` | Joins args with spaces, writes to stdout |
| `cat <file>` | Calls `FILE_READ`, writes content to stdout |
| `mkdir [-p] <path>` | Calls `FILE_MKDIR` |
| `rm [-r] <path>` | Calls `FILE_DELETE` |
| `cp <src> <dst>` | `FILE_READ` src, `FILE_WRITE` dst |
| `mv <src> <dst>` | `FILE_READ` src, `FILE_WRITE` dst, `FILE_DELETE` src |
| `touch <file>` | `FILE_WRITE` with empty string if file does not exist |
| `clear` | Calls `terminal.clear()` on the Xterm.js instance |
| `which <cmd>` | Returns "built-in" or "not found" |
| `help` | Prints list of available commands |
| `exit` | Sends `COMMAND_COMPLETE { exitCode: 0 }` and clears the terminal |

### 5.3 Unknown Command Handler

```
$ foobar

bash: foobar: command not found

Exit code: 127
```

The dispatcher writes the error message to stderr (red text via ANSI `\x1b[31m`) and sends `COMMAND_COMPLETE { exitCode: 127 }` to React Native.

---

## 6. VFS Bridge (WebView Side)

### Overview

The VFS bridge is an internal module in the WebView bundle. It provides a Promise-based file system API to the shell dispatcher and isomorphic-git. Every call results in a postMessage round-trip to the React Native layer.

### Implementation

```
┌─────────────────────────────────────────────────────────────────────┐
│  VFS Bridge (WebView)                                                │
│                                                                      │
│  pendingRequests: Map<requestId, { resolve, reject, timeoutId }>    │
│                                                                      │
│  readFile(path): Promise<string>                                     │
│  writeFile(path, content): Promise<void>                            │
│  listDir(path): Promise<string[]>                                   │
│  mkdir(path): Promise<void>                                          │
│  deleteFile(path): Promise<void>                                     │
│                                                                      │
│  Each method:                                                        │
│  1. Generates requestId                                              │
│  2. Stores { resolve, reject, timeoutId } in pendingRequests        │
│  3. Calls sendToRN({ type: 'FILE_*', requestId, ...args })          │
│  4. Returns the Promise                                              │
│                                                                      │
│  window.receiveMessage(jsonString):                                  │
│  1. Parses message                                                   │
│  2. If type === 'FILE_RESULT':                                       │
│     a. Looks up pendingRequests.get(requestId)                      │
│     b. Clears the timeout                                            │
│     c. If error → rejects the promise                               │
│     d. Else → resolves the promise with result                      │
│  3. Other types (RESIZE, SET_CWD) handled separately                │
└─────────────────────────────────────────────────────────────────────┘
```

### isomorphic-git `fs` Adapter

isomorphic-git requires an `fs` object conforming to a subset of the Node.js `fs` API. The VFS bridge provides this adapter:

```typescript
const gitFs = {
  promises: {
    readFile: (path: string, opts?: { encoding?: string }) =>
      vfsBridge.readFile(path).then(content =>
        opts?.encoding === 'utf8' ? content : Buffer.from(content)
      ),
    writeFile: (path: string, content: string | Uint8Array) =>
      vfsBridge.writeFile(
        path,
        typeof content === 'string' ? content : new TextDecoder().decode(content)
      ),
    readdir: (path: string) =>
      vfsBridge.listDir(path),
    mkdir: (path: string) =>
      vfsBridge.mkdir(path),
    rmdir: (path: string) =>
      vfsBridge.deleteFile(path),
    unlink: (path: string) =>
      vfsBridge.deleteFile(path),
    stat: (path: string) =>
      vfsBridge.listDir(path.split('/').slice(0, -1).join('/'))
        .then(entries => {
          const name = path.split('/').pop();
          if (!entries.includes(name!)) throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
          return { isDirectory: () => false, isFile: () => true };
        }),
    lstat: (path: string) => gitFs.promises.stat(path),
  }
};
```

> Note: The `stat` implementation above is a simplification. Full stat support (distinguishing files from directories) requires an additional `FILE_STAT` message type, which is deferred to a future iteration. For Phase 2, isomorphic-git operations that require accurate `stat` (e.g., `git status`) will use `FILE_LIST` to approximate.

---

## 7. Error Handling

### 7.1 File Operation Errors

All `expo-file-system` errors are caught in `FileBridge.handleMessage` and returned to the WebView as a `FILE_RESULT` with a non-null `error` field. The VFS bridge rejects the corresponding Promise, and the shell built-in or isomorphic-git adapter converts the error to a user-visible stderr message.

Common error messages:

| Scenario | Stderr output |
|---|---|
| File not found | `cat: /path/to/file: No such file or directory` |
| Permission denied | `rm: /path: Permission denied` |
| Not a directory | `cd: /path/file: Not a directory` |
| Directory not empty | `rm: /path: Directory not empty` |
| VFS bridge timeout | `terminal: file operation timed out` |

### 7.2 WebView Crash / Error State

`useTerminalBridge` registers the following WebView event handlers:

- `onError` — fired for WebView load failures
- `onHttpError` — fired for HTTP errors (not expected for local assets, but handled defensively)
- `onRenderProcessGone` (Android) — fired when the render process crashes

When any of these fire, `useTerminalBridge` sets `error` to a non-null string. `TerminalWebView` detects this and replaces the WebView with an error overlay:

```
┌─────────────────────────────────┐
│                                 │
│   ⚠  Terminal crashed           │
│   <error message>               │
│                                 │
│   [ Restart Terminal ]          │
│                                 │
└─────────────────────────────────┘
```

The "Restart Terminal" button calls `restart()` from `useTerminalBridge`, which remounts the WebView. The `cwd` prop is re-sent as `SET_CWD` after remount, so the working directory is preserved across restarts.

### 7.3 Git Network Errors

isomorphic-git network errors (e.g., authentication failure, repository not found, no network) are caught by the git command handler and written to stderr:

| Scenario | Stderr output |
|---|---|
| Repository not found (404) | `fatal: repository 'https://...' not found` |
| Authentication required | `fatal: Authentication failed for 'https://...'` |
| No network / timeout | `fatal: unable to access 'https://...': Could not resolve host` |
| Rate limited | `fatal: remote error: API rate limit exceeded` |

### 7.4 Unknown Commands

```
$ unknowncmd arg1 arg2
bash: unknowncmd: command not found
```

Exit code 127 is sent to React Native via `COMMAND_COMPLETE`. No stack trace is exposed.

---

## 8. New Artefact IDs

| ID | Type | Description |
|---|---|---|
| US-0047 | User Story | WebView terminal — replace mock Terminal.tsx with Xterm.js in a WebView |
| US-0048 | User Story | VFS file bridge — Expo FileSystem accessible from WebView via postMessage |
| US-0049 | User Story | Git operations — isomorphic-git wired to VFS bridge for full git workflow |
| AC-0122 | Acceptance Criterion | US-0047: Terminal renders Xterm.js with correct ANSI colour support |
| AC-0123 | Acceptance Criterion | US-0047: Terminal resizes correctly when device is rotated |
| AC-0124 | Acceptance Criterion | US-0047: Terminal works offline (no network access required to open) |
| AC-0125 | Acceptance Criterion | US-0047: Error state with "Restart" button shown on WebView crash |
| AC-0126 | Acceptance Criterion | US-0048: `cat <file>` reads real file content via Expo FileSystem |
| AC-0127 | Acceptance Criterion | US-0048: `ls <dir>` lists real directory contents via Expo FileSystem |
| AC-0128 | Acceptance Criterion | US-0048: `mkdir`, `rm`, `cp`, `mv` perform real file operations |
| AC-0129 | Acceptance Criterion | US-0048: File operation errors surface as readable stderr messages |
| AC-0130 | Acceptance Criterion | US-0049: `git init` creates a real `.git` directory in the project folder |
| AC-0131 | Acceptance Criterion | US-0049: `git status` shows accurate staged/unstaged status |
| AC-0132 | Acceptance Criterion | US-0049: `git add` and `git commit` create a real commit |
| AC-0133 | Acceptance Criterion | US-0049: `git log` displays commit history |
| AC-0134 | Acceptance Criterion | US-0049: `git push` / `git pull` work with authenticated GitHub remote |
| AC-0135 | Acceptance Criterion | US-0049: Network errors from git operations surface as readable stderr |
| TC-0295–TC-0306 | Test Cases | FileBridge — unit tests (12 tests) |
| TC-0307–TC-0316 | Test Cases | useTerminalBridge — hook tests (10 tests) |
| TC-0317–TC-0324 | Test Cases | TerminalWebView — component tests (8 tests) |

> **Note:** The ID ranges above must be verified against `Docs/ID_REGISTRY.md` before implementation begins. If the registry has advanced beyond these values, use the next available IDs.

---

## 9. Testing Strategy

### 9.1 Unit Tests — FileBridge

File: `src/terminal/__tests__/FileBridge.test.ts`

**Mock:** `expo-file-system` is mocked using Jest's module mocking (`jest.mock('expo-file-system')`).

Tests cover:
- `FILE_READ` success → `sendToWebView` called with `FILE_RESULT { result: '<content>' }`
- `FILE_READ` failure (ENOENT) → `sendToWebView` called with `FILE_RESULT { error: '...' }`
- `FILE_WRITE` success → `sendToWebView` called with `FILE_RESULT { result: null }`
- `FILE_WRITE` failure → `sendToWebView` called with `FILE_RESULT { error: '...' }`
- `FILE_LIST` success → result is JSON-encoded string array
- `FILE_LIST` on non-existent directory → error returned
- `FILE_MKDIR` success → `FILE_RESULT { result: null }`
- `FILE_MKDIR` recursive creation → `makeDirectoryAsync` called with `{ intermediates: true }`
- `FILE_DELETE` success → `FILE_RESULT { result: null }`
- `FILE_DELETE` non-existent path → error returned
- Unknown message type → no crash, no sendToWebView call
- requestId is echoed back correctly in all responses

**12 test cases, target: TC-0295–TC-0306**

### 9.2 Unit Tests — useTerminalBridge

File: `src/hooks/__tests__/useTerminalBridge.test.ts`

**Mock:** `react-native-webview` WebView ref is mocked with a `{ injectJavaScript: jest.fn() }` ref object.

Tests cover:
- Hook initialises with `isLoading: true` and `error: null`
- `sendToWebView` calls `injectJavaScript` with correct JSON-wrapped call
- `onMessage` with `FILE_READ` message → delegates to FileBridge
- `onMessage` with `COMMAND_COMPLETE` → calls `onCommandComplete` prop
- `onMessage` with unknown type → no crash
- WebView `onError` event → sets `error` to non-null string
- `restart()` increments internal key (verified via re-render)
- `SET_CWD` sent on mount with correct cwd value
- `RESIZE` sent when container dimensions change
- `isLoading` set to false after first successful message

**10 test cases, target: TC-0307–TC-0316**

### 9.3 Component Tests — TerminalWebView

File: `src/components/__tests__/TerminalWebView.test.tsx`

**Mock:** `react-native-webview` is mocked to render a `<View testID="mock-webview">`. The `useTerminalBridge` hook is mocked.

Tests cover:
- Renders WebView with correct `source` prop pointing to local asset
- Renders loading indicator while `isLoading` is true
- Renders error overlay with "Restart Terminal" button when `error` is non-null
- "Restart Terminal" button calls `restart()` from hook
- `onCommandComplete` prop is forwarded to the bridge hook
- `cwd` prop is passed to `useTerminalBridge`
- Component matches accessibility requirements (minimum 44pt touch targets on error button)
- Snapshot test for error state

**8 test cases, target: TC-0317–TC-0324**

### 9.4 Shell Dispatcher Tests

File: `terminal/bundle/__tests__/shellDispatcher.test.ts`

**Mock:** VFS bridge is mocked with Jest functions. isomorphic-git is mocked at the module level.

Tests cover routing (git commands → git handler, builtins → builtin handler, unknown → exit 127), correct stderr output for unknown commands, and correct exit code propagation.

These tests run in a Node.js environment (not the RN Jest environment) since they test the WebView bundle code. A separate Jest config or `testEnvironment: 'jsdom'` override is used.

### 9.5 Coverage Requirements

| File | Minimum coverage |
|---|---|
| `terminal/FileBridge.ts` | ≥ 80% |
| `hooks/useTerminalBridge.ts` | ≥ 80% |
| `components/TerminalWebView.tsx` | ≥ 80% |
| `terminal/protocol.ts` | N/A (types only, no runtime code) |

### 9.6 Existing Test Suite

All 472 existing tests must continue passing after these changes. The only modification to existing source files is a deprecation comment added to `Terminal.tsx` — this must not break any existing `Terminal.tsx` tests.

If existing `Terminal.tsx` tests import the component by its default export, they will continue to work because the component is not deleted, only deprecated. Snapshot tests for `Terminal.tsx` should be updated to reflect the deprecation comment if they snapshot the file content rather than rendered output.

---

## 10. Files Created / Modified

### New Files

| File path (relative to `mobile-ide/mobile-ide-prototype/src/`) | Purpose |
|---|---|
| `terminal/protocol.ts` | Typed message protocol — RNToWebView and WebViewToRN union types |
| `terminal/FileBridge.ts` | Expo FileSystem adapter — services FILE_* messages from WebView |
| `terminal/bundle/index.ts` | WebView bundle entry point — Xterm.js + shell dispatcher + VFS bridge |
| `terminal/bundle/build.js` | esbuild build script — compiles bundle to `assets/terminal/index.html` |
| `terminal/bundle/shellDispatcher.ts` | Shell command routing and built-in implementations |
| `terminal/bundle/vfsBridge.ts` | VFS bridge — pendingRequests map + isomorphic-git fs adapter |
| `hooks/useTerminalBridge.ts` | React hook — WebView ref management + bridge message routing |
| `components/TerminalWebView.tsx` | React Native component — replaces Terminal.tsx in IDE layout |
| `assets/terminal/index.html` | Built output — self-contained Xterm.js + shell bundle (git-ignored until built) |
| `terminal/__tests__/FileBridge.test.ts` | Unit tests for FileBridge |
| `hooks/__tests__/useTerminalBridge.test.ts` | Unit tests for useTerminalBridge hook |
| `components/__tests__/TerminalWebView.test.tsx` | Component tests for TerminalWebView |
| `terminal/bundle/__tests__/shellDispatcher.test.ts` | Unit tests for shell dispatcher |

### Modified Files

| File path | Change |
|---|---|
| `components/Terminal.tsx` | Add deprecation comment at top of file: `@deprecated — replaced by TerminalWebView.tsx (EPIC-0003 Phase 2). Do not add new features here.` |
| `Docs/ID_REGISTRY.md` | Advance ID counters to reflect new US, AC, and TC artefacts |
| `progress.md` | Update with Phase 2 implementation status |

### Files NOT Modified

- No existing `.ts` / `.tsx` source files (other than the deprecation comment in `Terminal.tsx`) are modified in this spec.
- `package.json` will require new dependencies (`xterm`, `isomorphic-git`, `@isomorphic-git/http`, `react-native-webview` if not already present, `esbuild` as dev dependency) — this is tracked as a prerequisite task, not part of this spec.

---

*End of spec — EPIC-0003 Phase 2 — WASI Terminal Runtime Design*
