# Lessons Learned

Append-only log of project lessons. Each entry follows the format below.
Parsed by `tools/lib/parse-lessons.js` — do not change heading format.

Format:
```
## L-XXXX — Short title
*Context: one-sentence situation description*
**Rule:** Actionable guideline derived from the lesson.
**Date:** YYYY-MM-DD
---
```

---

## L-0001 — npm version stdout is multiline in newer npm versions
*Attempting to capture `npm version patch` output with `$(...)` in a CI script to write to `$GITHUB_OUTPUT`.*
**Rule:** Never capture `npm version` stdout directly for use as a value. Run it for the side-effect only, then read the clean version with `jq -r '.version' package.json`.
**Date:** 2026-03-25

---

## L-0002 — Debug.keystore must be gitignored before expo prebuild
*Running `expo prebuild` generates `android/` including `debug.keystore` (private key material); the generated `.gitignore` inside `android/` did not exclude it, so it was committed in PR #45.*
**Rule:** Add `*.keystore` to `android/.gitignore` before running `expo prebuild`, or immediately after. Verify with `git status` before committing any `android/` scaffolding.
**Date:** 2026-03-25

---

## L-0003 — injectJavaScript is silently dropped on hidden WebViews
*`TerminalWebView` dispatched `SET_CWD` via `useEffect` before the WebView finished loading; the message was silently dropped and `cwd` stayed at `/`.*
**Rule:** Never `injectJavaScript` before `onLoadEnd` fires. Always move initial bridge messages into the `onLoadEnd` handler.
**Date:** 2026-03-20

---

## L-0004 — double-stringify is required when passing JSON through injectJavaScript
*`sendToWebView` injected `window.receiveFromRN(${JSON.stringify(msg)})`, passing a JS object literal. The WebView side called `JSON.parse(msgJson)` which coerced the object to `"[object Object]"` → SyntaxError → silent drop.*
**Rule:** When injecting a value that the WebView will `JSON.parse`, use `JSON.stringify(JSON.stringify(msg))` so the injected expression is a string literal, not an object literal.
**Date:** 2026-03-20

---
