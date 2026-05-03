# GitHub Pages Setup — NomadCode

Hosting the Privacy Policy and Support pages at `https://ksyed0.github.io/NomadCode/`.

---

## Step 1 — Push the commit

```bash
cd /Users/Kamal_Syed/Projects/NomadCode
git push origin develop
```

---

## Step 2 — Enable GitHub Pages

1. Go to `https://github.com/ksyed0/NomadCode`
2. Click **Settings** (top tab bar)
3. Click **Pages** in the left sidebar (under "Code and automation")
4. Under **Source**, select **Deploy from a branch**
5. Under **Branch**, select `develop`
6. In the folder dropdown next to the branch, select `/docs`
7. Click **Save**

---

## Step 3 — Wait ~2 minutes

GitHub builds and deploys automatically. A green banner appears at the top of the Pages settings page when done:

> Your site is live at `https://ksyed0.github.io/NomadCode/`

---

## Step 4 — Verify both pages

| Page | URL |
|---|---|
| Privacy Policy | `https://ksyed0.github.io/NomadCode/privacy/` |
| Support | `https://ksyed0.github.io/NomadCode/support/` |

---

## Step 5 — Use these URLs in store submissions

| Store | Field | URL |
|---|---|---|
| App Store Connect | Privacy Policy URL | `https://ksyed0.github.io/NomadCode/privacy/` |
| App Store Connect | Support URL | `https://ksyed0.github.io/NomadCode/support/` |
| Google Play Console | Privacy Policy URL | `https://ksyed0.github.io/NomadCode/privacy/` |
| Google Play Console | Support email | `support@fablesoft.biz` |

---

## Step 6 — Update URLs when fablesoft.biz is live

Update the URLs in App Store Connect and Google Play Console — **no app resubmission required**. Just paste the new URL in the respective console and save.

---

## File locations

| File | Purpose |
|---|---|
| `docs/privacy/index.html` | Privacy Policy page |
| `docs/support/index.html` | Support page |
| `docs/.nojekyll` | Disables Jekyll (prevents GitHub rendering `.md` files as a Jekyll site) |

---

## Notes

- GitHub Pages redeploys automatically on every `git push origin develop` — no manual publish step needed.
- The `/docs` folder source means only files inside `docs/` are publicly served, not the entire repo root.
- Page content (privacy policy text, FAQ answers) can be updated at any time by editing the HTML files and pushing — no store resubmission needed.
