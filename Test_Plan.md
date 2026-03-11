# Test Plan

## Product: Mobile IDE

**Version:** 0.1
**Date:** 2026-03-09

---

## 1. Testing Strategy

| Level | Tool | Coverage Target |
|---|---|---|
| Unit tests | Jest + React Testing Library | ≥ 80% |
| Integration tests | Jest | Key service boundaries |
| E2E tests | Detox (native) / Playwright (web) | Critical user flows |
| Performance tests | Custom benchmarks | Per Technical Spec targets |
| Accessibility tests | Axe / manual audit | WCAG 2.1 AA |

---

## 2. Unit Tests

### Editor Component
- [ ] Renders with given file content
- [ ] Calls `onChange` on keystroke
- [ ] Calls `onSave` after debounce period
- [ ] Applies correct language syntax highlighting
- [ ] Adjusts viewport when virtual keyboard shown

### File Explorer Component
- [ ] Renders directory tree from mock file system
- [ ] Calls `onFileSelect` when file is tapped
- [ ] Shows context menu on long-press
- [ ] Handles empty directory

### Terminal Component
- [ ] Renders terminal container
- [ ] Passes working directory to sandbox
- [ ] Displays ANSI-formatted output correctly

### Command Palette
- [ ] Opens on trigger gesture/shortcut
- [ ] Filters commands by fuzzy search input
- [ ] Calls `onSelect` with correct command
- [ ] Closes on escape / backdrop tap

### FileSystemBridge
- [ ] `readFile` returns file content
- [ ] `writeFile` writes content to path
- [ ] `listDirectory` returns correct entries
- [ ] `deleteFile` removes the file
- [ ] `exists` returns true/false correctly

---

## 3. E2E Tests

### Critical Flows
- [ ] Open app → browse to file → open file → edit → save
- [ ] Create new file from File Explorer → type code → save
- [ ] Open terminal → run command → see output
- [ ] Open command palette → search command → execute
- [ ] Rotate device: layout adapts correctly

---

## 4. Performance Tests

- [ ] Cold start time ≤ 2s on reference device
- [ ] Editor renders 10,000-line file without jank
- [ ] File tree renders 1,000 entries in < 100ms

---

## 5. Accessibility Tests

- [ ] All interactive elements have accessible labels
- [ ] VoiceOver (iOS) can navigate editor and file tree
- [ ] TalkBack (Android) can navigate editor and file tree
- [ ] Color contrast ratios meet WCAG 2.1 AA

---

## 6. Devices & Platforms

| Device | OS | Priority |
|---|---|---|
| iPad Pro 12.9" | iPadOS 17 | P0 |
| iPad mini 6 | iPadOS 17 | P0 |
| iPhone 15 Pro | iOS 17 | P1 |
| Samsung Galaxy Tab S9 | Android 14 | P0 |
| Google Pixel 8 | Android 14 | P1 |
| Web (Chrome, Safari) | Latest | P2 |
