/*
 * Admin-only proxy for R2 objects, used by the admin panel to display
 * application-review photos (private, under "applications/") and, for
 * convenience, published model images too. This route sits behind the
 * same Cloudflare Access application as the rest of /api/admin/*.
 */
import { requireAccessIdentity } from "../../../_lib/admin-auth.js";

export async function onRequestGet({ request, env, params }) {
  if (!requireAccessIdentity(request)) return new Response("Unauthorized", { status: 401 });

  const path = Array.isArray(params.path) ? params.path.join("/") : params.path || "";
  if (!env.MEDIA || (!path.startsWith("applications/") && !path.startsWith("models/"))) {
    return new Response("Not found", { status: 404 });
  }

  const object = await env.MEDIA.get(path);
  if (!object) return new Response("Not found", { status: 404 });

  return new Response(object.body, {
    headers: {
      "Content-Type": object.httpMetadata?.contentType || "application/octet-stream",
      "Cache-Control": "private, no-store",
    },
  });
}
