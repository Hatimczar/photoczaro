/*
 * Serves model.html for /models/:slug (and the /fr|ru|es|cs|ar/ variants)
 * with the model's own title, description and headshot written into the
 * <head>. Link-preview crawlers (WhatsApp, iMessage, Slack, Facebook, X)
 * don't run JavaScript, so the client-side meta updates in model.html never
 * reach them; without this they'd all show the generic site image.
 * Unknown or unpublished slugs fall through to the plain template, which
 * renders its own "not found" state.
 */
const LANGS = ["fr", "ru", "es", "cs", "ar"];
const ORIGIN = "https://models.photoczaro.com";

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

export async function renderModelPage({ request, env }, lang, slug) {
  const url = new URL(request.url);
  const template = await env.ASSETS.fetch(new Request(new URL("/model", url), { headers: request.headers }));

  let model = null;
  if (env.ROSTER_KV && slug && /^[a-z0-9-]+$/.test(slug)) {
    model = await env.ROSTER_KV.get(`model:${slug}`, { type: "json" });
  }
  if (!model || !model.published || model.archived) return template;

  const prefix = lang && LANGS.includes(lang) ? `/${lang}` : "";
  const canonical = `${ORIGIN}${prefix}/models/${model.slug}`;
  const title = model.seoTitle || `${model.name} | Photoczaro Models Dubai`;
  const description = model.seoDescription || `${model.name}, a Photoczaro Models roster talent based in the UAE.`;
  const image = model.images?.headshot ? `${ORIGIN}/media/${model.images.headshot}` : null;

  const setContent = (value) => ({ element(el) { el.setAttribute("content", value); } });
  const setHref = (value) => ({ element(el) { el.setAttribute("href", value); } });

  let rewriter = new HTMLRewriter()
    .on("title", { element(el) { el.setInnerContent(title); } })
    .on("#page-description", setContent(description))
    .on("#page-canonical", setHref(canonical))
    .on("#page-og-title", setContent(title))
    .on("#page-og-description", setContent(description))
    .on("#page-og-url", setContent(canonical))
    .on("#page-twitter-title", setContent(title))
    .on("#page-twitter-description", setContent(description));

  for (const code of ["en", "fr", "ru", "es", "cs", "ar", "x-default"]) {
    const p = code === "x-default" || code === "en" ? "" : `/${code}`;
    rewriter = rewriter.on(`#hreflang-${code}`, setHref(`${ORIGIN}${p}/models/${model.slug}`));
  }

  if (image) {
    rewriter = rewriter
      .on('meta[property="og:image"]', {
        element(el) {
          el.setAttribute("content", image);
          el.after(`<meta property="og:image:alt" content="${esc(model.name)}">`, { html: true });
        },
      })
      // Real dimensions are unknown, and the template's 1200x630 would be wrong.
      .on('meta[property="og:image:width"]', { element(el) { el.remove(); } })
      .on('meta[property="og:image:height"]', { element(el) { el.remove(); } })
      .on('meta[name="twitter:image"]', setContent(image));
  }

  const res = rewriter.transform(template);
  const headers = new Headers(res.headers);
  headers.set("Cache-Control", "public, max-age=0, must-revalidate");
  return new Response(res.body, { status: 200, headers });
}
