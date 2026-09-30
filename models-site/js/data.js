/*
 * Live roster feed. Model records are approved and edited through the
 * admin panel (/admin) and stored in Cloudflare KV; this file fetches the
 * public /api/models feed instead of bundling a static array, so approving
 * a model in the admin panel makes them appear on the site immediately.
 *
 * window.PhotoczaroModelsReady resolves once window.PHOTOCZARO_MODELS is
 * populated. Rendering code that used to assume the array was already
 * present (it used to be a synchronous inline script) should now do:
 *   window.PhotoczaroModelsReady.then(() => { ...render... });
 * A "photoczaro:models-ready" event fires at the same time for listeners
 * that were already attached before this script ran.
 */
window.PHOTOCZARO_MODELS = [];
window.PhotoczaroModelsReady = fetch("/api/models")
  .then((res) => (res.ok ? res.json() : []))
  .catch(() => [])
  .then((data) => {
    window.PHOTOCZARO_MODELS = Array.isArray(data) ? data : [];
    window.dispatchEvent(new CustomEvent("photoczaro:models-ready"));
    return window.PHOTOCZARO_MODELS;
  });

/* Renders a model's card/profile media: a real headshot when the admin
   panel has uploaded one, otherwise the gradient-swatch + initials
   placeholder used for sample and not-yet-photographed records. */
window.PhotoczaroCardMedia = function (m) {
  if (m.images && m.images.headshot) {
    return `<img src="/media/${m.images.headshot}" alt="" loading="lazy">`;
  }
  const initials = (m.name || "").split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();
  return `<span class="initials">${initials}</span>`;
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
