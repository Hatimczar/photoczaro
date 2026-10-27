import { json, sameOrigin } from '../../_lib/delivery.js';
import { clearCookieHeader } from '../../_lib/auth.js';

export async function onRequestPost({ request }) {
  if (!sameOrigin(request)) return json({ error: 'Invalid request.' }, 403);
  return json({ ok: true }, 200, { 'Set-Cookie': clearCookieHeader('pcz_admin_session') });
}
