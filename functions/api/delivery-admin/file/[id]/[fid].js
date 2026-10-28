import { json, requireAdmin, loadDelivery, getFileRecord, FID_RE, parseRange } from '../../../../_lib/delivery.js';

// Admin preview of any stored object (including originals) for a delivery.
export async function onRequestGet({ request, env, params }) {
  if (!(await requireAdmin(request, env))) return json({ error: 'Unauthorized.' }, 401);
  if (!env.DELIVERY_R2) return json({ error: 'Delivery storage is not configured yet.' }, 503);
  const d = await loadDelivery(env, params.id);
  const f = d && FID_RE.test(params.fid) ? await getFileRecord(env, d.id, params.fid) : null;
  if (!f) return json({ error: 'Not found.' }, 404);
  const v = new URL(request.url).searchParams.get('v') || 'preview';
  if (!['preview', 'poster', 'original'].includes(v)) return json({ error: 'Not found.' }, 404);
  const key = `${d.id}/${f.id}/${v}`;
  const head = await env.DELIVERY_R2.head(key);
  if (!head) return json({ error: 'Not found.' }, 404);
  const h = { 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex, nofollow', 'X-Content-Type-Options': 'nosniff', 'Accept-Ranges': 'bytes',
    'Content-Type': v === 'original' ? f.mime : 'image/webp' };
  const range = parseRange(request.headers.get('Range'), head.size);
  if (range && range.invalid) return new Response(null, { status: 416, headers: { ...h, 'Content-Range': `bytes */${head.size}` } });
  if (range) {
    const o = await env.DELIVERY_R2.get(key, { range: { offset: range.offset, length: range.length } });
    return new Response(o.body, { status: 206, headers: { ...h, 'Content-Length': String(range.length), 'Content-Range': `bytes ${range.offset}-${range.offset + range.length - 1}/${head.size}` } });
  }
  const o = await env.DELIVERY_R2.get(key);
  return new Response(o.body, { headers: { ...h, 'Content-Length': String(head.size) } });
}
