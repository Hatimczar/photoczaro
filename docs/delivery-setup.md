# Private Image/Video Delivery

Private, per-model delivery of photos and videos at `photoczaro.com/delivery/<id>`; admin at `photoczaro.com/delivery-admin`.

## How it works
- **Link only, no code or login.** Send the model the private link; whoever holds it can open the delivery. The link carries 128 bits of randomness and is never listed, indexed or cached, so treat it like a private key. Use an expiry date to limit how long it works, and delete a delivery at any time.
- **Download all as ZIP**: once released, the model gets one ZIP of every original, streamed from R2 (no compression, exact size announced up front). The admin's browser records each file's CRC-32 at upload so the server does no hashing. Limit: about 4 GB per ZIP; larger deliveries fall back to per-file downloads.
- Admin creates a delivery (model name, title, expiry, release now or later), uploads files, copies the private link and sends it to the model.
- The model opens the link and sees their gallery straight away.
- Images show watermarked previews (made in the admin's browser) until the delivery is **released**; videos show a watermarked poster frame. Releasing unlocks full-resolution originals and downloads.
- Canon CR2 and Nikon NEF files are supported. The browser cannot display RAW, so the admin builds the watermarked preview from the full-size JPEG embedded in the RAW file (orientation applied). The RAW itself is uploaded in parts (up to 200 MB) and stays locked until release; the model downloads the untouched original.
- Nothing is public: files live in a private R2 bucket and are streamed by Functions only after a session check. Delivery ids are 128-bit random. Pages are `noindex`, `no-store`, disallowed in robots.txt and absent from the sitemap.

## One-time setup
1. KV namespace `DELIVERY_KV` is created and bound in `wrangler.toml`.
2. Create R2 bucket `photoczaro-deliveries` (Cloudflare dashboard > R2, public access OFF), then uncomment the `[[r2_buckets]]` block in `wrangler.toml` and push. Do not push the binding before the bucket exists: the Pages deploy fails.
3. Pages project `photoczaro` needs the existing secrets `ADMIN_PASSWORD` and `SESSION_SECRET` (already used by the publishers admin).

## Files
- `functions/_lib/delivery.js` shared helpers
- `functions/delivery/[id].js` model-facing page
- `functions/api/delivery/*` manifest, file streaming, ZIP
- `functions/api/delivery-admin/*` admin API (cookie `pcz_admin_session`)
- `delivery-admin/index.html` admin UI
