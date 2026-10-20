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

// Responsive-image metadata for the photos a profile actually shows.
function publicImageSets(m) {
  const images = m.images || {};
  const keys = [images.headshot, images.fullFront, images.fullSide, ...(Array.isArray(images.gallery) ? images.gallery : [])].filter(Boolean);
  const out = {};
  for (const k of keys) {
    const s = m.imageSets && m.imageSets[k];
    if (!s || !/^[0-9a-f]{8}$/.test(String(s.v || ""))) continue;
    const widths = (Array.isArray(s.widths) ? s.widths : []).map(Number).filter((n) => Number.isInteger(n) && n >= 16 && n <= 4000).sort((a, b) => a - b);
    if (!widths.length) continue;
    out[k] = { v: s.v, w: Number(s.w) || 0, h: Number(s.h) || 0, widths };
  }
  return out;
}

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
    measurementUnit: m.measurementUnit === "in" ? "in" : "cm",
    bust: clean(m.bust), waist: clean(m.waist), hips: clean(m.hips),
    shoeSize: clean(m.shoeSize), shoeSystem: clean(m.shoeSystem),
    clothingSize: clean(m.clothingSize), clothingSystem: clean(m.clothingSystem),
    trouserSize: clean(m.trouserSize), trouserSystem: clean(m.trouserSystem),
    chest: clean(m.chest), neck: clean(m.neck), sleeve: clean(m.sleeve), inseam: clean(m.inseam),
    bio: clean(m.bio).slice(0, 300),
    hair: clean(m.hair),
    eyes: clean(m.eyes),
    languages: cleanList(m.languages),
    skills: cleanList(m.skills),
    displayOrder: m.displayOrder ?? 999,
    cardFocus: /^\d{1,3}% \d{1,3}%$/.test(clean(m.cardFocus)) ? clean(m.cardFocus) : "",
    swatch: Array.isArray(m.swatch) && m.swatch.length >= 2 ? m.swatch : ["#2b2621", "#14120f"],
    images: {
      headshot: images.headshot || null,
      fullFront: images.fullFront || null,
      fullSide: images.fullSide || null,
      gallery: Array.isArray(images.gallery) ? images.gallery.filter(Boolean) : [],
    },
    imageSets: publicImageSets(m),
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
