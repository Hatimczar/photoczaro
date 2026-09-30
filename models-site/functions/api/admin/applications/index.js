import { json } from "../../../_lib/http.js";
import { requireAccessIdentity } from "../../../_lib/admin-auth.js";

export async function onRequestGet({ request, env }) {
  if (!(await requireAccessIdentity(request))) return json({ error: "Unauthorized" }, 401);
  if (!env.APPLICATIONS_KV) return json([]);

  const list = await env.APPLICATIONS_KV.list({ prefix: "application:" });
  const records = await Promise.all(
    list.keys.map((k) => env.APPLICATIONS_KV.get(k.name, { type: "json" }))
  );
  const applications = records.filter(Boolean).sort((a, b) => (b.receivedAt || "").localeCompare(a.receivedAt || ""));
  return json(applications);
}
