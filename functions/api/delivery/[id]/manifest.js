import { json, loadDelivery, saveDelivery, logEvent, isExpired, publicFile, planZip } from '../../../_lib/delivery.js';

// The private link is the credential: anyone who holds this delivery's id can read its manifest.
export async function onRequestGet({ env, params }) {
  const id = params.id;
  const d = await loadDelivery(env, id);
  if (!d) return json({ error: 'Not found.' }, 404);
  if (isExpired(d)) return json({ error: 'This delivery has expired.' }, 410);
  const released = d.status === 'released';
  const plan = planZip(d.files || [], d.createdAt);
  // Count a visit at most once every 10 minutes so reloads do not flood the log.
  if (!d.lastViewedAt || Date.now() - d.lastViewedAt > 10 * 60 * 1000) {
    d.viewCount = (d.viewCount || 0) + 1;
    d.lastViewedAt = Date.now();
    await saveDelivery(env, d);
    await logEvent(env, id, 'opened');
  }
  return json({
    title: d.title,
    modelName: d.modelName,
    note: d.note || '',
    released,
    expiresAt: d.expiresAt || null,
    zip: released && plan.ok ? { size: plan.totalSize } : null,
    files: (d.files || []).map((f) => publicFile(f, released)),
  });
}
