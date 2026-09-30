import { json } from "../../../../_lib/http.js";
import { requireAccessIdentity } from "../../../../_lib/admin-auth.js";
import { requireSameOrigin } from "../../../../_lib/origin-check.js";

// Reverses the soft-delete in [slug].js's onRequestDelete. Restored models
// come back unpublished so an admin reviews them before they go live again.
export async function onRequestPost({ request, env, params }) {
  if (!requireSameOrigin(request)) return json({ error: "Cross-origin request blocked." }, 403);
  const actor = requireAccessIdentity(request);
  if (!actor) return json({ error: "Unauthorized" }, 401);
  const model = await env.ROSTER_KV?.get(`model:${params.slug}`, { type: "json" });
  if (!model) return json({ error: "Not found" }, 404);
  if (!model.archived) return json({ error: "This model is not archived." }, 409);

  const now = new Date().toISOString();
  model.archived = false;
  model.archivedAt = null;
  model.archivedBy = null;
  model.updatedAt = now;
  const history = Array.isArray(model.history) ? model.history : [];
  history.push({ action: "restored", actor, at: now });
  model.history = history.slice(-50);

  await env.ROSTER_KV.put(`model:${params.slug}`, JSON.stringify(model));
  return json({ ok: true, model });
}
