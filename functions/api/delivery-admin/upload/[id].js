import { json, requireAdmin, sameOrigin, loadDelivery, saveDelivery, FID_RE, IMAGE_TYPES, VIDEO_TYPES, RAW_TYPES } from '../../../_lib/delivery.js';

// Admin-only uploads into private R2.
//   POST ?action=put&fid=..&kind=original|preview|poster[&mime=..]          single request (files up to ~90 MB)
//   POST ?action=start&fid=..&mime=..                                        begin a multipart upload (videos)
//   POST ?action=part&fid=..&uploadId=..&n=..                                one part (<= 32 MB recommended)
//   POST ?action=complete&fid=..&uploadId=..   body {parts:[{partNumber,etag}]}
//   POST ?action=abort&fid=..&uploadId=..
const MAX_SINGLE = 90 * 1024 * 1024;
const MAX_PART = 95 * 1024 * 1024;

function startsWith(buf, bytes, offset = 0) { for (let i = 0; i < bytes.length; i++) if (buf[offset + i] !== bytes[i]) return false; return true; }
function sniff(buf) {
  if (startsWith(buf, [0xff, 0xd8, 0xff])) return 'image/jpeg';
  if (startsWith(buf, [0x89, 0x50, 0x4e, 0x47])) return 'image/png';
  if (startsWith(buf, [0x52, 0x49, 0x46, 0x46]) && startsWith(buf, [0x57, 0x45, 0x42, 0x50], 8)) return 'image/webp';
  if (startsWith(buf, [0x66, 0x74, 0x79, 0x70], 4)) return 'video/mp4'; // also matches QuickTime (ftyp)
  if (startsWith(buf, [0x1a, 0x45, 0xdf, 0xa3])) return 'video/webm';
  if (startsWith(buf, [0x49, 0x49, 0x2a, 0x00]) || startsWith(buf, [0x4d, 0x4d, 0x00, 0x2a])) return startsWith(buf, [0x43, 0x52], 8) ? 'raw/cr2' : 'raw/tiff';
  return null;
}
const compatible = (mime, sniffed) => mime === sniffed || (mime === 'video/quicktime' && sniffed === 'video/mp4')
  || (mime === 'image/x-canon-cr2' && sniffed === 'raw/cr2') || (mime === 'image/x-nikon-nef' && sniffed === 'raw/tiff');

export async function onRequestPost({ request, env, params }) {
  if (!(await requireAdmin(request, env))) return json({ error: 'Unauthorized.' }, 401);
  if (!env.DELIVERY_R2) return json({ error: 'Delivery storage is not configured yet.' }, 503);
  if (!sameOrigin(request)) return json({ error: 'Invalid request.' }, 403);
  const d = await loadDelivery(env, params.id);
  if (!d) return json({ error: 'Delivery not found.' }, 404);
  const url = new URL(request.url);
  const action = url.searchParams.get('action');
  const fid = url.searchParams.get('fid') || '';
  if (!FID_RE.test(fid)) return json({ error: 'Invalid file id.' }, 400);
  const base = `${d.id}/${fid}`;

  if (action === 'put') {
    const kind = url.searchParams.get('kind');
    if (!['original', 'preview', 'poster', 'clean', 'cleanposter'].includes(kind)) return json({ error: 'Invalid kind.' }, 400);
    const len = parseInt(request.headers.get('Content-Length') || '0', 10);
    if (!len || len > MAX_SINGLE) return json({ error: 'File too large for a single upload.' }, 413);
    const buf = new Uint8Array(await request.arrayBuffer());
    const sn = sniff(buf);
    let mime;
    if (kind === 'original') {
      mime = url.searchParams.get('mime') || '';
      if (![...IMAGE_TYPES, ...VIDEO_TYPES].includes(mime) || !compatible(mime, sn)) return json({ error: 'File content does not match its type.' }, 400);
    } else {
      mime = 'image/webp';
      if (sn !== 'image/webp') return json({ error: 'Previews must be WebP images.' }, 400);
    }
    await env.DELIVERY_R2.put(`${base}/${kind}`, buf, { httpMetadata: { contentType: mime } });
    if (kind === 'clean' || kind === 'cleanposter') {
      // Un-watermarked display copies, shown instead of the watermarked ones once a delivery is released.
      const f = (d.files || []).find((x) => x.id === fid);
      if (f) { f[kind === 'clean' ? 'hasClean' : 'hasCleanPoster'] = true; await saveDelivery(env, d); }
    }
    return json({ ok: true, size: buf.length });
  }

  if (action === 'start') {
    const mime = url.searchParams.get('mime') || '';
    if (![...VIDEO_TYPES, ...RAW_TYPES].includes(mime)) return json({ error: 'Unsupported file type.' }, 400);
    const mp = await env.DELIVERY_R2.createMultipartUpload(`${base}/original`, { httpMetadata: { contentType: mime } });
    return json({ uploadId: mp.uploadId });
  }

  const uploadId = url.searchParams.get('uploadId') || '';
  if (!/^[\w.~-]{10,400}$/.test(uploadId)) return json({ error: 'Invalid upload id.' }, 400);
  const mp = env.DELIVERY_R2.resumeMultipartUpload(`${base}/original`, uploadId);

  if (action === 'part') {
    const n = parseInt(url.searchParams.get('n') || '0', 10);
    if (!(n >= 1 && n <= 10000)) return json({ error: 'Invalid part number.' }, 400);
    const len = parseInt(request.headers.get('Content-Length') || '0', 10);
    if (!len || len > MAX_PART) return json({ error: 'Part too large.' }, 413);
    const buf = new Uint8Array(await request.arrayBuffer());
    if (n === 1) {
      const mime = url.searchParams.get('mime') || '';
      if (![...VIDEO_TYPES, ...RAW_TYPES].includes(mime) || !compatible(mime, sniff(buf))) return json({ error: 'File content does not match its type.' }, 400);
    }
    const part = await mp.uploadPart(n, buf);
    return json({ partNumber: part.partNumber, etag: part.etag });
  }
  if (action === 'complete') {
    let b;
    try { b = await request.json(); } catch { return json({ error: 'Invalid request.' }, 400); }
    const parts = Array.isArray(b.parts) ? b.parts.map((p) => ({ partNumber: +p.partNumber, etag: String(p.etag) })) : [];
    if (!parts.length) return json({ error: 'No parts.' }, 400);
    await mp.complete(parts);
    return json({ ok: true });
  }
  if (action === 'abort') { await mp.abort(); return json({ ok: true }); }
  return json({ error: 'Unknown action.' }, 400);
}
