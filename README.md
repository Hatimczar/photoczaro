# Photoczaro

Source for [photoczaro.com](https://photoczaro.com) — a static, multi-language photography portfolio site (Dubai portrait/editorial photography), deployed on Cloudflare Pages with a small set of Cloudflare Pages Functions for a gated publisher-submission flow.

This is a plain static site: **no build step, no bundler, no `npm install`.** Every `.html` file is served as-is.

## Structure

```
index.html               Homepage (EN)
work-with-me.html        Private/model booking page (EN)
for-agencies.html        Modeling/talent-agency booking page (EN)
virtual-shoots.html      Remote/virtual session page (EN)
journal.html             Blog index (EN)
privacy-policy.html      Privacy policy (EN)
blog/                    English blog articles
fr/ ru/ es/ cs/          Full translated site (same page set as EN, one directory per language)
images/                  All production images and the testimonial video
js/                      Shared client-side scripts (analytics, sticky-cta, footer year)
functions/               Cloudflare Pages Functions (publisher signup/login/admin API)
admin/                   Admin UI for approving publisher submissions
for-publishers/          Publisher-facing signup/login/gallery UI
docs/                    Project reports and maintenance documentation
_redirects, _headers     Cloudflare Pages routing/header rules
wrangler.toml            Cloudflare Pages project config (KV namespace binding)
robots.txt, sitemap.xml, BingSiteAuth.xml, indexnow_submit.py, <key>.txt   SEO/search-engine files
```

Each language directory (`fr/`, `ru/`, `es/`, `cs/`) mirrors the English page set 1:1, including its own `blog/` folder. There is no templating — each language's HTML is a fully independent, hand-maintained file.

## Editing content

- **Homepage sections** (Publications, Portraits, Projects, About, Trusted By): the image grids are built from JS data arrays inline near the bottom of `index.html` (`portraits`, `magazines`, `projectsData`, `galleries`). Add/remove an entry there to change what appears — no separate CMS or data file.
- **Nav, footer, contact details**: each page carries its own copy of the nav/footer markup (there's no shared partial/include system). WhatsApp/phone number, email, and social links appear as literal `wa.me/...`, `tel:...`, `mailto:...` and Instagram URLs — search-and-replace across all HTML files if any of these change.
- **Blog articles**: one `.html` file per article per language, under `blog/` (and `fr/blog/`, `ru/blog/`, etc.). Copy an existing article as a template for a new one.
- **Adding/replacing a portfolio image**: drop the new image into `images/`, then add/update its entry in the relevant JS data array in `index.html` (see above). Keep filenames descriptive (the existing convention is `Category__Subject__OriginalFilename.webp`) since alt text and captions are generated from these entries.
- **Language variants**: when copy changes on the English page, the same change must be manually applied to each language file — there is no automated translation sync.

See [`docs/manual-maintenance-and-recovery.md`](docs/manual-maintenance-and-recovery.md) for the full local-preview, testing, deployment, rollback, and disaster-recovery procedure.

## Quick start (local preview)

No dependencies to install. From the repo root:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000/index.html`. Cloudflare's clean-URL rewriting (`/work-with-me` instead of `/work-with-me.html`) is defined in `_redirects` and is **not** applied by a plain local server — use the `.html` filename when previewing locally.

## Deployment

Production deploys via Cloudflare Pages, connected to the `main` branch of this repository. Pushing to `main` triggers an automatic build/deploy. A manual deploy (e.g. from a local machine) uses:

```bash
npx wrangler pages deploy . --project-name photoczaro --commit-dirty=false
```

Full details, including how to verify the deployed commit and how to roll back, are in [`docs/manual-maintenance-and-recovery.md`](docs/manual-maintenance-and-recovery.md).

## Required environment variables

The Cloudflare Pages Functions under `functions/` (publisher signup/login/admin) require two secrets set in the Cloudflare Pages dashboard (Settings → Environment variables) — **not** committed to this repository. See [`.env.example`](.env.example) for names and placeholders.
