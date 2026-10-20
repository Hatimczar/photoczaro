import { json } from "../../../../_lib/http.js";
import { requireAccessIdentity } from "../../../../_lib/admin-auth.js";
import { requireSameOrigin } from "../../../../_lib/origin-check.js";
import { validateImageUpload } from "../../../../_lib/image-validate.js";

const EXT_FOR_TYPE = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

// First 8 hex characters of the SHA-256 of the file's bytes. Used in the
// stored file name, so replacing a photograph always changes its URL and an
// unchanged one keeps the same (cacheable) URL.
async function hash8(buffer) {
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return [...new Uint8Array(digest)].slice(0, 4).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function onRequestPost({ request, env, params }) {
  if (!requireSameOrigin(request)) return json({ error: "Cross-origin request blocked." }, 403);
  const actor = await requireAccessIdentity(request);
  if (!actor) return json({ error: "Unauthorized" }, 401);
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

  const validation = await validateImageUpload(file);
  if (!validation.ok) return json({ error: validation.error }, 400);
  const ext = EXT_FOR_TYPE[validation.contentType];

  const images = model.images || {};
  const imageSets = model.imageSets && typeof model.imageSets === "object" ? model.imageSets : {};
  const bytes = await file.arrayBuffer();
  const h = await hash8(bytes);
  let key;

  if (["headshot", "fullFront", "fullSide"].includes(slot)) {
    key = `models/${params.slug}/${slot}.${h}.${ext}`;
    await env.MEDIA.put(key, bytes, { httpMetadata: { contentType: validation.contentType } });
    const previous = images[slot];
    images[slot] = key;
    if (previous && previous !== key) delete imageSets[previous];   // the old photo's responsive set no longer applies
  } else {
    const gallery = images.gallery || [];
    key = `models/${params.slug}/gallery-${h}.${ext}`;
    await env.MEDIA.put(key, bytes, { httpMetadata: { contentType: validation.contentType } });
    if (!gallery.includes(key)) gallery.push(key);
    images.gallery = gallery;
  }
  model.imageSets = imageSets;

  model.images = images;
  model.updatedAt = new Date().toISOString();
  const history = Array.isArray(model.history) ? model.history : [];
  history.push({ action: `image_uploaded:${slot}`, actor, at: model.updatedAt });
  model.history = history.slice(-50);
  await env.ROSTER_KV.put(`model:${params.slug}`, JSON.stringify(model));
  return json({ ok: true, model, key });
}

export async function onRequestDelete({ request, env, params }) {
  if (!requireSameOrigin(request)) return json({ error: "Cross-origin request blocked." }, 403);
  const actor = await requireAccessIdentity(request);
  if (!actor) return json({ error: "Unauthorized" }, 401);
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

  if (env.MEDIA) {
    await env.MEDIA.delete(key);
    const set = model.imageSets && model.imageSets[key];
    if (set && set.v) {
      // Responsive versions are derived files; remove them with the photo.
      const base = key.replace(/\.[^./]+$/, "");
      const stem = base.endsWith("." + set.v) ? base : `${base}.${set.v}`;
      await Promise.all((set.widths || []).map((w) => env.MEDIA.delete(`${stem}-${w}.webp`).catch(() => {})));
    }
  }
  if (model.imageSets) delete model.imageSets[key];
  model.images = images;
  model.updatedAt = new Date().toISOString();
  const history = Array.isArray(model.history) ? model.history : [];
  history.push({ action: "image_removed", actor, at: model.updatedAt });
  model.history = history.slice(-50);
  await env.ROSTER_KV.put(`model:${params.slug}`, JSON.stringify(model));
  return json({ ok: true, model });
}
