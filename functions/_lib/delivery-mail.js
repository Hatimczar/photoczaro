// Sends the one-time code by email through Resend when RESEND_API_KEY is configured.
// Without it the code is not emailed; the admin can generate a code and pass it on personally.
export async function sendCodeEmail(env, to, code, title) {
  if (!env.RESEND_API_KEY) return { sent: false, reason: 'no-provider' };
  const from = env.DELIVERY_FROM || 'Photoczaro <delivery@photoczaro.com>';
  const safeTitle = String(title || 'your delivery').replace(/[<>&"]/g, '');
  const html = `<div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:24px;color:#111">
<p style="font-size:13px;letter-spacing:.2em;text-transform:uppercase;color:#8a6d2f">Photoczaro</p>
<p>Your one-time code to open <strong>${safeTitle}</strong>:</p>
<p style="font-size:32px;letter-spacing:.35em;font-weight:bold;margin:20px 0">${code}</p>
<p style="color:#555;font-size:14px">The code works for 10 minutes. If you did not ask for it, you can ignore this email: nobody can open the delivery without it.</p></div>`;
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [to], subject: 'Your Photoczaro delivery code', html, text: `Your one-time code to open ${safeTitle}: ${code}\nIt works for 10 minutes.` }),
    });
    return { sent: res.ok, status: res.status };
  } catch (e) {
    return { sent: false, reason: 'fetch-failed' };
  }
}
