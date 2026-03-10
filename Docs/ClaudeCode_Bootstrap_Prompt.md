# Claude Code Bootstrap Prompt

## Product: Mobile IDE (NomadCode)

**Version:** 0.1
**Date:** 2026-03-09

---

## Purpose

This document contains the bootstrap prompt used to initialize Claude Code sessions for the NomadCode Mobile IDE project. Paste this prompt at the start of a new session to give Claude full project context.

---

## Bootstrap Prompt

```
You are working on NomadCode, a mobile-first IDE built with React Native (Expo) and TypeScript.

## Project Overview
NomadCode is a cross-platform mobile application providing a full-featured IDE experience on iOS and Android tablets and phones. Core features include a syntax-highlighted code editor, file explorer, integrated sandboxed terminal, and a command palette.

## Repository Structure
mobile-ide/
├── docs/                    # All project documentation (PRD, Architecture, Tech Spec, etc.)
├── mobile-ide-prototype/    # The main application
│   ├── src/
│   │   ├── components/      # Editor, FileExplorer, Terminal, CommandPalette
│   │   ├── extensions/sandbox/ # WASM extension sandbox
│   │   ├── utils/           # FileSystemBridge and helpers
│   │   └── layout/          # TabletResponsive layout
│   ├── assets/              # Images and static assets
│   └── tests/               # Unit and e2e tests
└── pro-modules/             # Private/proprietary features (not in this repo)

## Technology Stack
- Framework: React Native (Expo)
- Language: TypeScript (strict mode)
- Editor Engine: CodeMirror 6 (mobile-optimized)
- State Management: Zustand
- Terminal: Xterm.js + WASI sandbox
- Extensions: WASM Workers
- Testing: Jest + Detox

## Key Documents
- PRD: docs/PRD.md
- Architecture: docs/Architecture_Design.md
- Technical Spec: docs/Technical_Spec.md
- Roadmap: docs/Roadmap.md

## Coding Standards
- TypeScript strict mode; no `any` types without justification.
- All components must have explicit prop interfaces.
- Unit tests required for all utility functions.
- Accessibility: every interactive element must have an accessible label.
- Performance: editor input must remain < 16ms latency.

## Current Focus
[Describe the current sprint goal or task here before starting.]

## Important Constraints
- The extension sandbox MUST run in a WASM worker; no direct native API access for extensions.
- Terminal commands run in a sandboxed WASI runtime; no unrestricted shell access.
- All file I/O goes through FileSystemBridge; never call native APIs directly in components.
```

---

## Usage Instructions

1. Start a new Claude Code session.
2. Paste the bootstrap prompt above as your first message (optionally updating the "Current Focus" section).
3. Claude will have full project context and can immediately assist with implementation, debugging, or documentation tasks.

---

## Updating This Document

When significant architectural decisions are made or the stack changes, update the bootstrap prompt accordingly and increment the version number at the top of this file.
