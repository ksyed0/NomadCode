# Contributing to NomadCode

This project follows the **Gitflow** branching model.

---

## Branch structure

```
main ─────────────────────────────────────────────── production releases (tagged)
  └─ develop ──────────────────────────────────────── integration branch
       ├─ feature/<ticket>-<slug>  ← new features
       ├─ bugfix/<ticket>-<slug>   ← non-urgent bug fixes
       └─ release/<version>        ← release preparation
main ─── hotfix/<ticket>-<slug>    ← urgent production patches
```

| Branch | Created from | Merges into | Purpose |
|---|---|---|---|
| `main` | — | — | Production-ready code; every commit is a release |
| `develop` | `main` | — | Stable integration; base for all feature work |
| `feature/*` | `develop` | `develop` | New features and enhancements |
| `bugfix/*` | `develop` | `develop` | Non-critical bug fixes |
| `release/*` | `develop` | `main` + `develop` | Release prep (version bumps, changelogs) |
| `hotfix/*` | `main` | `main` + `develop` | Urgent production patches |

---

## Branch naming

```
feature/42-monaco-multi-tab
bugfix/17-file-explorer-crash
release/1.2.0
hotfix/99-auth-token-leak
```

- Use lowercase and hyphens only
- Prefix with a ticket/issue number when one exists
- Keep slugs short and descriptive

---

## Workflow

### Starting a feature

```bash
git checkout develop
git pull origin develop
git checkout -b feature/<ticket>-<slug>

# ... do your work, commit often ...

git push -u origin feature/<ticket>-<slug>
# Open a PR: feature/... → develop
```

### Finishing a feature

1. Open a Pull Request targeting `develop`
2. Squash-merge after approval
3. Delete the feature branch

### Creating a release

```bash
git checkout develop
git pull origin develop
git checkout -b release/<version>

# Bump version numbers, update CHANGELOG.md
git commit -am "chore: prepare release <version>"
git push -u origin release/<version>

# Open two PRs:
#   release/<version> → main    (tag on merge: v<version>)
#   release/<version> → develop (keep develop in sync)
```

### Hotfixing production

```bash
git checkout main
git pull origin main
git checkout -b hotfix/<ticket>-<slug>

# Fix the issue
git push -u origin hotfix/<ticket>-<slug>

# Open two PRs:
#   hotfix/... → main    (tag on merge)
#   hotfix/... → develop
```

---

## Commit message convention

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <short summary>

[optional body]

[optional footer]
```

| Type | When to use |
|---|---|
| `feat` | New feature |
| `fix` | Bug fix |
| `chore` | Tooling, deps, config (no production code change) |
| `docs` | Documentation only |
| `refactor` | Code restructure with no behaviour change |
| `test` | Adding or fixing tests |
| `perf` | Performance improvement |
| `ci` | CI/CD pipeline changes |

**Examples:**
```
feat(editor): add multi-tab support with dirty indicator
fix(file-explorer): prevent crash when directory is empty
chore(deps): add react-native-webview ^13.12.0
docs: add gitflow contributing guide
test(terminal): add unit tests for built-in commands
```

---

## Pull request rules

- Target `develop` for features and bugfixes
- Target `main` (and `develop`) for releases and hotfixes
- Every PR must have a description using the [PR template](.github/PULL_REQUEST_TEMPLATE.md)
- At least **1 approving review** required before merge
- All CI checks must pass
- Branch must be up-to-date with the target before merging
- Prefer **squash-merge** for feature branches, **merge commit** for releases

---

## Protected branches

| Branch | Direct push | Force push | Require PR | Required checks |
|---|---|---|---|---|
| `main` | ✗ | ✗ | ✓ | lint, test, type-check |
| `develop` | ✗ | ✗ | ✓ | lint, test, type-check |

---

## Release versioning

We follow [Semantic Versioning](https://semver.org/): `MAJOR.MINOR.PATCH`

| Change | Version bump |
|---|---|
| Breaking API / behaviour change | MAJOR |
| New feature, backwards-compatible | MINOR |
| Bug fix, patch | PATCH |

Releases are tagged on `main` as `v<version>` (e.g. `v1.2.0`).
