import { hashPassword } from '../_lib/auth.js';

export async function onRequestPost({ request, env }) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid request.' }, 400);
  }

  const name = (body.name || '').trim();
  const magazine = (body.magazine || '').trim();
  const email = (body.email || '').trim().toLowerCase();
  const password = body.password || '';

  if (!name || !magazine || !email || !password) {
    return json({ error: 'All fields are required.' }, 400);
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ error: 'Please enter a valid email address.' }, 400);
  }
  if (password.length < 8) {
    return json({ error: 'Password must be at least 8 characters.' }, 400);
  }

  const key = `publisher:${email}`;
  const existing = await env.PUBLISHERS_KV.get(key);
  if (existing) {
    return json({ error: 'An account with this email already exists.' }, 400);
  }

  const passwordHash = await hashPassword(password);
  const record = {
    name,
    magazine,
    email,
    passwordHash,
    status: 'pending',
    createdAt: new Date().toISOString(),
  };

  await env.PUBLISHERS_KV.put(key, JSON.stringify(record));

  return json({ ok: true });
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
