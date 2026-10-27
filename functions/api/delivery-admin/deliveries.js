import { json, requireAdmin, sameOrigin, randomId, saveDelivery, normEmail, validEmail, cleanName } from '../../_lib/delivery.js';

function summary(d) {
  return { id: d.id, title: d.title, modelName: d.modelName, email: d.email, status: d.status, createdAt: d.createdAt, expiresAt: d.expiresAt || null,
    fileCount: (d.files || []).length, viewCount: d.viewCount || 0, downloadCount: d.downloadCount || 0, lastViewedAt: d.lastViewedAt || null };
}

export async function onRequestGet({ request, env }) {
  if (!(await requireAdmin(request, env))) return json({ error: 'Unauthorized.' }, 401);
  const out = [];
  let cursor;
  do {
    const page = await env.DELIVERY_KV.list({ prefix: 'd:', cursor });
    for (const k of page.keys) { const raw = await env.DELIVERY_KV.get(k.name); if (raw) out.push(summary(JSON.parse(raw))); }
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);
  out.sort((a, b) => b.createdAt - a.createdAt);
  return json({ deliveries: out });
}

export async function onRequestPost({ request, env }) {
  if (!(await requireAdmin(request, env))) return json({ error: 'Unauthorized.' }, 401);
  if (!sameOrigin(request)) return json({ error: 'Invalid request.' }, 403);
  let b;
  try { b = await request.json(); } catch { return json({ error: 'Invalid request.' }, 400); }
  const email = normEmail(b.email);
  const modelName = cleanName(b.modelName, '');
  const title = cleanName(b.title, '');
  if (!modelName || !title || !validEmail(email)) return json({ error: 'Model name, title and a valid email are required.' }, 400);
  const days = Number.isFinite(+b.expiresDays) ? Math.max(0, Math.min(365, Math.floor(+b.expiresDays))) : 30;
  const d = { id: randomId(16), title, modelName, email, note: String(b.note || '').slice(0, 500), status: 'preview',
    createdAt: Date.now(), expiresAt: days ? Date.now() + days * 86400000 : null, files: [], viewCount: 0, downloadCount: 0 };
  await saveDelivery(env, d);
  return json({ delivery: d, link: `https://photoczaro.com/delivery/${d.id}` }, 201);
}
