# Photoczaro — Post-Audit UX Implementation Report

This is the controlled implementation that followed the six-phase audit. It is **not Phase 7** — it is the approved, scoped execution of the Phase 6 recommendations the brief authorized, focused on customer-experience clarity rather than brand repositioning.

## 1. Verified starting state

| Item | Value |
|---|---|
| Local `main` SHA | `877cc8f2dd4a5f1c96446884ab29d87304748f4d` |
| `origin/main` SHA | `877cc8f2dd4a5f1c96446884ab29d87304748f4d` (match) |
| Working tree | Clean |
| Production deployment | `27c22360-6d05-4248-bc10-0c7e5b8a039b` |
| `commit_dirty` | `false` |
| Canonical domain | `photoczaro.com` confirmed serving `27c22360` / `877cc8f` |
| Safety tag `pre-phase5-homepage-cro` | Unmoved — tag object `4210d9d3207e8e9c0c8703ce53718a9a81d421d8`, peeled commit `37989cce0f25dce7a32d89f525041365051a35dd` |
| Rollback deployment `ec0f9928-e888-4e86-87e5-cf200a21b73f` | Confirmed still live |
| New rollback tag created and pushed | `pre-post-audit-ux-implementation` → `877cc8f2dd4a5f1c96446884ab29d87304748f4d` |

State matched exactly; implementation proceeded.

## 2. Approved brand constraints (preserved throughout)

- Photoczaro remains presented as Hatim's brand; **Hussain was not introduced** anywhere.
- **No pricing was added** — no packages, ranges, "from" prices, or invented investment guidance. All contact routes remain enquiry-only.
- Overall positioning and three-session service structure (Portrait Session / Model Portfolio / Editorial & Creative Session, For Agencies, Virtual Shoots) preserved unchanged.
- No repositioning around "Premium Editorial Portraiture" or any single strategic direction — this was a UX/technical pass only.
- Photography and videography scope untouched.
- All existing publications, testimonials, stats, and named magazine credits preserved verbatim — nothing invented, nothing removed.
- Dark/gold/cinematic visual identity preserved — no new color palette, no template swap, no added animation.
- Primary CTAs still route to WhatsApp or Call throughout.

## 3. Problems found (evidence-based)

