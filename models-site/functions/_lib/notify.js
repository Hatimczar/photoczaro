/*
 * WhatsApp alert for a new booking enquiry.
 *
 * The alert deliberately carries NO personal details (no client name, email,
 * phone, company or notes): those stay in the private enquiry record, which is
 * read in the admin behind Cloudflare Access. WhatsApp and any relay in
 * between only ever see "an enquiry arrived, for these models, on this date".
 *
 * Two providers, chosen by which secrets are set in the Pages project
 * (Settings -> Variables and Secrets). Nothing is sent, and nothing breaks,
 * until one is configured.
 *
 *  A) WhatsApp Business Cloud API (Meta), the official route:
 *       WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_TO
 *       optional: WHATSAPP_TEMPLATE (+ WHATSAPP_TEMPLATE_LANG, default "en")
 *     Business-initiated messages need an approved template; without
 *     WHATSAPP_TEMPLATE a plain text message is sent, which WhatsApp only
 *     delivers inside the 24 hours after you last messaged the business number.
 *     The template body takes three variables: {{1}} models, {{2}} type, {{3}} date.
 *
 *  B) CallMeBot, a free relay for messaging yourself:
 *       CALLMEBOT_APIKEY, WHATSAPP_TO
 */
const HOURLY_CAP = 10;
const ADMIN_URL = "https://models.photoczaro.com/admin";

function digits(v) { return (v || "").toString().replace(/\D/g, ""); }

function summarise(record) {
  const n = Array.isArray(record.selectedModels) ? record.selectedModels.length : 0;
  const models = n ? `${n} model${n === 1 ? "" : "s"}` : "no models selected";
  const type = (record.productionType || "enquiry").toString().slice(0, 40);
  const date = (record.shootDate || "date to be confirmed").toString().slice(0, 20);
  return { models, type, date };
}

export function providerFor(env) {
  if (env.WHATSAPP_TOKEN && env.WHATSAPP_PHONE_NUMBER_ID && env.WHATSAPP_TO) return "meta";
  if (env.CALLMEBOT_APIKEY && env.WHATSAPP_TO) return "callmebot";
  return null;
}

async function underCap(env) {
  if (!env.ENQUIRIES_KV) return true;
  const key = `notify:${new Date().toISOString().slice(0, 13)}`;
  const count = parseInt((await env.ENQUIRIES_KV.get(key)) || "0", 10);
  if (count >= HOURLY_CAP) return false;
  await env.ENQUIRIES_KV.put(key, String(count + 1), { expirationTtl: 7200 });
  return true;
}

async function sendMeta(env, s) {
  const to = digits(env.WHATSAPP_TO);
  const url = `https://graph.facebook.com/v21.0/${encodeURIComponent(env.WHATSAPP_PHONE_NUMBER_ID)}/messages`;
  const message = env.WHATSAPP_TEMPLATE
    ? { type: "template", template: { name: env.WHATSAPP_TEMPLATE, language: { code: env.WHATSAPP_TEMPLATE_LANG || "en" },
        components: [{ type: "body", parameters: [s.models, s.type, s.date].map((text) => ({ type: "text", text })) }] } }
    : { type: "text", text: { body: `New booking enquiry on Photoczaro Models: ${s.models}, ${s.type}, shoot date ${s.date}. Read it in the admin: ${ADMIN_URL}` } };
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${env.WHATSAPP_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", to, ...message }),
  });
  if (!res.ok) throw new Error(`WhatsApp API ${res.status}`);
}

async function sendCallMeBot(env, s) {
  const text = `New booking enquiry on Photoczaro Models: ${s.models}, ${s.type}, shoot date ${s.date}. Read it in the admin: ${ADMIN_URL}`;
  const url = `https://api.callmebot.com/whatsapp.php?phone=${encodeURIComponent(digits(env.WHATSAPP_TO))}&text=${encodeURIComponent(text)}&apikey=${encodeURIComponent(env.CALLMEBOT_APIKEY)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`CallMeBot ${res.status}`);
}

/* Never throws: a failed alert must not affect the visitor's submission. */
export async function notifyNewEnquiry(env, key, record) {
  const provider = providerFor(env);
  const result = { channel: provider || "none", at: new Date().toISOString() };
  try {
    if (!provider) { result.ok = false; result.error = "not_configured"; }
    else if (!(await underCap(env))) { result.ok = false; result.error = "hourly_cap"; }
    else {
      const s = summarise(record);
      if (provider === "meta") await sendMeta(env, s); else await sendCallMeBot(env, s);
      result.ok = true;
    }
  } catch (err) {
    result.ok = false;
    result.error = String(err && err.message || err).slice(0, 120);
  }
  try {
    if (env.ENQUIRIES_KV) await env.ENQUIRIES_KV.put(key, JSON.stringify({ ...record, notification: result }));
  } catch { /* the enquiry itself is already stored */ }
  return result;
}
