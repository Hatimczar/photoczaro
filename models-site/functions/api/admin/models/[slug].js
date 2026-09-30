import { json } from "../../../_lib/http.js";
import { requireAccessIdentity } from "../../../_lib/admin-auth.js";

const EDITABLE_FIELDS = [
  "name", "status", "published", "categories", "subcategories", "newFace", "featured",
  "location", "height", "measurementUnit", "bust", "waist", "hips", "neck", "chest",
  "sleeve", "inseam", "measurements", "hair", "eyes", "languages", "skills",
  "displayOrder", "swatch", "seoTitle", "seoDescription",
];

export async function onRequestGet({ request, env, params }) {
  if (!requireAccessIdentity(request)) return json({ error: "Unauthorized" }, 401);
  const model = await env.ROSTER_KV?.get(`model:${params.slug}`, { type: "json" });
  if (!model) return json({ error: "Not found" }, 404);
  return json(model);
}

function pushHistory(model, entry) {
  const history = Array.isArray(model.history) ? model.history : [];
  history.push(entry);
  model.history = history.slice(-50);
}

export async function onRequestPut({ request, env, params }) {
  const actor = requireAccessIdentity(request);
  if (!actor) return json({ error: "Unauthorized" }, 401);
  const model = await env.ROSTER_KV?.get(`model:${params.slug}`, { type: "json" });
  if (!model) return json({ error: "Not found" }, 404);
  if (model.archived) return json({ error: "This model is archived. Restore it before editing." }, 409);

  let body = {};
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid request body." }, 400);
  }

  const wasPublished = !!model.published;
  for (const field of EDITABLE_FIELDS) {
    if (field in body) model[field] = body[field];
  }
  model.updatedAt = new Date().toISOString();

  if ("published" in body && !!body.published !== wasPublished) {
    pushHistory(model, { action: body.published ? "published" : "unpublished", actor, at: model.updatedAt });
  } else {
    pushHistory(model, { action: "edited", actor, at: model.updatedAt });
  }

  await env.ROSTER_KV.put(`model:${params.slug}`, JSON.stringify(model));
  return json({ ok: true, model });
}

// Soft delete: the profile is unpublished and hidden from the default admin
// list, but the record and its R2 images are kept so it can be restored.
// There is deliberately no hard-delete path here; see functions/api/admin/
// models/[slug]/restore.js for the reverse action.
export async function onRequestDelete({ request, env, params }) {
  const actor = requireAccessIdentity(request);
  if (!actor) return json({ error: "Unauthorized" }, 401);
  const model = await env.ROSTER_KV?.get(`model:${params.slug}`, { type: "json" });
  if (!model) return json({ error: "Not found" }, 404);

  model.archived = true;
  model.published = false;
  model.archivedAt = new Date().toISOString();
  model.archivedBy = actor;
  model.updatedAt = model.archivedAt;
  pushHistory(model, { action: "archived", actor, at: model.archivedAt });

  await env.ROSTER_KV.put(`model:${params.slug}`, JSON.stringify(model));
  return json({ ok: true, archived: true });
}
