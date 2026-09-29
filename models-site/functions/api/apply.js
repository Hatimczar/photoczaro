/*
 * DEVELOPMENT-ONLY submission handler.
 * Stores each roster application's TEXT fields as a JSON record in the
 * APPLICATIONS_KV namespace (bind it in this project's own wrangler.toml /
 * Pages dashboard, separate from the main site's KV namespaces).
 *
 * Uploaded files (headshot, full-length digitals, optional portfolio file)
 * are NOT persisted by this handler. Do not add public-directory file
 * storage. The spec explicitly disallows storing sensitive uploads in a
 * public directory. Before production, wire a private store (e.g. a
 * Cloudflare R2 bucket that is never served publicly, with signed/short-
 * lived access for reviewers only) and persist file keys alongside the KV
 * record. Until that exists, this handler only records each file's name,
 * type and size so reviewers know something was attached; the actual
 * image bytes are discarded.
 *
 * Also still needed before production: spam protection (Turnstile),
 * rate-limiting, and a reviewer notification (see book-talent.js for the
 * same open items).
 */
export async function onRequestPost({ request, env }) {
  const isNativeSubmit = request.headers.get("x-requested-with") !== "fetch";

  let form;
  try {
    form = await request.formData();
  } catch {
    return respondError(isNativeSubmit, "Invalid request.", 400);
  }

  const email = (form.get("email") || "").toString().trim().toLowerCase();
  const professionalName = (form.get("professionalName") || "").toString().trim();
  const category = (form.get("category") || "").toString().trim().toLowerCase();
  if (
    !professionalName ||
    !email ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    !["women", "men"].includes(category)
  ) {
    return respondError(isNativeSubmit, "Missing or invalid required fields.", 400);
  }

  const MAX_BYTES = 8 * 1024 * 1024;
  const fileFields = ["headshot", "fullFront", "fullSide", "portfolioFile"];
  const files = {};
  for (const field of fileFields) {
    const file = form.get(field);
    if (file && typeof file === "object" && "size" in file) {
      if (file.size > MAX_BYTES) {
        return respondError(isNativeSubmit, `${field} exceeds the 8MB limit.`, 400);
      }
      files[field] = { name: file.name, type: file.type, size: file.size, stored: false };
    }
  }

  const record = {
    professionalName,
    legalName: (form.get("legalName") || "").toString(),
    category,
    email,
    telephone: (form.get("telephone") || "").toString(),
    uaeCity: (form.get("uaeCity") || "").toString(),
    experience: (form.get("experience") || "").toString(),
    height: (form.get("height") || "").toString(),
    measurements: (form.get("measurements") || "").toString(),
    hair: (form.get("hair") || "").toString(),
    eyes: (form.get("eyes") || "").toString(),
    languages: (form.get("languages") || "").toString(),
    skills: (form.get("skills") || "").toString(),
    portfolioUrl: (form.get("portfolioUrl") || "").toString(),
    introduction: (form.get("introduction") || "").toString(),
    ageConfirm: form.get("ageConfirm") === "on",
    residencyConfirm: form.get("residencyConfirm") === "on",
    files,
    receivedAt: new Date().toISOString(),
    status: "pending_review",
  };

  if (env.APPLICATIONS_KV) {
    const key = `application:${Date.now()}:${crypto.randomUUID()}`;
    await env.APPLICATIONS_KV.put(key, JSON.stringify(record));
  } else {
    console.log("roster application (no KV bound):", record);
  }

  if (isNativeSubmit) {
    return htmlResponse(
      "Application received",
      "Thank you. Your application has been received. We review applications on a rolling basis and will contact you only through verified Photoczaro channels.",
      "apply"
    );
  }
  return json({ ok: true });
}

function respondError(isNativeSubmit, message, status) {
  if (isNativeSubmit) {
    return htmlResponse("Something went wrong", message, "apply", status);
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
