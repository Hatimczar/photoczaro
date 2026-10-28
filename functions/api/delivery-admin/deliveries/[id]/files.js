import { json, requireAdmin, sameOrigin, loadDelivery, putFileRecord, deleteFileObjects, FID_RE, IMAGE_TYPES, VIDEO_TYPES, RAW_TYPES, cleanName } from '../../../../_lib/delivery.js';

const MAX_IMAGE = 60 * 1024 * 1024;
const MAX_RAW = 200 * 1024 * 1024;
const MAX_VIDEO = 4 * 1024 * 1024 * 1024;

// Registers a file after its objects have been uploaded to R2. Each file is its own record in R2, so
// registering many files at once can never overwrite one another.
export async function onRequestPost({ request, env, params }) {
  if (!(await requireAdmin(request, env))) return json({ error: 'Unauthorized.' }, 401);
  if (!env.DELIVERY_R2) return json({ error: 'Delivery storage is not configured yet.' }, 503);
  if (!sameOrigin(request)) return json({ error: 'Invalid request.' }, 403);
  const d = await loadDelivery(env, params.id);
  if (!d) return json({ error: 'Not found.' }, 404);
  let b;
  try { b = await request.json(); } catch { return json({ error: 'Invalid request.' }, 400); }
  const fid = String(b.fid || '');
  if (!FID_RE.test(fid)) return json({ error: 'Invalid file id.' }, 400);
  const type = b.type === 'video' ? 'video' : 'image';
  const mime = String(b.mime || '');
  const raw = type === 'image' && RAW_TYPES.includes(mime);
  if (!(type === 'image' ? [...IMAGE_TYPES, ...RAW_TYPES] : VIDEO_TYPES).includes(mime)) return json({ error: 'Unsupported file type.' }, 400);
  const original = await env.DELIVERY_R2.head(`${d.id}/${fid}/original`);
  if (!original) return json({ error: 'Original upload not found.' }, 400);
  if (original.size > (type === 'video' ? MAX_VIDEO : raw ? MAX_RAW : MAX_IMAGE)) return json({ error: 'File too large.' }, 400);
  const hasPreview = type === 'image' && !!(await env.DELIVERY_R2.head(`${d.id}/${fid}/preview`));
  const hasPoster = type === 'video' && !!(await env.DELIVERY_R2.head(`${d.id}/${fid}/poster`));
  if (type === 'image' && !hasPreview) return json({ error: 'A watermarked preview is required for images.' }, 400);
  const crc32 = Number.isInteger(b.crc32) && b.crc32 >= 0 && b.crc32 <= 0xffffffff ? b.crc32 : null;
  await putFileRecord(env, d.id, { id: fid, name: cleanName(b.name, 'file'), type, mime, raw, crc32, size: original.size,
    width: Math.round(+b.width) || null, height: Math.round(+b.height) || null, hasPreview, hasPoster, addedAt: Date.now() });
  return json({ ok: true });
}

export async function onRequestDelete({ request, env, params }) {
  if (!(await requireAdmin(request, env))) return json({ error: 'Unauthorized.' }, 401);
  if (!env.DELIVERY_R2) return json({ error: 'Delivery storage is not configured yet.' }, 503);
  if (!sameOrigin(request)) return json({ error: 'Invalid request.' }, 403);
  const d = await loadDelivery(env, params.id);
  if (!d) return json({ error: 'Not found.' }, 404);
  const fid = new URL(request.url).searchParams.get('fid') || '';
  if (!FID_RE.test(fid)) return json({ error: 'Invalid file id.' }, 400);
  await deleteFileObjects(env, d.id, fid);
  return json({ ok: true });
}
