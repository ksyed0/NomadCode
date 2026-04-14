# Git Integration Test Script — NomadCode

**Target repo:** `https://github.com/ksyed0/CTC-Mobile-Wishlist.git`
**Platforms:** iPad Pro 13-inch simulator, Android emulator (Pixel Tablet API 35)

---

## Prerequisites

- [ ] App is installed and running (no red screen / splash hang)
- [ ] SetupWizard completed with a **writable** workspace (app sandbox, not File Provider Storage)
- [ ] Metro dev server running on port 8081

---

## Test 1: GitHub Authentication (PAT)

> OAuth won't work in the simulator (no biometrics). Use a PAT.

1. Open **Settings** (gear icon in sidebar or Command Palette → "Settings")
2. Scroll to **GITHUB ACCOUNT** section
3. Tap **"Use a Personal Access Token instead"** link
4. Enter a valid GitHub PAT with `repo` scope in the secure input field
5. Tap **"Connect"**

**Expected:**
- [ ] Loading spinner appears briefly
- [ ] Shows **"@ksyed0"** with "Connected" label
- [ ] "Sign out" button appears (red text)
- [ ] No error text visible

**Error case:** Enter an invalid token → should show red error: "Token is invalid or lacks required permissions."

---

## Test 2: Clone Repository

1. Open **Command Palette** (tap `⌘` FAB button, bottom-right)
2. Select **"Git: Clone repository"**
3. In the Clone modal:
   - URL: `https://github.com/ksyed0/CTC-Mobile-Wishlist.git`
   - Folder name: leave blank (should auto-derive "CTC-Mobile-Wishlist")
4. Tap **"Clone"**

**Expected:**
- [ ] Progress indicator appears with percentage (0% → 100%)
- [ ] Modal dismisses on completion
- [ ] File Explorer refreshes, shows `CTC-Mobile-Wishlist/` folder
- [ ] Status bar updates: **"⎇ main"** (or whatever the default branch is)

**Error cases:**
- [ ] Clone with invalid URL → error message in modal
- [ ] Clone to already-existing folder → error alert
- [ ] Cancel during clone → modal closes, no partial clone left

---

## Test 3: Browse Cloned Files

1. In File Explorer, tap the **CTC-Mobile-Wishlist** folder to expand it
2. Tap any source file (e.g., a `.js`, `.ts`, `.swift`, or `.md` file)

**Expected:**
- [ ] File opens in the editor panel
- [ ] Syntax highlighting applied based on file extension
- [ ] Tab appears in the tab bar with the filename
- [ ] No errors in Metro console

---

## Test 4: View Git Status (Clean State)

1. Tap **"⎇ main"** in the top status bar

**Expected:**
- [ ] GitPanel opens (bottom sheet slide-up)
- [ ] Header shows "Git" title with close button
- [ ] Branch shows: "Branch: main"
- [ ] Files section shows: **"Working tree clean"**
- [ ] Pull and Push buttons visible and enabled
- [ ] Branches section lists "* main" (current branch marker)

---

## Test 5: Create a Branch

1. In GitPanel, scroll to **Branches** section
2. Type `test/nomadcode-edit` in the branch name input
3. Tap **"Create"**

**Expected:**
- [ ] Branch list updates, shows "* test/nomadcode-edit" as current
- [ ] Status bar updates to "⎇ test/nomadcode-edit"
- [ ] "main" appears in list without asterisk

---

## Test 6: Edit a File and View Changes

1. Close GitPanel
2. Open a file from the cloned repo (e.g., `README.md`)
3. Add a line at the bottom: `\n\n<!-- Edited from NomadCode mobile IDE -->`
4. Save the file (tap save icon or use hardware keyboard shortcut)

**Expected:**
- [ ] Tab shows dirty indicator (dot/circle on tab)
- [ ] File content persists after save

---

## Test 7: View Git Diff

1. Tap **"⎇ test/nomadcode-edit"** to open GitPanel
2. Files section should now show the modified file with `[modified]` label
3. Tap **"Diff"** link next to the file

