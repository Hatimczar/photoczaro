# SEO-GOD audit punch list — 2026-08-20

Site: https://photoczaro.com · Audit: `bdc9c350-2c79-4f5f-854b-7f76de8c1bf5` · 120 pages crawled, 0 blocked.
`build_cmd` is `"none"` for this project — nothing below was verified against a build gate, and nothing
fixed this run was labeled "fixed"; see the run summary for the edited-but-unverified list.

## Class 1 — broken links (partially a false positive, read this first)

**104 of the 108 `broken-internal-link` rows are not real.** Every one targets
`https://photoczaro.com/cdn-cgi/l/email-protection` — Cloudflare's own email-obfuscation rewrite of the
site's `mailto:info@photoczaro.com` links. Cloudflare's edge decodes that fragment client-side via a JS
snippet it injects automatically; a crawler that doesn't execute that script gets a 404 fetching it
directly. Real browsers and Googlebot's renderer both handle it correctly. No source change is possible
or needed — the source HTML already just has a plain `mailto:` link.

The remaining 4 were real and are already fixed this run (see run summary).

## Class 4 — thin content (needs an editorial decision, not a mechanical fix)

- **`/for-publishers/`** — 129 words, flagged `thin-content`. This is the publisher-portal landing page
  (register → get approved → pick & send). OpenSEO's own remediation options: expand it with genuinely
  useful content, `noindex` it, or fold it into a stronger page. Whether this page is meant to rank in
  search at all is a product decision — it currently has no `noindex` (i.e. it's indexable), so if it's
  meant to stay a private, invite-only entry point rather than a discoverable landing page, `noindex` is
  probably the right call; if it's meant to attract publishers via search, it needs 300-500+ words of
  real copy about what the program offers, written by someone speaking for the brand.

## Class 2 — title / meta length (info severity, needs human copy judgment)

70 pages have `title-too-long` (over ~60 chars) and 47 have `meta-description-too-long` (over ~160
chars). Broken down by language:

| Type | English | cs | es | fr | ru | Total |
|---|---|---|---|---|---|---|
| title-too-long | 14 | ~14 | ~14 | ~14 | ~14 | 70 |
| meta-description-too-long | 8 | ~10 | ~10 | ~10 | ~10 | 47 |

Not auto-fixed this run: shortening a title or description without losing its meaning or keywords is an
editorial call, and for the ~95 non-English rows it also carries real translation risk — I don't have the
fluency to safely shorten French/Spanish/Czech/Russian marketing copy without a native speaker reviewing
it. The 22 English-only rows (14 titles + 8 descriptions) are safe for a future run to fix directly (no
translation risk); the localized rows should go through whoever manages the translations, or be handed to
a follow-up run explicitly scoped to "fix the English titles/metas only."

Full URL lists are in the raw audit — call `get_audit_issues` with `issueType: "title-too-long"` or
`"meta-description-too-long"` against auditId `bdc9c350-2c79-4f5f-854b-7f76de8c1bf5` to pull them again.

## Class 5 — slow responses (server/CDN, not repo-fixable)

11 pages showed `slow-response` (1.5s–2.6s), all on the `/cs/`, `/es/`, `/fr/` locale pages and their
`/journal` pages, plus `/for-publishers/`:

| URL | Response time |
|---|---|
| /cs/blog/shooting-portraits-dubai-heat | 2561ms |
| /fr/blog/professional-headshots-dubai-guide | 2529ms |
| /cs/journal | 2246ms |
| /es/ | 1954ms |
| /es/blog/professional-headshots-dubai-guide | 1852ms |
| /cs/blog/professional-headshots-dubai-guide | 1768ms |
| /es/blog/shooting-portraits-dubai-heat | 1746ms |
| /ru/journal | 1707ms |
| /cs/ | 1622ms |
| /es/journal | 1620ms |
| /for-publishers/ | 1518ms |

This is Cloudflare Pages edge/origin response time, not something a static-HTML repo edit can fix
directly. Likely explanation: these were cold-cache first requests during the crawl (no build step, no
asset pipeline, nothing in the repo to optimize). Worth a re-check next run before treating as a real
pattern — if it persists specifically on locale pages, look at whether the locale pages are being served
from a less-warmed Cloudflare edge cache tier, and consider whether Cloudflare's cache rules need
adjusting for those paths. This is a Cloudflare dashboard change, not a repo change.

## Not measured

**Performance (Lighthouse): not assessed — 20 of 20 Lighthouse runs failed.** `lighthouseCompleted: 0`.
Class 5's performance findings have zero data behind them this run; only the crawler's own
`slow-response` timing (above) is real data. Re-run the audit to see if this was a one-off (e.g. the
OpenSEO container's Lighthouse runner still warming up right after first boot) or persistent.

## Informational, no action needed

- `noindex-page` on `/for-publishers/login` and `/for-publishers/signup` — correct and intentional
  (account auth pages should never be indexed).
