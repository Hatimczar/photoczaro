/*
 * Public roster feed. Reads published model records from ROSTER_KV and
 * returns only their public fields (see _lib/public-model.js) in the shape
 * the front-end rendering (index.html, models.html/js/filters.js, model.html)
 * expects. The pages are also server-rendered from the same data; this feed
 * keeps filtering and the shortlist live in the browser.
 */
import { json } from "../_lib/http.js";
import { loadPublishedModels } from "../_lib/public-model.js";

export async function onRequestGet({ env }) {
  return json(await loadPublishedModels(env), 200, { "Cache-Control": "public, max-age=60" });
}
