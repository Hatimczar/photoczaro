import { json } from "../../../_lib/http.js";
import { requireAccessIdentity } from "../../../_lib/admin-auth.js";
import { requireSameOrigin } from "../../../_lib/origin-check.js";
import { slugify, uniqueSlug } from "../../../_lib/slug.js";

export async function onRequestGet({ request, env, params }) {
  if (!requireAccessIdentity(request)) return json({ error: "Unauthorized" }, 401);
  const record = await getApplication(env, params.id);
  if (!record) return json({ error: "Not found" }, 404);
  return json(record);
}

export async function onRequestPost({ request, env, params }) {
  if (!requireSameOrigin(request)) return json({ error: "Cross-origin request blocked." }, 403);
  const actor = requireAccessIdentity(request);
  if (!actor) return json({ error: "Unauthorized" }, 401);

  const record = await getApplication(env, params.id);
  if (!record) return json({ error: "Not found" }, 404);

  let body = {};
  try {
    body = await request.json();
  } catch {
    /* no body is fine for reject */
  }
  const action = (body.action || "").toString();

  if (action === "reject") {
    record.status = "rejected";
    record.rejectedAt = new Date().toISOString();
    record.rejectedBy = actor;
    record.rejectionReason = (body.reason || "").toString();
    await env.APPLICATIONS_KV.put(`application:${record.id}`, JSON.stringify(record));
    return json({ ok: true });
  }

  if (action === "approve") {
    const roster = await listRoster(env);
    const slug = await uniqueSlug(slugify(record.professionalName), roster);

    const images = {};
    for (const field of ["headshot", "fullFront", "fullSide", "portfolioFile"]) {
      const meta = record.files?.[field];
      if (meta?.key && env.MEDIA) {
        const object = await env.MEDIA.get(meta.key);
        if (object) {
          const ext = meta.key.split(".").pop();
          const destKey = `models/${slug}/${field}.${ext}`;
          await env.MEDIA.put(destKey, object.body, {
            httpMetadata: { contentType: object.httpMetadata?.contentType || meta.type },
          });
          images[field] = destKey;
        }
      }
    }

    const measurementUnit = record.measurementUnit || "cm";
    const measurements =
      record.category === "men"
        ? [record.chest && `Chest ${record.chest}`, record.waist && `Waist ${record.waist}`]
            .filter(Boolean)
            .join(" / ") + (record.chest || record.waist ? ` ${measurementUnit}` : "")
        : [record.bust, record.waist, record.hips].filter(Boolean).join("-") +
          (record.bust || record.waist || record.hips ? ` ${measurementUnit}` : "");

    const model = {
      slug,
      name: record.professionalName,
      sample: false,
      status: "active",
      published: false,
      categories: [record.category],
      subcategories: [],
      newFace: true,
      featured: false,
      location: record.uaeCity ? `${record.uaeCity}, UAE` : "UAE",
      height: record.height ? `${record.height} ${measurementUnit}` : "",
      measurementUnit,
      bust: record.bust || "",
      waist: record.waist || "",
      hips: record.hips || "",
      neck: record.neck || "",
      chest: record.chest || "",
      sleeve: record.sleeve || "",
      inseam: record.inseam || "",
      measurements,
      hair: record.hair || "",
      eyes: record.eyes || "",
      languages: splitList(record.languages),
      skills: splitList(record.skills),
      displayOrder: roster.length + 1,
      swatch: ["#2b2621", "#14120f"],
      images,
      seoTitle: `${record.professionalName} | Photoczaro Models Dubai`,
      seoDescription: `${record.professionalName}, a Photoczaro Models roster talent based in the UAE.`,
      sourceApplicationId: record.id,
      archived: false,
      history: [{ action: "created_from_application", actor, at: new Date().toISOString(), applicationId: record.id }],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await env.ROSTER_KV.put(`model:${slug}`, JSON.stringify(model));

    record.status = "approved";
    record.approvedAt = new Date().toISOString();
    record.approvedBy = actor;
    record.rosterSlug = slug;
    await env.APPLICATIONS_KV.put(`application:${record.id}`, JSON.stringify(record));

    return json({ ok: true, slug });
  }

  return json({ error: "Unknown action" }, 400);
}

async function getApplication(env, id) {
  if (!env.APPLICATIONS_KV) return null;
  return env.APPLICATIONS_KV.get(`application:${id}`, { type: "json" });
}

async function listRoster(env) {
  if (!env.ROSTER_KV) return [];
  const list = await env.ROSTER_KV.list({ prefix: "model:" });
  const records = await Promise.all(list.keys.map((k) => env.ROSTER_KV.get(k.name, { type: "json" })));
  return records.filter(Boolean);
}

function splitList(value) {
  return (value || "")
    .toString()
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}
