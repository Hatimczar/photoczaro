/*
 * Failure log for roster applications. Every attempt that does not end in a
 * clean, complete application leaves a small record in APPLICATIONS_KV under
 * "applog:", kept for 90 days, so a broken form or a run of rejected photos
 * cannot go unnoticed.
 *
 * Privacy: the log holds NO applicant content. No names, emails, phone
 * numbers, handles or free text, and no file names or contents. It stores
 * which fields failed and why (short codes), file sizes and types, the
 * country the request came from and a trimmed user agent.
 *
 * Volume guard: at most DAILY_CAP entries per day, so a spam run cannot fill
 * the store; entries beyond that only increment a "suppressed" counter.
 */
const TTL_SECONDS = 90 * 24 * 60 * 60;
const DAILY_CAP = 300;
const short = (v, n) => String(v == null ? "" : v).replace(/[\r\n\t]+/g, " ").slice(0, n);

// Keep only { fieldName: "short_code" } pairs from a validation result.
export function codesOnly(errors) {
  const out = {};
  for (const [k, v] of Object.entries(errors || {})) {
    if (typeof v === "string") out[short(k, 40)] = short(v, 40);
  }
  return out;
}

// What the browser told us about the files, never their names or bytes.
export function describeFiles(form) {
  const out = [];
  for (const name of ["headshot", "fullFront", "fullSide", "facialProfile", "portfolioFile", "gallery"]) {
    for (const f of form.getAll(name)) {
      if (f && typeof f === "object" && "size" in f) out.push({ field: name, type: short(f.type, 40), bytes: f.size });
    }
  }
  return out.slice(0, 20);
}

/*
 * kind: "unreadable_request" | "validation" | "server_error" | "photos_rejected"
 * details: { fields?, files?, error?, rejected? }
 * Never throws and never blocks the response on failure.
 */
export async function logApplyFailure(env, request, kind, details = {}) {
  try {
    if (!env.APPLICATIONS_KV) return;
    const day = new Date().toISOString().slice(0, 10);
    const counterKey = `applogcount:${day}`;
    const count = parseInt((await env.APPLICATIONS_KV.get(counterKey)) || "0", 10);
    await env.APPLICATIONS_KV.put(counterKey, String(count + 1), { expirationTtl: 3 * 24 * 60 * 60 });
    if (count >= DAILY_CAP) return;

    const record = {
      at: new Date().toISOString(),
      kind,
      country: short(request.cf && request.cf.country, 4),
      userAgent: short(request.headers.get("user-agent"), 160),
      contentLength: parseInt(request.headers.get("content-length") || "0", 10) || 0,
      viaFetch: request.headers.get("x-requested-with") === "fetch",
      fields: details.fields || undefined,
      files: details.files || undefined,
      rejected: details.rejected || undefined,
      error: details.error ? short(details.error, 200) : undefined,
    };
    const key = `applog:${record.at}-${crypto.randomUUID().slice(0, 8)}`;
    await env.APPLICATIONS_KV.put(key, JSON.stringify(record), { expirationTtl: TTL_SECONDS });
  } catch (err) {
    console.error("apply log failed", err && err.message);
  }
}
