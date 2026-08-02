# Photoczaro — Manual Maintenance & Recovery Guide

This document is the complete procedure for maintaining, testing, deploying, verifying, and rolling back photoczaro.com without any tooling beyond git, a browser, and the Cloudflare dashboard/CLI. It assumes no prior context beyond what's in [`README.md`](../README.md).

## 1. What this site is

A static, no-build HTML/CSS/JS site with a small set of Cloudflare Pages Functions (serverless endpoints under `functions/`) backing a gated publisher-submission flow. There is no framework, no bundler, no `npm install` step for the site itself.

## 2. Where each page lives

| Page | File |
|---|---|
| Homepage | `index.html` (and `fr/index.html`, `ru/index.html`, `es/index.html`, `cs/index.html`) |
| Work With Me | `work-with-me.html` |
| For Agencies | `for-agencies.html` (+ `ru/for-agencies.html` — the only other language with its own copy) |
| Virtual Shoots | `virtual-shoots.html` |
| Journal (blog index) | `journal.html` |
| Blog articles | `blog/<slug>.html`, mirrored per language under `<lang>/blog/<slug>.html` |
| Privacy Policy | `privacy-policy.html` |
| Publisher signup/login/gallery | `for-publishers/*.html` |
| Admin approval UI | `admin/publishers.html` |

Every language directory (`fr/`, `ru/`, `es/`, `cs/`) is a full, independent copy of the relevant English pages — there is no shared template or i18n framework. A content change on the English page does **not** propagate anywhere automatically.

## 3. Editing page content

- Open the relevant `.html` file directly and edit the text/markup in place. Each page is self-contained (its own `<style>` and `<script>` blocks near the top/bottom of the file).
- **Homepage portfolio grids** (Publications, Portraits, Projects): built from inline JS arrays near the bottom of `index.html` — search for `const portraits =`, `const magazines =`, `const projectsData =`, and `const galleries =`. Each array entry is `{ name, alt, src }`. Add a new object to add an image; remove one to retire it.
- **Nav / footer / contact links**: repeated literally on every page (no shared partial). The WhatsApp number appears as `https://wa.me/971508065253`, phone as `tel:+971508065253`, email as `mailto:info@photoczaro.com`, Instagram as `https://www.instagram.com/photoczaro_portraits/`. To change any of these, search-and-replace the exact string across every `.html` file (`grep -rl "971508065253" --include="*.html" .`).

## 4. Adding or replacing a portfolio image safely

1. Add the new image file to `images/` (existing convention: `Category__Subject__OriginalFilename.webp`, WebP format, already-compressed).
2. Add a corresponding entry to the relevant JS array in `index.html` (see §3) with a descriptive `alt` (used for accessibility and image SEO — never leave it blank).
3. If replacing an existing image rather than adding a new one, keep the same array entry and only change `src`, so any per-model gallery references (`galleries['<name>']` in the same file) stay consistent.
4. Preview locally (§6) and check the image renders in the correct grid before committing.
5. Do not delete an image file that's still referenced anywhere — check `git grep -c "<filename>"` across all HTML/JS/JSON first (see §11, "before deleting a tracked asset").

## 5. Language variants

- Each of `fr/`, `ru/`, `es/`, `cs/` contains a full parallel page set, including its own `blog/` folder.
- `hreflang` alternate links and the language switcher (`.lang-switch-menu`) in every page's `<head>`/nav list every language variant's URL — if you add a new page, add the corresponding `hreflang` block and switcher entry on **every** existing language version of that page.
- There is no translation memory or automated sync. Update each language file by hand; a professional/native translation pass is recommended for anything beyond minor copy tweaks.

## 6. Running and previewing locally

No dependencies to install (pure static HTML/CSS/JS). From the repository root:

```bash
python3 -m http.server 8000
```

Open `http://localhost:8000/index.html`. Note two differences from production:

