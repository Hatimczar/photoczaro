import { verifyPassword, signToken, setCookieHeader } from '../_lib/auth.js';

const SESSION_MAX_AGE = 60 * 60 * 24 * 14; // 14 days

export async function onRequestPost({ request, env }) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid request.' }, 400);
  }

  const email = (body.email || '').trim().toLowerCase();
  const password = body.password || '';
  if (!email || !password) {
    return json({ error: 'Email and password are required.' }, 400);
  }

  const raw = await env.PUBLISHERS_KV.get(`publisher:${email}`);
  if (!raw) {
    return json({ error: 'Invalid email or password.' }, 401);
  }

  const record = JSON.parse(raw);
  const valid = await verifyPassword(password, record.passwordHash);
  if (!valid) {
    return json({ error: 'Invalid email or password.' }, 401);
  }

  if (record.status !== 'approved') {
    return json({ error: 'Your account is still pending approval. You’ll be able to log in once it’s approved.' }, 403);
  }

  const token = await signToken({ email, exp: Date.now() + SESSION_MAX_AGE * 1000 }, env.SESSION_SECRET);

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': setCookieHeader('pcz_pub_session', token, SESSION_MAX_AGE),
    },
  });
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
