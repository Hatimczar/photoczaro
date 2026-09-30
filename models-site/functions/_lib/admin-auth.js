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
export function requireAccessIdentity(request) {
  const email = request.headers.get("Cf-Access-Authenticated-User-Email");
  if (!email) return null;
  return email.trim().toLowerCase();
}
