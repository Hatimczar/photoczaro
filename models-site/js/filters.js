/* Models directory filtering, reads/writes query params so filtered views have clean, shareable URLs. */
(function () {
  const grid = document.getElementById("models-grid");
  const emptyState = document.getElementById("empty-state");
  const countEl = document.getElementById("f-count");
  if (!grid) return;

  const fCategory = document.getElementById("f-category");
  const fSubcategory = document.getElementById("f-subcategory");
  const fLocation = document.getElementById("f-location");
  const fHeight = document.getElementById("f-height");
  const fNewFace = document.getElementById("f-newface");

  const R_canonical = (v) => (window.PhotoczaroRender ? window.PhotoczaroRender.canonicalCity(v) : v);

  function paramsFromURL() {
    return new URLSearchParams(window.location.search);
  }

  function applyParamsToForm(params) {
    fCategory.value = params.get("category") || "";
    fSubcategory.value = params.get("subcategory") || "";
    fLocation.value = R_canonical(params.get("location") || "");
    fHeight.value = params.get("height") || "";
    fNewFace.checked = params.get("newFace") === "1";
  }

  function currentFilters() {
    return {
      category: fCategory.value,
      subcategory: fSubcategory.value,
      location: fLocation.value,
      height: fHeight.value,
      newFace: fNewFace.checked,
    };
  }

  function updateURL(filters) {
    const params = new URLSearchParams();
    if (filters.category) params.set("category", filters.category);
    if (filters.subcategory) params.set("subcategory", filters.subcategory);
    if (filters.location) params.set("location", filters.location);
    if (filters.height) params.set("height", filters.height);
    if (filters.newFace) params.set("newFace", "1");
    const qs = params.toString();
    const url = window.location.pathname + (qs ? `?${qs}` : "");
    window.history.replaceState({}, "", url);
  }

  const R = window.PhotoczaroRender;
  const emptyMen = document.getElementById("empty-men");
  const tr = (key, fallback) => {
    const v = window.PhotoczaroI18n && window.PhotoczaroI18n.t(key);
    return v == null ? fallback : v;
  };

  /* Location options come from the published roster, so a city appears as
     soon as someone based there is published (Fujairah, Abu Dhabi, ...). */
  function renderLocationOptions(models, selected) {
    const html = R.locationOptionsHtml(models, selected, tr);
    if (fLocation.innerHTML !== html) fLocation.innerHTML = html;
    fLocation.value = R.canonicalCity(selected) || "";
  }

  function render() {
    /* No live roster (feed failed): keep the server-rendered grid as it is. */
    if (window.PHOTOCZARO_MODELS_STATUS !== "ok") return;
    const filters = currentFilters();
    updateURL(filters);

    const all = window.PHOTOCZARO_MODELS || [];
    renderLocationOptions(all, filters.location);
    const results = R.filterModels(all, filters);

    countEl.textContent = R.countHtml(results.length, tr);

    /* Only the one empty state that applies is shown: the men's brief prompt
       when no male profiles are published at all; the generic reset message
       when filters merely exclude models that do exist. */
    const menOnly = results.length === 0 && filters.category === "men" && R.noMalesPublished(all);
    emptyState.hidden = !(results.length === 0 && !menOnly);
    if (emptyMen) emptyMen.hidden = !menOnly;

    /* The grid is already server-rendered for the initial URL; leave it alone
       when it is already showing exactly these models. */
    const key = results.map((m) => m.slug).join(",");
    if (grid.dataset.key !== key) {
      grid.innerHTML = R.gridHtml(results, { t: tr, path: window.PhotoczaroI18n.path, showHeight: true });
      grid.dataset.key = key;
    }

    window.PhotoczaroShortlist.render();
  }

  [fCategory, fSubcategory, fLocation, fHeight, fNewFace].forEach((el) => {
    el.addEventListener("change", render);
  });

  document.getElementById("f-reset").addEventListener("click", () => {
    fCategory.value = "";
    fSubcategory.value = "";
    fLocation.value = "";
    fHeight.value = "";
    fNewFace.checked = false;
    render();
  });

  applyParamsToForm(paramsFromURL());
  window.PhotoczaroModelsReady.then(() => {
    /* A failed feed keeps the server-rendered grid instead of blanking it. */
    if (window.PHOTOCZARO_MODELS_STATUS === "ok") render();
  });
})();
