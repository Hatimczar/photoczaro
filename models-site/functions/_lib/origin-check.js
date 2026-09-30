// Lightweight CSRF/cross-site defense for state-changing admin requests.
// Cloudflare Access's session cookie is sent by the browser on requests to
// this domain regardless of what site initiated them, so a same-origin
// check on top of the Access identity check stops a third-party page from
// silently issuing a POST/PUT/DELETE against these endpoints using an
// admin's existing session. Browsers set the Origin header on every
// cross-origin request and on most same-origin non-GET requests, so a
// request with no Origin header at all is treated as same-origin (plain
// same-origin fetches from the admin SPA itself commonly omit it), while a
// present Origin header must match this request's own origin exactly.
export function requireSameOrigin(request) {
  const origin = request.headers.get("Origin");
  if (!origin) return true;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}
