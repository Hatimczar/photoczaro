# Photoczaro Models: models.photoczaro.com (development scaffold)

Static HTML/CSS/vanilla JS, matching the main photoczaro.com site's stack: no build step,
Cloudflare Pages + Pages Functions, same typefaces (Cormorant Garamond + Inter) and the
same brand palette (`css/style.css`).

## What's built

- **Pages**: Home, All Models (filtered directory), Model Profile, Book Talent, Apply to
  the Roster, About, Contact, Booking Terms, Privacy Policy, 404.
- **Filters**: category (Women/Men) implemented as filtered views of `/models` (not
  separate pages, per spec), plus specialty, location, height range and New Faces,
  all reflected in the URL query string.
- **Shortlist / booking deck**: `localStorage`-backed (`js/shortlist.js`), persists across
  pages, feeds a slide-in drawer and pre-fills Book Talent with the selected slugs.
- **Forms**: Book Talent and Apply to the Roster both have full field sets per spec,
  client-side validation, and POST to `functions/api/book-talent.js` / `functions/api/apply.js`.
- **Accessibility**: skip link, visible focus states, semantic headings, `prefers-reduced-motion`
  support, keyboard-operable filters/drawer/menu.
- **Legal placeholders**: Booking Terms and Privacy Policy both carry an explicit on-page
  dev note that they are drafts requiring UAE legal review.

## What's still mocked / open before production

- **`js/data.js` is entirely mock data**: 8 invented model records, clearly commented as
  placeholders. No real photographs are used anywhere; cards render a gradient swatch +
  initials instead, specifically so nothing here can be mistaken for a real person.
- **No real portfolio images**: the profile gallery reuses the same placeholder swatch.
- **Backend handlers write to KV** (`ENQUIRIES_KV` / `APPLICATIONS_KV`, bound via
  `wrangler.toml`). Still development-only in the sense that nothing reviews the records
  yet, see the next two points.
- **Uploaded files in the Apply form are NOT persisted**: the handler only records name/
  type/size. Real file storage (e.g. a private Cloudflare R2 bucket, never public) needs
  to be wired before this goes live, see the comment at the top of `functions/api/apply.js`.
- **No spam protection or rate-limiting yet**: Cloudflare Turnstile is the natural fit
  given the rest of the stack; add it to both forms before launch.
- **No reviewer notification**: enquiries/applications currently just sit in KV. Wire an
  email or the same Telegram-webhook pattern the main site uses
  (`functions/_lib/telegram.js`) so they're actually seen.
- **`robots: noindex, nofollow`** is set site-wide intentionally while content is mock data.
- **Model profile URLs use `?slug=`, not a static path per model.** This keeps the site
  buildless and data-driven for v1. If real per-model SEO indexing matters before launch,
  the cleanest next step is a small generation script (Python, like the image-resizing
  scripts already used on the main site) that emits one static HTML file per model from
  `js/data.js` at content-update time, not a runtime framework change.

## Deployment (not yet done, needs your explicit go-ahead)

This is a **separate** Cloudflare Pages project, isolated from the live photoczaro.com
deploy:

1. Create a new Cloudflare Pages project (e.g. `photoczaro-models`) with this `models-site/`
   directory as its build output, either point it at this same GitHub repo with a build
   output directory of `models-site`, or split it into its own repo if you'd rather keep
   deploys fully separate.
2. Create and bind the two KV namespaces referenced above.
3. Add the custom domain `models.photoczaro.com` to that new Pages project, which requires
   a DNS CNAME record. I have not touched DNS or Cloudflare account settings for this.
4. Add a small cross-link from the main site's nav/footer to `models.photoczaro.com` (and
   this site already links back to `https://photoczaro.com` throughout).

## Local preview

```bash
cd models-site
npx wrangler pages dev . --port 8812
```

(Also registered as the `photoczaro-models` launch config for the Browser pane.)

## Credits

Icons: Unicons (line style) by IconScout, used under the IconScout Simple License (commercial use allowed, attribution optional). Sprite: `images/icons-v1.svg`; bump the filename if the sprite changes (images are cached long-term).
