# Handoff: implementation brief of 21 October 2026

Branch: `brief-2026-10-21` (not merged, nothing deployed to production).
Previews: https://brief-2026-10-21.photoczaro.pages.dev (main site) and
https://brief-2026-10-21.photoczaro-models.pages.dev (Models).

## What was done, per item

| # | Item | Result |
|---|---|---|
| 1 | Responsive model images | Every roster photo now has WebP versions at up to 320/640/960/1280/1600 px (never upscaled; EXIF orientation baked in, metadata stripped). `srcset` + measured `sizes` + intrinsic width/height on cards, hero, gallery, related, shortlist thumbnails and the social image |
| 2 | Cache freshness | Derived files and all new uploads are content-hashed. Replacing a photo changes its URL; unchanged photos keep theirs. Originals and old URLs untouched |
| 3 | Initial HTML language/direction | Server sets `lang`, `dir` (and `rtl` class for Arabic) for every translated page, including the 45 profile pages that returned `lang="en"` |
| 4 | Profile data | Tasneem: `Hindia` -> `Hindi`, skills `Runway, Commercial, Speaking roles, Acting`, the supporting statement kept as an optional approved line. Empty optional rows hidden; a value of 0 is treated as a value |
| 5 | Alt text / names | 17 magazine pages, Kseniia's cover and 12 Virtual Shoots images described from the actual photographs; numbered frames now read "name, feature, photo 3 of 7"; every expander has a distinct accessible name; gallery lightbox no longer gives every frame the cover's alt |
| 6 | Publications | First six shown; the other 13 behind an accessible "Show all publications" disclosure (all five language homepages) |
| 7 | Booking form | Same form/endpoint/payload; essentials first; optional details in a native `<details>` group; auto-opens and focuses on an error inside it; the "not a confirmed booking, usage and fees agreed first" note is visible |
| 8 | Apply link | Added to the desktop Models navigation (the mobile menu already had it) with tightened spacing between 901 and 1499 px so six links fit |
| 9 | Founder intro | About intro names Hatim Champeli, Dubai-based, available across the UAE (5 languages) |

Also: failed-submission log (earlier), privacy-safe submission events (`booking_enquiry_attempt/success/error`, `application_attempt/success/error`, counts and codes only, consent-gated).

## Tools and tests added
- `docs/tools/derive_model_images.py`: creates/uploads/records the image versions for existing models
- `docs/tools/tests/admin-image-handlers.test.mjs`: 14 checks on the upload/variant/delete handlers
- `docs/tools/tests/translated-profile-lang-dir.sh`: route-wide `lang`/`dir` assertion

## Data changes made outside the branch
Production KV/R2 data is shared with previews, so these are live (additive or the
explicitly requested fix):
- R2: 257 new derived files (new names; originals untouched)
- KV: `imageSets` added to all 9 model records (ignored by the current production code)
- KV: Tasneem's languages/skills corrected and a statement line added
Backups: `~/Desktop/photoczaro-backups-2026-10-21/` (outside the repo; contains admin-only fields).

## Not verified
- iPhone Safari and Android Chrome (only the in-app browser's emulation was used)
- DPR 1 (the test browser runs at DPR 2)
- Admin screens (behind Cloudflare Access); their server handlers are tested with a fake store
- Application analytics events end-to-end (needs real photo uploads)
- Cumulative Layout Shift and other Core Web Vitals (not measured)
- Reduced-motion rendering (rules exist; not exercised)
