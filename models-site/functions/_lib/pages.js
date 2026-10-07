/*
 * Server-rendered roster pages (/, /models and their /fr|ru|es|cs|ar
 * variants). The static HTML is fetched from the asset store and the roster
 * grid is written into it, so crawlers and no-JS visitors get real model
 * names, photographs and profile links. The browser then takes over
 * (filtering, shortlist) from the same data via /api/models.
 */
import Render from "../../js/render.js";
import { loadPublishedModels } from "./public-model.js";
import { localizeHead } from "./page-meta.js";

export const LANGS = ["fr", "ru", "es", "cs", "ar"];

const pathFor = (lang) => (p) => (lang ? `/${lang}${p}` : p);

/* The template is always fetched unconditionally. Forwarding the browser's
   If-None-Match / If-Modified-Since would make the asset store answer
   304 with an empty body, which this function would then wrap in a 200:
   a blank page for anyone revisiting. */
export async function fetchTemplate({ request, env }, assetPath) {
  const url = new URL(request.url);
  const headers = new Headers(request.headers);
  ["if-none-match", "if-modified-since", "if-match", "if-unmodified-since", "if-range", "range"].forEach((h) => headers.delete(h));
  return env.ASSETS.fetch(new Request(new URL(assetPath, url), { headers }));
}

/* The page is built per request from live data, so the static file's
   validators must not travel with it. */
export function finish(res, status) {
  const headers = new Headers(res.headers);
  headers.delete("ETag");
  headers.delete("Last-Modified");
  headers.set("Cache-Control", "public, max-age=0, must-revalidate");
  return new Response(res.body, { status: status ?? res.status, headers });
}

export function renderHomePage(context, lang) {
  return edgeCached(context, () => buildHomePage(context, lang));
}

async function buildHomePage(context, lang) {
  const template = await fetchTemplate(context, "/");
  const models = await loadPublishedModels(context.env);
  const top = models.slice(0, 12);
  const html = Render.gridHtml(top, { path: pathFor(lang) });
  let rewriter = new HTMLRewriter();
  if (lang) rewriter = localizeHead(rewriter, lang, "home");
  const res = rewriter
    .on("#home-model-grid", { element(el) { el.setInnerContent(html, { html: true }); el.setAttribute("data-key", top.map((m) => m.slug).join(",")); } })
    .transform(template);
  return finish(res);
}

export function renderModelsPage(context, lang) {
  return edgeCached(context, () => buildModelsPage(context, lang));
}

async function buildModelsPage(context, lang) {
  const url = new URL(context.request.url);
  const template = await fetchTemplate(context, "/models");
  const models = await loadPublishedModels(context.env);

  const q = url.searchParams;
  const filters = {
    category: q.get("category") || "",
    subcategory: q.get("subcategory") || "",
    location: q.get("location") || "",
    height: q.get("height") || "",
    newFace: q.get("newFace") === "1",
  };
  const results = Render.filterModels(models, filters);
  const menOnly = filters.category === "men" && Render.noMalesPublished(models);
  const html = Render.gridHtml(results, { path: pathFor(lang), showHeight: true });

  let rewriter = new HTMLRewriter();
  if (lang) rewriter = localizeHead(rewriter, lang, "models");
  // Structured list of the roster for search engines.
  const origin = "https://models.photoczaro.com";
  const prefix = lang ? `/${lang}` : "";
  const itemList = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Photoczaro Models roster",
    url: `${origin}${prefix}/models`,
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: models.length,
      itemListElement: models.map((m, i) => ({ "@type": "ListItem", position: i + 1, url: `${origin}${prefix}/models/${m.slug}`, name: m.name })),
    },
  }).replace(/</g, "\\u003c");
  const res = rewriter
    .on("head", { element(el) { el.append(`<script type="application/ld+json">${itemList}</script>`, { html: true }); } })
    .on("#models-grid", { element(el) { el.setInnerContent(html, { html: true }); el.setAttribute("data-key", results.map((m) => m.slug).join(",")); } })
    .on("#f-location", { element(el) { el.setInnerContent(Render.locationOptionsHtml(models, filters.location), { html: true }); } })
    .on("#f-count", { element(el) { el.setInnerContent(Render.countHtml(results.length)); } })
    .on("#empty-state", { element(el) { if (results.length === 0 && !menOnly) el.removeAttribute("hidden"); } })
    .on("#empty-men", { element(el) { if (results.length === 0 && menOnly) el.removeAttribute("hidden"); } })
    .transform(template);
  return finish(res);
}

const STATIC_PAGES = ["book-talent", "apply", "about", "contact", "booking-terms", "privacy-policy"];

/* /fr/about, /ar/contact, ...: the same static page with its own canonical,
   language and translated head. */
export async function renderStaticPage(context, lang, page) {
  if (!LANGS.includes(lang) || !STATIC_PAGES.includes(page)) return null;
  const template = await fetchTemplate(context, "/" + page);
  return finish(localizeHead(new HTMLRewriter(), lang, page).transform(template));
}

/* Pages are built from live roster data, which made the document itself the
   slowest part of a first visit (a KV list plus one read per model on every
   request). The finished HTML is kept at the edge for a minute, the same
   freshness the public feed already had, so an admin edit still shows up
   within a minute. Browsers are told to revalidate as before. Only plain
   200 pages without a query string are stored. */
export async function edgeCached(context, build, ttl = 60) {
  const url = new URL(context.request.url);
  if (context.request.method !== "GET" || url.search || typeof caches === "undefined") return build();
  const key = new Request(url.origin + url.pathname, { method: "GET" });
  const hit = await caches.default.match(key);
  if (hit) {
    const out = new Response(hit.body, hit);
    out.headers.set("Cache-Control", "public, max-age=0, must-revalidate");
    out.headers.set("X-Page-Cache", "hit");
    return out;
  }
  const res = await build();
  if (res.status === 200) {
    const store = new Response(res.clone().body, res);
    store.headers.set("Cache-Control", `public, max-age=${ttl}`);
    context.waitUntil(caches.default.put(key, store));
  }
  return res;
}
