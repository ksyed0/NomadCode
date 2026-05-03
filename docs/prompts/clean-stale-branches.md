# Prompt: Clean Stale Remote Branches

Paste this into a new Claude Code session in the NomadCode project.

---

## Instructions for Claude

Clean up all stale remote branches in the NomadCode repo at `/Users/Kamal_Syed/Projects/NomadCode`.

**Step 1 — List all remote branches and their merge status:**

```bash
cd /Users/Kamal_Syed/Projects/NomadCode && git fetch --prune && git branch -r | grep -v "HEAD"
```

Then for each non-protected branch, check if it is fully merged into `develop`:

```bash
git branch -r --merged origin/develop | grep -v "HEAD\|origin/main\|origin/develop\|origin/gh-pages"
```

**Step 2 — Identify branches to delete:**

Delete branches that are:
- Fully merged into `develop` (shown by the command above)
- AND are not: `main`, `develop`, `gh-pages`, or any active `chore/version-bump-*` PR branch

**Always keep:**
- `origin/main`
- `origin/develop`
- `origin/gh-pages` (GitHub Pages deployment branch)
- Any branch with an open PR (check with `gh pr list --state open`)

**Step 3 — Delete each stale remote branch:**

```bash
git push origin --delete <branch-name>
```

**Step 4 — Clean up local tracking references:**

```bash
git remote prune origin
git branch -vv | grep ': gone]'
```

Delete any local branches tracking deleted remotes:
```bash
git branch -d <local-branch-name>
```

**Step 5 — Confirm clean state:**

```bash
git branch -r | grep -v "HEAD\|main\|develop\|gh-pages"
```

Expected result: empty (or only active feature branches with open PRs).

**Step 6 — Also clean up any stale git worktrees:**

```bash
git worktree list
git worktree prune
```

Report how many branches were deleted and list them.
