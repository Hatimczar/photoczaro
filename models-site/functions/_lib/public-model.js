/*
 * The one place that decides which fields of a roster record are public.
 * Everything that leaves the server for visitors (the /api/models feed, the
 * server-rendered roster and profile pages) goes through toPublicModel(), so
 * admin-only data (edit history with reviewer emails, the source application
 * id, individual measurements, the raw portfolio upload) never reaches the
 * browser or a crawler. Add a field here only if it is safe to publish.
 */
import Render from "../../js/render.js";

const clean = (s) => String(s == null ? "" : s).replace(/\s+/g, " ").trim();
const cleanList = (arr) => (Array.isArray(arr) ? arr : []).map(clean).filter(Boolean);

export function toPublicModel(m) {
  const images = m.images || {};
  return {
    slug: m.slug,
    name: clean(m.name),
    sample: !!m.sample,
    status: m.status,
    categories: Array.isArray(m.categories) ? m.categories : [],
    subcategories: Array.isArray(m.subcategories) ? m.subcategories : [],
    newFace: !!m.newFace,
    featured: !!m.featured,
    location: Render.canonicalLocation(m.location),
    height: clean(m.height),
    measurements: clean(m.measurements),
    hair: clean(m.hair),
    eyes: clean(m.eyes),
    languages: cleanList(m.languages),
    skills: cleanList(m.skills),
    displayOrder: m.displayOrder ?? 999,
    swatch: Array.isArray(m.swatch) && m.swatch.length >= 2 ? m.swatch : ["#2b2621", "#14120f"],
    images: {
      headshot: images.headshot || null,
      fullFront: images.fullFront || null,
      fullSide: images.fullSide || null,
      gallery: Array.isArray(images.gallery) ? images.gallery.filter(Boolean) : [],
    },
    seoTitle: m.seoTitle || `${clean(m.name)} | Photoczaro Models Dubai`,
    seoDescription: m.seoDescription || "",
  };
}

export async function loadPublishedModels(env) {
  if (!env.ROSTER_KV) return [];
  const list = await env.ROSTER_KV.list({ prefix: "model:" });
  const records = await Promise.all(list.keys.map((k) => env.ROSTER_KV.get(k.name, { type: "json" })));
  return records
    .filter((m) => m && m.published && !m.archived)
    .sort((a, b) => (a.displayOrder ?? 999) - (b.displayOrder ?? 999))
    .map(toPublicModel);
}
