import { json, loadDelivery, saveDelivery, isExpired, logEvent, planZip, cleanName } from '../../../_lib/delivery.js';

// "Download all": streams every original in one ZIP straight from private R2. Only after release.
export async function onRequestGet({ env, params, waitUntil }) {
  const id = params.id;
  if (!env.DELIVERY_R2) return json({ error: 'Not available.' }, 503);
  const d = await loadDelivery(env, id);
  if (!d) return json({ error: 'Not found.' }, 404);
  if (isExpired(d)) return json({ error: 'This delivery has expired.' }, 410);
  if (d.status !== 'released') return json({ error: 'Originals are not released yet.' }, 403);
  const plan = planZip(d.files || [], d.createdAt);
  if (!plan.ok) return json({ error: plan.reason === 'too-large' ? 'This delivery is too large for one ZIP. Download the files individually.' : 'A ZIP is not available for this delivery.' }, 409);

  const FLS = typeof FixedLengthStream !== 'undefined' ? FixedLengthStream : null;
  const { readable, writable } = FLS ? new FLS(plan.totalSize) : new TransformStream();
  const pump = (async () => {
    try {
      for (const e of plan.entries) {
        const w = writable.getWriter(); await w.write(e.local); w.releaseLock();
        const obj = await env.DELIVERY_R2.get(`${d.id}/${e.file.id}/original`);
        if (!obj) throw new Error('missing object');
        await obj.body.pipeTo(writable, { preventClose: true });
      }
      const w = writable.getWriter(); await w.write(plan.centralDirectory); await w.close();
    } catch (err) {
      try { await writable.abort(err); } catch (_) {}
    }
  })();
  if (typeof waitUntil === 'function') waitUntil(pump);

  d.downloadCount = (d.downloadCount || 0) + 1;
  await saveDelivery(env, d);
  await logEvent(env, id, 'zip_download', { files: d.files.length });
  const base = cleanName(`Photoczaro - ${d.title}`, 'Photoczaro delivery');
  return new Response(readable, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${base.replace(/[^\x20-\x7e]/g, '_')}.zip"; filename*=UTF-8''${encodeURIComponent(base)}.zip`,
      ...(FLS ? { 'Content-Length': String(plan.totalSize) } : {}),
      'Cache-Control': 'private, no-store',
      'X-Robots-Tag': 'noindex, nofollow',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
