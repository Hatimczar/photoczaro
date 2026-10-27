import { json, loadDelivery, hasSession, isExpired, publicFile } from '../../../_lib/delivery.js';

export async function onRequestGet({ request, env, params }) {
  const id = params.id;
  const d = await loadDelivery(env, id);
  if (!d || !(await hasSession(request, env, id))) return json({ error: 'Unauthorized.' }, 401);
  if (isExpired(d)) return json({ error: 'This delivery has expired.' }, 410);
  const released = d.status === 'released';
  return json({
    title: d.title,
    modelName: d.modelName,
    note: d.note || '',
    released,
    expiresAt: d.expiresAt || null,
    files: (d.files || []).map((f) => publicFile(f, released)),
  });
}
