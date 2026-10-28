import { json, loadDelivery, listFiles, getStats, putStats, logEvent, isExpired, publicFile, planZip } from '../../../_lib/delivery.js';

// The private link is the credential: anyone who holds this delivery's id can read its manifest.
export async function onRequestGet({ env, params }) {
  const id = params.id;
  if (!env.DELIVERY_R2) return json({ error: 'Not available.' }, 503);
  const d = await loadDelivery(env, id);
  if (!d) return json({ error: 'Not found.' }, 404);
  if (isExpired(d)) return json({ error: 'This delivery has expired.' }, 410);
  const released = d.status === 'released';
  const files = await listFiles(env, id);
  const plan = planZip(files, d.createdAt);
  // Count a visit at most once every 10 minutes so reloads do not flood the log.
  const st = await getStats(env, id);
  if (!st.lastViewedAt || Date.now() - st.lastViewedAt > 10 * 60 * 1000) {
    st.viewCount = (st.viewCount || 0) + 1;
    st.lastViewedAt = Date.now();
    await putStats(env, id, st);
    await logEvent(env, id, 'opened');
  }
  return json({
    title: d.title,
    modelName: d.modelName,
    note: d.note || '',
    released,
    expiresAt: d.expiresAt || null,
    zip: released && plan.ok ? { size: plan.totalSize } : null,
    files: files.map((f) => publicFile(f, released)),
  });
}
