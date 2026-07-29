import { getCookie, verifyToken } from '../_lib/auth.js';

export async function onRequestPost({ request, env }) {
  const token = getCookie(request, 'pcz_admin_session');
  const payload = token ? await verifyToken(token, env.SESSION_SECRET) : null;
  if (!payload || !payload.admin) {
    return json({ error: 'Unauthorized.' }, 401);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid request.' }, 400);
  }

  const email = (body.email || '').trim().toLowerCase();
  const action = body.action;
  if (!email || !['approve', 'reject'].includes(action)) {
    return json({ error: 'Invalid request.' }, 400);
  }

  const key = `publisher:${email}`;
  const raw = await env.PUBLISHERS_KV.get(key);
  if (!raw) return json({ error: 'Publisher not found.' }, 404);

  const record = JSON.parse(raw);
  record.status = action === 'approve' ? 'approved' : 'rejected';
  await env.PUBLISHERS_KV.put(key, JSON.stringify(record));

  return json({ ok: true });
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
