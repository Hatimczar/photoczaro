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

export async function onRequestPut({ request, env, params }) {
  if (!requireAccessIdentity(request)) return json({ error: "Unauthorized" }, 401);
  const model = await env.ROSTER_KV?.get(`model:${params.slug}`, { type: "json" });
  if (!model) return json({ error: "Not found" }, 404);

  let body = {};
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid request body." }, 400);
  }

  for (const field of EDITABLE_FIELDS) {
    if (field in body) model[field] = body[field];
  }
  model.updatedAt = new Date().toISOString();

  await env.ROSTER_KV.put(`model:${params.slug}`, JSON.stringify(model));
  return json({ ok: true, model });
}

export async function onRequestDelete({ request, env, params }) {
  if (!requireAccessIdentity(request)) return json({ error: "Unauthorized" }, 401);
  const model = await env.ROSTER_KV?.get(`model:${params.slug}`, { type: "json" });
  if (!model) return json({ error: "Not found" }, 404);

  if (env.MEDIA && model.images) {
    await Promise.all(Object.values(model.images).flatMap((v) => {
      const keys = Array.isArray(v) ? v : [v];
      return keys.filter(Boolean).map((key) => env.MEDIA.delete(key));
    }));
  }

  await env.ROSTER_KV.delete(`model:${params.slug}`);
  return json({ ok: true });
}
