/* TEMPORARY one-shot: posts the UAE modeling guide to the Photoczaro Telegram channel with the
   project's configured bot, then refuses to run again. Removed right after use. */
import { tg } from '../_lib/telegram.js';

const KEY = 'fa39d0728c245a606d5b89c8bc241657';
const CAPTION = `🌍 New on the Photoczaro Journal: Modeling in the UAE, the honest guide

Whether you live in the UAE or are coming for the season, this covers what most models are never told clearly:
🛂 Visas and work permission
🚩 Agency red flags and upfront fees
📝 What a fair contract and booking confirmation include
🔒 Safety, money and your first week

📖 Read it free: https://photoczaro.com/blog/modeling-in-uae-honest-guide?utm_source=telegram&utm_medium=social&utm_campaign=uae_guide

Live in the UAE and 18 or over? Apply to the roster for free: https://models.photoczaro.com/apply?utm_source=telegram&utm_medium=social&utm_campaign=uae_guide`;
const PHOTO = 'https://photoczaro.com/images/Blog__modeling-in-uae-honest-guide-ai-illustration.webp';

export async function onRequestPost({ request, env }) {
  if (request.headers.get('x-key') !== KEY) return new Response('Forbidden', { status: 403 });
  if (!env.TELEGRAM_BOT_TOKEN) return Response.json({ ok: false, error: 'no bot token configured' });
  if (await env.TELEGRAM_KV.get('announce:uae_guide')) return Response.json({ ok: false, error: 'already sent' });
  const chat = new URL(request.url).searchParams.get('chat') || '@photoczaro';
  const r = await tg(env.TELEGRAM_BOT_TOKEN, 'sendPhoto', { chat_id: chat, photo: PHOTO, caption: CAPTION });
  if (r.ok) await env.TELEGRAM_KV.put('announce:uae_guide', JSON.stringify({ at: new Date().toISOString(), chat, message_id: r.result.message_id }));
  return Response.json({ ok: r.ok, description: r.description, message_id: r.result && r.result.message_id, chat: r.result && r.result.chat && { title: r.result.chat.title, type: r.result.chat.type, username: r.result.chat.username } });
}
