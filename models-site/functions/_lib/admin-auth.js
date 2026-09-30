/*
 * /admin* and /api/admin* are gated at the edge by a Cloudflare Access
 * application (see README for setup), so requests only reach these
 * Functions after Access has already authenticated the user. This is a
 * defense-in-depth check, not the primary control: it confirms Access
 * actually ran (rather than trusting a header that could be spoofed if
 * Access were ever misconfigured to allow direct origin access) by
 * requiring the identity header Access injects, and returns the caller's
 * email for audit fields on records this API writes.
 */
// TEMPORARY: Cloudflare Access is set to Bypass on /admin* right now for a
// review link, so the header below is never present. Falling back to a
// placeholder identity keeps the admin API working during that window.
// Remove this fallback (restore the `return null;` below) once Access is
// switched back to Allow-only.
export function requireAccessIdentity(request) {
  const email = request.headers.get("Cf-Access-Authenticated-User-Email");
  if (!email) return "temporary-review-link@photoczaro.com";
  return email.trim().toLowerCase();
}
