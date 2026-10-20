/*
 * Stores the responsive (resized WebP) versions of one of a model's photos.
 * The admin page makes them in the browser (it already has the decoded
 * image) and posts them here. Names follow js/render.js variantKey():
 *   <key without extension>.<hash of the source file's bytes>-<width>.webp
 * The hash is computed here from the stored source file, never trusted from
 * the browser, so the name always matches the photograph it was made from.
 */
import { json } from "../../../../_lib/http.js";
import { requireAccessIdentity } from "../../../../_lib/admin-auth.js";
import { requireSameOrigin } from "../../../../_lib/origin-check.js";
import { validateImageUpload } from "../../../../_lib/image-validate.js";

const MAX_VARIANTS = 6;
const MAX_WIDTH = 1600;

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
  try { form = await request.formData(); } catch { return json({ error: "Invalid request." }, 400); }

  const key = String(form.get("key") || "");
  const images = model.images || {};
  const owned = [images.headshot, images.fullFront, images.fullSide, ...(images.gallery || [])].filter(Boolean);
  if (!owned.includes(key) || !key.startsWith(`models/${params.slug}/`)) return json({ error: "Unknown image for this model." }, 400);

  const srcW = parseInt(form.get("sourceWidth"), 10);
  const srcH = parseInt(form.get("sourceHeight"), 10);
  if (!(srcW > 0 && srcW <= 12000 && srcH > 0 && srcH <= 12000)) return json({ error: "Source dimensions are required." }, 400);

  const source = await env.MEDIA.get(key);
  if (!source) return json({ error: "Source photograph not found." }, 404);
  const v = await hash8(await source.arrayBuffer());
  const base = key.replace(/\.[^./]+$/, "");

  const files = [...form.entries()].filter(([name, f]) => /^w\d+$/.test(name) && f && typeof f === "object" && "size" in f);
  if (!files.length || files.length > MAX_VARIANTS) return json({ error: `Send 1 to ${MAX_VARIANTS} versions.` }, 400);

  const widths = [];
  for (const [name, file] of files) {
    const w = parseInt(name.slice(1), 10);
    if (!(w >= 16 && w <= MAX_WIDTH)) return json({ error: `Unsupported width ${w}.` }, 400);
    const validation = await validateImageUpload(file);
    if (!validation.ok) return json({ error: validation.error }, 400);
    if (validation.contentType !== "image/webp") return json({ error: "Versions must be WebP." }, 400);
    await env.MEDIA.put(`${base}.${v}-${w}.webp`, await file.arrayBuffer(), { httpMetadata: { contentType: "image/webp" } });
    widths.push(w);
  }
  widths.sort((a, b) => a - b);

  model.imageSets = model.imageSets && typeof model.imageSets === "object" ? model.imageSets : {};
  model.imageSets[key] = { v, w: srcW, h: srcH, widths };
  model.updatedAt = new Date().toISOString();
  const history = Array.isArray(model.history) ? model.history : [];
  history.push({ action: "responsive_images_generated", actor, at: model.updatedAt });
  model.history = history.slice(-50);
  await env.ROSTER_KV.put(`model:${params.slug}`, JSON.stringify(model));
  return json({ ok: true, model, set: model.imageSets[key] });
}
