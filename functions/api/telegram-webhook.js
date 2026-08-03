import { tg } from '../_lib/telegram.js';

const WELCOME_TEXT = `Welcome to Photoczaro!

This channel is where I post new shoots, behind-the-scenes, and open casting calls. Quick one so I can tag relevant posts for you.

Are you a Model or an Agency? (or skip if neither)`;

const ROLE_LABELS = {
  model: 'Model',
  agency: 'Agency',
  none: 'Just here to follow',
};

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  if (url.searchParams.get('diag') !== env.TELEGRAM_WEBHOOK_SECRET) {
    return new Response('Forbidden', { status: 401 });
  }
  const info = await tg(env.TELEGRAM_BOT_TOKEN, 'getWebhookInfo', {});
  return json(info);
}

export async function onRequestPost({ request, env }) {
  const secret = request.headers.get('X-Telegram-Bot-Api-Secret-Token');
  if (!env.TELEGRAM_WEBHOOK_SECRET || secret !== env.TELEGRAM_WEBHOOK_SECRET) {
    return new Response('Forbidden', { status: 401 });
  }

  let update;
  try {
    update = await request.json();
  } catch {
    return json({ ok: true });
  }

  const token = env.TELEGRAM_BOT_TOKEN;

  if (update.chat_join_request) {
    const { chat, from } = update.chat_join_request;

    await tg(token, 'approveChatJoinRequest', {
      chat_id: chat.id,
      user_id: from.id,
    });

    await env.TELEGRAM_KV.put(
      `tguser:${from.id}`,
      JSON.stringify({
        username: from.username || null,
        firstName: from.first_name || null,
        role: null,
        joinedAt: new Date().toISOString(),
      })
    );

    await tg(token, 'sendMessage', {
      chat_id: from.id,
      text: WELCOME_TEXT,
      reply_markup: {
        inline_keyboard: [
          [
            { text: 'Model', callback_data: 'role:model' },
            { text: 'Agency', callback_data: 'role:agency' },
          ],
          [{ text: 'Just here to follow', callback_data: 'role:none' }],
        ],
      },
    });

    return json({ ok: true });
  }

  if (update.callback_query) {
    const cb = update.callback_query;
    const match = /^role:(model|agency|none)$/.exec(cb.data || '');

    if (match) {
      const role = match[1];
      const key = `tguser:${cb.from.id}`;
      const existing = await env.TELEGRAM_KV.get(key);
      const record = existing
        ? JSON.parse(existing)
        : { username: cb.from.username || null, firstName: cb.from.first_name || null, joinedAt: new Date().toISOString() };
      record.role = role;
      await env.TELEGRAM_KV.put(key, JSON.stringify(record));

      await tg(token, 'answerCallbackQuery', { callback_query_id: cb.id });

      if (cb.message) {
        await tg(token, 'editMessageText', {
          chat_id: cb.message.chat.id,
          message_id: cb.message.message_id,
          text: `Thanks, tagged as: ${ROLE_LABELS[role]}. Welcome aboard!`,
        });
      }
    } else {
      await tg(token, 'answerCallbackQuery', { callback_query_id: cb.id });
    }

    return json({ ok: true });
  }

  return json({ ok: true });
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
