/*
 * Shared roster rendering and city handling.
 *
 * One source for two runtimes: browsers load this as a classic script
 * (window.PhotoczaroRender) and the Pages Functions import it, so the
 * server-rendered roster/profile HTML that crawlers see is exactly what the
 * client would build. Text that has a translation carries a data-i18n key
 * with the English copy as its content; js/i18n.js swaps it on load, and the
 * client passes a real translator into `t` so freshly rendered markup is
 * already translated.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.PhotoczaroRender = api;
})(typeof self !== "undefined" ? self : this, function () {
  /* ---------- Cities ---------- */
  const UAE_CITIES = ["Dubai", "Abu Dhabi", "Al Ain", "Sharjah", "Ajman", "Umm Al Quwain", "Ras Al Khaimah", "Fujairah"];
  const squash = (s) => String(s || "").normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z]/g, "");
  const CITY_BY_KEY = {};
  UAE_CITIES.forEach((c) => { CITY_BY_KEY[squash(c)] = c; });
  Object.assign(CITY_BY_KEY, {
    abudabi: "Abu Dhabi", abudhabi: "Abu Dhabi", abudhabicity: "Abu Dhabi",
    dubayy: "Dubai", dubay: "Dubai", dubaicity: "Dubai",
    sharjha: "Sharjah", sharja: "Sharjah",
    uaq: "Umm Al Quwain", ummalqaiwain: "Umm Al Quwain", ummalquaiwain: "Umm Al Quwain",
    rak: "Ras Al Khaimah", rasalkhaimah: "Ras Al Khaimah", rasalkhaima: "Ras Al Khaimah",
    fujeirah: "Fujairah", alfujairah: "Fujairah", alain: "Al Ain",
  });

  /* "Dubaí , UAE" -> "Dubai"; anything that is not a UAE city -> "". */
  function canonicalCity(value) {
    const first = String(value || "").split(",")[0];
    return CITY_BY_KEY[squash(first)] || "";
  }
  /* Canonical stored form: "Dubai, UAE". Unknown text is only tidied. */
  function canonicalLocation(value) {
    const city = canonicalCity(value);
    if (city) return city + ", UAE";
    return String(value || "").replace(/\s+/g, " ").replace(/\s+,/g, ",").trim();
  }
  const cityKey = (city) => "city." + squash(city);

  /* ---------- Small helpers ---------- */
  const esc = (s) => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const tidy = (s) => {
    const v = String(s == null ? "" : s).replace(/\s+/g, " ").trim();
    return v ? v.charAt(0).toUpperCase() + v.slice(1) : v;
  };
  const list = (arr) => (Array.isArray(arr) ? arr : []).map(tidy).filter(Boolean);
  const initialsOf = (name) => String(name || "").split(" ").filter(Boolean).map((p) => p[0]).join("").slice(0, 2).toUpperCase();
  const CATEGORY_FALLBACK = { women: "Women", men: "Men", commercial: "Commercial", "editorial-fashion": "Editorial / Fashion", beauty: "Beauty", fitness: "Fitness" };

  /* Default translator for server-side rendering: English fallbacks. */
  const identityT = (key, fallback) => fallback;

  function cityLabel(m, t) {
    const city = canonicalCity(m.location);
    if (city) return `<span data-i18n="${cityKey(city)}">${esc(t(cityKey(city), city))}</span>`;
    return esc(String(m.location || "").split(",")[0].trim());
  }

  /* alt text states the actual subject and city, never a blanket "Dubai model". */
  function altAttrs(m, kind, n, t) {
    const city = canonicalCity(m.location) || "UAE";
    const keys = { based: "alt.modelBasedIn", front: "alt.fullFront", side: "alt.fullSide", photo: "alt.portfolioPhoto" };
    const fallbacks = {
      based: "{name}, model based in {city}",
      front: "{name}, full-length front photo",
      side: "{name}, full-length side photo",
      photo: "{name}, portfolio photo {n}",
    };
    const text = String(t(keys[kind], fallbacks[kind]))
      .replace("{name}", m.name).replace("{city}", t(cityKey(city), city)).replace("{n}", String(n || ""));
    const vars = JSON.stringify({ name: m.name, city, n: n || "" });
    return `alt="${esc(text)}" data-i18n-alt="${keys[kind]}" data-alt-vars="${esc(vars)}"`;
  }

  /* Optimised photos are stored as <name>-1200.webp with a <name>-600.webp
     sibling; those get a srcset so phones fetch the small one. Older
     uploads (any other key) are served as they are. */
  function srcAttrs(key, sizes) {
    const src = "/media/" + esc(key);
    if (!/-1200\.webp$/.test(key)) return `src="${src}"`;
    const small = "/media/" + esc(key.replace(/-1200\.webp$/, "-600.webp"));
    return `src="${src}" srcset="${small} 600w, ${src} 1200w" sizes="${esc(sizes)}"`;
  }
  const CARD_SIZES = "(max-width: 600px) 50vw, (max-width: 1100px) 33vw, 400px";
  const HERO_SIZES = "(max-width: 880px) 100vw, 50vw";
  const GALLERY_SIZES = "(max-width: 880px) 50vw, 33vw";

  /* ---------- Cards ---------- */
  function mediaHtml(m, t, sizes, priority) {
    t = t || identityT;
    if (m.images && m.images.headshot) {
      return `<img ${srcAttrs(m.images.headshot, sizes || CARD_SIZES)} ${altAttrs(m, "based", 0, t)} ${priority === "high" ? 'loading="eager" fetchpriority="high"' : priority === "eager" ? 'loading="eager"' : 'loading="lazy"'} decoding="async">`;
    }
    return `<span class="initials">${esc(initialsOf(m.name))}</span>`;
  }

  /* opts: { t, path, showHeight, simple } */
  function cardHtml(m, opts) {
    opts = opts || {};
    const t = opts.t || identityT;
    const path = opts.path || ((p) => p);
    const cat = m.categories[0];
    const catKey = "category." + cat;
    const meta = [`<span data-i18n="${catKey}">${esc(t(catKey, CATEGORY_FALLBACK[cat] || ""))}</span>`, cityLabel(m, t)];
    if (opts.showHeight && m.height) meta.push(esc(m.height));
    const badge = opts.simple ? "" : m.sample
      ? `<span class="model-card-badge sample-badge" data-i18n="badge.sampleProfile">${esc(t("badge.sampleProfile", "Sample profile"))}</span>`
      : m.newFace ? `<span class="model-card-badge" data-i18n="badge.newFace">${esc(t("badge.newFace", "New Face"))}</span>` : "";
    const heart = opts.simple ? "" : `<button class="model-card-shortlist" data-shortlist-toggle="${esc(m.slug)}" aria-pressed="false" data-i18n-aria-label="shortlist.addAriaLabel" aria-label="${esc(t("shortlist.addAriaLabel", "Add to shortlist"))}" onclick="event.preventDefault();window.PhotoczaroShortlist.toggle('${esc(m.slug)}')">♡</button>`;
    const overlay = opts.simple ? "" : `<div class="model-card-overlay"><span class="model-card-name">${esc(m.name)}</span></div>`;
    return `
      <a href="${esc(path("/models/" + m.slug))}" class="model-card">
        <div class="model-card-media" style="--card-a:${esc(m.swatch[0])};--card-b:${esc(m.swatch[1])}">
          ${mediaHtml(m, t, null, opts.priority)}${badge}${heart}${overlay}
        </div>
        <div class="model-card-info">
          <h2>${esc(m.name)}</h2>
          <div class="model-card-meta">${meta.join(" · ")}</div>
        </div>
      </a>`;
  }

  /* On the roster page the first cards are what a phone shows without
     scrolling: they load eagerly (the first two at high priority). Elsewhere
     (home, related models) everything stays lazy so the main photo of the page
     is not competing with them. */
  function gridHtml(models, opts) {
    const above = opts && opts.aboveFold;
    return models.map((m, i) => cardHtml(m, Object.assign({}, opts, above && i < 2 ? { priority: "high" } : above && i < 4 ? { priority: "eager" } : {}))).join("");
  }

  /* ---------- Filtering ---------- */
  function filterModels(models, f) {
    f = f || {};
    let out = models.filter((m) => m.status === "active");
    if (f.category) out = out.filter((m) => m.categories.includes(f.category));
    if (f.subcategory) out = out.filter((m) => m.subcategories.includes(f.subcategory));
    if (f.location) out = out.filter((m) => canonicalCity(m.location) === canonicalCity(f.location));
    if (f.newFace) out = out.filter((m) => m.newFace);
    if (f.height) {
      const [min, max] = String(f.height).split("-").map(Number);
      out = out.filter((m) => { const cm = parseInt(m.height, 10); return cm >= min && cm <= max; });
    }
    return out.sort((a, b) => (a.displayOrder ?? 999) - (b.displayOrder ?? 999));
  }
  /* The location filter lists every emirate, in a fixed order, whether or not
     anyone is published there yet. */
  function cityOptions() {
    return UAE_CITIES.slice();
  }
  function locationOptionsHtml(models, selected, t) {
    t = t || identityT;
    const sel = canonicalCity(selected);
    return `<option value="" data-i18n="models.allLocations">${esc(t("models.allLocations", "All Locations"))}</option>` +
      cityOptions(models).map((c) => `<option value="${esc(c)}" data-i18n="${cityKey(c)}"${c === sel ? " selected" : ""}>${esc(t(cityKey(c), c))}</option>`).join("");
  }
  /* The roster has no male profiles at all (as opposed to filters that merely exclude them). */
  const noMalesPublished = (models) => !models.some((m) => m.status === "active" && m.categories.includes("men"));

  function countHtml(n, t) {
    t = t || identityT;
    return `${n} ${t(n === 1 ? "filters.countSingular" : "filters.countPlural", n === 1 ? "model" : "models")}`;
  }

  /* ---------- Profile ---------- */
  /* opts: { t, path, models } ; returns the markup for #profile-root */
  function profileHtml(model, opts) {
    opts = opts || {};
    const t = opts.t || identityT;
    const path = opts.path || ((p) => p);
    const tx = (key, fb) => `<span data-i18n="${key}">${esc(t(key, fb))}</span>`;
    const cat = model.categories[0];
    const subs = (model.subcategories || []).map((s) => `<span class="profile-tag" data-i18n="category.${esc(s)}">${esc(t("category." + s, CATEGORY_FALLBACK[s] || s))}</span>`).join("");
    const icon = (id) => `<svg class="icon" aria-hidden="true" focusable="false"><use href="/images/icons-v1.svg#${id}"></use></svg>`;
    const stat = (id, key, fb, value) => `<div class="profile-stat"><dt>${icon(id)}<span data-i18n="${key}">${esc(t(key, fb))}</span></dt><dd>${value}</dd></div>`;
    const dash = (s) => (s ? esc(s) : "–");

    const shots = [];
    if (model.images?.fullFront) shots.push({ src: model.images.fullFront, kind: "front" });
    if (model.images?.fullSide) shots.push({ src: model.images.fullSide, kind: "side" });
    (model.images?.gallery || []).forEach((src) => shots.push({ src, kind: "photo" }));
    const gallery = shots.length
      ? `<div class="profile-gallery">${shots.map((s, i) => `<div class="model-card-media" style="--card-a:${esc(model.swatch[0])};--card-b:${esc(model.swatch[1])}"><img ${srcAttrs(s.src, GALLERY_SIZES)} ${altAttrs(model, s.kind, i + 1, t)} loading="lazy" decoding="async"></div>`).join("")}</div>`
      : `<p class="form-note gallery-note" data-i18n="profile.noPhotos">${esc(t("profile.noPhotos", "More photographs are available on request."))}</p>`;

    const related = (opts.models || []).filter((m) => m.slug !== model.slug && m.categories.some((c) => model.categories.includes(c))).slice(0, 4);
    const relatedHtml = related.length ? `
    <section class="section related-models reveal visible" id="related-section" style="border-top:1px solid rgba(255,255,255,0.08);">
      <div class="section-head"><span class="eyebrow" data-i18n="profile.related">${esc(t("profile.related", "Related"))}</span><h2 style="font-size:1.8rem;" data-i18n="profile.similarModels">${esc(t("profile.similarModels", "Similar models"))}</h2></div>
      <div class="model-grid" id="related-grid">${gridHtml(related, { t, path, simple: true })}</div>
    </section>` : "";

    const mainLoc = cityLabel(model, t);
    const loc = canonicalCity(model.location) ? `${mainLoc}, <span data-i18n="country.uae">${esc(t("country.uae", "UAE"))}</span>` : esc(model.location);
    const langs = list(model.languages).map(esc).join(", ");
    const skills = list(model.skills).map(esc).join(", ");

    return `
    <div class="breadcrumbs"><a href="/" data-i18n="a11y.home">${esc(t("a11y.home", "Home"))}</a><span>/</span><a href="models" data-i18n="nav.allModels">${esc(t("nav.allModels", "All Models"))}</a><span>/</span><span>${esc(model.name)}</span></div>
    ${model.sample ? `<div class="profile-sample-notice"><strong data-i18n="profile.sampleStrong">${esc(t("profile.sampleStrong", "Sample profile."))}</strong> <span data-i18n="profile.sampleBody">${esc(t("profile.sampleBody", "Shown for demonstration only. Not a real person and not available for booking."))}</span></div>` : ""}
    <section class="profile-hero" style="margin-top:24px;">
      <div class="profile-media" style="--card-a:${esc(model.swatch[0])};--card-b:${esc(model.swatch[1])}">
        ${mediaHtml(model, t, HERO_SIZES, "high")}
      </div>
      <div class="profile-info">
        <span class="eyebrow"><span data-i18n="category.${esc(cat)}">${esc(t("category." + cat, CATEGORY_FALLBACK[cat] || ""))}</span>${model.newFace ? ` · <span data-i18n="badge.newFace">${esc(t("badge.newFace", "New Face"))}</span>` : ""}</span>
        <h1>${esc(model.name)}</h1>
        <div class="profile-tags">${subs}</div>
        <dl class="profile-stats">
          ${stat("i-pin", "profile.location", "Location", loc)}
          ${stat("i-ruler", "profile.height", "Height", dash(model.height))}
          ${stat("i-ruler", "profile.measurements", "Measurements", dash(model.measurements))}
          ${stat("i-eye", "profile.hairEyes", "Hair / Eyes", `${dash(tidy(model.hair))} / ${dash(tidy(model.eyes))}`)}
          ${stat("i-globe", "profile.languages", "Languages", langs || "–")}
          ${stat("i-star", "profile.skills", "Skills", skills || "–")}
        </dl>
        <div class="profile-actions">
          <a href="book-talent?models=${esc(model.slug)}" class="cta-btn cta-btn-primary" data-i18n="profile.checkAvailability">${esc(t("profile.checkAvailability", "Check Availability"))}</a>
          <button class="cta-btn" data-shortlist-toggle="${esc(model.slug)}" aria-pressed="false" onclick="window.PhotoczaroShortlist.toggle('${esc(model.slug)}')" data-i18n="profile.addToBookingDeck">${esc(t("profile.addToBookingDeck", "Add to Booking Deck"))}</button>
          <button class="cta-btn" id="share-profile" type="button"><span class="share-label">${icon("i-share")}<span data-i18n="profile.share">${esc(t("profile.share", "Share"))}</span></span></button>
        </div>
      </div>
    </section>

    <section class="section reveal visible">
      <div class="section-head"><span class="eyebrow" data-i18n="profile.digitals">${esc(t("profile.digitals", "Digitals"))}</span><h2 style="font-size:1.8rem;" data-i18n="profile.portfolio">${esc(t("profile.portfolio", "Portfolio"))}</h2></div>
      ${gallery}
    </section>
    ${relatedHtml}`;
  }

  return {
    UAE_CITIES, canonicalCity, canonicalLocation, cityKey, esc, tidy,
    mediaHtml, cardHtml, gridHtml, profileHtml,
    filterModels, cityOptions, locationOptionsHtml, noMalesPublished, countHtml,
  };
});
