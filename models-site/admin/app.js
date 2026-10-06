(function () {
  const state = {
    applications: [], models: [], activeTab: "applications",
    selectedAppId: null, selectedSlug: null,
    showArchived: false, modelFormDirty: false,
  };

  async function api(path, opts) {
    const res = await fetch(path, opts);
    if (res.status === 401) renderSignedOut();
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
  // Cloudflare Access normally intercepts a fully signed-out visit before
  // this page ever loads, but a session can also expire while the panel is
  // already open in a tab; that shows up as a 401 from some API call mid-use
  // rather than a redirect. Either way, the topbar should always offer a way
  // back in rather than just going blank.
  function renderSignedOut() {
    const el = document.getElementById("admin-session");
    if (!el) return;
    el.innerHTML = `<span class="admin-session-email">Signed out</span> · <a href="/admin/">Sign in</a>`;
  }

  async function loadSession() {
    const el = document.getElementById("admin-session");
    try {
      const me = await api("/api/admin/whoami");
      el.innerHTML = `<span class="admin-session-email" title="${esc(me.email)}">${esc(me.email)}</span> · <a href="/cdn-cgi/access/logout">Log out</a>`;
    } catch {
      renderSignedOut();
    }
  }

  /* Mirrors functions/_lib/publish-check.js server-side. This copy is only
     used to disable the Publish button early with a helpful reason; the
     server re-checks authoritatively and is what actually enforces it. */
  function publishReadiness(model) {
    const missing = [];
    if (!model.name || !model.name.trim()) missing.push("Name");
    if (!model.images?.headshot) missing.push("Headshot photo");
    if (!model.images?.fullFront) missing.push("Full-length front photo");
    if (!model.images?.fullSide) missing.push("Full-length side photo");
    if (!model.location || !model.location.trim()) missing.push("Location");
    if (!model.height || !model.height.trim()) missing.push("Height");
    if (!model.seoTitle || !model.seoTitle.trim()) missing.push("SEO title");
    if (!model.seoDescription || !model.seoDescription.trim()) missing.push("SEO description");
    const category = (model.categories || [])[0];
    if (category === "men") {
      if (!model.chest && !model.waist) missing.push("Chest or waist measurement");
    } else {
      if (!model.bust && !model.waist && !model.hips) missing.push("Bust, waist or hips measurement");
    }
    return { ready: missing.length === 0, missing };
  }

  /* XHR (not fetch) specifically so upload progress is observable; fetch
     has no simple cross-browser way to report upload progress. */
  function uploadWithProgress(url, formData, onProgress) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", url);
      xhr.upload.addEventListener("progress", (e) => {
        if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
      });
      xhr.addEventListener("load", () => {
        let body = {};
        try { body = JSON.parse(xhr.responseText); } catch { /* ignore */ }
        if (xhr.status >= 200 && xhr.status < 300) resolve(body);
        else reject(new Error(body.error || `Upload failed (${xhr.status})`));
      });
      xhr.addEventListener("error", () => reject(new Error("Network error during upload.")));
      xhr.send(formData);
    });
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

  function reviewGalleryImages(app) {
    const gallery = Array.isArray(app.files?.gallery) ? app.files.gallery : [];
    const errors = Array.isArray(app.fileErrors?.gallery) ? app.fileErrors.gallery : [];
    const items = gallery
      .filter((meta) => meta?.key)
      .map((meta, i) => {
        const isImage = (meta.type || "").startsWith("image/") && meta.type !== "image/heic";
        return `<div class="admin-review-image">
          ${isImage
            ? `<img src="/api/admin/media/${esc(meta.key)}" alt="">`
            : `<a class="admin-btn" href="/api/admin/media/${esc(meta.key)}" target="_blank" rel="noopener noreferrer">Open file</a>`}
          <div class="admin-review-image-label">Gallery ${i + 1}</div>
        </div>`;
      })
      .join("");
    const errorNote = errors.length
      ? `<div class="admin-review-image"><div class="admin-review-image-missing">${errors.length} gallery photo(s) not usable (bad format or size)</div></div>`
      : "";
    return items + errorNote;
  }

  function reviewImage(app, field, label) {
    const meta = app.files?.[field];
    const fileError = app.fileErrors?.[field];
    if (!meta?.key) {
      if (!fileError) return "";
      // The file was rejected server-side (bad format/size) and never stored,
      // so there's nothing to preview here - surface why instead of a blank slot,
      // so a reviewer knows to follow up with the applicant rather than assuming
      // she just skipped this photo.
      return `<div class="admin-review-image">
        <div class="admin-review-image-missing">Not usable: ${esc(fileError)}</div>
        <div class="admin-review-image-label">${esc(label)}</div>
      </div>`;
    }
    // Browser support for inline HEIC/HEIF rendering is inconsistent outside
    // Safari, so link out to it instead of risking a broken <img>.
    const isImage = (meta.type || "").startsWith("image/") && meta.type !== "image/heic";
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
        ${reviewGalleryImages(app)}
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

  function imageSlot(model, slot, label, required) {
    const key = model.images?.[slot];
    return `<div class="admin-image-slot">
      <div class="admin-image-slot-label">${label}${required ? ' <span class="admin-required" aria-hidden="true">*</span>' : ""}</div>
      <div class="admin-image-box" data-slot="${slot}">
        ${key ? `<img src="/media/${esc(key)}" alt=""><button class="admin-image-remove" type="button" data-remove-key="${esc(key)}" aria-label="Remove ${esc(label)} photo">Remove</button>` : `<span class="admin-image-placeholder">Upload</span>`}
        <input type="file" accept="image/*" data-upload-slot="${slot}" aria-label="${key ? "Replace" : "Upload"} ${esc(label)} photo${required ? " (required to publish)" : ""}">
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
    const SEO_TITLE_MAX = 60;
    const SEO_DESC_MAX = 160;
    const measureHint = (model.categories?.[0] === "men")
      ? "Chest or waist is required before publishing."
      : "Bust, waist or hips is required before publishing.";

    detail.innerHTML = `
      <div class="admin-detail-head">
        <h2>${esc(model.name)}</h2>
        <div class="admin-actions">
          <span class="admin-badge ${model.published ? "published" : "unpublished"}">${model.published ? "published" : "unpublished"}</span>
          <button class="admin-btn danger" id="archive-model-btn" type="button">Archive</button>
          <button class="admin-btn" id="publish-toggle-btn" type="button">${model.published ? "Unpublish" : "Publish"}</button>
          <button class="admin-btn primary" id="save-model-btn" type="button">Save changes</button>
        </div>
      </div>

      <div class="admin-section-title">Photos</div>
      <p class="admin-note">JPEG, PNG or WEBP, up to 8MB. Headshot, front and side photos (marked <span class="admin-required" aria-hidden="true">*</span>) are required before publishing.</p>
      <div class="admin-images-grid">
        ${imageSlot(model, "headshot", "Headshot", true)}
        ${imageSlot(model, "fullFront", "Full length, front", true)}
        ${imageSlot(model, "fullSide", "Full length, side", true)}
      </div>
      <div class="admin-section-title" style="margin-top:0;border-top:none;padding-top:0;">Gallery</div>
      <div class="admin-gallery-strip" id="gallery-strip">
        ${gallery.map((key) => `<div class="admin-gallery-item"><img src="/media/${esc(key)}" alt=""><button class="admin-image-remove" type="button" data-remove-key="${esc(key)}" aria-label="Remove this gallery photo">✕</button></div>`).join("")}
        <div class="admin-gallery-add"><span aria-hidden="true">+</span><input type="file" accept="image/*" id="gallery-upload" aria-label="Add a gallery photo"></div>
      </div>

      <div class="admin-section-title">Profile</div>
      <div class="admin-grid">
        <div class="admin-field"><label for="f-name">Name <span class="admin-required" aria-hidden="true">*</span></label><input id="f-name" value="${esc(model.name)}" aria-required="true"></div>
        <div class="admin-field"><label for="f-category">Category</label>
          <select id="f-category">
            <option value="women" ${model.categories?.[0] === "women" ? "selected" : ""}>Women</option>
            <option value="men" ${model.categories?.[0] === "men" ? "selected" : ""}>Men</option>
          </select>
        </div>
        <div class="admin-field"><label for="f-subcategories">Subcategories (comma-separated)</label><input id="f-subcategories" value="${esc((model.subcategories || []).join(", "))}" placeholder="editorial-fashion, commercial, beauty, fitness"></div>
        <div class="admin-field"><label for="f-status">Status</label>
          <select id="f-status">
            <option value="active" ${model.status === "active" ? "selected" : ""}>Active</option>
            <option value="hidden" ${model.status === "hidden" ? "selected" : ""}>Hidden</option>
          </select>
        </div>
        <div class="admin-field checkbox"><input type="checkbox" id="f-newface" ${model.newFace ? "checked" : ""}><label for="f-newface">New face</label></div>
        <div class="admin-field checkbox"><input type="checkbox" id="f-featured" ${model.featured ? "checked" : ""}><label for="f-featured">Featured on homepage</label></div>
        <div class="admin-field"><label for="f-order">Display order</label><input type="number" id="f-order" value="${esc(model.displayOrder)}"></div>
      </div>

      <div class="admin-section-title">Stats</div>
      <p class="admin-note">${measureHint}</p>
      <div class="admin-grid">
        <div class="admin-field"><label for="f-location">Location <span class="admin-required" aria-hidden="true">*</span></label><input id="f-location" list="f-location-cities" value="${esc(model.location)}" aria-required="true" aria-describedby="f-location-hint"><datalist id="f-location-cities">${["Abu Dhabi","Ajman","Al Ain","Dubai","Fujairah","Ras Al Khaimah","Sharjah","Umm Al Quwain"].map((c) => `<option value="${c}, UAE">`).join("")}</datalist><div class="admin-note" id="f-location-hint">Pick a UAE city; spelling is normalised on save (e.g. "Dubaí" becomes "Dubai, UAE").</div></div>
        <div class="admin-field"><label for="f-height">Height <span class="admin-required" aria-hidden="true">*</span></label><input id="f-height" value="${esc(model.height)}" placeholder="e.g. 177 cm" aria-required="true"></div>
        <div class="admin-field"><label for="f-unit">Measurement unit</label>
          <select id="f-unit"><option value="cm" ${model.measurementUnit === "cm" ? "selected" : ""}>cm</option><option value="in" ${model.measurementUnit === "in" ? "selected" : ""}>in</option></select>
        </div>
        <div class="admin-field"><label for="f-measurements">Measurements (display text)</label><input id="f-measurements" value="${esc(model.measurements)}" placeholder="e.g. 81-61-88 cm"></div>
        <div class="admin-field"><label for="f-bust">Bust</label><input type="number" step="0.1" min="0" id="f-bust" value="${esc(model.bust)}"></div>
        <div class="admin-field"><label for="f-waist">Waist</label><input type="number" step="0.1" min="0" id="f-waist" value="${esc(model.waist)}"></div>
        <div class="admin-field"><label for="f-hips">Hips</label><input type="number" step="0.1" min="0" id="f-hips" value="${esc(model.hips)}"></div>
        <div class="admin-field"><label for="f-neck">Neck</label><input type="number" step="0.1" min="0" id="f-neck" value="${esc(model.neck)}"></div>
        <div class="admin-field"><label for="f-chest">Chest</label><input type="number" step="0.1" min="0" id="f-chest" value="${esc(model.chest)}"></div>
        <div class="admin-field"><label for="f-sleeve">Sleeve</label><input type="number" step="0.1" min="0" id="f-sleeve" value="${esc(model.sleeve)}"></div>
        <div class="admin-field"><label for="f-inseam">Inseam</label><input type="number" step="0.1" min="0" id="f-inseam" value="${esc(model.inseam)}"></div>
        <div class="admin-field"><label for="f-hair">Hair colour</label><input id="f-hair" value="${esc(model.hair)}"></div>
        <div class="admin-field"><label for="f-eyes">Eye colour</label><input id="f-eyes" value="${esc(model.eyes)}"></div>
        <div class="admin-field full"><label for="f-languages">Languages (comma-separated)</label><input id="f-languages" value="${esc((model.languages || []).join(", "))}"></div>
        <div class="admin-field full"><label for="f-skills">Skills (comma-separated)</label><input id="f-skills" value="${esc((model.skills || []).join(", "))}"></div>
      </div>

      <div class="admin-section-title">SEO</div>
      <div class="admin-grid">
        <div class="admin-field full">
          <label for="f-seo-title">SEO title <span class="admin-required" aria-hidden="true">*</span></label>
          <input id="f-seo-title" value="${esc(model.seoTitle)}" aria-required="true" maxlength="120">
          <div class="admin-char-counter" id="f-seo-title-counter" aria-live="polite"></div>
        </div>
        <div class="admin-field full">
          <label for="f-seo-desc">SEO description <span class="admin-required" aria-hidden="true">*</span></label>
          <textarea id="f-seo-desc" aria-required="true" maxlength="300">${esc(model.seoDescription)}</textarea>
          <div class="admin-char-counter" id="f-seo-desc-counter" aria-live="polite"></div>
        </div>
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

    function updateCounter(inputId, counterId, max) {
      const input = document.getElementById(inputId);
      const counter = document.getElementById(counterId);
      const update = () => {
        const len = input.value.length;
        counter.textContent = `${len} / ${max} recommended`;
        counter.classList.toggle("over", len > max);
      };
      input.addEventListener("input", update);
      update();
    }
    updateCounter("f-seo-title", "f-seo-title-counter", SEO_TITLE_MAX);
    updateCounter("f-seo-desc", "f-seo-desc-counter", SEO_DESC_MAX);

    detail.addEventListener("input", () => { state.modelFormDirty = true; });
    detail.addEventListener("change", () => { state.modelFormDirty = true; });

    document.getElementById("save-model-btn").addEventListener("click", () => saveModel(model.slug));
    document.getElementById("archive-model-btn").addEventListener("click", () => archiveModel(model.slug, model.name));
    document.getElementById("publish-toggle-btn").addEventListener("click", () => togglePublish(model, slug));
  }

  async function togglePublish(model, slug) {
    if (state.modelFormDirty) { toast("Save your changes first.", true); return; }

    if (model.published) {
      const proceed = await showConfirmModal({
        title: "Unpublish", confirmLabel: "Unpublish", danger: true,
        message: `Take ${model.name} off the live site? It stays saved as a draft you can republish anytime.`,
      });
      if (!proceed) return;
    } else {
      const readiness = publishReadiness(model);
      if (!readiness.ready) {
        toast(`Can't publish yet, missing: ${readiness.missing.join(", ")}`, true);
        return;
      }
      const proceed = await showConfirmModal({
        title: "Publish", confirmLabel: "Publish",
        message: `Publish ${model.name} to the live site? It becomes visible on models.photoczaro.com immediately.`,
      });
      if (!proceed) return;
    }

    try {
      await api(`/api/admin/models/${encodeURIComponent(slug)}/publish`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ published: !model.published }),
      });
      toast(model.published ? "Unpublished." : "Published.");
      await loadModels();
      selectModel(slug);
    } catch (err) { toast(err.message, true); }
  }

  const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

  async function uploadImage(slug, slot, file) {
    if (!file) return;
    if (file.size > MAX_UPLOAD_BYTES) {
      toast("File exceeds the 8MB limit.", true);
      return;
    }

    const box = slot === "gallery"
      ? document.querySelector(".admin-gallery-add")
      : document.querySelector(`.admin-image-box[data-slot="${slot}"]`);
    const progressEl = document.createElement("div");
    progressEl.className = "admin-image-progress";
    progressEl.textContent = "Uploading… 0%";
    box?.appendChild(progressEl);

    const fd = new FormData();
    fd.append("image", file);
    fd.append("slot", slot);
    try {
      await uploadWithProgress(`/api/admin/models/${encodeURIComponent(slug)}/images`, fd, (pct) => {
        progressEl.textContent = `Uploading… ${pct}%`;
      });
      toast("Image uploaded.");
      state.modelFormDirty = false;
      await loadModels();
      selectModel(slug);
    } catch (err) {
      toast(err.message, true);
      progressEl.remove();
    }
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

  const NUMERIC_FIELD_IDS = ["f-bust", "f-waist", "f-hips", "f-neck", "f-chest", "f-sleeve", "f-inseam"];

  async function saveModel(slug) {
    for (const id of NUMERIC_FIELD_IDS) {
      const el = document.getElementById(id);
      if (el.value && !el.checkValidity()) {
        const label = document.querySelector(`label[for="${id}"]`)?.textContent.trim() || id;
        toast(`${label} must be a valid, non-negative number.`, true);
        el.focus();
        return;
      }
    }

    const body = {
      name: document.getElementById("f-name").value.trim(),
      categories: [document.getElementById("f-category").value],
      subcategories: splitList(document.getElementById("f-subcategories").value),
      status: document.getElementById("f-status").value,
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

  /* Bento layout: the detail panes are rendered as a flat run of headings and
     fields. Whenever one is (re)rendered, group each heading and what follows
     it into a card so the pane reads as a grid of tiles. Moves the existing
     nodes rather than copying them, so ids and listeners are untouched. */
  const CARD_SPAN = { details: "s7", measurements: "s5", photos: "s7", gallery: "s5", profile: "s7", stats: "s5" };
  function bentoize(detail) {
    if (!detail.querySelector(":scope > .admin-section-title")) return;
    const nodes = Array.from(detail.childNodes);
    const grid = document.createElement("div");
    grid.className = "admin-bento";
    let card = null;
    const newCard = (title) => {
      card = document.createElement("section");
      const key = title ? title.textContent.trim().toLowerCase().replace(/\s*\(.*$/, "") : "";
      card.className = "admin-card " + (CARD_SPAN[key] || "");
      grid.appendChild(card);
    };
    nodes.forEach((node) => {
      if (node.nodeType !== 1) { if (card) card.appendChild(node); return; }
      if (node.classList.contains("admin-detail-head")) { card = null; grid.appendChild(node); return; }
      if (node.classList.contains("admin-section-title")) { newCard(node); card.appendChild(node); return; }
      if (!card) newCard(null);
      card.appendChild(node);
    });
    detail.appendChild(grid);
  }
  ["applications-detail", "models-detail"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) new MutationObserver(() => bentoize(el)).observe(el, { childList: true });
  });

  loadSession();
  loadApplications().catch((err) => toast(err.message, true));
  loadModels().catch((err) => toast(err.message, true));
})();
