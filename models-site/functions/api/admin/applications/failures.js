import { json } from "../../../_lib/http.js";
import { requireAccessIdentity } from "../../../_lib/admin-auth.js";

// Failed or partly failed application attempts (see _lib/apply-log.js).
export async function onRequestGet({ request, env }) {
  if (!(await requireAccessIdentity(request))) return json({ error: "Unauthorized" }, 401);
  if (!env.APPLICATIONS_KV) return json({ entries: [], suppressedToday: 0 });

  const list = await env.APPLICATIONS_KV.list({ prefix: "applog:", limit: 500 });
  const records = await Promise.all(list.keys.map((k) => env.APPLICATIONS_KV.get(k.name, { type: "json" })));
  const entries = records.filter(Boolean).sort((a, b) => (b.at || "").localeCompare(a.at || "")).slice(0, 200);

  const day = new Date().toISOString().slice(0, 10);
  const todayCount = parseInt((await env.APPLICATIONS_KV.get(`applogcount:${day}`)) || "0", 10);
  return json({ entries, suppressedToday: Math.max(0, todayCount - 300) });
}
