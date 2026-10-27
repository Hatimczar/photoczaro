import { json, ID_RE, loadDelivery, saveDelivery, safeEqual, hmacHex, issueSession, sameOrigin, isExpired, logEvent, rateLimited, clientIp, MAX_CODE_ATTEMPTS } from '../../_lib/delivery.js';

export async function onRequestPost({ request, env }) {
  if (!sameOrigin(request)) return json({ error: 'Invalid request.' }, 403);
  let body;
  try { body = await request.json(); } catch { return json({ error: 'Invalid request.' }, 400); }
  const id = String(body.id || '');
  const code = String(body.code || '').replace(/\s+/g, '');
  const generic = () => json({ error: 'That code is not valid or has expired. Request a new one.' }, 401);
  if (!ID_RE.test(id) || !/^\d{6}$/.test(code)) return generic();
  if (await rateLimited(env, `vip:${clientIp(request)}`, 30)) return json({ error: 'Too many attempts. Please try again later.' }, 429);

  const d = await loadDelivery(env, id);
  const raw = await env.DELIVERY_KV.get(`c:${id}`);
  if (!d || isExpired(d) || !raw) return generic();
  const c = JSON.parse(raw);
  if (Date.now() > c.exp || c.attempts >= MAX_CODE_ATTEMPTS) { await env.DELIVERY_KV.delete(`c:${id}`); return generic(); }

  const expected = await hmacHex(env.SESSION_SECRET, `${id}:${code}`);
  if (!safeEqual(expected, c.hash)) {
    c.attempts += 1;
    await env.DELIVERY_KV.put(`c:${id}`, JSON.stringify(c), { expirationTtl: 1800 });
    await logEvent(env, id, 'code_failed');
    return generic();
  }
  await env.DELIVERY_KV.delete(`c:${id}`); // single use
  d.viewCount = (d.viewCount || 0) + 1;
  d.lastViewedAt = Date.now();
  await saveDelivery(env, d);
  await logEvent(env, id, 'opened');
  return json({ ok: true }, 200, { 'Set-Cookie': await issueSession(id, env) });
}
