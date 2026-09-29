/*
 * DEVELOPMENT-ONLY submission handler.
 * Stores each booking enquiry as a JSON record in the ENQUIRIES_KV namespace
 * (bind it in this project's own wrangler.toml / Pages dashboard — it is
 * intentionally separate from the main photoczaro.com KV namespaces).
 *
 * Before production:
 *  - Add spam protection (Cloudflare Turnstile is the natural fit given the
 *    rest of the stack; verify the token here before writing to KV).
 *  - Add rate-limiting (e.g. a Cloudflare Rate Limiting rule on /api/*, or a
 *    per-IP counter key in KV with a short TTL).
 *  - Wire a notification (email or the same Telegram pattern used by
 *    functions/_lib/telegram.js on the main site) so enquiries aren't only
 *    sitting in KV unread.
 *  - Add server-side validation matching the client-side rules in
 *    book-talent.html (this handler currently trusts required-field checks
 *    already run client-side and only re-validates email format + presence).
 */
export async function onRequestPost({ request, env }) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid request." }, 400);
  }

  const workEmail = (body.workEmail || "").trim().toLowerCase();
  const clientName = (body.clientName || "").trim();
  if (!clientName || !workEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(workEmail)) {
    return json({ error: "Missing or invalid required fields." }, 400);
  }

  const record = {
    ...body,
    workEmail,
    clientName,
    receivedAt: new Date().toISOString(),
    status: "new",
  };

  if (env.ENQUIRIES_KV) {
    const key = `enquiry:${Date.now()}:${crypto.randomUUID()}`;
    await env.ENQUIRIES_KV.put(key, JSON.stringify(record));
  } else {
    // No KV bound yet — log only, so local/dev testing doesn't hard-fail.
    console.log("book-talent enquiry (no KV bound):", record);
  }

  return json({ ok: true });
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
