import { json } from "../../../../_lib/http.js";
import { requireAccessIdentity } from "../../../../_lib/admin-auth.js";

const MAX_BYTES = 8 * 1024 * 1024;

export async function onRequestPost({ request, env, params }) {
  if (!requireAccessIdentity(request)) return json({ error: "Unauthorized" }, 401);
  const model = await env.ROSTER_KV?.get(`model:${params.slug}`, { type: "json" });
  if (!model) return json({ error: "Not found" }, 404);
  if (!env.MEDIA) return json({ error: "Media storage not configured." }, 500);

  let form;
  try {
    form = await request.formData();
  } catch {
    return json({ error: "Invalid request." }, 400);
  }

  const file = form.get("image");
  const slot = (form.get("slot") || "").toString();
  if (!file || typeof file !== "object" || !("size" in file) || file.size === 0) {
    return json({ error: "No file provided." }, 400);
  }
  if (file.size > MAX_BYTES) return json({ error: "File exceeds the 8MB limit." }, 400);

  const ext = (file.name || "").split(".").pop()?.toLowerCase().slice(0, 8) || "jpg";
  const images = model.images || {};

  if (["headshot", "fullFront", "fullSide"].includes(slot)) {
    const key = `models/${params.slug}/${slot}.${ext}`;
    await env.MEDIA.put(key, file.stream(), { httpMetadata: { contentType: file.type || "application/octet-stream" } });
    images[slot] = key;
  } else {
    const gallery = images.gallery || [];
    const key = `models/${params.slug}/gallery-${Date.now()}.${ext}`;
    await env.MEDIA.put(key, file.stream(), { httpMetadata: { contentType: file.type || "application/octet-stream" } });
    gallery.push(key);
    images.gallery = gallery;
  }

  model.images = images;
  model.updatedAt = new Date().toISOString();
  await env.ROSTER_KV.put(`model:${params.slug}`, JSON.stringify(model));
  return json({ ok: true, model });
}

export async function onRequestDelete({ request, env, params }) {
  if (!requireAccessIdentity(request)) return json({ error: "Unauthorized" }, 401);
  const model = await env.ROSTER_KV?.get(`model:${params.slug}`, { type: "json" });
  if (!model) return json({ error: "Not found" }, 404);

  const url = new URL(request.url);
  const key = url.searchParams.get("key");
  if (!key) return json({ error: "key query param is required." }, 400);

  const images = model.images || {};
  let found = false;
  for (const [field, value] of Object.entries(images)) {
    if (Array.isArray(value)) {
      const idx = value.indexOf(key);
      if (idx !== -1) {
        value.splice(idx, 1);
        found = true;
      }
    } else if (value === key) {
      images[field] = null;
      found = true;
    }
  }
  if (!found) return json({ error: "Image key not found on this model." }, 404);

  if (env.MEDIA) await env.MEDIA.delete(key);
  model.images = images;
  model.updatedAt = new Date().toISOString();
  await env.ROSTER_KV.put(`model:${params.slug}`, JSON.stringify(model));
  return json({ ok: true, model });
}
