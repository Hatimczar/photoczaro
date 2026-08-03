const API_BASE = 'https://api.telegram.org/bot';

export async function tg(token, method, payload) {
  const res = await fetch(`${API_BASE}${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return res.json();
}
