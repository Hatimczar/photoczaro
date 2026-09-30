/*
 * Public roster feed. Reads published model records from ROSTER_KV and
 * returns them in the same shape js/data.js used to hard-code, so the
 * front-end rendering (index.html, models.html/js/filters.js, model.html)
 * needs only to fetch this instead of reading a bundled array.
 */
import { json } from "../_lib/http.js";

export async function onRequestGet({ env }) {
  if (!env.ROSTER_KV) return json([]);

  const list = await env.ROSTER_KV.list({ prefix: "model:" });
  const records = await Promise.all(
    list.keys.map((k) => env.ROSTER_KV.get(k.name, { type: "json" }))
  );
  const published = records
    .filter((m) => m && m.published && !m.archived)
    .sort((a, b) => (a.displayOrder ?? 999) - (b.displayOrder ?? 999));

  return json(published, 200, { "Cache-Control": "public, max-age=60" });
}