**Expected:**
- [ ] GitDiffModal opens with title "Diff: {filename}"
- [ ] Shows green highlighted `+` lines for additions
- [ ] Shows red highlighted `-` lines for deletions (if any)
- [ ] Monospace font, line numbers visible
- [ ] Close button (✕) dismisses the modal

---

## Test 8: Stage Files

1. In GitPanel Files section, tap the **checkbox** (☐) next to the modified file

**Expected:**
- [ ] Checkbox toggles to ☑
- [ ] File label changes from `[modified]` to `[staged]`
- [ ] Tapping again untogles back to ☐ / `[modified]`

---

## Test 9: Commit Changes

1. Stage the modified file (checkbox ☑)
2. In the **Commit** section, type: `test: edit from NomadCode IDE`
3. Tap **"Commit"**

**Expected:**
- [ ] Commit message input clears
- [ ] Files section returns to "Working tree clean"
- [ ] No error alerts
- [ ] File tree revision bumps (explorer may briefly refresh)

**Edge case:** Leave commit message empty → should auto-fill with "chore: commit from NomadCode"

---

## Test 10: Push to Remote

1. Tap **"Push"** button in GitPanel

**Expected:**
- [ ] Brief loading state (buttons disabled)
- [ ] Push completes without error
- [ ] Verify on GitHub: `ksyed0/CTC-Mobile-Wishlist` has branch `test/nomadcode-edit` with your commit

**Error case (no auth):**
- [ ] If signed out, Push shows alert: "Sign in required" with "Cancel" | "Settings" buttons

---

## Test 11: Pull from Remote

1. (Optional: make a change on GitHub web to the same branch)
2. Tap **"Pull"** button in GitPanel

**Expected:**
- [ ] Brief loading state
- [ ] Pull completes without error
- [ ] If remote had changes, file tree refreshes with new content
- [ ] If already up-to-date, silent success (no error)

---

## Test 12: Switch Branches

1. In GitPanel Branches section, tap **"main"** (without asterisk)

**Expected:**
- [ ] Branch checkout happens
- [ ] Status bar updates to "⎇ main"
- [ ] Branch list updates: "* main" becomes current
- [ ] File tree refreshes to reflect main branch content
- [ ] Editor tabs may close if files changed between branches

---

## Test 13: Create New File and Commit

1. Close GitPanel
2. Long-press (or use context menu) on the repo folder in File Explorer
3. Select **"New File"** or **"New Folder"**
4. Type a name (e.g., `nomadcode-test.txt`) and press **Enter** (or tap confirm)

**Expected:**
- [ ] Enter key submits the name (not just the button)
- [ ] No double-slash path errors
- [ ] File/folder created successfully
- [ ] File appears in explorer

5. Open GitPanel → new file shows as `[untracked]`
6. Stage it (checkbox), commit with message, push

**Expected:**
- [ ] Untracked file stages correctly
- [ ] Diff link is NOT shown for untracked files (only for modified/staged)
- [ ] Commit + push succeed

---

## Test 14: Clone Private Repo (Auth Required)

1. Open Command Palette → "Git: Clone repository"
2. Enter URL of a **private** repo you have access to
3. Tap Clone

**Expected (authenticated):**
- [ ] Clone succeeds with progress

**Expected (not authenticated):**
- [ ] Error: "Sign in with GitHub in Settings to access private repositories."
- [ ] "Sign in" link in modal is visible and tappable

---

## Test 15: Sign Out

1. Open Settings → GITHUB ACCOUNT
2. Tap **"Sign out"** (red text)

**Expected:**
- [ ] Returns to "Sign in with GitHub" button + PAT toggle
- [ ] Push operations now show auth-required alert
- [ ] Clone of private repos fails with auth error
- [ ] Clone of public repos still works

---

## Cleanup

After testing, delete the test branch on GitHub:
```bash
gh api -X DELETE repos/ksyed0/CTC-Mobile-Wishlist/git/refs/heads/test/nomadcode-edit
```
