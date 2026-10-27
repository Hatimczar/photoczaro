import { json, ID_RE, loadDelivery, normEmail, validEmail, safeEqual, createCode, rateLimited, clientIp, sameOrigin, isExpired, logEvent } from '../../_lib/delivery.js';
import { sendCodeEmail } from '../../_lib/delivery-mail.js';

// Always answers the same way, whether or not the email matches, so the form cannot be used
// to discover which addresses have a delivery.
export async function onRequestPost({ request, env }) {
  if (!sameOrigin(request)) return json({ error: 'Invalid request.' }, 403);
  let body;
  try { body = await request.json(); } catch { return json({ error: 'Invalid request.' }, 400); }
  const id = String(body.id || '');
  const email = normEmail(body.email);
  if (!ID_RE.test(id) || !validEmail(email)) return json({ error: 'Please enter a valid email address.' }, 400);

  if (await rateLimited(env, `ip:${clientIp(request)}`, 12)) return json({ error: 'Too many attempts. Please try again later.' }, 429);
  if (await rateLimited(env, `id:${id}`, 6)) return json({ error: 'Too many attempts. Please try again later.' }, 429);

  const d = await loadDelivery(env, id);
  if (d && d.access !== 'link' && !isExpired(d) && safeEqual(normEmail(d.email), email)) {
    const code = await createCode(env, id);
    const r = await sendCodeEmail(env, email, code, d.title);
    await logEvent(env, id, 'code_requested', { emailed: !!r.sent });
  }
  return json({ ok: true });
}
