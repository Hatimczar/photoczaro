import { json } from "../../../_lib/http.js";
import { requireAccessIdentity } from "../../../_lib/admin-auth.js";
import { requireSameOrigin } from "../../../_lib/origin-check.js";
import Render from "../../../../js/render.js";

// "published" is deliberately excluded here: it's a guarded, validated
// action of its own now (see [slug]/publish.js), not one field among many
// in a bulk save.
const EDITABLE_FIELDS = [
  "name", "status", "categories", "subcategories", "newFace", "featured",
  "location", "height", "measurementUnit", "bust", "waist", "hips", "neck", "chest",
  "sleeve", "inseam", "measurements",
  "shoeSize", "shoeSystem", "clothingSize", "clothingSystem", "trouserSize", "trouserSystem", "hair", "eyes", "languages", "skills",
  "displayOrder", "swatch", "seoTitle", "seoDescription",
];

export async function onRequestGet({ request, env, params }) {
  if (!(await requireAccessIdentity(request))) return json({ error: "Unauthorized" }, 401);
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
  if (!requireSameOrigin(request)) return json({ error: "Cross-origin request blocked." }, 403);
  const actor = await requireAccessIdentity(request);
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

  for (const field of EDITABLE_FIELDS) {
    if (field in body) model[field] = body[field];
  }
  // Sizes are short labels in a fixed set of sizing systems.
  const SYSTEMS = { shoeSystem: ["EU", "UK", "US"], clothingSystem: ["EU", "UK", "US", "SML"], trouserSystem: ["EU", "UK", "US", "WAIST_IN"] };
  for (const f of ["shoeSize", "clothingSize", "trouserSize"]) if (f in body) model[f] = String(body[f] || "").trim().slice(0, 12);
  for (const [f, allowed] of Object.entries(SYSTEMS)) if (f in body) model[f] = allowed.includes(body[f]) ? body[f] : "";
  // One stored spelling per city ("Dubai, UAE"), whatever was typed, so the
  // roster's location filter and the profile pages always agree.
  if ("location" in body) model.location = Render.canonicalLocation(body.location);
  model.updatedAt = new Date().toISOString();
  pushHistory(model, { action: "edited", actor, at: model.updatedAt });

  await env.ROSTER_KV.put(`model:${params.slug}`, JSON.stringify(model));
  return json({ ok: true, model });
}

// Soft delete: the profile is unpublished and hidden from the default admin
// list, but the record and its R2 images are kept so it can be restored.
// There is deliberately no hard-delete path here; see functions/api/admin/
// models/[slug]/restore.js for the reverse action.
export async function onRequestDelete({ request, env, params }) {
  if (!requireSameOrigin(request)) return json({ error: "Cross-origin request blocked." }, 403);
  const actor = await requireAccessIdentity(request);
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