- **Clean URLs** (`/work-with-me` instead of `/work-with-me.html`) are handled by Cloudflare via `_redirects` and are not available on a plain local server — always use the `.html` filename locally.
- **Cloudflare Pages Functions** (`functions/`) are not served by `python3 -m http.server`. To test the publisher signup/login flow locally, use `npx wrangler pages dev .` instead (requires Node.js and the `wrangler` CLI; see §9 for the KV/secret setup it needs).

## 7. Testing a change before pushing

There is no automated test suite or CI pipeline for this site — verification is manual:

1. Preview locally (§6) and visually check the changed page(s) at common widths (browser dev tools, or resize the window): 375px, 768px, 1440px at minimum.
2. Check the browser console for errors (right-click → Inspect → Console).
3. Click through every changed link/CTA to confirm it goes where expected.
4. If you changed anything shared across languages (nav, footer, contact details), spot-check at least one other language file too.
5. If you have Node.js and Playwright available, a headless cross-viewport/console-error check can be scripted against the local server — this is how the last two implementation passes on this site were verified (see `docs/post-audit-implementation-report.md` for the exact method), but it is not a required step for a small content edit.

## 8. Committing and pushing

Standard git workflow — nothing project-specific:

```bash
git status                     # review what changed
git diff                       # review the actual diff before staging
git add <files>                # stage only the intended files
git commit -m "type(scope): short description"
git push origin main
```

- Never force-push to `main`.
- Never amend a commit that has already been pushed.
- Keep commits focused — one logical change per commit — so history stays useful for future debugging.

## 9. How production deployment works

Production is a **Cloudflare Pages "Direct Upload"** project named `photoczaro`. It is **not** connected to this GitHub repository for automatic builds — GitHub here is the durable source of truth and recoverability record, but pushing to `main` does not, by itself, deploy anything.

- **Deploying**: from a local checkout of `main`, with a clean working tree and the Cloudflare `wrangler` CLI installed and authenticated —
  ```bash
  git pull                        # make sure local main is up to date
  git status                      # confirm the working tree is clean before deploying
  npx wrangler pages deploy . --project-name photoczaro --commit-dirty=false
  ```
  `--commit-dirty=false` refuses to deploy if there are uncommitted local changes, which keeps the deployed source traceable to an exact git commit. No build command runs — `pages_build_output_dir = "."` in `wrangler.toml` means the repository root is served as-is.
- **Every deploy is "manual" in the sense that a human or script must run the command above** after pushing to GitHub. There is no separate "automatic" path today. If GitHub↔Cloudflare auto-deploy is ever configured in the future (via the Cloudflare dashboard, Pages project → Settings → Builds & deployments), update this section to describe it — until then, assume nothing deploys until the command above is run.

### Verifying which commit is actually live

Cloudflare's dashboard and `wrangler pages deployment list` show only a **truncated 7-character** commit SHA. To get the full 40-character SHA and confirm the exact commit deployed, query the Cloudflare API directly:

```bash
curl -s -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  "https://api.cloudflare.com/client/v4/accounts/<account-id>/pages/projects/photoczaro/deployments/<deployment-id>" \
  | python3 -c "import sys,json; d=json.load(sys.stdin)['result']; print(d['deployment_trigger']['metadata']['commit_hash'], d['deployment_trigger']['metadata']['commit_dirty'])"
```

Then confirm the canonical domain serves that deployment:

```bash
curl -s -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  "https://api.cloudflare.com/client/v4/accounts/<account-id>/pages/projects/photoczaro" \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['result']['canonical_deployment']['id'])"
```
That `canonical_deployment.id` should match the deployment ID you expect to be live, and a direct fetch of `https://photoczaro.com/` should show the content you expect (e.g. `grep` for a string you know changed in that commit).

### Environment variables / secrets required for the Functions

Two secrets must be set in the Cloudflare Pages dashboard (Settings → Environment variables → Production) for `functions/` to work — never committed to git:

- `SESSION_SECRET` — HMAC signing key for session tokens.
- `ADMIN_PASSWORD` — password for the admin approval UI.

