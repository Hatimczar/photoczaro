import { json } from "../../../_lib/http.js";
import { requireAccessIdentity } from "../../../_lib/admin-auth.js";

/* Booking enquiries, newest first. The id is the KV key without its "enquiry:" prefix. */
export async function onRequestGet({ request, env }) {
  if (!(await requireAccessIdentity(request))) return json({ error: "Unauthorized" }, 401);
  if (!env.ENQUIRIES_KV) return json([]);

  const list = await env.ENQUIRIES_KV.list({ prefix: "enquiry:" });
  const records = await Promise.all(
    list.keys.map(async (k) => {
      const r = await env.ENQUIRIES_KV.get(k.name, { type: "json" });
      return r ? { id: k.name.slice("enquiry:".length), ...r } : null;
    })
  );
  return json(records.filter(Boolean).sort((a, b) => (b.receivedAt || "").localeCompare(a.receivedAt || "")));
}