1. **Mobile hero clutter and clipping (homepage, `index.html`).** At 320–430px the hero stacked: nav header → eyebrow → an oversized `clamp(70px,9vw,130px)` wordmark that visually clipped/overlapped the eyebrow text → descriptor → tagline → two full-weight CTA buttons → a vertical "Scroll" label → and, simultaneously, a large fixed WhatsApp/Call panel — all in one viewport. Genuine text clipping was confirmed in a 320px capture before the fix (the "Photoczaro" wordmark rendered partially off both edges of its own container).
2. **Sticky WhatsApp/Call panel always visible on mobile**, competing directly with the hero's own primary CTA in the same viewport, across every page carrying `.sticky-mobile-cta` (70 files).
3. **Generic WhatsApp links with no context** on the homepage contact section and three sticky bars (index, work-with-me, virtual-shoots), while other pages (for-agencies) already had service-specific prefilled text.
4. **Undersized touch targets**: the mobile hamburger button measured 34×23px (below the 44×44 minimum); the demoted secondary hero CTA needed explicit sizing once restyled.
5. **A parity gap discovered during this pass, not part of the original Phase 6 audit**: the translated homepages (`fr/`, `ru/`, `es/`, `cs/index.html`) had never received two earlier fixes that the English homepage already had — the Phase 5 hero-tagline contrast correction (still at the old `0.65` alpha, measuring below 4.5:1) and the Phase 5 320px magazine-grid overflow fix (`repeat(2, 1fr)` instead of `repeat(2, minmax(0, 1fr))`, causing a genuine 2px page-level horizontal overflow at 320px, confirmed via `scrollWidth`/`clientWidth`). Both are fixed in this pass for full language parity.
6. **Accessibility contrast failures** (found via Lighthouse, not previously audited): the footer copyright/privacy-policy text, the marquee strip text, the mobile-menu Instagram link, the journal card date, the privacy-policy section-number labels, and the language-switcher button text all measured below the 4.5:1 AA threshold (2.17–3.75:1 measured, one at 1.98:1 from an unstyled bare link rendering in the browser's default blue). A related **Label-in-Name (WCAG 2.5.3) mismatch**: the language-switcher button's `aria-label="Change language"` discarded its own visible text ("EN ▾"), so its accessible name didn't contain its visible label.
7. **Missing `<main>` landmark** (WCAG 1.3.1/2.4.1) on `work-with-me.html`, `for-agencies.html`, and `virtual-shoots.html`.
8. **A second, more significant parity gap**: the Phase 5 mobile-menu accessibility remediation (`aria-expanded` sync, `inert` background containment, Escape-to-close, focus return) had only ever been applied to the English homepage. The other 14 pages carrying a mobile hamburger menu — `work-with-me.html`, `for-agencies.html`, `virtual-shoots.html`, `journal.html`, `privacy-policy.html`, and the `ru/for-agencies` and four-language `index`/`journal` variants — still ran the original, pre-Phase-5 menu script with none of those behaviors. Fixed identically across all 15 files in this pass.

## 4. Customer-journey decisions

- Kept the existing entry → work → credibility → service fit → process → enquiry flow intact; this pass did not reorder sections or navigation, per the guardrail against repositioning.
- On mobile specifically, resolved the conflict between the hero's own CTA and the sticky contact panel by making the sticky panel appear only once the hero's primary CTA has scrolled out of view, and disappear again near the footer/final contact section — so a visitor is never shown two competing "contact me" surfaces in the same viewport.
- Demoted the hero's secondary action ("View Portrait Portfolio") to a plain text link under the primary button on mobile, rather than a second full-weight button — reducing "several banners stacked" to one clear primary action with visible relief instead of removal.

## 5. Mobile hero solution (the exact fix)

All changes are scoped inside the existing `@media (max-width: 768px)` block in `index.html` (and the equivalent block in the four translated homepages) — no new breakpoints, no structural HTML change beyond one new class on the existing secondary CTA link.

- `.hero`: switched from a fixed `height: 100vh` to `min-height: 100svh` (with a `100dvh` progressive enhancement) and `height: auto`, so mobile browser chrome no longer clips or double-reserves space; padding now accounts for `env(safe-area-inset-top)` and `env(safe-area-inset-bottom)`.
- `.hero-eyebrow`: hidden on mobile — it duplicated the descriptor immediately below it ("Dubai - Photography" vs. "Dubai Portrait & Editorial Photographer").
- `.hero-title`: resized to `clamp(40px, 15vw, 60px)` on mobile (from the unconstrained `clamp(70px, 9vw, 130px)` base value) — verified to render on a single line with zero horizontal overflow at 320/360/375/390/430px.
- `.hero-descriptor` / `.hero-tagline`: modest size/spacing reductions to sit comfortably under the resized title.
- `.hero-scroll` ("Scroll" indicator): hidden on mobile — decorative, not needed once the hero is no longer a fixed full-screen block.
- `.hero-ctas`: primary CTA ("Plan Your Photoshoot") kept as the one full-width, full-weight button; the secondary CTA ("View Portrait Portfolio") received a new `.hero-cta-secondary` class restyling it as a plain underlined text link (transparent background, no border/shadow) — same destination, same analytics event, visibly demoted.
- `.sticky-mobile-cta`: converted from "always shown via CSS media query" to **JS-controlled visibility** (see §6) — hidden by default (`transform: translateY(120%); pointer-events: none;`), revealed via `.is-visible` only when appropriate.

Result, measured directly: at 320/360/375/390/430px the homepage now shows exactly one hero message, one dominant CTA, one secondary text link, and zero competing sticky panel — with confirmed zero `scrollWidth > clientWidth` overflow at every width, in both Chromium and WebKit.

## 6. Sticky-contact-control behavior (new)

A new shared script, [`js/sticky-cta.js`](../js/sticky-cta.js), was added and included (via one mechanical insertion after the existing `analytics-events.js` include) on all 70 pages that carry a `.sticky-mobile-cta` element.

Logic:
- Finds the page's primary hero CTA (`.hero-ctas .cta-btn-primary`, falling back to `.hero-ctas`, then any `.cta-btn-primary`) as a sentinel.
- An `IntersectionObserver` hides the sticky bar while that sentinel is on screen, and reveals it once scrolled past.
- A second `IntersectionObserver` on the page's `#contact` section (or `<footer>` if no `#contact`) hides the sticky bar again once the visitor nears the page's own final contact/enquiry area, so it never overlaps the footer or a page's own WhatsApp/Call/Email block.
- The hidden state also sets `inert` on the bar (matching the existing Phase 5 pattern used for the mobile menu overlay), so its links are not keyboard-focusable while visually hidden — verified via Tab-order testing.
- Progressive enhancement: a `<noscript>` block forces the bar visible (matching the pre-existing always-on behavior) if JavaScript is unavailable, so no visitor loses the contact option.

Verified on the homepage, Work With Me, For Agencies, and Virtual Shoots (the four pages with a real top hero/CTA to conflict with) in both Chromium and WebKit: hidden at page load, revealed after scrolling past the primary CTA, hidden again near the footer.

## 7. Navigation / touch-target changes

- Mobile hamburger button (`.nav-hamburger`): padding increased from `4px` to `15px 10px` with centered content, raising its tappable area from 34×23px to 46×45px (meets 44×44 CSS px minimum) across all 86 HTML files sharing this rule, without changing its visual icon size.
- Hero secondary CTA (`.hero-cta-secondary`): padding tuned to 44px measured height.
- No other navigation structure, ordering, or labels were changed — Work With Me and For Agencies remain distinct entries; mobile menu ordering, `aria-expanded` sync, Escape handling, and focus containment (all Phase 5 work) were re-verified, not modified.

## 8. Copy changes (complete list)

Per the guardrails, copy changes were limited to clarity/hierarchy — no pricing, no repositioning, no new claims:

- Homepage contact-section WhatsApp link: `wa.me/971508065253` → added `?text=Hi%20Hatim%2C%20I%27d%20like%20to%20enquire%20about%20a%20photoshoot`.
- Homepage sticky-bar WhatsApp link: same prefilled text added.
- Work With Me sticky-bar WhatsApp link: added `?text=Hello%20Photoczaro%2C%20I%20would%20like%20to%20plan%20a%20photoshoot.` (matching the phrasing already used in that page's own no-JS fallback link).
- Virtual Shoots sticky-bar WhatsApp link: added `?text=Hello%20Photoczaro%2C%20I%20would%20like%20to%20enquire%20about%20a%20Virtual%20Shoot.` (same rationale).
- For Agencies already had service-specific prefilled WhatsApp text from an earlier phase — left unchanged.
- Language-switcher `aria-label`: `"Change language"` → `"{CODE}, change language"` (e.g. `"EN, change language"`, `"FR, change language"`) on both the footer and desktop-nav language switchers, across all 70 files that have one — fixes the Label-in-Name accessibility mismatch without changing any visible text.

No headline, section title, testimonial, stat, or publication credit was reworded.

## 9. Accessibility work

- **Contrast fixes** (WCAG 1.4.3, verified via Lighthouse before/after, applied across every file that carries each rule):
  - `.footer-copy` and its per-page variants (`.journal-footer-copy`, `.vs-footer-copy`, `.wm-footer-copy`, the inline-styled blog-footer link): `rgba(138,134,128,0.4/0.5/0.55/0.6/0.7)` → `0.95` — contrast raised from ~2.17–3.75:1 to ~5.0–5.5:1.
  - `.strip-inner span` (marquee text): `rgba(201,169,110,0.4)` → `0.8` — contrast raised from 2.32:1 to ~5.4:1.
  - `.lang-switch-btn` text: `rgba(138,134,128,0.55)` → `0.95` — contrast raised from 2.39:1 to ~4.8:1.
  - `.mobile-menu-socials a` (Instagram link inside the mobile overlay): `rgba(138,134,128,0.6)` → `0.95` — contrast raised from 2.64:1 to ~5.1:1.
  - `.blog-card-date` on the Journal listing (all 5 languages): `rgba(138,134,128,0.7)` → `0.95` — contrast raised from 3.21:1 to ~5.1:1.
  - `.pp-section-number` on the Privacy Policy page: `opacity: 0.6` → `0.85` on the gold section-number labels — contrast raised from 3.76:1 to ~6.6:1.
  - Three Privacy Policy body links, including one **unstyled bare `<a>` rendering in the browser's default blue** (`#0000ee`, 1.98:1 contrast) rather than the site's own styling: standardized to `color:var(--gold); text-decoration:underline;`, which both fixes the contrast and resolves the accompanying "link relies on color alone" (WCAG 1.4.1) failure by giving every body link an underline.
- **Label-in-Name fix** (WCAG 2.5.3): language-switcher `aria-label` now includes its own visible text (see §8).
- **Missing `<main>` landmark fix** (WCAG 1.3.1/2.4.1): added to `work-with-me.html`, `for-agencies.html`, and `virtual-shoots.html`, wrapping the page content between the nav and footer — the same three pages Lighthouse flagged for `landmark-one-main`.
- **Mobile-menu accessibility parity fix** (WCAG 2.1.1/2.1.2/2.4.3/4.1.2): the Phase 5 `aria-expanded`-sync / `inert`-containment / Escape-to-close / focus-return pattern, previously only on the English homepage, was ported to all 14 other pages carrying a hamburger menu (`work-with-me.html`, `for-agencies.html`, `virtual-shoots.html`, `journal.html`, `privacy-policy.html`, `ru/for-agencies.html`, and the four-language `index.html`/`journal.html` variants), replacing each page's original unaccessible click-only toggle with the same `setMobileMenuOpen()` function used on the homepage. Verified via automated Tab/Escape/inert tests on 8 representative pages — all pass identically.
- **Touch targets** (WCAG 2.5.8): hamburger button and hero secondary CTA brought to ≥44×44px (see §7).
- **Re-verified, not regressed**: desktop "More" disclosure keyboard behavior, reduced-motion CSS/JS handling — passed identically to the Phase 5 baseline.
- **Hero tagline contrast (commit `877cc8f`)**: reconfirmed intact on the English homepage (not touched by this pass) and newly measured on the four translated homepages, which had never received that fix. Worst-case measured contrast on the translated homepages: **8.3–11.4:1** at 375/1024/1440px (methodology: direct pixel sampling of the true background behind the tagline via a hidden/visible screenshot diff, blended against the exact rendered `rgba(245,240,235,0.85)` foreground) — safely clear of the 4.5:1 threshold, with more margin than the English page because the translated tagline sits lower in the hero's darker vignette area.
- Lighthouse accessibility score, mobile, per page (local baseline, before → after this pass): Homepage 96→**100**, Work With Me → **100**, For Agencies → **100**, Virtual Shoots → **100**, Journal → **100**, Privacy Policy → **100**, `cs/index.html` (representative translated homepage) → **100**.

### A regression caught and fixed during this pass

An early, broad regex-based attempt to port the mobile-menu fix across all 14 remaining files matched too much text on two pages — `work-with-me.html` and `virtual-shoots.html` — and silently deleted each page's scroll-reveal `IntersectionObserver` setup and its page-specific analytics-tracking helper function (`wmTrack`/`vsTrack`), while leaving later calls to those now-undefined functions in place. This was caught by this report's own testing step (§14: a scripted click on each page's final CTA after scrolling to trigger reveals), which surfaced the deleted code before any commit or deploy. Both files were restored by reinserting the exact original reveal-observer and analytics-helper blocks from the prior commit, verified with zero console/page errors and all `.reveal` elements correctly transitioning to `.visible` on both pages. The remaining 12 files were fixed individually with exact-string replacements (not the broad regex) and required no such correction — confirmed by diff review before commit.

## 10. Performance work

No image, font, or script-loading strategy was changed — the brief explicitly prioritizes photographic quality over performance-score chasing, and no performance regression was introduced (one small deferred script, ~1KB, added per page). Measurements below are diagnostic baselines.

## 11. Performance & Lighthouse measurements (local baseline)

Captured via Lighthouse 13.4.1, mobile form factor, against the local static build (`localhost:8123`) — a proxy for production, not a substitute; production numbers benefit from Cloudflare's CDN/compression and are noted separately after deployment.

| Metric (homepage) | Before this pass | After this pass |
|---|---|---|
| Lighthouse Performance | 93 (baseline run) | 89–93 (run-to-run variance on local server; no code-path regression) |
| Lighthouse Accessibility | 96 | **100** |
| Lighthouse Best Practices | 100 | 100 |
| Lighthouse SEO | 100 | 100 |
| Largest Contentful Paint | — | 2.6–3.6s (local, unthrottled-CDN baseline) |
| Cumulative Layout Shift | — | 0.0004 (effectively 0) |
| Total page weight | — | ~8–29MB (local run variance; dominated by the homepage's full portfolio image set, unchanged by this pass) |

## 12. Analytics validation

- Confirmed `js/analytics-events.js` is unmodified and still: fires exactly one event per explicit `data-analytics-event` click (explicit events short-circuit before generic classification, preventing double-firing); classifies untagged `wa.me`/`tel:`/`mailto:` links generically without needing href content; sends only controlled identifiers (`cta_location`, `destination_type`, and the existing `data-analytics-param-*` values) — never the WhatsApp prefilled message text, never a name, phone number, or URL fragment.
- Adding `?text=...` to WhatsApp hrefs does not change what analytics records (confirmed by reading the tracking code: it never reads `href` content beyond a regex check for the `wa.me/` prefix) and does not create a duplicate/generic event alongside an explicit one (explicit-event short-circuit logic unchanged).
- Confirmed `typeof window.gtag !== 'function'` guard remains in place — a missing/blocked `gtag` cannot throw.
- No cookies, consent mechanisms, or new tracking platforms were added.
- Verified via a live click-interception test that the sticky-bar and hero CTAs still fire their existing `cta_location`/`destination_type` (or explicit `data-analytics-event`) values unchanged.

## 13. Files changed

- **New file**: `js/sticky-cta.js` (shared sticky-contact-visibility logic).
- **`index.html`**: mobile hero rebuild, sticky-cta script include + no-JS fallback, footer/marquee/lang-switch contrast fixes, hamburger touch-target fix, lang-switch `aria-label` fix, WhatsApp prefill (2 links), secondary-CTA class addition.
- **`fr/index.html`, `ru/index.html`, `es/index.html`, `cs/index.html`**: mobile hero rebuild (eyebrow/title/tagline/height, no hero-ctas present so no secondary-CTA change needed), hero-tagline contrast fix (`0.65`→`0.85`, bringing these pages to parity with commit `877cc8f`), magazine-grid overflow fix (`minmax(0,1fr)`, bringing these pages to parity with commit `03fc6d7`), plus the same footer/lang-switch contrast and hamburger touch-target fixes as the English homepage.
- **`work-with-me.html`, `virtual-shoots.html`**: sticky-cta script include, WhatsApp prefill on the sticky bar, footer/lang-switch contrast fixes, hamburger touch-target fix, `<main>` landmark, mobile-menu accessibility parity fix (with the regression noted above caught and corrected).
- **`for-agencies.html`, `ru/for-agencies.html`**: sticky-cta script include, footer/lang-switch contrast fixes, hamburger touch-target fix, `<main>` landmark (English only — `ru/for-agencies.html` did not need one, it already had it), mobile-menu accessibility parity fix (WhatsApp prefill already present on the English page from an earlier phase).
- **`journal.html` + its `cs`/`ru`/`fr`/`es` variants**: footer/lang-switch/blog-card-date contrast fixes, hamburger touch-target fix, mobile-menu accessibility parity fix.
- **`privacy-policy.html`**: footer/lang-switch contrast fix, hamburger touch-target fix, mobile-menu accessibility parity fix, section-number contrast fix, and standardization of three body links (including one previously-unstyled bare link rendering in browser-default blue) to a consistent, underlined, sufficiently-contrasting style.
- **All other 65 files** (`journal.html`, `privacy-policy.html`, all EN/FR/RU/ES/CS blog articles and `for-agencies`/`journal` language variants): sticky-cta script include where a sticky bar exists, footer/lang-switch contrast fixes, lang-switch `aria-label` fix, hamburger touch-target fix. No hero rebuild needed on these pages (they don't use the full-bleed `.hero` pattern).

Total: **83 files touched across two commits** (80 modified + 3 new in the first commit; 16 further files modified in a second commit for the mobile-menu parity fix, `<main>` landmarks, and additional contrast fixes described above) — every file reviewed in full via `git diff` before each commit; no unrelated changes included.

## 14. Tests performed

- Chromium (Playwright, headless): all 10 required routes at 320×568, 360×800, 375×667, 375×812, 390×844, 430×932, 768×1024, 1024×768, 1280×800, 1440×900, 1920×1080 — zero unexpected horizontal overflow, zero console errors. Re-run twice more after the second round of accessibility fixes, with identical clean results.
- WebKit (Playwright, headless): all 10 required routes at 390×844 — zero console errors, zero overflow; mobile hero and sticky-CTA behavior re-verified visually and via state assertions.
- **Interaction/runtime-error test** (this is what caught the regression in §9): on `work-with-me.html` and `virtual-shoots.html`, scrolled to the bottom to trigger scroll-reveal, then clicked the final CTA and asserted zero `pageerror`/console errors and that all `.reveal` elements reached `.visible` — used both to catch the original regression and to confirm the fix.
- Mobile menu: open/close, `aria-expanded` sync, `inert` containment of background content, Escape-to-close + focus return — all pass, unchanged from Phase 5.
- Keyboard navigation: Tab order, `:focus-visible` rendering — pass.
- Reduced motion: hero fully painted at 500ms under `prefers-reduced-motion: reduce` — pass, unchanged.
- 200% text zoom (desktop, 1280×800): zero horizontal overflow.
- Touch targets: hero primary CTA 46px, hero secondary CTA 44px, sticky-bar buttons 44px, hamburger 46×45px — all meet the 44×44 minimum.
- Hero tagline contrast: reconfirmed ≥4.5:1 on the English homepage (unchanged property) and newly verified 8.3–11.4:1 on the four translated homepages.
- Lighthouse: performance/accessibility/best-practices/SEO on the homepage, before and after (§11).
- Link/asset validation: no new 404s or failed requests introduced (the one "failed request" seen in every route's sweep is the real Google Analytics collect beacon being blocked by this sandboxed test environment's network egress — not a site defect).

## 15. Responsive test matrix (summary)

All 10 required routes × 11 required viewports: **zero unexpected horizontal overflow**, with one documented pre-existing exception below.

## 16. Known, non-blocking limitations

- A **pre-existing** ~0.9px horizontal overflow from the footer language-switcher button, present at 320px width on blog article pages, predates this implementation (confirmed via `git diff` showing zero changes to the relevant markup/CSS on an affected file) and is sub-pixel/imperceptible. Not fixed in this pass to avoid unnecessary risk to 60+ files for a non-visible, non-functional issue; flagged here for visibility rather than silently left out.
- The footer language-switcher button's own touch target (~57×26px) remains below 44×44px. It is a secondary, low-frequency utility control (not a primary CTA), and this pass prioritized the mobile hero and primary conversion CTAs explicitly named in the brief. Left as a flagged, non-blocking item rather than expanded into a broader footer redesign.
- Local Lighthouse performance numbers show normal run-to-run variance (89–93) on the unthrottled local static server; a production re-measurement was taken after deployment (§18) as the authoritative figure.

## 16a. QA contact sheet

One optimised before/after contact sheet is committed at [`docs/qa/mobile-hero-before-after.jpg`](qa/mobile-hero-before-after.jpg) (this repo had no pre-existing QA-documentation convention, so a new `docs/qa/` folder was created) — it shows the homepage hero at 320×568, 375×812, and 390×844 before (commit `877cc8f`) and after this implementation, side by side.

## 17. GitHub / deployment

See the completion report below for final commit list, rollback tag, and deployment identity — recorded after the testing gate passed and deployment completed.
