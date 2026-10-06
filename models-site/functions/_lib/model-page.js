/*
 * Serves model.html for /models/:slug (and the /fr|ru|es|cs|ar/ variants)
 * with the model's own title, description and headshot written into the
 * <head>. Link-preview crawlers (WhatsApp, iMessage, Slack, Facebook, X)
 * don't run JavaScript, so the client-side meta updates in model.html never
 * reach them; without this they'd all show the generic site image.
 * Unknown or unpublished slugs get the plain template as a real 404 with
 * noindex, so search engines drop them.
 */
import Render from "../../js/render.js";
import { profileDescription, profileJsonLd } from "./profile-seo.js";
import { toPublicModel, loadPublishedModels } from "./public-model.js";
import { fetchTemplate, finish } from "./pages.js";

const LANGS = ["fr", "ru", "es", "cs", "ar"];
const ORIGIN = "https://models.photoczaro.com";

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

export async function renderModelPage({ request, env }, lang, slug) {
  const template = await fetchTemplate({ request, env }, "/model");

  let record = null;
  if (env.ROSTER_KV && slug && /^[a-z0-9-]+$/.test(slug)) {
    record = await env.ROSTER_KV.get(`model:${slug}`, { type: "json" });
  }
  if (!record || !record.published || record.archived) {
    // Unknown or unpublished profile: a real 404 that search engines drop,
    // instead of the template answering 200 with an empty page.
    const gone = new HTMLRewriter()
      .on('meta[name="robots"]', { element(el) { el.setAttribute("content", "noindex, nofollow"); } })
      .transform(template);
    return finish(gone, 404);
  }

  const model = toPublicModel(record);
  const prefix = lang && LANGS.includes(lang) ? `/${lang}` : "";
  const canonical = `${ORIGIN}${prefix}/models/${model.slug}`;
  const title = model.seoTitle || `${model.name} | Photoczaro Models Dubai`;
  const description = profileDescription(model);
  const image = model.images?.headshot ? `${ORIGIN}/media/${model.images.headshot}` : null;

  const setContent = (value) => ({ element(el) { el.setAttribute("content", value); } });
  const setHref = (value) => ({ element(el) { el.setAttribute("href", value); } });

  // The profile body itself is rendered here too, so crawlers and no-JS
  // visitors get the model's details, photographs and related profiles.
  const roster = await loadPublishedModels(env);
  const body = Render.profileHtml(model, { path: (p) => `${prefix}${p}`, models: roster });

  let rewriter = new HTMLRewriter()
    .on("#profile-root", {
      element(el) {
        el.setInnerContent(body, { html: true });
        el.setAttribute("data-ssr", "1");
        el.setAttribute("data-share-url", canonical);
        el.setAttribute("data-share-title", title);
      },
    })
    .on("title", { element(el) { el.setInnerContent(title); } })
    .on("#page-description", setContent(description))
    .on("#page-canonical", setHref(canonical))
    .on("#page-og-title", setContent(title))
    .on("#page-og-description", setContent(description))
    .on("#page-og-url", setContent(canonical))
    .on("#page-twitter-title", setContent(title))
    .on("#page-twitter-description", setContent(description))
    .on("head", { element(el) { el.append(`<script type="application/ld+json">${profileJsonLd(model, canonical, image)}</script>`, { html: true }); } });

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

  return finish(rewriter.transform(template), 200);
}
