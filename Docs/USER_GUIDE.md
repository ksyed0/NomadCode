# NomadCode User Guide

**NomadCode — "Code from anywhere."**

A professional-grade mobile IDE for iOS and Android. Write, run, and manage real code from your tablet or phone. This guide covers everything you need to get productive on Phase 1 (v0.1).

---

## Table of Contents

1. [Getting Started](#1-getting-started)
2. [Editor](#2-editor)
3. [File Explorer](#3-file-explorer)
4. [Terminal](#4-terminal)
5. [Git Integration](#5-git-integration)
6. [Command Palette](#6-command-palette)
7. [Extensions](#7-extensions)
8. [Settings](#8-settings)
9. [Keyboard Shortcuts](#9-keyboard-shortcuts)
10. [Known Limitations (Phase 1)](#10-known-limitations-phase-1)

---

## 1. Getting Started

### Installation

- **iOS:** Download NomadCode from the [App Store](https://apps.apple.com). Requires iOS 16 or later. Optimised for iPad Pro.
- **Android:** Download from [Google Play](https://play.google.com). Requires Android 12 or later. Optimised for Android tablets.

### First Launch

On first launch, NomadCode walks you through a short setup:

1. **Theme** — Choose Light, Dark, or System (follows device appearance).
2. **Font size** — Pick your default editor font size (12–20pt). JetBrains Mono is used for all code.
3. **Git identity** — Enter your name and email. These are used for git commits (`user.name` / `user.email`). You can update them later in Settings > Git.

### Creating or Opening a Project

**Create a new project:**
1. Tap **New Project** on the home screen.
2. Choose a name and location within the app's sandboxed file system.
3. NomadCode creates an empty project folder and opens the file explorer.

**Open an existing project:**
1. Tap **Open Project**.
2. Navigate to a folder using the system file picker or the in-app file explorer.
3. Tap the folder to open it as your working directory.

**Clone a remote repo:**
Use the terminal (see [Section 4](#4-terminal)) to run `git clone <url>`, then open the cloned folder as a project.

---

## 2. Editor

### Opening Files

Tap any file in the file explorer to open it in the editor. Files open in tabs across the top of the editor panel. Tap a tab to switch between open files.

### Syntax Highlighting

Language is detected automatically from the file extension:

| Extension | Language |
|---|---|
| `.ts`, `.tsx` | TypeScript |
| `.js`, `.jsx` | JavaScript |
| `.py` | Python |
| `.go` | Go |
| `.rs` | Rust |
| `.md` | Markdown |
| `.json` | JSON |
| `.yaml`, `.yml` | YAML |
| `.sh` | Shell |
| `.html` | HTML |
| `.css` | CSS |

Unrecognised extensions fall back to plain text.

### Keyboard Shortcuts

With an external hardware keyboard connected, standard shortcuts work as expected (see [Section 9](#9-keyboard-shortcuts) for the full reference table).

On the software keyboard, NomadCode adds a custom toolbar row above the system keyboard with shortcuts for common actions: indent, dedent, bracket pair insertion, comment toggle, and cursor movement by word.

### Auto-Save

Auto-save is enabled by default with a 1-second delay after the last keystroke. The file tab shows a dot indicator when a buffer has unsaved changes. You can disable auto-save or adjust the delay in Settings > Editor.

---

## 3. File Explorer

### Navigating the File Tree

The file explorer sits in the left panel (tablet layout) or slides in as a bottom sheet (phone layout). Tap a folder to expand or collapse it. Tap a file to open it in the editor.

The active file is highlighted in Nomad Blue (`#2563EB`).

### Creating Files and Folders

- **Tap the `+` button** at the top of the file explorer and choose New File or New Folder.
- **Long-press** any folder in the tree to get a context menu with New File and New Folder options.
- Type the name in the inline text field and confirm with the return key.

### Renaming and Deleting

Long-press any file or folder to open the context menu:

- **Rename** — Edits the name inline.
- **Delete** — Prompts for confirmation before permanently removing the entry.

Deletion is permanent within the app sandbox. There is no Trash in Phase 1.

### File Icons by Type

File icons are shown next to each entry in the tree, colour-coded by type:

| Type | Icon colour |
|---|---|
| TypeScript / JavaScript | Yellow |
| Markdown | Blue |
| JSON / YAML | Orange |
| Images | Teal |
| Directories | Nomad Blue |
| Unknown | Grey |

---

## 4. Terminal

### What It Is

The NomadCode terminal is a sandboxed shell running inside a secure WebView, powered by a WASI runtime. It provides shell built-ins and git operations without exposing unrestricted native process execution. All file operations go through the app's sandboxed file system via Expo FileSystem.

This is intentional by design — it keeps NomadCode App Store and Google Play compliant and prevents untrusted code from accessing the underlying OS.

### Supported Commands

**Shell built-ins:**

```
pwd         Print working directory
ls          List directory contents
cd <dir>    Change directory
echo <str>  Print string to stdout
cat <file>  Print file contents
mkdir <dir> Create directory
rm <file>   Remove file or directory (-r for recursive)
clear       Clear the terminal screen
```

**Git operations:**

```
git status
git log [--oneline]
git add <file>
git add .
git commit -m "message"
git push
git pull
git clone <url>
git diff
git branch
git checkout <branch>
git checkout -b <new-branch>
```

### Not Supported in Phase 1

The following are **not available** because they require spawning native processes outside the sandbox:

- Package managers: `npm`, `pip`, `brew`, `apt`, `cargo`, `gem`
- Arbitrary system binaries (`node`, `python`, `gcc`, etc.)
- Background or long-running processes
- Network utilities (`curl`, `wget`, `ssh`)

Attempting to run an unsupported command prints a clear error message explaining why it is unavailable.

> `cp` and `mv` are planned but not yet implemented in Phase 1. Use the file explorer context menu for copy and move operations in the meantime.

### Opening the Terminal

- Tap the terminal icon in the bottom toolbar.
- Use **Cmd+`** on an external keyboard.
- Open via Command Palette: type "Toggle Terminal".

---

## 5. Git Integration

### Workflow Overview

NomadCode supports a full clone → edit → commit → push workflow entirely from the terminal.

```bash
# Clone a repo
git clone https://github.com/yourname/your-repo.git

# Check status after editing
git status

# Stage changes
git add src/index.ts
# or stage everything
git add .

# Commit
git commit -m "feat: add user authentication"

# Push
git push

# View history
git log --oneline
```

### Authentication

Git credentials are stored securely using iOS Keychain or Android Keystore — never in app storage or logs.

To configure authentication:

1. Go to **Settings > Git**.
2. Choose **Sign in with GitHub** (OAuth) or enter a **Personal Access Token (PAT)**.
3. Once saved, all `git push` and `git clone` operations use the stored credentials automatically.

**SSH is not supported in Phase 1.** Use HTTPS URLs only:

```
# Correct
git clone https://github.com/yourname/your-repo.git

# Not supported
git clone git@github.com:yourname/your-repo.git
```

### Git Identity

Your commit `user.name` and `user.email` are set during first launch and can be updated in **Settings > Git > Identity** at any time.

---

## 6. Command Palette

### Opening

- Tap the **search icon** in the app header.
- **Cmd+P** on an external keyboard.

### What It Does

The command palette provides fuzzy search across all available commands. Start typing any part of a command name or description to filter the list. Tap a result or press Return to execute.

### Available Commands (Phase 1)

| Command | Description |
|---|---|
| Open File | Open a file by name (fuzzy search across project) |
| New File | Create a new file in the current directory |
| New Folder | Create a new folder in the current directory |
| Toggle Terminal | Show or hide the terminal panel |
| Toggle File Explorer | Show or hide the file explorer panel |
| Change Theme | Switch between Light, Dark, and System themes |
| Settings | Open the Settings screen |
| Sign In | Authenticate with GitHub |
| Sign Out | Sign out and clear stored credentials |

---

## 7. Extensions

### What Extensions Are

Extensions are WASM-based plugins that can add new syntax highlighting, language support, linting, or UI panels to NomadCode. They run in isolated WebAssembly workers with a defined `ExtensionAPI` — no direct access to the OS, the DOM, or the file system outside the controlled API boundary.

### Permissions Model

Each extension declares the permissions it needs in its manifest:

| Permission | What it allows |
|---|---|
| `file-read` | Read files via the Extension API |
| `editor-write` | Insert or modify text in the active editor buffer |
| `ui-panel` | Register a custom side panel |

NomadCode shows a permissions summary when you install an extension. You must explicitly grant each permission.

### Installation

**From a file (sideload):**

1. Go to **Settings > Extensions > Install from file**.
2. Use the file picker to select a `.wasm` bundle.
3. Review the permissions manifest and tap **Install**.

**From the marketplace (Phase 1):**

A curated extension list is linked from **Settings > Extensions > Browse**. Each entry links to the download page for the `.wasm` bundle.

### VS Code Extension Compatibility

VS Code extensions are **not directly compatible**. VS Code extensions target the VS Code Extension API (Node.js), which NomadCode does not implement. An extension must be repackaged as a WASM bundle targeting the NomadCode `ExtensionAPI` to run in NomadCode.

### Uninstalling

1. Go to **Settings > Extensions > Installed**.
2. Swipe left on an extension and tap **Remove**, or tap the extension and choose **Uninstall**.

---

## 8. Settings

Open Settings via the Command Palette or the gear icon in the header.

### Appearance

| Setting | Options | Default |
|---|---|---|
| Theme | Light / Dark / System | System |
| Editor font size | 12pt – 20pt | 14pt |

### Editor

| Setting | Options | Default |
|---|---|---|
| Tab size | 2 spaces / 4 spaces | 2 spaces |
| Auto-save | On / Off | On |
| Auto-save delay | 500ms / 1s / 2s | 1s |
| Word wrap | On / Off | Off |

### Git

| Setting | Description |
|---|---|
| Name | Your `user.name` for commits |
| Email | Your `user.email` for commits |
| GitHub auth | Sign in via OAuth or enter a PAT |

### Extensions

| Setting | Description |
|---|---|
| Installed extensions | View, manage, or remove installed extensions |
| Install from file | Sideload a `.wasm` extension bundle |
| Browse marketplace | Open the curated extension list |

---

## 9. Keyboard Shortcuts

All shortcuts use the standard Cmd key on iPad (Apple external keyboard) or the equivalent Ctrl key on Android with a Bluetooth keyboard.

| Action | Shortcut |
|---|---|
| Open Command Palette | Cmd+P |
| Save file | Cmd+S |
| Find in file | Cmd+F |
| Toggle terminal | Cmd+` |
| Toggle file explorer | Cmd+B |
| New file | Cmd+N |
| Close tab | Cmd+W |
| Undo | Cmd+Z |
| Redo | Cmd+Shift+Z |
| Go to line | Cmd+G |
| Comment/uncomment line | Cmd+/ |

---

## 10. Known Limitations (Phase 1)

These are known constraints in the v0.1 prototype. Most are planned for Phase 2 or later.

| Limitation | Status |
|---|---|
| No native process execution — `npm install`, `pip`, `brew`, `cargo`, and similar commands are not supported | Phase 1 scope |
| No SSH git authentication — HTTPS only | Phase 2 planned |
| Extensions must be repackaged as WASM bundles — VS Code extensions are not directly compatible | By design |
| No split editor | Phase 2 planned |
| No IntelliSense or LSP — AI-powered suggestions available via Pro+ tier only | Phase 2 planned |
| No collaborative / multiplayer editing | Not yet scoped |
| Terminal is sandboxed — no access to the system outside the app sandbox | By design (permanent) |
| `cp` and `mv` terminal commands not yet implemented — use the file explorer context menu | Phase 1 in-progress |
| No project-wide file search | Phase 2 planned |
| No multi-root workspaces | Phase 2 planned |

---

*NomadCode v0.1 — Phase 1 Prototype. Last updated: 2026-03-17.*
