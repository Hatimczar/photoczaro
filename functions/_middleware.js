import { getCookie, verifyToken } from './_lib/auth.js';

export async function onRequest({ request, next, env }) {
  const url = new URL(request.url);

  // Gate the publisher gallery page and its preview images/manifests.
  const isGalleryPage = url.pathname === '/for-publishers/gallery.html' || url.pathname === '/for-publishers/gallery';
  const isGalleryAsset = url.pathname.startsWith('/images/publishers/');

  if (isGalleryPage || isGalleryAsset) {
    const token = getCookie(request, 'pcz_pub_session');
    const payload = token ? await verifyToken(token, env.SESSION_SECRET) : null;

    if (!payload || !payload.email) {
      if (isGalleryAsset) {
        return new Response('Forbidden', { status: 403 });
      }
      return new Response(null, {
        status: 302,
        headers: { Location: '/for-publishers/login.html', 'Cache-Control': 'no-store' },
      });
    }
  }

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
