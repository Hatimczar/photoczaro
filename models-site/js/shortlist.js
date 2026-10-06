/* Shortlist / booking deck, persisted client-side (localStorage) for v1.
   No private model data is stored here, only slugs. */
(function () {
  const KEY = "photoczaro_models_shortlist";

  function read() {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }
  function write(slugs) {
    try { localStorage.setItem(KEY, JSON.stringify(slugs)); } catch {}
  }

  const Shortlist = {
    list() { return read(); },
    has(slug) { return read().includes(slug); },
    add(slug) {
      const s = read();
      if (!s.includes(slug)) { s.push(slug); write(s); }
      Shortlist.render();
    },
    remove(slug) {
      write(read().filter((x) => x !== slug));
      Shortlist.render();
    },
    toggle(slug) {
      Shortlist.has(slug) ? Shortlist.remove(slug) : Shortlist.add(slug);
    },
    clear() { write([]); Shortlist.render(); },
    render() {
      const slugs = read();
      const status = window.PHOTOCZARO_MODELS_STATUS || "loading";
      const roster = window.PHOTOCZARO_MODELS || [];
      const models = roster.filter((m) => slugs.includes(m.slug));
      /* Until the roster arrives (or if it fails) the saved slugs are all we
         know; show their count rather than 0, and never prune them. */
      const known = status === "ok";
      const count = known ? models.length : slugs.length;

      document.querySelectorAll("[data-shortlist-count]").forEach((el) => {
        el.textContent = String(count);
        el.setAttribute("data-empty", count === 0 ? "true" : "false");
      });

      const tr = (key, fallback) => {
        const i18n = window.PhotoczaroI18n;
        const v = i18n && i18n.t ? i18n.t(key) : "";
        return v && v !== key ? v : fallback;
      };

      document.querySelectorAll("[data-shortlist-toggle]").forEach((btn) => {
        const slug = btn.getAttribute("data-shortlist-toggle");
        const pressed = slugs.includes(slug);
        btn.setAttribute("aria-pressed", pressed ? "true" : "false");
        /* Only the small heart buttons on cards swap their glyph; the labelled
           "Add to Booking Deck" button on a profile keeps its text and shows its
           state through aria-pressed (styled in style.css). */
        if (btn.classList.contains("model-card-shortlist")) {
          btn.textContent = pressed ? "♥" : "♡";
          btn.setAttribute("aria-label", pressed ? tr("shortlist.removeAriaLabel", "Remove from shortlist") : tr("shortlist.addAriaLabel", "Add to shortlist"));
        }
      });

      const itemsEl = document.getElementById("drawer-items");
      if (itemsEl) {
        const drawer = document.getElementById("shortlist-drawer");
        const hadFocus = !!(drawer && drawer.contains(document.activeElement) && itemsEl.contains(document.activeElement));
        const esc = (v) => String(v).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
        if (slugs.length === 0) {
          itemsEl.innerHTML = `<p class="drawer-empty">${tr("drawer.empty", "Your shortlist is empty. Add models from the roster to build a booking deck.")}</p>`;
        } else if (status === "loading") {
          itemsEl.innerHTML = `<p class="drawer-empty" role="status">${tr("drawer.loading", "Loading your shortlist…")}</p>`;
        } else if (status === "error") {
          itemsEl.innerHTML = `<p class="drawer-empty" role="alert">${tr("drawer.loadError", "We couldn't load the model details. Your shortlist is saved.")}</p>
            <button type="button" class="cta-btn" id="drawer-retry">${tr("bookTalent.retry", "Retry")}</button>`;
          document.getElementById("drawer-retry").addEventListener("click", () => {
            window.PhotoczaroReloadModels && window.PhotoczaroReloadModels();
            Shortlist.render();
          });
        } else {
          itemsEl.innerHTML = models.map((m) => `
            <div class="drawer-item">
              <div class="drawer-item-media" style="--card-a:${esc(m.swatch[0])};--card-b:${esc(m.swatch[1])}">${m.images && m.images.headshot ? `<img src="/media/${esc(String(m.images.headshot).replace(/-1200\.webp$/, "-600.webp"))}" alt="">` : esc(initials(m.name))}</div>
              <div class="drawer-item-info">
                <h4>${esc(m.name)}</h4>
                <span>${esc(tr("category." + m.categories[0], window.PHOTOCZARO_CATEGORY_LABELS[m.categories[0]] || ""))}${m.newFace ? " · " + esc(tr("badge.newFace", "New Face")) : ""}</span>
              </div>
              <button class="drawer-item-remove" data-remove-slug="${esc(m.slug)}" aria-label="${esc(tr("drawer.removeNamed", "Remove {name} from shortlist").replace("{name}", m.name))}">✕</button>
            </div>
          `).join("");
          itemsEl.querySelectorAll("[data-remove-slug]").forEach((btn) => {
            btn.addEventListener("click", () => Shortlist.remove(btn.getAttribute("data-remove-slug")));
          });
        }
        /* The button that had focus was just replaced; keep focus inside the
           open dialog instead of dropping it to the page behind. */
        if (hadFocus && !itemsEl.contains(document.activeElement)) {
          (itemsEl.querySelector("[data-remove-slug], #drawer-retry") || document.getElementById("drawer-close"))?.focus();
        }
      }

      /* The booking link is built from what is saved, not from what the
         roster feed returned, so it is right even before the roster loads. */
      const bookLink = document.getElementById("drawer-book-btn");
      if (bookLink) {
        const saved = known ? models.map((m) => m.slug) : slugs;
        bookLink.href = saved.length ? `book-talent?models=${saved.join(",")}` : "book-talent";
      }
    },
  };

  function initials(name) {
    return name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();
  }

  window.PhotoczaroShortlist = Shortlist;
  document.addEventListener("DOMContentLoaded", () => Shortlist.render());
  /* Pages render the shortlist before the roster feed arrives, so it has to
     be drawn again once the roster is known (on every page, not only the
     ones that render a roster themselves). Slugs of models that are no longer
     published are dropped, but only after a successful load. */
  window.addEventListener("photoczaro:models-ready", () => {
    if (window.PHOTOCZARO_MODELS_STATUS === "ok") {
      const live = new Set((window.PHOTOCZARO_MODELS || []).map((m) => m.slug));
      const saved = read();
      const kept = saved.filter((slug) => live.has(slug));
      if (kept.length !== saved.length) write(kept);
    }
    Shortlist.render();
  });
  window.addEventListener("photoczaro:i18n-applied", () => Shortlist.render());
})();
