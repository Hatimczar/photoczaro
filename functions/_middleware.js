export async function onRequest({ request, next }) {
  const url = new URL(request.url);

  // Only auto-redirect the root path
  if (url.pathname !== '/') return next();

  // Don't redirect if the user has already been handled this week
  const cookie = request.headers.get('Cookie') || '';
  if (cookie.includes('pcz_redir=1')) return next();

  const supported = ['fr', 'ru', 'es', 'cs'];
  const acceptLang = request.headers.get('Accept-Language') || '';

  // Parse "fr-FR,fr;q=0.9,en;q=0.8" → ['fr', 'en', ...]
  const langs = acceptLang
    .split(',')
    .map(l => l.split(';')[0].trim().slice(0, 2).toLowerCase());

  const lang = langs.find(l => supported.includes(l));

  // No supported non-English language — serve English as-is
  if (!lang) return next();

  // Redirect once, set cookie so subsequent visits aren't redirected again
  return new Response(null, {
    status: 302,
    headers: {
      'Location': `${url.origin}/${lang}/`,
      'Set-Cookie': 'pcz_redir=1; Path=/; Max-Age=604800; SameSite=Lax',
      'Vary': 'Accept-Language',
      'Cache-Control': 'no-store',
    },
  });
}