See [`.env.example`](../.env.example) for names/placeholders only. **Whoever administers the Cloudflare account (the account owner, Hatim, or whoever they designate) is the one who can view/rotate these** — this document intentionally does not say who currently holds them or what their values are.

## 10. Rolling back

Two independent recovery points exist at the time of writing (there may be newer ones by the time you read this — check `git tag` and the Cloudflare deployment history for the latest):

| Rollback point | Git tag | Commit | Cloudflare deployment |
|---|---|---|---|
| Before the post-audit UX implementation | `pre-post-audit-ux-implementation` | `877cc8f2dd4a5f1c96446884ab29d87304748f4d` | `27c22360-6d05-4248-bc10-0c7e5b8a039b` |
| Before the Phase 5 homepage CRO work | `pre-phase5-homepage-cro` | `37989cce0f25dce7a32d89f525041365051a35dd` | `ec0f9928-e888-4e86-87e5-cf200a21b73f` (an older Phase-5-era deployment retained as a rollback point) |

**To roll back production immediately** (fastest, no git operations needed): in the Cloudflare Pages dashboard, open the Deployments list for the `photoczaro` project and click "Rollback to this deployment" on the desired prior deployment — or via CLI, redeploy that commit:
```bash
git checkout <rollback-tag-or-commit>
npx wrangler pages deploy . --project-name photoczaro --commit-dirty=false
git checkout main   # return to the tip of main afterwards
```

**To roll back the git history itself** (only if the bad change needs to be reverted in source, not just in production): use `git revert <bad-commit>` to create a new commit undoing the change — never `git reset --hard` + force-push on a shared branch.

Never delete or move an existing rollback tag or a rollback-designated Cloudflare deployment; both are kept precisely so recovery is always possible.

## 11. Common failure & recovery steps

| Symptom | Likely cause | Fix |
|---|---|---|
| Pushed to `main` but production still looks old | Expected — this project does not auto-deploy on push (§9). Run the manual deploy command | `npx wrangler pages deploy . --project-name photoczaro --commit-dirty=false` from a clean, up-to-date `main` checkout |
| `photoczaro.com` shows an older version after deploying | DNS/CDN cache, or the canonical deployment didn't update | Wait a minute and hard-refresh; if it persists, re-check `canonical_deployment.id` (§9) — if it's still the old deployment, the new one may have failed a build stage |
| Publisher signup/login returns a 500 error | `SESSION_SECRET` or `ADMIN_PASSWORD` missing/misconfigured in Cloudflare env vars, or the `PUBLISHERS_KV` namespace binding in `wrangler.toml` doesn't match a namespace that exists in the account | Check Cloudflare dashboard → Pages project → Settings → Environment variables and → Functions → KV namespace bindings |
| A page looks broken only on mobile | Check for horizontal overflow (`document.documentElement.scrollWidth` vs `clientWidth` in the browser console) and confirm no CSS `width`/`grid-template-columns` rule was widened without `minmax(0, ...)` — this exact class of bug has recurred twice in this site's history (see `docs/post-audit-implementation-report.md`) | Compare the affected page's relevant CSS block against a known-good page (e.g. `index.html`) |
| Before deleting a tracked asset (image, script, page) | — | Run `git grep -c "<filename or unique substring>"` across the whole repo first — image filenames are referenced from inline JS data arrays (§3), not just `<img>` tags, so a plain filesystem check is not sufficient |
| Need to fully reconstruct the site from nothing but GitHub | — | `git clone` this repository, `python3 -m http.server` from its root, and it will be pixel-identical to what's tracked in git — no local-machine-only files are required for the site itself (Functions require the two env vars above to be set in Cloudflare, which is a one-time account-level configuration, not a file) |

## 12. Who supplies what

- **GitHub repository access**: whoever the repository owner (Hatimczar) grants collaborator access to.
- **Cloudflare account/deployment credentials**: the Cloudflare account owner. This document does not list current holders or values — ask the account owner directly.
- **Domain/DNS**: managed wherever `photoczaro.com`'s registrar/DNS is configured (outside the scope of this repository).
