import { json } from "../../../_lib/http.js";
import { requireAccessIdentity } from "../../../_lib/admin-auth.js";
import { requireSameOrigin } from "../../../_lib/origin-check.js";

const STATUSES = ["new", "contacted", "booked", "closed"];

/* Update the working status and/or a private note on one enquiry. */
export async function onRequestPost({ request, env, params }) {
  if (!requireSameOrigin(request)) return json({ error: "Cross-origin request blocked." }, 403);
  const actor = await requireAccessIdentity(request);
  if (!actor) return json({ error: "Unauthorized" }, 401);
  if (!env.ENQUIRIES_KV) return json({ error: "Enquiries storage is not configured." }, 500);

  const id = decodeURIComponent(params.id || "");
  if (!/^\d{10,16}:[0-9a-f-]{36}$/i.test(id)) return json({ error: "Not found" }, 404);
  const key = `enquiry:${id}`;
  const record = await env.ENQUIRIES_KV.get(key, { type: "json" });
  if (!record) return json({ error: "Not found" }, 404);

  let body = {};
  try { body = await request.json(); } catch { return json({ error: "Invalid request." }, 400); }

  if (body.status !== undefined) {
    if (!STATUSES.includes(body.status)) return json({ error: "Unknown status." }, 400);
    record.status = body.status;
  }
  if (body.adminNote !== undefined) record.adminNote = (body.adminNote || "").toString().slice(0, 1000);
  record.history = [...(record.history || []), { action: body.status ? `status_${body.status}` : "note_updated", actor, at: new Date().toISOString() }].slice(-30);
  await env.ENQUIRIES_KV.put(key, JSON.stringify(record));
  return json({ ok: true, id, status: record.status });
}
