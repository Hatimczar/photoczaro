import { json } from "../../../../_lib/http.js";
import { requireAccessIdentity } from "../../../../_lib/admin-auth.js";
import { requireSameOrigin } from "../../../../_lib/origin-check.js";
import { publishReadiness } from "../../../../_lib/publish-check.js";

// Publishing is deliberately its own endpoint, separate from the generic
// PUT (see [slug].js, which no longer accepts "published" in its editable
// fields). That keeps "go live" as a single authorized, validated action
// instead of one checkbox among many in a large form save.
export async function onRequestPost({ request, env, params }) {
  if (!requireSameOrigin(request)) return json({ error: "Cross-origin request blocked." }, 403);
  const actor = requireAccessIdentity(request);
  if (!actor) return json({ error: "Unauthorized" }, 401);

  const model = await env.ROSTER_KV?.get(`model:${params.slug}`, { type: "json" });
  if (!model) return json({ error: "Not found" }, 404);
  if (model.archived) return json({ error: "Archived models cannot be published. Restore it first." }, 409);

  let body = {};
  try {
    body = await request.json();
  } catch {
    /* default to publish */
  }
  const publish = body.published !== false;

  if (publish) {
    const readiness = publishReadiness(model);
    if (!readiness.ready) {
      return json({ error: `Missing before publishing: ${readiness.missing.join(", ")}` }, 400);
    }
  }

  const now = new Date().toISOString();
  model.published = publish;
  model.updatedAt = now;
  const history = Array.isArray(model.history) ? model.history : [];
  history.push({ action: publish ? "published" : "unpublished", actor, at: now });
  model.history = history.slice(-50);

  await env.ROSTER_KV.put(`model:${params.slug}`, JSON.stringify(model));
  return json({ ok: true, model });
}
