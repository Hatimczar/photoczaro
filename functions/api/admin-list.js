import { getCookie, verifyToken } from '../_lib/auth.js';

export async function onRequestGet({ request, env }) {
  const token = getCookie(request, 'pcz_admin_session');
  const payload = token ? await verifyToken(token, env.SESSION_SECRET) : null;
  if (!payload || !payload.admin) {
    return json({ error: 'Unauthorized.' }, 401);
  }

  const list = await env.PUBLISHERS_KV.list({ prefix: 'publisher:' });
  const publishers = [];
  for (const k of list.keys) {
    const raw = await env.PUBLISHERS_KV.get(k.name);
    if (!raw) continue;
    const { name, magazine, email, status, createdAt } = JSON.parse(raw);
    publishers.push({ name, magazine, email, status, createdAt });
  }
  publishers.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  return json({ publishers });
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
