import { signToken, setCookieHeader } from '../_lib/auth.js';

const SESSION_MAX_AGE = 60 * 60 * 8; // 8 hours

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function onRequestPost({ request, env }) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid request.' }, 400);
  }

  const password = body.password || '';
  if (!password || !timingSafeEqual(password, env.ADMIN_PASSWORD)) {
    return json({ error: 'Incorrect password.' }, 401);
  }

  const token = await signToken({ admin: true, exp: Date.now() + SESSION_MAX_AGE * 1000 }, env.SESSION_SECRET);

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': setCookieHeader('pcz_admin_session', token, SESSION_MAX_AGE),
    },
  });
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
