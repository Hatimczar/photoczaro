/*
 * Live roster feed. Model records are approved and edited through the
 * admin panel (/admin) and stored in Cloudflare KV; this file fetches the
 * public /api/models feed instead of bundling a static array, so approving
 * a model in the admin panel makes them appear on the site immediately.
 *
 * window.PhotoczaroModelsReady resolves once window.PHOTOCZARO_MODELS is
 * populated (check window.PHOTOCZARO_MODELS_STATUS for "ok" vs "error").
 * Rendering code that used to assume the array was already
 * present (it used to be a synchronous inline script) should now do:
 *   window.PhotoczaroModelsReady.then(() => { ...render... });
 * A "photoczaro:models-ready" event fires at the same time for listeners
 * that were already attached before this script ran.
 */
window.PHOTOCZARO_MODELS = [];
/* "loading" | "ok" | "error". A failed fetch used to be indistinguishable from
   an empty roster, which let pages quietly act on an empty list. */
window.PHOTOCZARO_MODELS_STATUS = "loading";

function loadRoster() {
  window.PHOTOCZARO_MODELS_STATUS = "loading";
  return fetch("/api/models", { headers: { Accept: "application/json" } })
    .then((res) => {
      if (!res.ok) throw new Error("roster_" + res.status);
      return res.json();
    })
    .then((data) => {
      if (!Array.isArray(data)) throw new Error("roster_shape");
      window.PHOTOCZARO_MODELS = data;
      window.PHOTOCZARO_MODELS_STATUS = "ok";
    })
    .catch(() => {
      window.PHOTOCZARO_MODELS_STATUS = "error";
    })
    .then(() => {
      window.dispatchEvent(new CustomEvent("photoczaro:models-ready", { detail: { status: window.PHOTOCZARO_MODELS_STATUS } }));
      return window.PHOTOCZARO_MODELS;
    });
}
window.PhotoczaroModelsReady = loadRoster();
/* Re-fetch after a failure; resolves like PhotoczaroModelsReady. */
window.PhotoczaroReloadModels = function () {
  window.PhotoczaroModelsReady = loadRoster();
  return window.PhotoczaroModelsReady;
};

/* Renders a model's card/profile media (shared with the server-rendered
   pages via js/render.js). */
window.PhotoczaroCardMedia = function (m) {
  const t = window.PhotoczaroI18n && window.PhotoczaroI18n.t ? (k, fb) => { const v = window.PhotoczaroI18n.t(k); return v == null ? fb : v; } : undefined;
  return window.PhotoczaroRender.mediaHtml(m, t);
};

window.PHOTOCZARO_CATEGORY_LABELS = {
  women: "Women",
  men: "Men",
};
window.PHOTOCZARO_SUBCATEGORY_LABELS = {
  commercial: "Commercial",
  "editorial-fashion": "Editorial / Fashion",
  beauty: "Beauty",
  fitness: "Fitness",
};
