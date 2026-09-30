(function () {
  const state = { applications: [], models: [], activeTab: "applications", selectedAppId: null, selectedSlug: null };

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

  /* ---------- Tabs ---------- */
  document.getElementById("admin-tabs").addEventListener("click", (e) => {
    const btn = e.target.closest(".admin-tab");
    if (!btn) return;
    state.activeTab = btn.dataset.tab;
    document.querySelectorAll(".admin-tab").forEach((t) => t.classList.toggle("active", t === btn));
    document.getElementById("panel-applications").hidden = state.activeTab !== "applications";
    document.getElementById("panel-models").hidden = state.activeTab !== "models";
  });

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
      <div class="admin-row ${a.id === state.selectedAppId ? "selected" : ""}" data-id="${esc(a.id)}">
        <div class="admin-row-title">${esc(a.professionalName)}</div>
        <div class="admin-row-meta">${esc(a.category)} · ${esc(a.uaeCity || "n/a")} · ${new Date(a.receivedAt).toLocaleDateString()}</div>
        <span class="admin-badge ${a.status === "pending_review" ? "pending" : a.status}">${a.status.replace("_", " ")}</span>
      </div>
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
        : `<a class="admin-btn" href="/api/admin/media/${esc(meta.key)}" target="_blank" rel="noopener">Open file</a>`}
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

    detail.innerHTML = `
      <div class="admin-detail-head">
        <h2>${esc(app.professionalName)}</h2>
        <div class="admin-actions">
          ${app.status === "pending_review" ? `
            <button class="admin-btn danger" id="reject-btn">Reject</button>
            <button class="admin-btn primary" id="approve-btn">Approve</button>
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
        <div class="admin-field"><label>Portfolio URL</label><div>${app.portfolioUrl ? `<a href="${esc(app.portfolioUrl)}" target="_blank" rel="noopener">${esc(app.portfolioUrl)}</a>` : "n/a"}</div></div>
        <div class="admin-field"><label>Age / residency confirmed</label><div>${app.ageConfirm ? "Yes" : "No"} / ${app.residencyConfirm ? "Yes" : "No"}</div></div>
      </div>

      <div class="admin-section-title">Measurements (${esc(app.measurementUnit)})</div>
      <div class="admin-grid">
        ${measureFields.map(([label, val]) => `<div class="admin-field"><label>${label}</label><div>${esc(val) || "n/a"}</div></div>`).join("")}
      </div>

      <div class="admin-section-title">Introduction</div>
      <p class="admin-note">${esc(app.introduction) || "n/a"}</p>

      ${app.rosterSlug ? `<p class="admin-note">Approved onto the roster as <a href="/models/${esc(app.rosterSlug)}" target="_blank" rel="noopener">${esc(app.rosterSlug)}</a>.</p>` : ""}
      ${app.rejectionReason ? `<p class="admin-note">Rejection note: ${esc(app.rejectionReason)}</p>` : ""}
    `;

    document.getElementById("approve-btn")?.addEventListener("click", async () => {
      if (!confirm(`Approve ${app.professionalName} and publish them to the live roster?`)) return;
      try {
        const res = await api(`/api/admin/applications/${encodeURIComponent(id)}`, {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "approve" }),
        });
        toast(`Approved. Now live as /${res.slug}.`);
        await loadApplications();
        await loadModels();
        selectApplication(id);
      } catch (err) { toast(err.message, true); }
    });
    document.getElementById("reject-btn")?.addEventListener("click", async () => {
      const reason = prompt("Optional note for this rejection:") || "";
      try {
        await api(`/api/admin/applications/${encodeURIComponent(id)}`, {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "reject", reason }),
        });
        toast("Application rejected.");
        await loadApplications();
        selectApplication(id);
      } catch (err) { toast(err.message, true); }
    });
  }

  /* ---------- Models ---------- */
  async function loadModels() {
    state.models = await api("/api/admin/models");
    renderModelsList();
    document.getElementById("tab-count-models").textContent = state.models.length ? `(${state.models.length})` : "";
  }

  function renderModelsList() {
    const list = document.getElementById("models-list");
    if (state.models.length === 0) {
      list.innerHTML = `<div class="admin-empty">No models yet.</div>`;
      return;
    }
    list.innerHTML = state.models.map((m) => `
      <div class="admin-row ${m.slug === state.selectedSlug ? "selected" : ""}" data-slug="${esc(m.slug)}">
        <div class="admin-row-title">${esc(m.name)}</div>
        <div class="admin-row-meta">${esc((m.categories || []).join(", "))} · order ${esc(m.displayOrder)}</div>
        <span class="admin-badge ${m.published ? "published" : "unpublished"}">${m.published ? "published" : "unpublished"}</span>
      </div>
    `).join("");
    list.querySelectorAll(".admin-row").forEach((row) => {
      row.addEventListener("click", () => selectModel(row.dataset.slug));
    });
  }

  function imageSlot(model, slot, label) {
    const key = model.images?.[slot];
    return `<div class="admin-image-slot">
      <div class="admin-image-slot-label">${label}</div>
      <div class="admin-image-box" data-slot="${slot}">
        ${key ? `<img src="/media/${esc(key)}" alt=""><button class="admin-image-remove" data-remove-key="${esc(key)}">Remove</button>` : `<span class="admin-image-placeholder">Upload</span>`}
        <input type="file" accept="image/*" data-upload-slot="${slot}">
      </div>
    </div>`;
  }

  async function selectModel(slug) {
    state.selectedSlug = slug;
    renderModelsList();
    const model = await api(`/api/admin/models/${encodeURIComponent(slug)}`);
    const detail = document.getElementById("models-detail");
    const gallery = model.images?.gallery || [];

    detail.innerHTML = `
      <div class="admin-detail-head">
        <h2>${esc(model.name)}</h2>
        <div class="admin-actions">
          <button class="admin-btn danger" id="delete-model-btn">Delete</button>
          <button class="admin-btn primary" id="save-model-btn">Save changes</button>
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
        ${gallery.map((key) => `<div class="admin-gallery-item"><img src="/media/${esc(key)}" alt=""><button class="admin-image-remove" data-remove-key="${esc(key)}">✕</button></div>`).join("")}
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
    `;

    detail.querySelectorAll("[data-upload-slot]").forEach((input) => {
      input.addEventListener("change", () => uploadImage(model.slug, input.dataset.uploadSlot, input.files[0]));
    });
    document.getElementById("gallery-upload").addEventListener("change", (e) => uploadImage(model.slug, "gallery", e.target.files[0]));
    detail.querySelectorAll("[data-remove-key]").forEach((btn) => {
      btn.addEventListener("click", () => removeImage(model.slug, btn.dataset.removeKey));
    });

    document.getElementById("save-model-btn").addEventListener("click", () => saveModel(model.slug));
    document.getElementById("delete-model-btn").addEventListener("click", () => deleteModel(model.slug, model.name));
  }

  async function uploadImage(slug, slot, file) {
    if (!file) return;
    const fd = new FormData();
    fd.append("image", file);
    fd.append("slot", slot);
    try {
      await api(`/api/admin/models/${encodeURIComponent(slug)}/images`, { method: "POST", body: fd });
      toast("Image uploaded.");
      await loadModels();
      selectModel(slug);
    } catch (err) { toast(err.message, true); }
  }

  async function removeImage(slug, key) {
    if (!confirm("Remove this image?")) return;
    try {
      await api(`/api/admin/models/${encodeURIComponent(slug)}/images?key=${encodeURIComponent(key)}`, { method: "DELETE" });
      toast("Image removed.");
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
      await loadModels();
    } catch (err) { toast(err.message, true); }
  }

  async function deleteModel(slug, name) {
    if (!confirm(`Permanently delete ${name}? This removes their profile and photos.`)) return;
    try {
      await api(`/api/admin/models/${encodeURIComponent(slug)}`, { method: "DELETE" });
      toast("Model deleted.");
      state.selectedSlug = null;
      document.getElementById("models-detail").innerHTML = `<div class="admin-empty">Select a model to edit, or create a new one.</div>`;
      await loadModels();
    } catch (err) { toast(err.message, true); }
  }

  document.getElementById("new-model-btn").addEventListener("click", async () => {
    const name = prompt("New model's professional name:");
    if (!name) return;
    const category = confirm("Click OK for Women, Cancel for Men.") ? "women" : "men";
    try {
      const res = await api("/api/admin/models", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, category }),
      });
      toast("Model created.");
      await loadModels();
      selectModel(res.slug);
    } catch (err) { toast(err.message, true); }
  });

  loadApplications().catch((err) => toast(err.message, true));
  loadModels().catch((err) => toast(err.message, true));
})();
