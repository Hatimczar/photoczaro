/*
 * Dynamic sitemap: the static pages plus every published model profile,
 * each in all six languages with hreflang alternates. Built from ROSTER_KV
 * on request so a newly published model appears without a redeploy.
 */
const ORIGIN = "https://models.photoczaro.com";
const LANGS = ["en", "fr", "ru", "es", "cs", "ar"];
const PAGES = [
  { path: "", priority: "1.0", changefreq: "weekly" },
  { path: "/models", priority: "0.9", changefreq: "daily" },
  { path: "/book-talent", priority: "0.8", changefreq: "monthly" },
  { path: "/apply", priority: "0.8", changefreq: "monthly" },
  { path: "/about", priority: "0.6", changefreq: "monthly" },
  { path: "/contact", priority: "0.5", changefreq: "monthly" },
  { path: "/booking-terms", priority: "0.3", changefreq: "yearly" },
  { path: "/privacy-policy", priority: "0.3", changefreq: "yearly" },
];

const xmlEsc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
const loc = (lang, path) => `${ORIGIN}${lang === "en" ? "" : "/" + lang}${path || (lang === "en" ? "/" : "/")}`;

function entry(path, { priority, changefreq, lastmod }) {
  const alts = LANGS.map((l) => `    <xhtml:link rel="alternate" hreflang="${l}" href="${xmlEsc(loc(l, path))}"/>`).join("\n") +
    `\n    <xhtml:link rel="alternate" hreflang="x-default" href="${xmlEsc(loc("en", path))}"/>`;
  return LANGS.map((l) => `  <url>
    <loc>${xmlEsc(loc(l, path))}</loc>
${alts}
${lastmod ? `    <lastmod>${lastmod}</lastmod>\n` : ""}    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`).join("\n");
}

export async function onRequestGet({ env }) {
  const parts = PAGES.map((p) => entry(p.path, p));

  if (env.ROSTER_KV) {
    const list = await env.ROSTER_KV.list({ prefix: "model:" });
    const models = await Promise.all(list.keys.map((k) => env.ROSTER_KV.get(k.name, { type: "json" })));
    for (const m of models) {
      if (!m || !m.published || m.archived || !m.slug) continue;
      const lastmod = (m.updatedAt || "").slice(0, 10) || undefined;
      parts.push(entry(`/models/${m.slug}`, { priority: "0.7", changefreq: "weekly", lastmod }));
    }
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${parts.join("\n")}
</urlset>
`;
  return new Response(xml, { headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=3600" } });
}
