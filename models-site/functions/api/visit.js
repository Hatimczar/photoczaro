/*
 * Footer page-view counter, shared by photoczaro.com and models.photoczaro.com
 * (both Pages projects bind the SAME KV namespace as VISITS_KV).
 *
 * GET  /api/visit  -> { count }          read only
 * POST /api/visit  -> { count }          adds 1, then returns the new total
 *
 * Stores one number. No cookies, IP addresses, user agents or any per-visitor
 * data are read into storage. Crawlers/headless clients are not counted.
 * BASE is the GA4 lifetime page-view total (property 303642880, 2026-11-11,
 * 2,620 views) so the public figure starts from the real history.
 * KV has no atomic increment, so two truly simultaneous hits can collapse
 * into one; at this traffic level that is an acceptable rounding error.
 */
const BASE = 2620;
const KEY = "total";
const BOT = /bot|crawl|spider|slurp|facebookexternalhit|headless|lighthouse|pagespeed|preview|monitor|uptime|curl|wget|python|axios|node-fetch|go-http/i;

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

export async function onRequest({ request, env }) {
  const kv = env.VISITS_KV;
  if (!kv) return json({ count: null });

  const stored = parseInt((await kv.get(KEY)) || "0", 10) || 0;

  if (request.method !== "POST") return json({ count: BASE + stored });

  const url = new URL(request.url);
  const origin = request.headers.get("origin");
  const ua = request.headers.get("user-agent") || "";
  const sameSite = !origin || new URL(origin).host === url.host;
  if (!sameSite || !ua || BOT.test(ua)) return json({ count: BASE + stored });

  const next = stored + 1;
  await kv.put(KEY, String(next));
  return json({ count: BASE + next });
}
