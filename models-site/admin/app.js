(function () {
  const state = {
    applications: [], models: [], activeTab: "applications",
    selectedAppId: null, selectedSlug: null,
    showArchived: false, modelFormDirty: false,
  };

  async function api(path, opts) {
    const res = await fetch(path, opts);
    if (!res.ok) {
      let message = `Request failed (${res.status})`;
      try {
        const body = await res.json();
        if (body.error) message = body.error;
      } catch { /* ignore */ }
      throw new Error(message);
    }
    return res.status === 204 ? null : res.json();
  }

  function toast(message, isError) {
    const el = document.getElementById("admin-toast");
    el.textContent = message;
    el.hidden = false;
    el.classList.toggle("error", !!isError);
    el.setAttribute("role", isError ? "alert" : "status");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => { el.hidden = true; }, 3500);
  }

  function esc(s) {
    return (s ?? "").toString().replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  /* Applications submitted after the experience <select> got stable value
     attributes carry one of these slugs; older submissions may still carry
     the raw (possibly translated) label text, so unknown values just pass
     through as-is rather than showing blank. */
  const EXPERIENCE_LABELS = { "new-face": "New face", "some-experience": "Some experience", experienced: "Experienced" };
  function experienceLabel(value) {
    return EXPERIENCE_LABELS[value] || value;
  }

  /* ---------- Modal dialog (accessible, focus-trapped, promise-based) ---------- */
  function openModal(html, { onMount } = {}) {
    const backdrop = document.getElementById("admin-modal-backdrop");
    const modal = document.getElementById("admin-modal");
    modal.innerHTML = html;
    backdrop.hidden = false;
    const previouslyFocused = document.activeElement;

    const focusable = () => Array.from(
      modal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')
    ).filter((el) => !el.disabled);
    focusable()[0]?.focus();

    let resolveFn;
    function close(result) {
      document.removeEventListener("keydown", trap);
      backdrop.hidden = true;
      modal.innerHTML = "";
      previouslyFocused?.focus?.();
      resolveFn(result);
    }
    function trap(e) {
      if (e.key === "Escape") { e.preventDefault(); close(null); return; }
      if (e.key !== "Tab") return;
      const items = focusable();
      if (!items.length) return;
      const idx = items.indexOf(document.activeElement);
      if (e.shiftKey && idx <= 0) { e.preventDefault(); items[items.length - 1].focus(); }
      else if (!e.shiftKey && idx === items.length - 1) { e.preventDefault(); items[0].focus(); }
    }
    document.addEventListener("keydown", trap);
    onMount?.(modal, close);
    return new Promise((resolve) => { resolveFn = resolve; });
  }

  function showNewModelModal() {
    const html = `
      <h3 id="admin-modal-title">New model</h3>
      <p>Creates a draft profile. It stays unpublished until you review and publish it from the Models tab.</p>
      <div class="admin-field"><label for="modal-new-name">Professional name</label><input id="modal-new-name" autocomplete="off"></div>
      <div class="admin-field">
        <label id="modal-new-category-label">Category</label>
        <div class="admin-modal-radio-group" role="radiogroup" aria-labelledby="modal-new-category-label">
          <label><input type="radio" name="modal-new-category" value="women" checked> Women</label>
          <label><input type="radio" name="modal-new-category" value="men"> Men</label>
        </div>
      </div>
      <div class="admin-modal-actions">
        <button class="admin-btn" id="modal-cancel" type="button">Cancel</button>
        <button class="admin-btn primary" id="modal-submit" type="button">Create</button>
      </div>
    `;
    return openModal(html, {
      onMount(modal, close) {
        const nameInput = modal.querySelector("#modal-new-name");
        modal.querySelector("#modal-cancel").addEventListener("click", () => close(null));
        modal.querySelector("#modal-submit").addEventListener("click", () => {
          const name = nameInput.value.trim();
          if (!name) { nameInput.focus(); return; }
          const category = modal.querySelector('input[name="modal-new-category"]:checked').value;
          close({ name, category });
        });
      },
    });
  }

  function showRejectModal() {
    const html = `
      <h3 id="admin-modal-title">Reject application</h3>
      <p>Optional note, kept on the application record.</p>
      <div class="admin-field"><label for="modal-reject-reason">Note</label><textarea id="modal-reject-reason"></textarea></div>
      <div class="admin-modal-actions">
        <button class="admin-btn" id="modal-cancel" type="button">Cancel</button>
        <button class="admin-btn danger" id="modal-submit" type="button">Reject</button>
      </div>
    `;
    return openModal(html, {
      onMount(modal, close) {
        modal.querySelector("#modal-cancel").addEventListener("click", () => close(null));
        modal.querySelector("#modal-submit").addEventListener("click", () => {
          close({ reason: modal.querySelector("#modal-reject-reason").value.trim() });
        });
      },
    });
  }

  function showApproveModal(name) {
    const html = `
      <h3 id="admin-modal-title">Approve application</h3>
      <p>${esc(name)} will be created as a draft profile on the Models tab. It stays unpublished until you review it and publish it from there.</p>
      <div class="admin-modal-actions">
        <button class="admin-btn" id="modal-cancel" type="button">Cancel</button>
        <button class="admin-btn primary" id="modal-submit" type="button">Approve as draft</button>
      </div>
    `;
    return openModal(html, {
      onMount(modal, close) {
        modal.querySelector("#modal-cancel").addEventListener("click", () => close(false));
        modal.querySelector("#modal-submit").addEventListener("click", () => close(true));
      },
    });
  }

  function showArchiveModal(name) {
    const html = `
      <h3 id="admin-modal-title">Archive ${esc(name)}</h3>
      <p>This unpublishes the profile and hides it from the default Models list. The record and photos are kept, and you can restore them later from "Show archived". Type the name to confirm.</p>
      <div class="admin-field"><label for="modal-archive-confirm">Type "${esc(name)}"</label><input id="modal-archive-confirm" autocomplete="off"></div>
      <div class="admin-modal-actions">
        <button class="admin-btn" id="modal-cancel" type="button">Cancel</button>
        <button class="admin-btn danger" id="modal-submit" type="button" disabled>Archive</button>
      </div>
    `;
    return openModal(html, {
      onMount(modal, close) {
        const input = modal.querySelector("#modal-archive-confirm");
        const submit = modal.querySelector("#modal-submit");
        input.addEventListener("input", () => { submit.disabled = input.value.trim() !== name; });
        modal.querySelector("#modal-cancel").addEventListener("click", () => close(false));
        submit.addEventListener("click", () => { if (!submit.disabled) close(true); });
      },
    });
  }

  function showRestoreModal(name) {
    const html = `
      <h3 id="admin-modal-title">Restore ${esc(name)}</h3>
      <p>This brings the profile back as an unpublished draft. Publish it again from the Models tab when it's ready.</p>
      <div class="admin-modal-actions">
        <button class="admin-btn" id="modal-cancel" type="button">Cancel</button>
        <button class="admin-btn primary" id="modal-submit" type="button">Restore</button>
      </div>
    `;
    return openModal(html, {
      onMount(modal, close) {
        modal.querySelector("#modal-cancel").addEventListener("click", () => close(false));
        modal.querySelector("#modal-submit").addEventListener("click", () => close(true));
      },
    });
  }

  function showConfirmModal({ title, message, confirmLabel = "Confirm", danger = false }) {
    const html = `
      <h3 id="admin-modal-title">${esc(title)}</h3>
      <p>${esc(message)}</p>
      <div class="admin-modal-actions">
        <button class="admin-btn" id="modal-cancel" type="button">Cancel</button>
        <button class="admin-btn ${danger ? "danger" : "primary"}" id="modal-submit" type="button">${esc(confirmLabel)}</button>
      </div>
    `;
    return openModal(html, {
      onMount(modal, close) {
        modal.querySelector("#modal-cancel").addEventListener("click", () => close(false));
        modal.querySelector("#modal-submit").addEventListener("click", () => close(true));
      },
    });
  }

  function showDiscardModal() {
    const html = `
      <h3 id="admin-modal-title">Discard unsaved changes?</h3>
      <p>You have unsaved edits on this profile. Leaving now will discard them.</p>
      <div class="admin-modal-actions">
        <button class="admin-btn" id="modal-cancel" type="button">Keep editing</button>
        <button class="admin-btn danger" id="modal-submit" type="button">Discard</button>
      </div>
    `;
    return openModal(html, {
      onMount(modal, close) {
        modal.querySelector("#modal-cancel").addEventListener("click", () => close(false));
        modal.querySelector("#modal-submit").addEventListener("click", () => close(true));
      },
    });
  }

  async function confirmDiscardIfDirty() {
    if (!state.modelFormDirty) return true;
    const proceed = await showDiscardModal();
    if (proceed) state.modelFormDirty = false;
    return proceed;
  }

  window.addEventListener("beforeunload", (e) => {
    if (state.modelFormDirty) {
      e.preventDefault();
      e.returnValue = "";
    }
  });

  /* ---------- Session ---------- */
  async function loadSession() {
    const el = document.getElementById("admin-session");
    try {
      const me = await api("/api/admin/whoami");
      el.innerHTML = `${esc(me.email)} · <a href="/cdn-cgi/access/logout">Log out</a>`;
    } catch {
      el.innerHTML = "";
    }
  }

  /* ---------- Tabs ---------- */
  function activateTab(tab) {
    state.activeTab = tab;
    document.querySelectorAll(".admin-tab").forEach((t) => {
      const active = t.dataset.tab === tab;
      t.classList.toggle("active", active);
      t.setAttribute("aria-selected", active ? "true" : "false");
      t.tabIndex = active ? 0 : -1;
    });
    document.getElementById("panel-applications").hidden = tab !== "applications";
    document.getElementById("panel-models").hidden = tab !== "models";
  }
  document.getElementById("admin-tabs").addEventListener("click", async (e) => {
    const btn = e.target.closest(".admin-tab");
    if (!btn || btn.classList.contains("active")) return;
    if (!(await confirmDiscardIfDirty())) return;
    activateTab(btn.dataset.tab);
    btn.focus();
  });
  document.getElementById("admin-tabs").addEventListener("keydown", async (e) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    const tabs = Array.from(document.querySelectorAll(".admin-tab"));
    const idx = tabs.indexOf(document.activeElement);
    if (idx === -1) return;
    e.preventDefault();
    const next = tabs[e.key === "ArrowRight" ? (idx + 1) % tabs.length : (idx - 1 + tabs.length) % tabs.length];
    if (!(await confirmDiscardIfDirty())) return;
    activateTab(next.dataset.tab);
    next.focus();
  });

  /* ---------- History ---------- */
  function renderHistory(record) {
    const history = (record.history || []).slice().reverse();
    if (!history.length) return "";
    return `
      <div class="admin-section-title">History</div>
      <ul class="admin-history">
        ${history.map((h) => `<li><span class="admin-history-action">${esc((h.action || "").replace(/_/g, " "))}</span> · ${esc(h.actor)} · ${new Date(h.at).toLocaleString()}</li>`).join("")}
      </ul>
    `;
  }

  /* ---------- Applications ---------- */
  async function loadApplications() {
    state.applications = await api("/api/admin/applications");
    renderApplicationsList();
    const pending = state.applications.filter((a) => a.status === "pending_review").length;
    document.getElementById("tab-count-applications").textContent = pending ? `(${pending})` : "";
  }

  function renderApplicationsList() {
    const list = document.getElementById("applications-list");
    if (state.applications.length === 0) {
      list.innerHTML = `<div class="admin-empty">No applications yet.</div>`;
      return;
    }
    list.innerHTML = state.applications.map((a) => `
      <button type="button" class="admin-row ${a.id === state.selectedAppId ? "selected" : ""}" data-id="${esc(a.id)}">
        <div class="admin-row-title">${esc(a.professionalName)}</div>
        <div class="admin-row-meta">${esc(a.category)} · ${esc(a.uaeCity || "n/a")} · ${new Date(a.receivedAt).toLocaleDateString()}</div>
        <span class="admin-badge ${a.status === "pending_review" ? "pending" : a.status}">${a.status.replace("_", " ")}</span>
      </button>
    `).join("");
    list.querySelectorAll(".admin-row").forEach((row) => {
      row.addEventListener("click", () => selectApplication(row.dataset.id));
    });
  }

  function reviewImage(app, field, label) {
    const meta = app.files?.[field];
    if (!meta?.key) return "";
    const isImage = (meta.type || "").startsWith("image/");
    return `<div class="admin-review-image">
      ${isImage
        ? `<img src="/api/admin/media/${esc(meta.key)}" alt="">`
        : `<a class="admin-btn" href="/api/admin/media/${esc(meta.key)}" target="_blank" rel="noopener noreferrer">Open file</a>`}
      <div class="admin-review-image-label">${esc(label)}</div>
    </div>`;
  }

  async function selectApplication(id) {
    state.selectedAppId = id;
    renderApplicationsList();
    const detail = document.getElementById("applications-detail");
    detail.innerHTML = `<div class="admin-empty">Loading…</div>`;
    const app = await api(`/api/admin/applications/${encodeURIComponent(id)}`);

    const measureFields = app.category === "men"
      ? [["Neck", app.neck], ["Chest", app.chest], ["Waist", app.waist], ["Sleeve", app.sleeve], ["Inseam", app.inseam]]
      : [["Bust", app.bust], ["Waist", app.waist], ["Hips", app.hips]];

    const portfolioLink = app.portfolioUrl && app.portfolioUrl.startsWith("https://")
      ? `<a href="${esc(app.portfolioUrl)}" target="_blank" rel="noopener noreferrer">${esc(app.portfolioUrl)}</a>`
      : "n/a";

    detail.innerHTML = `
      <div class="admin-detail-head">
        <h2>${esc(app.professionalName)}</h2>
        <div class="admin-actions">
          ${app.status === "pending_review" ? `
            <button class="admin-btn danger" id="reject-btn" type="button">Reject</button>
            <button class="admin-btn primary" id="approve-btn" type="button">Approve</button>
          ` : `<span class="admin-badge ${app.status === "approved" ? "approved" : "rejected"}">${app.status}</span>`}
        </div>
      </div>

      <div class="admin-review-images">
        ${reviewImage(app, "headshot", "Headshot")}
        ${reviewImage(app, "fullFront", "Full length, front")}
        ${reviewImage(app, "fullSide", "Full length, side")}
        ${reviewImage(app, "portfolioFile", "Portfolio")}
      </div>

      <div class="admin-section-title">Details</div>
      <div class="admin-grid">
        <div class="admin-field"><label>Legal name</label><div>${esc(app.legalName)}</div></div>
        <div class="admin-field"><label>Category</label><div>${esc(app.category)}</div></div>
        <div class="admin-field"><label>Email</label><div>${esc(app.email)}</div></div>
        <div class="admin-field"><label>Telephone</label><div>${esc(app.telephone)}</div></div>
        <div class="admin-field"><label>UAE city</label><div>${esc(app.uaeCity)}</div></div>
        <div class="admin-field"><label>Experience</label><div>${esc(experienceLabel(app.experience)) || "n/a"}</div></div>
        <div class="admin-field"><label>Height</label><div>${esc(app.height)} ${esc(app.measurementUnit)}</div></div>
        <div class="admin-field"><label>Hair / Eyes</label><div>${esc(app.hair)} / ${esc(app.eyes)}</div></div>
        <div class="admin-field"><label>Languages</label><div>${esc(app.languages) || "n/a"}</div></div>
        <div class="admin-field"><label>Skills</label><div>${esc(app.skills) || "n/a"}</div></div>
        <div class="admin-field"><label>Portfolio URL</label><div>${portfolioLink}</div></div>
        <div class="admin-field"><label>Age / residency confirmed</label><div>${app.ageConfirm ? "Yes" : "No"} / ${app.residencyConfirm ? "Yes" : "No"}</div></div>
      </div>

      <div class="admin-section-title">Measurements (${esc(app.measurementUnit)})</div>
      <div class="admin-grid">
        ${measureFields.map(([label, val]) => `<div class="admin-field"><label>${label}</label><div>${esc(val) || "n/a"}</div></div>`).join("")}
      </div>

      <div class="admin-section-title">Introduction</div>
      <p class="admin-note">${esc(app.introduction) || "n/a"}</p>

      ${app.rosterSlug ? `<p class="admin-note">Approved onto the roster as <a href="/models/${esc(app.rosterSlug)}" target="_blank" rel="noopener noreferrer">${esc(app.rosterSlug)}</a> (draft, review it on the Models tab before publishing).</p>` : ""}
      ${app.rejectionReason ? `<p class="admin-note">Rejection note: ${esc(app.rejectionReason)}</p>` : ""}
    `;

    document.getElementById("approve-btn")?.addEventListener("click", async () => {
      if (!(await showApproveModal(app.professionalName))) return;
      try {
        const res = await api(`/api/admin/applications/${encodeURIComponent(id)}`, {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "approve" }),
        });
        toast(`Approved as a draft (${res.slug}). Publish it from the Models tab when ready.`);
        await loadApplications();
        await loadModels();
        selectApplication(id);
      } catch (err) { toast(err.message, true); }
    });
    document.getElementById("reject-btn")?.addEventListener("click", async () => {
      const result = await showRejectModal();
      if (!result) return;
      try {
        await api(`/api/admin/applications/${encodeURIComponent(id)}`, {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "reject", reason: result.reason }),
        });
        toast("Application rejected.");
        await loadApplications();
        selectApplication(id);
      } catch (err) { toast(err.message, true); }
    });
  }

  /* ---------- Models ---------- */
  async function loadModels() {
    const qs = state.showArchived ? "?includeArchived=true" : "";
    state.models = await api("/api/admin/models" + qs);
    renderModelsList();
    const activeCount = state.models.filter((m) => !m.archived).length;
    document.getElementById("tab-count-models").textContent = activeCount ? `(${activeCount})` : "";
  }

  function renderModelsList() {
    const list = document.getElementById("models-list");
    if (state.models.length === 0) {
      list.innerHTML = `<div class="admin-empty">No models yet.</div>`;
      return;
    }
    list.innerHTML = state.models.map((m) => `
      <button type="button" class="admin-row ${m.slug === state.selectedSlug ? "selected" : ""}" data-slug="${esc(m.slug)}">
        <div class="admin-row-title">${esc(m.name)}</div>
        <div class="admin-row-meta">${esc((m.categories || []).join(", "))} · order ${esc(m.displayOrder)}</div>
        <span class="admin-badge ${m.archived ? "archived" : m.published ? "published" : "unpublished"}">${m.archived ? "archived" : m.published ? "published" : "unpublished"}</span>
      </button>
    `).join("");
    list.querySelectorAll(".admin-row").forEach((row) => {
      row.addEventListener("click", async () => {
        if (row.dataset.slug === state.selectedSlug) return;
        if (!(await confirmDiscardIfDirty())) return;
        selectModel(row.dataset.slug);
      });
    });
  }

  function imageSlot(model, slot, label) {
    const key = model.images?.[slot];
    return `<div class="admin-image-slot">
      <div class="admin-image-slot-label">${label}</div>
      <div class="admin-image-box" data-slot="${slot}">
        ${key ? `<img src="/media/${esc(key)}" alt=""><button class="admin-image-remove" type="button" data-remove-key="${esc(key)}">Remove</button>` : `<span class="admin-image-placeholder">Upload</span>`}
        <input type="file" accept="image/*" data-upload-slot="${slot}">
      </div>
    </div>`;
  }

  async function selectModel(slug) {
    state.selectedSlug = slug;
    state.modelFormDirty = false;
    renderModelsList();
    const model = await api(`/api/admin/models/${encodeURIComponent(slug)}`);
    const detail = document.getElementById("models-detail");

    if (model.archived) {
      detail.innerHTML = `
        <div class="admin-detail-head">
          <h2>${esc(model.name)}</h2>
          <div class="admin-actions">
            <span class="admin-badge archived">archived</span>
            <button class="admin-btn primary" id="restore-model-btn" type="button">Restore</button>
          </div>
        </div>
        <p class="admin-note">Archived ${model.archivedAt ? new Date(model.archivedAt).toLocaleString() : ""}${model.archivedBy ? ` by ${esc(model.archivedBy)}` : ""}. The profile and its photos are kept; restoring brings it back as an unpublished draft.</p>
        ${renderHistory(model)}
      `;
      document.getElementById("restore-model-btn").addEventListener("click", async () => {
        if (!(await showRestoreModal(model.name))) return;
        try {
          await api(`/api/admin/models/${encodeURIComponent(slug)}/restore`, { method: "POST" });
          toast("Restored as a draft.");
          await loadModels();
          selectModel(slug);
        } catch (err) { toast(err.message, true); }
      });
      return;
    }

    const gallery = model.images?.gallery || [];

    detail.innerHTML = `
      <div class="admin-detail-head">
        <h2>${esc(model.name)}</h2>
        <div class="admin-actions">
          <button class="admin-btn danger" id="archive-model-btn" type="button">Archive</button>
          <button class="admin-btn primary" id="save-model-btn" type="button">Save changes</button>
        </div>
      </div>

      <div class="admin-section-title">Photos</div>
      <div class="admin-images-grid">
        ${imageSlot(model, "headshot", "Headshot")}
        ${imageSlot(model, "fullFront", "Full length, front")}
        ${imageSlot(model, "fullSide", "Full length, side")}
      </div>
      <div class="admin-section-title" style="margin-top:0;border-top:none;padding-top:0;">Gallery</div>
      <div class="admin-gallery-strip" id="gallery-strip">
        ${gallery.map((key) => `<div class="admin-gallery-item"><img src="/media/${esc(key)}" alt=""><button class="admin-image-remove" type="button" data-remove-key="${esc(key)}">✕</button></div>`).join("")}
        <div class="admin-gallery-add">+<input type="file" accept="image/*" id="gallery-upload"></div>
      </div>

      <div class="admin-section-title">Profile</div>
      <div class="admin-grid">
        <div class="admin-field"><label>Name</label><input id="f-name" value="${esc(model.name)}"></div>
        <div class="admin-field"><label>Category</label>
          <select id="f-category">
            <option value="women" ${model.categories?.[0] === "women" ? "selected" : ""}>Women</option>
            <option value="men" ${model.categories?.[0] === "men" ? "selected" : ""}>Men</option>
          </select>
        </div>
        <div class="admin-field"><label>Subcategories (comma-separated)</label><input id="f-subcategories" value="${esc((model.subcategories || []).join(", "))}" placeholder="editorial-fashion, commercial, beauty, fitness"></div>
        <div class="admin-field"><label>Status</label>
          <select id="f-status">
            <option value="active" ${model.status === "active" ? "selected" : ""}>Active</option>
            <option value="hidden" ${model.status === "hidden" ? "selected" : ""}>Hidden</option>
          </select>
        </div>
        <div class="admin-field checkbox"><input type="checkbox" id="f-published" ${model.published ? "checked" : ""}><label for="f-published">Published to live site</label></div>
        <div class="admin-field checkbox"><input type="checkbox" id="f-newface" ${model.newFace ? "checked" : ""}><label for="f-newface">New face</label></div>
        <div class="admin-field checkbox"><input type="checkbox" id="f-featured" ${model.featured ? "checked" : ""}><label for="f-featured">Featured on homepage</label></div>
        <div class="admin-field"><label>Display order</label><input type="number" id="f-order" value="${esc(model.displayOrder)}"></div>
      </div>

      <div class="admin-section-title">Stats</div>
      <div class="admin-grid">
        <div class="admin-field"><label>Location</label><input id="f-location" value="${esc(model.location)}"></div>
        <div class="admin-field"><label>Height</label><input id="f-height" value="${esc(model.height)}" placeholder="e.g. 177 cm"></div>
        <div class="admin-field"><label>Measurement unit</label>
          <select id="f-unit"><option value="cm" ${model.measurementUnit === "cm" ? "selected" : ""}>cm</option><option value="in" ${model.measurementUnit === "in" ? "selected" : ""}>in</option></select>
        </div>
        <div class="admin-field"><label>Measurements (display text)</label><input id="f-measurements" value="${esc(model.measurements)}" placeholder="e.g. 81-61-88 cm"></div>
        <div class="admin-field"><label>Bust</label><input id="f-bust" value="${esc(model.bust)}"></div>
        <div class="admin-field"><label>Waist</label><input id="f-waist" value="${esc(model.waist)}"></div>
        <div class="admin-field"><label>Hips</label><input id="f-hips" value="${esc(model.hips)}"></div>
        <div class="admin-field"><label>Neck</label><input id="f-neck" value="${esc(model.neck)}"></div>
        <div class="admin-field"><label>Chest</label><input id="f-chest" value="${esc(model.chest)}"></div>
        <div class="admin-field"><label>Sleeve</label><input id="f-sleeve" value="${esc(model.sleeve)}"></div>
        <div class="admin-field"><label>Inseam</label><input id="f-inseam" value="${esc(model.inseam)}"></div>
        <div class="admin-field"><label>Hair colour</label><input id="f-hair" value="${esc(model.hair)}"></div>
        <div class="admin-field"><label>Eye colour</label><input id="f-eyes" value="${esc(model.eyes)}"></div>
        <div class="admin-field full"><label>Languages (comma-separated)</label><input id="f-languages" value="${esc((model.languages || []).join(", "))}"></div>
        <div class="admin-field full"><label>Skills (comma-separated)</label><input id="f-skills" value="${esc((model.skills || []).join(", "))}"></div>
      </div>

      <div class="admin-section-title">SEO</div>
      <div class="admin-grid">
        <div class="admin-field full"><label>SEO title</label><input id="f-seo-title" value="${esc(model.seoTitle)}"></div>
        <div class="admin-field full"><label>SEO description</label><textarea id="f-seo-desc">${esc(model.seoDescription)}</textarea></div>
      </div>

      <p class="admin-note">Slug: ${esc(model.slug)}${model.sourceApplicationId ? ` · from application ${esc(model.sourceApplicationId)}` : ""}</p>

      ${renderHistory(model)}
    `;

    detail.querySelectorAll("[data-upload-slot]").forEach((input) => {
      input.addEventListener("change", () => uploadImage(model.slug, input.dataset.uploadSlot, input.files[0]));
    });
    document.getElementById("gallery-upload").addEventListener("change", (e) => uploadImage(model.slug, "gallery", e.target.files[0]));
    detail.querySelectorAll("[data-remove-key]").forEach((btn) => {
      btn.addEventListener("click", () => removeImage(model.slug, btn.dataset.removeKey));
    });

    detail.addEventListener("input", () => { state.modelFormDirty = true; });
    detail.addEventListener("change", () => { state.modelFormDirty = true; });

    document.getElementById("save-model-btn").addEventListener("click", () => saveModel(model.slug));
    document.getElementById("archive-model-btn").addEventListener("click", () => archiveModel(model.slug, model.name));
  }

  async function uploadImage(slug, slot, file) {
    if (!file) return;
    const fd = new FormData();
    fd.append("image", file);
    fd.append("slot", slot);
    try {
      await api(`/api/admin/models/${encodeURIComponent(slug)}/images`, { method: "POST", body: fd });
      toast("Image uploaded.");
      state.modelFormDirty = false;
      await loadModels();
      selectModel(slug);
    } catch (err) { toast(err.message, true); }
  }

  async function removeImage(slug, key) {
    const proceed = await showConfirmModal({
      title: "Remove image", message: "Remove this image? This cannot be undone.",
      confirmLabel: "Remove", danger: true,
    });
    if (!proceed) return;
    try {
      await api(`/api/admin/models/${encodeURIComponent(slug)}/images?key=${encodeURIComponent(key)}`, { method: "DELETE" });
      toast("Image removed.");
      state.modelFormDirty = false;
      await loadModels();
      selectModel(slug);
    } catch (err) { toast(err.message, true); }
  }

  function splitList(value) {
    return value.split(",").map((s) => s.trim()).filter(Boolean);
  }

  async function saveModel(slug) {
    const body = {
      name: document.getElementById("f-name").value.trim(),
      categories: [document.getElementById("f-category").value],
      subcategories: splitList(document.getElementById("f-subcategories").value),
      status: document.getElementById("f-status").value,
      published: document.getElementById("f-published").checked,
      newFace: document.getElementById("f-newface").checked,
      featured: document.getElementById("f-featured").checked,
      displayOrder: Number(document.getElementById("f-order").value) || 999,
      location: document.getElementById("f-location").value.trim(),
      height: document.getElementById("f-height").value.trim(),
      measurementUnit: document.getElementById("f-unit").value,
      measurements: document.getElementById("f-measurements").value.trim(),
      bust: document.getElementById("f-bust").value.trim(),
      waist: document.getElementById("f-waist").value.trim(),
      hips: document.getElementById("f-hips").value.trim(),
      neck: document.getElementById("f-neck").value.trim(),
      chest: document.getElementById("f-chest").value.trim(),
      sleeve: document.getElementById("f-sleeve").value.trim(),
      inseam: document.getElementById("f-inseam").value.trim(),
      hair: document.getElementById("f-hair").value.trim(),
      eyes: document.getElementById("f-eyes").value.trim(),
      languages: splitList(document.getElementById("f-languages").value),
      skills: splitList(document.getElementById("f-skills").value),
      seoTitle: document.getElementById("f-seo-title").value.trim(),
      seoDescription: document.getElementById("f-seo-desc").value.trim(),
    };
    try {
      await api(`/api/admin/models/${encodeURIComponent(slug)}`, {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      toast("Saved.");
      state.modelFormDirty = false;
      await loadModels();
    } catch (err) { toast(err.message, true); }
  }

  async function archiveModel(slug, name) {
    if (!(await showArchiveModal(name))) return;
    try {
      await api(`/api/admin/models/${encodeURIComponent(slug)}`, { method: "DELETE" });
      toast('Archived. Restore it anytime from "Show archived".');
      state.selectedSlug = null;
      state.modelFormDirty = false;
      document.getElementById("models-detail").innerHTML = `<div class="admin-empty">Select a model to edit, or create a new one.</div>`;
      await loadModels();
    } catch (err) { toast(err.message, true); }
  }

  document.getElementById("show-archived-toggle").addEventListener("change", async (e) => {
    state.showArchived = e.target.checked;
    await loadModels();
  });

  document.getElementById("new-model-btn").addEventListener("click", async () => {
    if (!(await confirmDiscardIfDirty())) return;
    const result = await showNewModelModal();
    if (!result) return;
    try {
      const res = await api("/api/admin/models", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: result.name, category: result.category }),
      });
      toast("Model created as a draft.");
      await loadModels();
      selectModel(res.slug);
    } catch (err) { toast(err.message, true); }
  });

  loadSession();
  loadApplications().catch((err) => toast(err.message, true));
  loadModels().catch((err) => toast(err.message, true));
})();
