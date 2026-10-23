/* TEMPORARY one-shot: posts the roster invitation to the Photoczaro Telegram channel using the
   bot already configured for this project, then refuses to run again. Removed right after use. */
import { tg } from '../_lib/telegram.js';

const KEY = '1a7922605139a90ddb9df97a841b97a1';
const TEXT = `✨ Photoczaro Models is open for applications ✨

If you're 18 or over and live in the UAE, you can apply to join the roster. Brands, agencies and photographers browse it to book models for editorial, commercial and campaign work. 📸

✅ Free to apply
🤝 Non-exclusive, so you can work with other agencies
📱 Simple phone photos are enough to start
👀 Every application is reviewed personally

Applying doesn't guarantee acceptance or bookings, and paid photography is never a condition.

👉 Apply here: https://models.photoczaro.com/apply?utm_source=telegram&utm_medium=social&utm_campaign=roster_invite

💡 Not sure which photos to send? Read this first: https://photoczaro.com/blog/why-model-photos-get-ignored-dubai?utm_source=telegram&utm_medium=social&utm_campaign=roster_invite`;

export async function onRequestPost({ request, env }) {
  if (request.headers.get('x-key') !== KEY) return new Response('Forbidden', { status: 403 });
  if (!env.TELEGRAM_BOT_TOKEN) return Response.json({ ok: false, error: 'no bot token configured' });
  if (await env.TELEGRAM_KV.get('announce:roster_invite')) return Response.json({ ok: false, error: 'already sent' });
  const url = new URL(request.url);
  const chat = url.searchParams.get('chat') || '@photoczaro';
  const r = await tg(env.TELEGRAM_BOT_TOKEN, 'sendMessage', { chat_id: chat, text: TEXT });
  if (r.ok) await env.TELEGRAM_KV.put('announce:roster_invite', JSON.stringify({ at: new Date().toISOString(), chat, message_id: r.result.message_id }));
  return Response.json({ ok: r.ok, description: r.description, message_id: r.result && r.result.message_id, chat: r.result && r.result.chat && { title: r.result.chat.title, type: r.result.chat.type, username: r.result.chat.username } });
}
