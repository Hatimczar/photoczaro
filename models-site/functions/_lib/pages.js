/*
 * Server-rendered roster pages (/, /models and their /fr|ru|es|cs|ar
 * variants). The static HTML is fetched from the asset store and the roster
 * grid is written into it, so crawlers and no-JS visitors get real model
 * names, photographs and profile links. The browser then takes over
 * (filtering, shortlist) from the same data via /api/models.
 */
import Render from "../../js/render.js";
import { loadPublishedModels } from "./public-model.js";

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

export async function renderHomePage(context, lang) {
  const template = await fetchTemplate(context, "/");
  const models = await loadPublishedModels(context.env);
  const top = models.slice(0, 12);
  const html = Render.gridHtml(top, { path: pathFor(lang) });
  const res = new HTMLRewriter()
    .on("#home-model-grid", { element(el) { el.setInnerContent(html, { html: true }); el.setAttribute("data-key", top.map((m) => m.slug).join(",")); } })
    .transform(template);
  return finish(res);
}

export async function renderModelsPage(context, lang) {
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

  const res = new HTMLRewriter()
    .on("#models-grid", { element(el) { el.setInnerContent(html, { html: true }); el.setAttribute("data-key", results.map((m) => m.slug).join(",")); } })
    .on("#f-location", { element(el) { el.setInnerContent(Render.locationOptionsHtml(models, filters.location), { html: true }); } })
    .on("#f-count", { element(el) { el.setInnerContent(Render.countHtml(results.length)); } })
    .on("#empty-state", { element(el) { if (results.length === 0 && !menOnly) el.removeAttribute("hidden"); } })
    .on("#empty-men", { element(el) { if (results.length === 0 && menOnly) el.removeAttribute("hidden"); } })
    .transform(template);
  return finish(res);
}
