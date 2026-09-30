/*
 * Public read-only proxy for PUBLISHED model images only. R2 buckets are
 * private by default (no public bucket domain is configured), so this is
 * the one path allowed to serve objects under the "models/" prefix.
 * Application-review uploads live under "applications/" and are never
 * reachable here — only through /api/admin/media/*, which sits behind
 * Cloudflare Access.
 */
export async function onRequestGet({ env, params }) {
  const path = Array.isArray(params.path) ? params.path.join("/") : params.path || "";
  if (!path.startsWith("models/")) {
    return new Response("Not found", { status: 404 });
  }
  if (!env.MEDIA) return new Response("Not found", { status: 404 });

  const object = await env.MEDIA.get(path);
  if (!object) return new Response("Not found", { status: 404 });

  return new Response(object.body, {
    headers: {
      "Content-Type": object.httpMetadata?.contentType || "application/octet-stream",
      "Cache-Control": "public, max-age=31536000, immutable",
      ETag: object.httpEtag,
    },
  });
}
