# Technical Specification

## Product: Mobile IDE

**Version:** 0.1
**Date:** 2026-03-09

---

## 1. Editor Component (`src/components/Editor.tsx`)

### Responsibilities
- Render a syntax-highlighted, touch-friendly code editor.
- Handle file open/save operations via `FileSystemBridge`.
- Support multiple tabs/buffers.

### Props
```typescript
interface EditorProps {
  filePath: string;
  language?: string;
  readOnly?: boolean;
  onSave?: (content: string) => void;
  onChange?: (content: string) => void;
}
```

### Key Behaviors
- Debounced autosave (500ms after last keystroke).
- Virtual keyboard aware: editor viewport adjusts when keyboard is shown.
- Undo/redo history per buffer (up to 200 steps).

---

## 2. File Explorer Component (`src/components/FileExplorer.tsx`)

### Responsibilities
- Display directory tree rooted at a configurable base path.
- Support create, rename, delete, and move operations.

### Props
```typescript
interface FileExplorerProps {
  rootPath: string;
  onFileSelect: (filePath: string) => void;
  onFileCreate?: (filePath: string) => void;
  onFileDelete?: (filePath: string) => void;
}
```

---

## 3. Terminal Component (`src/components/Terminal.tsx`)

### Responsibilities
- Render an interactive terminal using Xterm.js.
- Connect to a sandboxed WASI shell process.
- Support standard ANSI escape sequences.

### Props
```typescript
interface TerminalProps {
  workingDirectory?: string;
  onCommand?: (command: string) => void;
}
```

---

## 4. Command Palette (`src/components/CommandPalette.tsx`)

### Responsibilities
- Provide a fuzzy-searchable overlay for commands, files, and symbols.
- Triggered by swipe gesture or keyboard shortcut (Cmd+P / Ctrl+P).

### Props
```typescript
interface CommandPaletteProps {
  commands: Command[];
  onSelect: (command: Command) => void;
  placeholder?: string;
}

interface Command {
  id: string;
  label: string;
  description?: string;
  action: () => void;
  shortcut?: string;
}
```

---

## 5. FileSystemBridge (`src/utils/FileSystemBridge.ts`)

### Responsibilities
- Abstract native file I/O (Expo FileSystem on mobile, Web File API in browser).
- Provide a uniform async API for read, write, list, create, delete.

### API
```typescript
interface FileSystemBridge {
  readFile(path: string): Promise<string>;
  writeFile(path: string, content: string): Promise<void>;
  listDirectory(path: string): Promise<FileEntry[]>;
  createDirectory(path: string): Promise<void>;
  deleteFile(path: string): Promise<void>;
  exists(path: string): Promise<boolean>;
}

interface FileEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  size?: number;
  modifiedAt?: Date;
}
```

---

## 6. Tablet Responsive Layout (`src/layout/TabletResponsive.tsx`)

### Responsibilities
- Render a split-pane layout on tablet (≥768px wide): File Explorer | Editor | Terminal.
- Collapse to single-pane with bottom sheet on phones.
- Support landscape and portrait orientations.

---

## 7. Extension Sandbox (`src/extensions/sandbox/`)

### Responsibilities
- Load extension bundles as WASM workers.
- Expose a restricted API surface (file reads, editor commands, UI panels).
- Prevent extensions from accessing native APIs directly.

### Extension API (stub)
```typescript
interface ExtensionAPI {
  editor: {
    getText(): string;
    setText(text: string): void;
    insertSnippet(snippet: string): void;
  };
  files: {
    readFile(path: string): Promise<string>;
  };
  ui: {
    showMessage(message: string): void;
    registerCommand(id: string, label: string, handler: () => void): void;
  };
}
```

---

## 8. Performance Targets

| Metric | Target |
|---|---|
| Cold start time | < 2s on mid-range devices |
| Editor input latency | < 16ms (60fps) |
| File tree render (1000 files) | < 100ms |
| Terminal output throughput | ≥ 10,000 lines/s |
| Memory usage (idle) | < 150MB |
