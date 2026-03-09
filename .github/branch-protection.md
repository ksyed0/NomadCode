# Branch Protection Settings

Configure the following rules in **GitHub → Settings → Branches** after the repo is set up.

## `main`

| Setting | Value |
|---|---|
| Require a pull request before merging | ✓ |
| Required approving reviews | 1 |
| Dismiss stale reviews on new commits | ✓ |
| Require status checks to pass | ✓ |
| Required checks | `Lint & Type-check`, `Unit Tests (coverage ≥ 80%)`, `Dependency Audit (npm audit)`, `Static Analysis (Semgrep)`, `CodeQL Analysis`, `Secret Scanning (Gitleaks)` |
| Require branch to be up to date | ✓ |
| Restrict who can push directly | Admins only |
| Allow force pushes | ✗ |
| Allow deletions | ✗ |

## `develop`

| Setting | Value |
|---|---|
| Require a pull request before merging | ✓ |
| Required approving reviews | 1 |
| Dismiss stale reviews on new commits | ✓ |
| Require status checks to pass | ✓ |
| Required checks | `Lint & Type-check`, `Unit Tests (coverage ≥ 80%)`, `Dependency Audit (npm audit)`, `Static Analysis (Semgrep)`, `CodeQL Analysis`, `Secret Scanning (Gitleaks)` |
| Require branch to be up to date | ✓ |
| Allow force pushes | ✗ |
| Allow deletions | ✗ |

## All other branches (`feature/*`, `bugfix/*`, `release/*`, `hotfix/*`)

No branch protection required — they are short-lived and deleted after merging.
