import { json, requireAdmin, sameOrigin, loadDelivery, createCode, logEvent } from '../../../../_lib/delivery.js';

// Generates a one-time code for the admin to pass on personally (WhatsApp, call, in person).
export async function onRequestPost({ request, env, params }) {
  if (!(await requireAdmin(request, env))) return json({ error: 'Unauthorized.' }, 401);
  if (!sameOrigin(request)) return json({ error: 'Invalid request.' }, 403);
  const d = await loadDelivery(env, params.id);
  if (!d) return json({ error: 'Not found.' }, 404);
  const code = await createCode(env, d.id);
  await logEvent(env, d.id, 'code_generated_by_admin');
  return json({ code, validMinutes: 10, email: d.email });
}
