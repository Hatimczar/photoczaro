import { json, loadDelivery, saveDelivery, isExpired, logEvent, parseRange, FID_RE, cleanName } from '../../../../_lib/delivery.js';

// Streams one object from private R2 after checking the viewer's session.
//   ?v=preview  watermarked image preview (always allowed)
//   ?v=poster   watermarked video poster frame (always allowed)
//   ?v=original the real file, only once the delivery is released
//   &dl=1       force a download
export async function onRequestGet({ request, env, params }) {
  const { id, fid } = params;
  if (!env.DELIVERY_R2) return json({ error: 'Not available.' }, 503);
  const d = await loadDelivery(env, id);
  if (!d || !FID_RE.test(fid)) return json({ error: 'Not found.' }, 404);
  if (isExpired(d)) return json({ error: 'This delivery has expired.' }, 410);
  const f = (d.files || []).find((x) => x.id === fid);
  if (!f) return json({ error: 'Not found.' }, 404);

  const url = new URL(request.url);
  const v = url.searchParams.get('v') || 'preview';
  if (!['preview', 'poster', 'original'].includes(v)) return json({ error: 'Not found.' }, 404);
  if (v === 'original' && d.status !== 'released') return json({ error: 'Originals are not released yet.' }, 403);
  if (v === 'preview' && !f.hasPreview) return json({ error: 'Not found.' }, 404);
  if (v === 'poster' && !f.hasPoster) return json({ error: 'Not found.' }, 404);

  // Once released, the gallery shows clean (un-watermarked) copies when they exist.
  const released = d.status === 'released';
  const stored = v === 'preview' && released && f.hasClean ? 'clean' : v === 'poster' && released && f.hasCleanPoster ? 'cleanposter' : v;
  const key = `${id}/${fid}/${stored}`;
  const head = await env.DELIVERY_R2.head(key);
  if (!head) return json({ error: 'Not found.' }, 404);
  const size = head.size;

  const baseHeaders = {
    'Cache-Control': 'private, no-store',
    'X-Robots-Tag': 'noindex, nofollow',
    'X-Content-Type-Options': 'nosniff',
    'Accept-Ranges': 'bytes',
    'Content-Type': v === 'original' ? f.mime : (v === 'poster' ? 'image/webp' : (head.httpMetadata && head.httpMetadata.contentType) || 'image/webp'),
  };
  if (v === 'original' && url.searchParams.get('dl') === '1') {
    baseHeaders['Content-Disposition'] = `attachment; filename="${cleanName(f.name).replace(/[^\x20-\x7e]/g, '_')}"; filename*=UTF-8''${encodeURIComponent(cleanName(f.name))}`;
    d.downloadCount = (d.downloadCount || 0) + 1;
    await saveDelivery(env, d);
    await logEvent(env, id, 'download', { file: f.name });
  }

  const range = parseRange(request.headers.get('Range'), size);
  if (range && range.invalid) return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}`, ...baseHeaders } });
  if (range) {
    const obj = await env.DELIVERY_R2.get(key, { range: { offset: range.offset, length: range.length } });
    if (!obj) return json({ error: 'Not found.' }, 404);
    return new Response(obj.body, { status: 206, headers: { ...baseHeaders, 'Content-Length': String(range.length), 'Content-Range': `bytes ${range.offset}-${range.offset + range.length - 1}/${size}` } });
  }
  const obj = await env.DELIVERY_R2.get(key);
  if (!obj) return json({ error: 'Not found.' }, 404);
  return new Response(obj.body, { status: 200, headers: { ...baseHeaders, 'Content-Length': String(size) } });
}
