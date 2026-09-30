import { json } from "../../../_lib/http.js";
import { requireAccessIdentity } from "../../../_lib/admin-auth.js";
import { requireSameOrigin } from "../../../_lib/origin-check.js";
import { slugify, uniqueSlug } from "../../../_lib/slug.js";

export async function onRequestGet({ request, env }) {
  if (!(await requireAccessIdentity(request))) return json({ error: "Unauthorized" }, 401);
  if (!env.ROSTER_KV) return json([]);

  const url = new URL(request.url);
  const includeArchived = url.searchParams.get("includeArchived") === "true";

  const list = await env.ROSTER_KV.list({ prefix: "model:" });
  const records = await Promise.all(list.keys.map((k) => env.ROSTER_KV.get(k.name, { type: "json" })));
  const models = records
    .filter(Boolean)
    .filter((m) => includeArchived || !m.archived)
    .sort((a, b) => (a.displayOrder ?? 999) - (b.displayOrder ?? 999));
  return json(models);
}

export async function onRequestPost({ request, env }) {
  if (!requireSameOrigin(request)) return json({ error: "Cross-origin request blocked." }, 403);
  const actor = await requireAccessIdentity(request);
  if (!actor) return json({ error: "Unauthorized" }, 401);

  let body = {};
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid request body." }, 400);
  }

  const name = (body.name || "").toString().trim();
  const category = (body.category || "women").toString();
  if (!name) return json({ error: "name is required." }, 400);

  const list = await env.ROSTER_KV.list({ prefix: "model:" });
  const roster = (await Promise.all(list.keys.map((k) => env.ROSTER_KV.get(k.name, { type: "json" })))).filter(Boolean);
  const slug = await uniqueSlug(slugify(name), roster);

  const model = {
    slug,
    name,
    sample: false,
    status: "active",
    published: false,
    categories: [category],
    subcategories: [],
    newFace: true,
    featured: false,
    location: "UAE",
    height: "",
    measurementUnit: "cm",
    bust: "",
    waist: "",
    hips: "",
    neck: "",
    chest: "",
    sleeve: "",
    inseam: "",
    measurements: "",
    hair: "",
    eyes: "",
    languages: [],
    skills: [],
    displayOrder: roster.length + 1,
    swatch: ["#2b2621", "#14120f"],
    images: {},
    seoTitle: `${name} | Photoczaro Models Dubai`,
    seoDescription: `${name}, a Photoczaro Models roster talent based in the UAE.`,
    archived: false,
    history: [{ action: "created", actor, at: new Date().toISOString() }],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await env.ROSTER_KV.put(`model:${slug}`, JSON.stringify(model));
  return json({ ok: true, slug });
}
