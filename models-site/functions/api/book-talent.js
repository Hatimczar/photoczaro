/*
 * DEVELOPMENT-ONLY submission handler.
 * Stores each booking enquiry as a JSON record in the ENQUIRIES_KV namespace
 * (bind it in this project's own wrangler.toml / Pages dashboard, it is
 * intentionally separate from the main photoczaro.com KV namespaces).
 *
 * Accepts both application/json (the JS fetch path in book-talent.html) and
 * application/x-www-form-urlencoded (the plain <form method="post"> fallback
 * if JS fails) so the no-JS path actually works rather than 400ing on a body
 * it can't parse.
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
  const isNativeSubmit = request.headers.get("x-requested-with") !== "fetch";

  let body;
  try {
    if (isNativeSubmit) {
      const form = await request.formData();
      body = Object.fromEntries(form.entries());
    } else {
      body = await request.json();
    }
  } catch {
    return respondError(isNativeSubmit, "Invalid request.", 400);
  }

  const workEmail = (body.workEmail || "").trim().toLowerCase();
  const clientName = (body.clientName || "").trim();
  if (!clientName || !workEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(workEmail)) {
    return respondError(isNativeSubmit, "Missing or invalid required fields.", 400);
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
    // No KV bound yet, log only, so local/dev testing doesn't hard-fail.
    console.log("book-talent enquiry (no KV bound):", record);
  }

  if (isNativeSubmit) {
    return htmlResponse(
      "Enquiry received",
      "Thank you. Your enquiry has been received. Photoczaro will typically confirm availability and a quotation within one business day.",
      "book-talent"
    );
  }
  return json({ ok: true });
}

function respondError(isNativeSubmit, message, status) {
  if (isNativeSubmit) {
    return htmlResponse("Something went wrong", message, "book-talent", status);
  }
  return json({ error: message }, status);
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function htmlResponse(title, message, backPath, status = 200) {
  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="noindex, nofollow"><title>${title} | Photoczaro Models</title>
<style>body{background:#0a0a0a;color:#f5f0eb;font-family:sans-serif;min-height:100svh;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:0 24px;}
p{max-width:480px;color:#8a8680;margin:16px 0 28px;}a{color:#0a0a0a;background:#c9a96e;padding:12px 24px;border-radius:999px;text-decoration:none;}</style>
</head><body><h1>${title}</h1><p>${message}</p><a href="/${backPath}">Back</a></body></html>`;
  return new Response(html, { status, headers: { "Content-Type": "text/html; charset=UTF-8" } });
}
