/*
 * Server-side translation of language-prefixed pages (/fr/..., /ar/...).
 * js/i18n.js has always swapped the text in the browser; doing the same swap
 * here means a translated page arrives already translated: search engines
 * index real French/Arabic/... content, and nothing jumps when the script
 * runs (the English-then-translated swap was a large layout shift on mobile).
 * Same dictionary, same data-i18n attributes, same fallback to English.
 */
let DICT = null;

async function loadDict(context) {
  if (DICT) return DICT;
  const res = await context.env.ASSETS.fetch(new Request(new URL("/js/i18n-data.js", context.request.url)));
  const src = await res.text();
  // The file is a JS object literal; make it JSON (quote the language keys,
  // drop trailing commas) so it can be parsed without evaluating code.
  const body = src.slice(src.indexOf("{", src.indexOf("PHOTOCZARO_I18N_DICT")), src.lastIndexOf("}") + 1)
    .replace(/^(en|fr|ru|es|cs|ar): \{/gm, '"$1": {')
    .replace(/,(\s*[}\]])/g, "$1");
  DICT = JSON.parse(body);
  return DICT;
}

/* HTMLRewriter hands attribute values back still HTML-escaped. */
const unescapeAttr = (s) => s.replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");

/* A t(key, fallback) for building copy (titles, descriptions) in a language. */
export async function getTranslator(context, lang) {
  if (!lang || lang === "en") return (key, fallback) => fallback;
  const dict = await loadDict(context);
  return (key, fallback) => {
    const v = dict[lang] && Object.prototype.hasOwnProperty.call(dict[lang], key) ? dict[lang][key] : dict.en[key];
    return v == null ? fallback : v;
  };
}

const RTL_LANGS = ["ar"];

/* Arabic-only refinements (other languages keep their current behaviour until
   they are reviewed the same way): links that must stay inside /ar/, and the
   measurement form's "e.g." examples and unit labels in Arabic. */
const AR_ONLY = ["ar"];

export async function translateResponse(context, res, lang) {
  if (!lang || lang === "en") return res;
  const dict = await loadDict(context);
  const t = (key) => {
    const v = dict[lang] && Object.prototype.hasOwnProperty.call(dict[lang], key) ? dict[lang][key] : dict.en[key];
    return v == null ? null : v;
  };
  const attr = (selector, source, name) => ({
    selector,
    handler: { element(el) { const v = t(el.getAttribute(source)); if (v != null) el.setAttribute(name, v); } },
  });
  const rules = [
    { selector: "[data-i18n]", handler: { element(el) { const v = t(el.getAttribute("data-i18n")); if (v != null) el.setInnerContent(v); } } },
    { selector: "[data-i18n-html]", handler: { element(el) { const v = t(el.getAttribute("data-i18n-html")); if (v != null) el.setInnerContent(v, { html: true }); } } },
    attr("[data-i18n-placeholder]", "data-i18n-placeholder", "placeholder"),
    attr("[data-i18n-aria-label]", "data-i18n-aria-label", "aria-label"),
    attr("[data-i18n-title]", "data-i18n-title", "title"),
    {
      selector: "[data-i18n-alt]",
      handler: {
        element(el) {
          const template = t(el.getAttribute("data-i18n-alt"));
          if (template == null) return;
          let vars = {};
          try { vars = JSON.parse(unescapeAttr(el.getAttribute("data-alt-vars") || "{}")); } catch (e) { /* keep defaults */ }
          const city = vars.city ? (t("city." + String(vars.city).toLowerCase().replace(/[^a-z]/g, "")) || vars.city) : "";
          el.setAttribute("alt", template.replace("{name}", vars.name || "").replace("{city}", city).replace("{n}", vars.n || ""));
        },
      },
    },
    { selector: "[data-xsite]", handler: { element(el) {
      const langs = (el.getAttribute("data-xsite-langs") || "").split(/\s+/);
      if (langs.includes(lang)) el.setAttribute("href", `https://photoczaro.com/${lang}/${el.getAttribute("data-xsite")}`);
    } } },
    { selector: "[data-blog-guide]", handler: { element(el) { el.setAttribute("href", `https://photoczaro.com/${lang}/blog/book-models-dubai-uae-photoczaro-models-roster`); } } },
  ];
  if (AR_ONLY.includes(lang)) {
    // Root-absolute links to this site's own home would leave the language.
    rules.push({ selector: 'a[href="/"]', handler: { element(el) { el.setAttribute("href", `/${lang}/`); } } });
    rules.push({ selector: 'a[href="/models"]', handler: { element(el) { el.setAttribute("href", `/${lang}/models`); } } });
    // "e.g. 178" -> "مثال: 178" (display text only; the value logic never reads it).
    const example = t("form.exampleShort");
    const localiseExample = (v) => (example && v ? v.replace(/^e\.g\. (.+)$/, (m, n) => example.replace("{n}", n)) : v);
    rules.push({ selector: "[data-ph-cm]", handler: { element(el) {
      for (const a of ["placeholder", "data-ph-cm", "data-ph-in"]) { const v = el.getAttribute(a); if (v) el.setAttribute(a, localiseExample(v)); }
    } } });
    // "(cm)" next to a field label -> "(سم)"; apply.js keeps it in step with the CM/IN switch.
    rules.push({ selector: "[data-unit-suffix]", handler: { element(el) { const u = t("vocab.unit.cm"); if (u) el.setInnerContent(`(${u})`); } } });
  }
  // The page's language and direction are part of the HTML itself, not
  // something the browser script fixes up after load (screen readers,
  // crawlers and the first paint all see the right values). Arabic also
  // gets the "rtl" class js/i18n.js would otherwise add, so layout does not
  // flip when the script runs.
  rules.unshift({
    selector: "html",
    handler: {
      element(el) {
        el.setAttribute("lang", lang);
        el.setAttribute("dir", RTL_LANGS.includes(lang) ? "rtl" : "ltr");
        if (RTL_LANGS.includes(lang)) {
          const cls = el.getAttribute("class") || "";
          if (!/(^|\s)rtl(\s|$)/.test(cls)) el.setAttribute("class", (cls + " rtl").trim());
        }
      },
    },
  });
  let rewriter = new HTMLRewriter();
  for (const r of rules) rewriter = rewriter.on(r.selector, r.handler);
  return rewriter.transform(res);
}
