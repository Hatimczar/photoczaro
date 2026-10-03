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
      const models = (window.PHOTOCZARO_MODELS || []).filter((m) => slugs.includes(m.slug));

      document.querySelectorAll("[data-shortlist-count]").forEach((el) => {
        el.textContent = String(models.length);
        el.setAttribute("data-empty", models.length === 0 ? "true" : "false");
      });

      document.querySelectorAll("[data-shortlist-toggle]").forEach((btn) => {
        const slug = btn.getAttribute("data-shortlist-toggle");
        const pressed = slugs.includes(slug);
        btn.setAttribute("aria-pressed", pressed ? "true" : "false");
        /* Only the small heart buttons on cards swap their glyph; the labelled
           "Add to Booking Deck" button on a profile keeps its text and shows its
           state through aria-pressed (styled in style.css). */
        if (btn.classList.contains("model-card-shortlist")) {
          btn.textContent = pressed ? "♥" : "♡";
          btn.setAttribute("aria-label", pressed ? "Remove from shortlist" : "Add to shortlist");
        }
      });

      const tr = (key, fallback) => {
        const i18n = window.PhotoczaroI18n;
        const v = i18n && i18n.t ? i18n.t(key) : "";
        return v && v !== key ? v : fallback;
      };
      const itemsEl = document.getElementById("drawer-items");
      if (itemsEl) {
        if (models.length === 0) {
          itemsEl.innerHTML = '<p class="drawer-empty">Your shortlist is empty. Add models from the roster to build a booking deck.</p>';
        } else {
          itemsEl.innerHTML = models.map((m) => `
            <div class="drawer-item">
              <div class="drawer-item-media" style="--card-a:${m.swatch[0]};--card-b:${m.swatch[1]}">${m.images && m.images.headshot ? `<img src="/media/${m.images.headshot}" alt="">` : initials(m.name)}</div>
              <div class="drawer-item-info">
                <h4>${m.name}</h4>
                <span>${tr("category." + m.categories[0], window.PHOTOCZARO_CATEGORY_LABELS[m.categories[0]] || "")}${m.newFace ? " · " + tr("badge.newFace", "New Face") : ""}</span>
              </div>
              <button class="drawer-item-remove" data-remove-slug="${m.slug}" aria-label="Remove ${m.name} from shortlist">✕</button>
            </div>
          `).join("");
          itemsEl.querySelectorAll("[data-remove-slug]").forEach((btn) => {
            btn.addEventListener("click", () => Shortlist.remove(btn.getAttribute("data-remove-slug")));
          });
        }
      }

      const bookLink = document.getElementById("drawer-book-btn");
      if (bookLink) {
        bookLink.href = models.length ? `book-talent?models=${models.map((m) => m.slug).join(",")}` : "book-talent";
      }
    },
  };

  function initials(name) {
    return name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();
  }

  window.PhotoczaroShortlist = Shortlist;
  document.addEventListener("DOMContentLoaded", () => Shortlist.render());
})();
