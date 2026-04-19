# Editor Feature Smoke Tests — EPIC-0021

Run these manually on an iOS simulator (iPad Pro 13-inch M5) before opening the PR.

## 1. Search & Replace (US-0073)
1. Open a project with at least 3 files containing the word `const`.
2. Open the Search panel, switch to REPLACE tab.
3. Enter `const` in Search, `let` in Replace.
4. Verify preview shows `"const" → "let"`.
5. Uncheck one match (it should show ☐).
6. Press Replace All — verify alert shows correct file/match counts.
7. Open the affected files — verify unchecked match was NOT replaced.
8. Verify regex replacement: search `(const) (\w+)`, replace `$2 = $1` — verify capture group expansion.

## 2. Hardware Keyboard Shortcuts (US-0074)
Requires an iPad with a physical keyboard connected.
1. Press ⌘S — verify current file saves (dirty indicator clears).
2. Press ⌘⇧S — verify all dirty files save.
3. Press ⌘\` — verify terminal panel toggles.
4. Press ⌘N — verify new untitled file appears in tabs.
5. Press ⌘P — verify Command Palette opens.
6. Press ⌘/ — verify Keyboard Shortcuts sheet opens with all shortcuts listed.

## 3. Code Folding (US-0075)
1. Open a TypeScript file with at least one function (≥5 lines).
2. Verify gutter chevrons (▾) appear on foldable lines.
3. Tap a chevron — the region collapses.
4. Open Command Palette → "Editor: Fold All" — all regions collapse.
5. Open Command Palette → "Editor: Unfold All" — all regions expand.
6. Fold a region, then switch to another tab and back.
7. Verify the folded region is still folded (view state persisted).

## 4. Auto-Format on Save (US-0076)
1. Open Settings → enable "Format on Save".
2. Open a `.ts` file and add poorly indented code (e.g., extra spaces).
3. Press ⌘S — verify Prettier formats the code. Undo (⌘Z) restores original.
4. Open Command Palette → "Format Document" — verify it formats regardless of toggle.
5. Disable "Format on Save". Press ⌘S — verify file saves WITHOUT formatting.
6. Add a `.prettierrc.json` at workspace root: `{"tabWidth": 2}`. Format — verify config is respected.

## 5. Breadcrumb Navigation (US-0077)
1. Open a TypeScript file with a function `function myHandler()`.
2. Move cursor inside the function body.
3. Verify breadcrumb shows path segments + `myHandler` in accent color.
4. Move cursor above the function — verify symbol disappears from breadcrumb.
5. Tap a path segment (not the last) — (sibling picker is a future enhancement; verify press is handled without crash).

## 6. Snippets (US-0078)
1. Open a JavaScript file, type `clg` and press Tab.
2. Verify `console.log()` expands with cursor inside parens.
3. Open a `.tsx` file (TypeScript React), type `rfc` and press Tab — verify component scaffold.
4. Open Settings → Snippets section — verify built-in snippets listed read-only.
5. Tap "Add Snippet" — fill in prefix `mySnip`, body `const $1 = $2;`, language `typescript`.
6. Open a `.ts` file, type `mySnip` Tab — verify expansion with tab stop navigation.
7. Return to Settings → Remove the snippet — verify it disappears.
