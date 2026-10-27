import { json, loadDelivery, canAccess, isExpired, publicFile, planZip } from '../../../_lib/delivery.js';

export async function onRequestGet({ request, env, params }) {
  const id = params.id;
  const d = await loadDelivery(env, id);
  if (!d || !(await canAccess(request, env, d))) return json({ error: 'Unauthorized.' }, 401);
  if (isExpired(d)) return json({ error: 'This delivery has expired.' }, 410);
  const released = d.status === 'released';
  const plan = planZip(d.files || [], d.createdAt);
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
