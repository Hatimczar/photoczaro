import { json, requireAdmin, sameOrigin, randomId, saveDelivery, cleanName, listFiles, getStats } from '../../_lib/delivery.js';

async function summary(env, d) {
  const [files, st] = await Promise.all([listFiles(env, d.id), getStats(env, d.id)]);
  return { id: d.id, title: d.title, modelName: d.modelName, status: d.status, createdAt: d.createdAt, expiresAt: d.expiresAt || null,
    fileCount: files.length, viewCount: st.viewCount || 0, downloadCount: st.downloadCount || 0, lastViewedAt: st.lastViewedAt || null };
}

export async function onRequestGet({ request, env }) {
  if (!(await requireAdmin(request, env))) return json({ error: 'Unauthorized.' }, 401);
  const out = [];
  let cursor;
  do {
    const page = await env.DELIVERY_KV.list({ prefix: 'd:', cursor });
    for (const k of page.keys) { const raw = await env.DELIVERY_KV.get(k.name); if (raw) out.push(await summary(env, JSON.parse(raw))); }
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
  const modelName = cleanName(b.modelName, '');
  const title = cleanName(b.title, '');
  if (!modelName || !title) return json({ error: 'Model name and title are required.' }, 400);
  const days = Number.isFinite(+b.expiresDays) ? Math.max(0, Math.min(365, Math.floor(+b.expiresDays))) : 30;
  const d = { id: randomId(16), title, modelName, note: String(b.note || '').slice(0, 500), status: b.release ? 'released' : 'preview',
    createdAt: Date.now(), expiresAt: days ? Date.now() + days * 86400000 : null };
  await saveDelivery(env, d);
  return json({ delivery: d, link: `https://photoczaro.com/delivery/${d.id}` }, 201);
}
