# Private Image/Video Delivery

Private, per-model delivery of photos and videos at `photoczaro.com/delivery/<id>`; admin at `photoczaro.com/delivery-admin`.

## How it works
- Admin creates a delivery (model name, model email, title, expiry), uploads files, copies the private link and sends it to the model.
- The model opens the link, enters the email on file, receives a 6-digit code (valid 10 min, single use, 5 attempts) and sees only their own delivery.
- Images show watermarked previews (made in the admin's browser) until the delivery is **released**; videos show a watermarked poster frame. Releasing unlocks full-resolution originals and downloads.
- Canon CR2 and Nikon NEF files are supported. The browser cannot display RAW, so the admin builds the watermarked preview from the full-size JPEG embedded in the RAW file (orientation applied). The RAW itself is uploaded in parts (up to 200 MB) and stays locked until release; the model downloads the untouched original.
- Nothing is public: files live in a private R2 bucket and are streamed by Functions only after a session check. Delivery ids are 128-bit random. Pages are `noindex`, `no-store`, disallowed in robots.txt and absent from the sitemap.

## One-time setup
1. KV namespace `DELIVERY_KV` is created and bound in `wrangler.toml`.
2. Create R2 bucket `photoczaro-deliveries` (Cloudflare dashboard > R2, public access OFF), then uncomment the `[[r2_buckets]]` block in `wrangler.toml` and push. Do not push the binding before the bucket exists: the Pages deploy fails.
3. Pages project `photoczaro` needs the existing secrets `ADMIN_PASSWORD` and `SESSION_SECRET` (already used by the publishers admin).
4. Optional, for emailed codes: add secret `RESEND_API_KEY` (and optionally `DELIVERY_FROM`, e.g. `Photoczaro <delivery@photoczaro.com>`) after verifying photoczaro.com in Resend. Without it, use "Generate a one-time code" in the admin and pass the code on personally.

## Files
- `functions/_lib/delivery.js`, `delivery-mail.js` shared helpers
- `functions/delivery/[id].js` model-facing page
- `functions/api/delivery/*` request-code, verify, manifest, file streaming
- `functions/api/delivery-admin/*` admin API (cookie `pcz_admin_session`)
- `delivery-admin/index.html` admin UI
