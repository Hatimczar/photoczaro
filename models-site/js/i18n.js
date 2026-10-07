/*
 * Client-side i18n engine. Language is detected from a URL path prefix
 * (/fr/, /ru/, /es/, /cs/, /ar/, matching photoczaro.com's own locale
 * convention; English is the unprefixed root, same as the main site).
 * Cloudflare Pages rewrites each language prefix (see _redirects) onto the
 * same English HTML file with a 200 status, so the URL bar keeps the
 * language prefix while this script swaps the visible text on load.
 *
 * Elements opt in via:
 *   data-i18n="key"              -> textContent
 *   data-i18n-html="key"         -> innerHTML (only for trusted, our-own dictionary HTML)
 *   data-i18n-placeholder="key"  -> placeholder attribute
 *   data-i18n-aria-label="key"   -> aria-label attribute
 *   data-i18n-title="key"        -> title attribute
 *   data-i18n-content="key"      -> content attribute (meta tags)
 */
(function () {
  const SUPPORTED = ["en", "fr", "ru", "es", "cs", "ar"];
  const RTL = ["ar"];

  function detectLang() {
    const seg = window.location.pathname.split("/")[1];
    return SUPPORTED.includes(seg) ? seg : "en";
  }

  const lang = detectLang();
  const dir = RTL.includes(lang) ? "rtl" : "ltr";
  document.documentElement.lang = lang;
  document.documentElement.dir = dir;
  if (dir === "rtl") document.documentElement.classList.add("rtl");

  /* Strip the language prefix from the current path, returning a
     root-relative path with no trailing slash (e.g. "/models", ""). */
  function unprefixedPath() {
    const parts = window.location.pathname.split("/").filter(Boolean);
    if (parts.length && SUPPORTED.includes(parts[0]) && parts[0] !== "en") parts.shift();
    return "/" + parts.join("/");
  }

  /* Build a path for a given language from a root-relative path (no prefix). */
  function langPath(targetLang, rootPath) {
    const clean = rootPath === "/" ? "" : rootPath.replace(/^\/+/, "");
    if (targetLang === "en") return "/" + clean;
    return "/" + targetLang + (clean ? "/" + clean : "/");
  }

  /* Prefix an already root-relative internal path (e.g. "/models/amara")
     with the current language, for links built dynamically in JS. */
  function path(rootPath) {
    return langPath(lang, rootPath);
  }

  function applyDictionary() {
    const dict = (window.PHOTOCZARO_I18N_DICT && window.PHOTOCZARO_I18N_DICT[lang]) || {};
    const fallback = (window.PHOTOCZARO_I18N_DICT && window.PHOTOCZARO_I18N_DICT.en) || {};
    function t(key) {
      return Object.prototype.hasOwnProperty.call(dict, key) ? dict[key] : fallback[key];
    }
    document.querySelectorAll("[data-i18n]").forEach((el) => {
      const v = t(el.getAttribute("data-i18n"));
      if (v != null) el.textContent = v;
    });
    document.querySelectorAll("[data-i18n-html]").forEach((el) => {
      const v = t(el.getAttribute("data-i18n-html"));
      if (v != null) el.innerHTML = v;
    });
    document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
      const v = t(el.getAttribute("data-i18n-placeholder"));
      if (v != null) el.setAttribute("placeholder", v);
    });
    document.querySelectorAll("[data-i18n-aria-label]").forEach((el) => {
      const v = t(el.getAttribute("data-i18n-aria-label"));
      if (v != null) el.setAttribute("aria-label", v);
    });
    document.querySelectorAll("[data-i18n-title]").forEach((el) => {
      const v = t(el.getAttribute("data-i18n-title"));
      if (v != null) el.setAttribute("title", v);
    });
    /* Image alt text with placeholders: data-i18n-alt="alt.fullFront" plus
       data-alt-vars='{"name":"...","city":"Dubai"}' ({city} is translated). */
    document.querySelectorAll("[data-i18n-alt]").forEach((el) => {
      const template = t(el.getAttribute("data-i18n-alt"));
      if (template == null) return;
      let vars = {};
      try { vars = JSON.parse(el.getAttribute("data-alt-vars") || "{}"); } catch (e) { /* keep defaults */ }
      const cityKey = "city." + String(vars.city || "").toLowerCase().replace(/[^a-z]/g, "");
      const city = vars.city ? (t(cityKey) || vars.city) : "";
      el.setAttribute("alt", template.replace("{name}", vars.name || "").replace("{city}", city).replace("{n}", vars.n || ""));
    });
    document.querySelectorAll("[data-i18n-content]").forEach((el) => {
      const v = t(el.getAttribute("data-i18n-content"));
      if (v != null) el.setAttribute("content", v);
    });
    document.querySelectorAll("[data-blog-guide]").forEach((el) => {
      el.setAttribute("href", "https://photoczaro.com" + (lang === "en" ? "" : "/" + lang) + "/blog/book-models-dubai-uae-photoczaro-models-roster");
    });
    renderSwitchers();
    window.dispatchEvent(new CustomEvent("photoczaro:i18n-applied", { detail: { lang } }));
  }

  function buildSwitcherHref(targetLang) {
    return langPath(targetLang, unprefixedPath());
  }

  const LANG_LABELS = { en: "EN", fr: "FR", ru: "RU", es: "ES", cs: "CS", ar: "AR" };
  const LANG_NAMES = { en: "English", fr: "Français", ru: "Русский", es: "Español", cs: "Čeština", ar: "العربية" };

  function buildSwitcherMarkup(idSuffix) {
    const menuItems = SUPPORTED.map((l) => {
      const active = l === lang ? " active" : "";
      return `<a href="${buildSwitcherHref(l)}" hreflang="${l}" class="lang-switch-menu-item${active}">${LANG_NAMES[l]}</a>`;
    }).join("");
    return `
      <div class="lang-switch" id="lang-switch${idSuffix}">
        <button type="button" class="lang-switch-btn" aria-haspopup="true" aria-expanded="false" aria-label="${LANG_LABELS[lang]}, change language">${LANG_LABELS[lang]} <span class="lang-switch-caret">&#9662;</span></button>
        <div class="lang-switch-menu" role="menu">${menuItems}</div>
      </div>`;
  }

  function renderSwitchers() {
    const desktopSlot = document.getElementById("lang-switch-slot");
    const mobileSlot = document.getElementById("lang-switch-slot-mobile");
    if (desktopSlot && !desktopSlot.dataset.rendered) {
      desktopSlot.innerHTML = buildSwitcherMarkup("-desktop");
      desktopSlot.dataset.rendered = "1";
    }
    if (mobileSlot && !mobileSlot.dataset.rendered) {
      mobileSlot.innerHTML = buildSwitcherMarkup("-mobile");
      mobileSlot.dataset.rendered = "1";
    }
    document.querySelectorAll(".lang-switch-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const wrap = btn.closest(".lang-switch");
        const open = wrap.classList.toggle("open");
        btn.setAttribute("aria-expanded", open ? "true" : "false");
      });
    });
    document.addEventListener("click", () => {
      document.querySelectorAll(".lang-switch.open").forEach((wrap) => {
        wrap.classList.remove("open");
        wrap.querySelector(".lang-switch-btn")?.setAttribute("aria-expanded", "false");
      });
    });
  }

  window.PhotoczaroI18n = {
    lang,
    dir,
    supported: SUPPORTED,
    path,
    langPath: (targetLang) => buildSwitcherHref(targetLang),
    t(key) {
      const dict = (window.PHOTOCZARO_I18N_DICT && window.PHOTOCZARO_I18N_DICT[lang]) || {};
      const fallback = (window.PHOTOCZARO_I18N_DICT && window.PHOTOCZARO_I18N_DICT.en) || {};
      return Object.prototype.hasOwnProperty.call(dict, key) ? dict[key] : fallback[key];
    },
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", applyDictionary);
  } else {
    applyDictionary();
  }
})();
