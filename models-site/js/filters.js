/* Models directory filtering — reads/writes query params so filtered views have clean, shareable URLs. */
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

  function paramsFromURL() {
    return new URLSearchParams(window.location.search);
  }

  function applyParamsToForm(params) {
    fCategory.value = params.get("category") || "";
    fSubcategory.value = params.get("subcategory") || "";
    fLocation.value = params.get("location") || "";
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

  function initialsOf(name) {
    return name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();
  }

  function render() {
    const filters = currentFilters();
    updateURL(filters);

    let results = (window.PHOTOCZARO_MODELS || []).filter((m) => m.status === "active");

    if (filters.category) results = results.filter((m) => m.categories.includes(filters.category));
    if (filters.subcategory) results = results.filter((m) => m.subcategories.includes(filters.subcategory));
    if (filters.location) results = results.filter((m) => m.location.startsWith(filters.location));
    if (filters.newFace) results = results.filter((m) => m.newFace);
    if (filters.height) {
      const [min, max] = filters.height.split("-").map(Number);
      results = results.filter((m) => {
        const cm = parseInt(m.height, 10);
        return cm >= min && cm <= max;
      });
    }

    results.sort((a, b) => a.displayOrder - b.displayOrder);

    countEl.textContent = `${results.length} model${results.length === 1 ? "" : "s"}`;
    emptyState.hidden = results.length !== 0;

    grid.innerHTML = results.map((m) => `
      <a href="model?slug=${m.slug}" class="model-card">
        <div class="model-card-media" style="--card-a:${m.swatch[0]};--card-b:${m.swatch[1]}">
          <span class="initials">${initialsOf(m.name)}</span>
          ${m.newFace ? '<span class="model-card-badge">New Face</span>' : ""}
          <button class="model-card-shortlist" data-shortlist-toggle="${m.slug}" aria-pressed="false" aria-label="Add to shortlist" onclick="event.preventDefault();window.PhotoczaroShortlist.toggle('${m.slug}')">♡</button>
          <div class="model-card-overlay"><span class="model-card-name">${m.name}</span></div>
        </div>
        <div class="model-card-info">
          <h3>${m.name}</h3>
          <div class="model-card-meta">${window.PHOTOCZARO_CATEGORY_LABELS[m.categories[0]]} · ${m.location.split(",")[0]} · ${m.height}</div>
        </div>
      </a>
    `).join("");

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
  render();
})();
