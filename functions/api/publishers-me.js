import { getCookie, verifyToken } from '../_lib/auth.js';

export async function onRequestGet({ request, env }) {
  const token = getCookie(request, 'pcz_pub_session');
  const payload = token ? await verifyToken(token, env.SESSION_SECRET) : null;
  if (!payload || !payload.email) {
    return json({ error: 'Unauthorized.' }, 401);
  }

  const raw = await env.PUBLISHERS_KV.get(`publisher:${payload.email}`);
  if (!raw) return json({ error: 'Not found.' }, 404);

  const { name, magazine, email } = JSON.parse(raw);
  return json({ name, magazine, email });
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
