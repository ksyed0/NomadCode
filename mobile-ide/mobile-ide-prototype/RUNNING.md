# Running NomadCode Mobile IDE

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Node.js | ≥ 18 | https://nodejs.org |
| npm / yarn | latest | bundled with Node |
| Expo CLI | latest | `npm i -g expo-cli` |
| Xcode | ≥ 15 (iOS) | Mac App Store |
| Android Studio | latest (Android) | https://developer.android.com/studio |
| CocoaPods | latest (iOS) | `sudo gem install cocoapods` |

---

## 1. Install dependencies

```bash
cd mobile-ide-prototype
npm install
# iOS: install native pods
npx pod-install          # or: cd ios && pod install && cd ..
```

---

## 2. Run on iOS Simulator (iPad)

```bash
# Start the Metro bundler + open on an iPad simulator
npx expo start --ios

# Or target a specific device:
npx expo run:ios --simulator "iPad Pro (12.9-inch) (6th generation)"
```

> **Note:** The Monaco editor loads from CDN (`cdn.jsdelivr.net`).
> Ensure the simulator has internet access, or bundle Monaco locally (see below).

---

## 3. Run on Android Emulator

```bash
# Start an AVD first in Android Studio, then:
npx expo start --android

# Or use Expo's direct run:
npx expo run:android
```

---

## 4. Run on a physical device

```bash
# Install Expo Go from the App Store / Play Store, then:
npx expo start
# Scan the QR code with Expo Go (iOS: Camera app; Android: Expo Go app)
```

For production builds (without Expo Go), use [EAS Build](https://docs.expo.dev/build/introduction/):
```bash
npm install -g eas-cli
eas build --platform ios    # or android
```

---

## 5. Run tests

```bash
# Unit tests (Jest)
npm test

# Unit tests with coverage report (target: ≥ 80%)
npm run test:coverage

# TypeScript type-check (no emit)
npm run type-check

# Lint
npm run lint
```

---

## 6. E2E tests (Detox)

```bash
# Build the Detox test binary first (iOS example):
npx detox build --configuration ios.sim.debug

# Run E2E tests:
npx detox test --configuration ios.sim.debug
```

See [Detox docs](https://wix.github.io/Detox/docs/introduction/getting-started) for configuration.

---

## Offline Monaco (optional)

To run without internet access, bundle Monaco locally:

```bash
# Download Monaco assets (~5 MB)
mkdir -p assets/monaco
npx degit microsoft/monaco-editor/min assets/monaco

# Serve locally via a WebView-compatible static server
npm install --save-dev serve
```

Then update `MONACO_HTML` in `src/components/Editor.tsx`:
```diff
- paths: { vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.45.0/min/vs' }
+ paths: { vs: 'http://localhost:8080/vs' }
```

---

## Project structure

```
App.tsx                        Root component (IDE state, layout wiring)
src/
  components/
    Editor.tsx                 Monaco multi-tab editor (WebView bridge)
    FileExplorer.tsx           Directory tree with expand/collapse
    Terminal.tsx               Sandboxed JS terminal
    CommandPalette.tsx         Fuzzy-search command overlay
  layout/
    TabletResponsive.tsx       Adaptive sidebar/main/terminal layout
  utils/
    FileSystemBridge.ts        expo-file-system + Git stubs
  extensions/
    sandbox/index.ts           JS extension registry + sandbox HTML builder
tests/
  unit/                        Jest unit tests (FileSystemBridge, Terminal,
  │                              CommandPalette, ExtensionSandbox, Editor)
  e2e/                         Detox E2E smoke tests
```

---

## Integrating isomorphic-git (Git support)

Replace the stubs in `FileSystemBridge.ts` → `GitBridge`:

```bash
npm install isomorphic-git @isomorphic-git/lightning-fs
```

```typescript
import git from 'isomorphic-git';
import http from 'isomorphic-git/http/web';
import { FileSystem } from '@isomorphic-git/lightning-fs';

const fs = new FileSystem('nomadcode');

// Example: clone
await git.clone({ fs, http, dir: '/project', url: 'https://github.com/user/repo' });
```

---

## Future AI integration

Look for `// AI_HOOK` comments throughout the source. Key integration points:

- `App.tsx` — call Claude API after opening a file for instant diagnostics
- `Editor.tsx` — add `editor.addCommand(Cmd+K, ...)` to trigger AI completions
- `CommandPalette.tsx` — add `AI: Explain`, `AI: Fix`, `AI: Generate` commands
- `src/extensions/sandbox/index.ts` — expose `vscode.ai.complete()` in the extension API
