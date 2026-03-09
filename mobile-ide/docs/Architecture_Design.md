# Architecture Design

## Product: Mobile IDE

**Version:** 0.1
**Date:** 2026-03-09

---

## 1. High-Level Architecture

```
┌─────────────────────────────────────────────────┐
│                   Mobile App                    │
│  (React Native / Expo)                          │
│                                                 │
│  ┌──────────┐  ┌───────────┐  ┌─────────────┐  │
│  │  Editor  │  │  File     │  │  Terminal   │  │
│  │ Component│  │ Explorer  │  │  Component  │  │
│  └────┬─────┘  └─────┬─────┘  └──────┬──────┘  │
│       │              │               │          │
│  ┌────▼──────────────▼───────────────▼──────┐   │
│  │            Core Services Layer           │   │
│  │  FileSystemBridge | EditorService |      │   │
│  │  TerminalService  | ExtensionHost        │   │
│  └──────────────────┬───────────────────────┘   │
│                     │                           │
│  ┌──────────────────▼───────────────────────┐   │
│  │         Extension Sandbox (WASM)         │   │
│  └──────────────────────────────────────────┘   │
└─────────────────────┬───────────────────────────┘
                      │
         ┌────────────▼────────────┐
         │    Native Layer         │
         │  (iOS / Android APIs)   │
         │  File I/O | Processes   │
         └────────────┬────────────┘
                      │
         ┌────────────▼────────────┐
         │    Cloud Services       │
         │  Sync | Auth | Storage  │
         └─────────────────────────┘
```

---

## 2. Key Components

### 2.1 Editor Component
- Built on a mobile-optimized fork of CodeMirror 6.
- Supports virtual keyboard integration, touch gestures, and cursor control.
- Language support via WASM-compiled tree-sitter parsers.

### 2.2 File Explorer
- Displays a hierarchical directory tree.
- Backed by `FileSystemBridge` which abstracts native file APIs.
- Supports drag-and-drop reordering on tablet.

### 2.3 Terminal
- Sandboxed shell via WebAssembly (e.g., Xterm.js + WASI runtime).
- No unrestricted native process access; commands run in a managed sandbox.

### 2.4 Command Palette
- Fuzzy-search over registered commands, files, and symbols.
- Keyboard and gesture accessible.

### 2.5 Extension Sandbox
- Extensions run in an isolated WASM worker.
- Communicate with the host via a message-passing API.
- No direct DOM or native API access.

---

## 3. Data Flow

```
User Input → UI Component → Core Service → Native Layer / Cloud
                                ↓
                      State Management (Zustand / Redux)
                                ↓
                          UI Re-render
```

---

## 4. Technology Stack

| Layer | Technology |
|---|---|
| UI Framework | React Native (Expo) |
| Language | TypeScript |
| State Management | Zustand |
| Editor Engine | CodeMirror 6 (mobile fork) |
| Terminal Runtime | Xterm.js + WASI |
| Extension Sandbox | WebAssembly Workers |
| Networking | React Query + REST/GraphQL |
| Storage (local) | Expo FileSystem + SQLite |
| Storage (cloud) | S3-compatible object storage |
| Auth | OAuth 2.0 / OpenID Connect |
| CI/CD | GitHub Actions + EAS Build |

---

## 5. Security Considerations

- Extension code runs in isolated WASM sandbox with no native API access.
- File system access gated by explicit user permissions.
- Terminal sandboxed; no arbitrary process spawning on device.
- All cloud communication over TLS 1.3.
- Secrets stored in platform keychain (iOS Keychain / Android Keystore).
