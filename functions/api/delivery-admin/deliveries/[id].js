import { json, requireAdmin, sameOrigin, loadDelivery, saveDelivery, cleanName } from '../../../_lib/delivery.js';

async function deleteAllObjects(env, id) {
  let cursor;
  do {
    const l = await env.DELIVERY_R2.list({ prefix: `${id}/`, cursor });
    if (l.objects.length) await env.DELIVERY_R2.delete(l.objects.map((o) => o.key));
    cursor = l.truncated ? l.cursor : undefined;
  } while (cursor);
}

export async function onRequestGet({ request, env, params }) {
  if (!(await requireAdmin(request, env))) return json({ error: 'Unauthorized.' }, 401);
  const d = await loadDelivery(env, params.id);
  if (!d) return json({ error: 'Not found.' }, 404);
  const log = [];
  const l = await env.DELIVERY_KV.list({ prefix: `l:${d.id}:` });
  for (const k of l.keys.slice(-60)) { const raw = await env.DELIVERY_KV.get(k.name); if (raw) log.push(JSON.parse(raw)); }
  log.reverse();
  return json({ delivery: d, link: `https://photoczaro.com/delivery/${d.id}`, log });
}

export async function onRequestPatch({ request, env, params }) {
  if (!(await requireAdmin(request, env))) return json({ error: 'Unauthorized.' }, 401);
  if (!sameOrigin(request)) return json({ error: 'Invalid request.' }, 403);
  const d = await loadDelivery(env, params.id);
  if (!d) return json({ error: 'Not found.' }, 404);
  let b;
  try { b = await request.json(); } catch { return json({ error: 'Invalid request.' }, 400); }
  if (b.title !== undefined) d.title = cleanName(b.title, d.title);
  if (b.modelName !== undefined) d.modelName = cleanName(b.modelName, d.modelName);
  if (b.note !== undefined) d.note = String(b.note).slice(0, 500);
  if (b.expiresDays !== undefined) { const n = Math.max(0, Math.min(365, Math.floor(+b.expiresDays) || 0)); d.expiresAt = n ? Date.now() + n * 86400000 : null; }
  if (b.status !== undefined) { if (!['preview', 'released'].includes(b.status)) return json({ error: 'Invalid status.' }, 400); d.status = b.status; }
  await saveDelivery(env, d);
  return json({ delivery: d });
}

export async function onRequestDelete({ request, env, params }) {
  if (!(await requireAdmin(request, env))) return json({ error: 'Unauthorized.' }, 401);
  if (!sameOrigin(request)) return json({ error: 'Invalid request.' }, 403);
  if (!env.DELIVERY_R2) return json({ error: 'Delivery storage is not configured yet.' }, 503);
  const d = await loadDelivery(env, params.id);
  if (!d) return json({ error: 'Not found.' }, 404);
  await deleteAllObjects(env, d.id);
  await env.DELIVERY_KV.delete(`d:${d.id}`);
  const l = await env.DELIVERY_KV.list({ prefix: `l:${d.id}:` });
  for (const k of l.keys) await env.DELIVERY_KV.delete(k.name);
  return json({ ok: true });
}
