/*
 * /admin* and /api/admin* sit behind a Cloudflare Access application, but
 * Access does NOT inject a plain "Cf-Access-Authenticated-User-Email"
 * header for a Pages-hosted origin to blindly trust - it only attaches
 * Cf-Access-Jwt-Assertion, a signed JWT, and the origin is expected to
 * verify that signature itself against Access's published public keys
 * before trusting anything inside it:
 * https://developers.cloudflare.com/cloudflare-one/identity/authorization-cookie/validating-json/
 *
 * TEAM_DOMAIN and EXPECTED_AUD are specific to the "Photoczaro Models
 * Admin" Access application (Zero Trust dashboard -> Access -> Applications
 * -> that app -> Overview shows the AUD tag). If that application is ever
 * deleted and recreated, both of these need updating to match.
 */
const TEAM_DOMAIN = "rough-resonance-1fb6.cloudflareaccess.com";
const CERTS_URL = `https://${TEAM_DOMAIN}/cdn-cgi/access/certs`;
const EXPECTED_AUD = "03b24a691d863020322e03107e4165e796d92d3b73efc1a944429a62a90729df";
const KEYS_TTL_MS = 60 * 60 * 1000;

// Cached across requests within the same Worker isolate; Access rotates
// signing keys infrequently, so refetching on every request would be pure
// waste. Worst case a rotation takes up to an hour to be picked up here,
// which just means a login retried within that window still works fine
// (old key removed from the JWKS response would fail verification, but a
// freshly rotated-in key not yet cached would too - the TTL bounds that).
let cachedKeys = null;

function base64UrlToBytes(b64url) {
  const padded = b64url + "=".repeat((4 - (b64url.length % 4)) % 4);
  const raw = atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

function base64UrlDecodeJson(b64url) {
  return JSON.parse(new TextDecoder().decode(base64UrlToBytes(b64url)));
}

async function getSigningKeys() {
  if (cachedKeys && Date.now() - cachedKeys.fetchedAt < KEYS_TTL_MS) return cachedKeys.keys;
  const res = await fetch(CERTS_URL);
  if (!res.ok) throw new Error("Failed to fetch Access signing keys.");
  const { keys } = await res.json();
  const imported = new Map();
  for (const jwk of keys) {
    const key = await crypto.subtle.importKey(
      "jwk",
      jwk,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["verify"]
    );
    imported.set(jwk.kid, key);
  }
  cachedKeys = { fetchedAt: Date.now(), keys: imported };
  return imported;
}

export async function requireAccessIdentity(request) {
  const token = request.headers.get("Cf-Access-Jwt-Assertion");
  if (!token) return null;

  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [headerB64, payloadB64, signatureB64] = parts;

  let header, payload;
  try {
    header = base64UrlDecodeJson(headerB64);
    payload = base64UrlDecodeJson(payloadB64);
  } catch {
    return null;
  }

  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.exp !== "number" || payload.exp < now) return null;
  if (typeof payload.nbf === "number" && payload.nbf > now) return null;
  const aud = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!aud.includes(EXPECTED_AUD)) return null;

  let keys;
  try {
    keys = await getSigningKeys();
  } catch {
    return null;
  }
  const key = keys.get(header.kid);
  if (!key) return null;

  const valid = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    key,
    base64UrlToBytes(signatureB64),
    new TextEncoder().encode(`${headerB64}.${payloadB64}`)
  );
  if (!valid) return null;
  if (!payload.email) return null;

  return payload.email.trim().toLowerCase();
}
