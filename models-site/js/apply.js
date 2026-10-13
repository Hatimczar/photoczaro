/*
 * Roster application form behaviour (apply.html).
 *
 * Validation goes through js/apply-rules.js, the same module the apply
 * Function runs, so the page and the server agree. The form is one page with
 * labelled sections; this script adds photo previews, unit conversion,
 * conditional fields, an accessible error summary and a progress-reporting
 * upload. Nothing is cleared until the server confirms the application.
 */
(function () {
  "use strict";
  const i18n = window.PhotoczaroI18n;
  const Rules = window.PhotoczaroApplyRules;
  const Render = window.PhotoczaroRender;
  const form = document.getElementById("apply-form");
  if (!form || !Rules) return;

  const status = document.getElementById("form-status");
  const summary = document.getElementById("error-summary");
  const summaryList = document.getElementById("error-summary-list");
  const submitButton = document.getElementById("apply-submit");
  const progress = document.getElementById("apply-progress");

  const MAX_BYTES = 8 * 1024 * 1024;
  const MAX_GALLERY_PHOTOS = 12;
  const WEBP_MAX_DIMENSION = 4000; // below the server's 6000px sanity cap; photos are never upscaled
  const WEBP_QUALITY = 0.92; // visually lossless for photographs
  const PHOTO_SLOTS = ["headshot", "fullFront", "fullSide", "facialProfile"];
  const FILE_FIELDS = PHOTO_SLOTS.concat(["portfolioFile"]);
  const CONFIRMS = ["ageConfirm", "residencyConfirm", "accuracyConfirm", "privacyConsent", "termsConsent"];
  const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

  function t(key, vars) {
    let s = i18n && i18n.t ? i18n.t(key) : null;
    if (s == null) s = key;
    if (vars) Object.keys(vars).forEach((k) => { s = s.replace("{" + k + "}", vars[k]); });
    return s;
  }

  /* ---------- Photo preparation ---------- */

  const isHeic = (file) => /hei[cf]/i.test(file.type || "") || /\.hei[cf]$/i.test(file.name || "");
  function imageKind(file) {
    const type = (file.type || "").toLowerCase();
    if (IMAGE_TYPES.includes(type)) return type;
    if (!type) {
      const ext = (file.name.split(".").pop() || "").toLowerCase();
      if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
      if (ext === "png") return "image/png";
      if (ext === "webp") return "image/webp";
    }
    return null;
  }

  async function encodeWebp(bitmap, maxDim, quality) {
    let { width, height } = bitmap;
    if (width > maxDim || height > maxDim) {
      const scale = maxDim / Math.max(width, height);
      width = Math.round(width * scale);
      height = Math.round(height * scale);
    }
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bitmap, 0, 0, width, height);
    return new Promise((resolve) => canvas.toBlob(resolve, "image/webp", quality));
  }

  /* Every photo is re-encoded to WebP in the browser (smaller uploads on
     mobile data, one stored format). A file the browser cannot decode is
     refused with a clear message rather than sent on hoping the server copes;
     HEIC is only accepted where the browser can decode it (Safari). Resolves
     to a File, or rejects with an error code. */
  async function prepareImage(file) {
    const heic = isHeic(file);
    const kind = imageKind(file);
    if (!heic && !kind) throw "file_type";
    if (typeof createImageBitmap !== "function") {
      if (heic) throw "file_heic";
      if (file.size > MAX_BYTES) throw "file_size";
      return file;
    }
    if (kind === "image/webp" && file.size <= MAX_BYTES) return file;
    let bitmap;
    try {
      try { bitmap = await createImageBitmap(file, { imageOrientation: "from-image" }); }
      catch (e) { bitmap = await createImageBitmap(file); }
    } catch (e) {
      throw heic ? "file_heic" : "file_decode";
    }
    let blob = await encodeWebp(bitmap, WEBP_MAX_DIMENSION, WEBP_QUALITY);
    // Only step quality down if the 8 MB cap forces it, and as little as possible.
    for (const [dim, q] of [[3600, 0.88], [3000, 0.84], [2400, 0.8]]) {
      if (!blob || blob.size <= MAX_BYTES) break;
      blob = await encodeWebp(bitmap, dim, q);
    }
    if (bitmap.close) bitmap.close();
    if (!blob || blob.type !== "image/webp") {
      if (heic) throw "file_heic";
      if (file.size > MAX_BYTES) throw "file_size";
      return file;
    }
    if (blob.size > MAX_BYTES) throw "file_size";
    return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".webp", { type: "image/webp" });
  }

  async function preparePortfolio(file) {
    const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
    if (isPdf) {
      if (file.size > MAX_BYTES) throw "file_size";
      return file;
    }
    try { return await prepareImage(file); }
    catch (code) { throw code === "file_type" ? "file_type_pdf" : code; }
  }

  let pendingConversions = 0;
  async function track(promise) {
    pendingConversions++;
    try { return await promise; } finally { pendingConversions--; }
  }

  const sizeLabel = (bytes) => (bytes >= 1048576 ? (bytes / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round(bytes / 1024)) + " KB");

  /* ---------- Errors, warnings and the summary ---------- */

  const fileErrors = {}; // errors raised while choosing a file, keyed by field name
  // "waist" exists in both measurement groups; only the enabled one counts.
  const controlFor = (name) => form.querySelector('[name="' + name + '"]:not([disabled])') || form.querySelector('[name="' + name + '"]');
  function errorEl(name) {
    const c = controlFor(name);
    const scope = c && (c.closest(".form-field") || c.closest("fieldset") || c.closest(".confirm-item") || c.closest(".photo-slot-body"));
    return (scope && scope.querySelector('[data-error-name="' + name + '"]')) || form.querySelector('[data-error-name="' + name + '"]');
  }

  function messageFor(name, code) {
    if (code === "required") {
      if (CONFIRMS.includes(name)) return t("apply.err.confirm");
      if (FILE_FIELDS.includes(name)) return t("apply.err.photo_required");
    }
    return t("apply.err." + code);
  }

  function labelFor(name) {
    const control = controlFor(name);
    if (!control) return "";
    let node = null;
    if (control.type === "file" && control.closest(".photo-slot")) node = control.closest(".photo-slot").querySelector(".photo-slot-title");
    else if (control.type === "radio" || (control.type === "checkbox" && !CONFIRMS.includes(name))) node = control.closest("fieldset") && control.closest("fieldset").querySelector("legend");
    else if (control.id) node = form.querySelector('label[for="' + control.id + '"]');
    if (!node && control.closest("label")) node = control.closest("label");
    if (!node) return control.getAttribute("aria-label") || "";
    const clone = node.cloneNode(true);
    clone.querySelectorAll(".opt-tag, .unit-suffix").forEach((n) => n.remove());
    const text = clone.textContent.replace(/\s+/g, " ").replace(/[\s*.]+$/, "").trim();
    return text.length > 70 ? text.slice(0, 67) + "…" : text;
  }

  function setFieldError(name, code) {
    const span = errorEl(name);
    const control = controlFor(name);
    const group = control && (control.type === "radio" || control.type === "checkbox") && !CONFIRMS.includes(name);
    if (span) span.textContent = code ? messageFor(name, code) : "";
    if (control) {
      const targets = group ? form.querySelectorAll('[name="' + name + '"]') : [control];
      targets.forEach((el) => { if (code) el.setAttribute("aria-invalid", "true"); else el.removeAttribute("aria-invalid"); });
    }
  }

  function renderSummary(errors) {
    // List the problems in the order they appear on the page.
    const names = Object.keys(errors).filter((n) => controlFor(n)).sort((a, b) =>
      controlFor(a).compareDocumentPosition(controlFor(b)) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1);
    summaryList.innerHTML = "";
    names.forEach((name) => {
      const control = controlFor(name);
      if (!control) return;
      if (!control.id) control.id = "ctl-" + name;
      const li = document.createElement("li");
      li.dataset.summaryFor = name;
      const a = document.createElement("a");
      a.href = "#" + control.id;
      const label = labelFor(name);
      a.textContent = (label ? label + ": " : "") + messageFor(name, errors[name]);
      a.addEventListener("click", (e) => {
        e.preventDefault();
        control.focus();
        control.scrollIntoView({ block: "center" });
      });
      li.appendChild(a);
      summaryList.appendChild(li);
    });
    summary.hidden = summaryList.children.length === 0;
  }

  let currentErrors = {};
  function showErrors(errors, focus) {
    // Clear everything that was shown before, then show the current set.
    Object.keys(currentErrors).forEach((name) => setFieldError(name, null));
    currentErrors = errors;
    Object.keys(errors).forEach((name) => setFieldError(name, errors[name]));
    renderSummary(errors);
    if (focus && !summary.hidden) {
      status.className = "form-status";
      status.textContent = "";
      summary.focus();
      summary.scrollIntoView({ block: "start" });
    }
  }

  /* ---------- Gathering the values ---------- */

  const photoFiles = {}; // field name -> prepared File
  const portfolioInput = document.getElementById("file-extra");
  let galleryFiles = [];

  function readInput() {
    const data = new FormData(form);
    const input = {};
    for (const key of new Set(data.keys())) {
      const v = data.get(key);
      if (typeof v === "string") input[key] = v;
    }
    input.workInterests = data.getAll("workInterests").filter((v) => typeof v === "string");
    CONFIRMS.forEach((k) => { input[k] = data.get(k) === "on"; });
    return input;
  }

  function validate() {
    const result = Rules.validateApplication(readInput(), {
      canonicalCity: Render && Render.canonicalCity,
      files: { headshot: !!photoFiles.headshot, fullFront: !!photoFiles.fullFront, fullSide: !!photoFiles.fullSide },
    });
    const errors = Object.assign({}, result.errors);
    // A rejected optional file is simply not sent, so it must not block the
    // application; the applicant was already told when they chose it.
    const optionalEmpty = { portfolioFile: !(portfolioInput.files && portfolioInput.files.length), facialProfile: !photoFiles.facialProfile };
    Object.keys(fileErrors).forEach((name) => { if (fileErrors[name] && !optionalEmpty[name]) errors[name] = fileErrors[name]; });
    return errors;
  }

  /* Re-check a field as soon as it has been corrected, so its error does not
     linger until the next submit. */
  function revalidateField(name) {
    if (!name || !Object.prototype.hasOwnProperty.call(currentErrors, name)) return;
    const errors = validate();
    const next = Object.assign({}, currentErrors);
    if (errors[name]) next[name] = errors[name]; else delete next[name];
    showErrors(next, false);
  }
  form.addEventListener("input", (e) => revalidateField(e.target && e.target.name));
  form.addEventListener("change", (e) => revalidateField(e.target && e.target.name));

  /* Soft, non-blocking hints: an unusual measurement, or a birth year that
     would make the applicant under 18. */
  function showWarning(field, key) {
    const scope = field.closest(".form-field");
    const el = scope && scope.querySelector("[data-warn-name]");
    if (!el) return;
    el.textContent = key ? t(key) : "";
    el.hidden = !key;
  }
  function checkWarnings(field) {
    const name = field.name;
    if (name === "birthYear") {
      const r = Rules.checkBirthYear(field.value);
      showWarning(field, r.ok && r.underage ? "apply.warn.underage" : null);
    } else if (field.hasAttribute("data-ph-cm")) {
      const r = Rules.checkMeasurement(name, field.value, currentUnit, false);
      showWarning(field, r.unusual ? "apply.warn.doubleCheck" : null);
    }
  }
  form.addEventListener("input", (e) => { if (e.target && e.target.name) checkWarnings(e.target); });

  /* ---------- Photo slots ---------- */

  const slotEls = {};
  PHOTO_SLOTS.forEach((name) => {
    const root = form.querySelector('.photo-slot[data-slot="' + name + '"]');
    const input = root.querySelector('input[type="file"]');
    slotEls[name] = {
      root, input,
      preview: root.querySelector(".photo-preview"),
      img: root.querySelector(".photo-preview img"),
      meta: root.querySelector(".photo-meta"),
      choose: root.querySelector(".photo-choose span"),
      remove: root.querySelector(".photo-remove"),
      url: null,
    };
  });

  function renderSlot(name) {
    const el = slotEls[name];
    const file = photoFiles[name];
    if (el.url) { URL.revokeObjectURL(el.url); el.url = null; }
    if (file) {
      el.url = URL.createObjectURL(file);
      el.img.src = el.url;
      el.meta.textContent = file.name + " · " + sizeLabel(file.size);
    }
    el.preview.hidden = !file;
    el.remove.hidden = !file;
    el.choose.textContent = t(file ? "apply.replacePhoto" : "apply.choosePhoto");
    el.remove.setAttribute("aria-label", t("apply.removeNamed", { name: labelFor(name) }));
  }

  function setFileError(name, code) {
    if (code) fileErrors[name] = code; else delete fileErrors[name];
    // Show or clear straight away rather than waiting for the next submit.
    const next = Object.assign({}, currentErrors);
    if (code) next[name] = code; else delete next[name];
    showErrors(next, false);
  }

  PHOTO_SLOTS.forEach((name) => {
    const el = slotEls[name];
    el.input.addEventListener("change", async () => {
      const picked = el.input.files && el.input.files[0];
      el.input.value = ""; // allow choosing the same file again; the prepared file lives in photoFiles
      if (!picked) return;
      el.root.setAttribute("aria-busy", "true");
      el.preview.hidden = false;
      el.meta.textContent = t("apply.preparing");
      try {
        photoFiles[name] = await track(prepareImage(picked));
        setFileError(name, null);
      } catch (code) {
        setFileError(name, typeof code === "string" ? code : "file_decode");
      }
      el.root.removeAttribute("aria-busy");
      renderSlot(name);
      revalidateField(name);
    });
    el.remove.addEventListener("click", () => {
      delete photoFiles[name];
      setFileError(name, null);
      renderSlot(name);
      el.input.focus();
    });
  });

  portfolioInput.addEventListener("change", async () => {
    const picked = portfolioInput.files && portfolioInput.files[0];
    if (!picked) { setFileError("portfolioFile", null); return; }
    try {
      const prepared = await track(preparePortfolio(picked));
      if (prepared !== picked && typeof DataTransfer === "function") {
        const dt = new DataTransfer();
        dt.items.add(prepared);
        portfolioInput.files = dt.files;
      }
      setFileError("portfolioFile", null);
    } catch (code) {
      portfolioInput.value = "";
      setFileError("portfolioFile", typeof code === "string" ? code : "file_decode");
    }
  });

  /* ---------- Additional gallery photos (up to 12) ---------- */

  const galleryGrid = document.getElementById("apply-gallery-grid");
  const galleryAddTile = document.getElementById("apply-gallery-add-tile");
  const galleryInput = document.getElementById("file-gallery-input");
  const galleryCount = document.getElementById("apply-gallery-count");
  const galleryMsg = document.getElementById("apply-gallery-msg");
  const galleryUrls = new WeakMap();

  function renderGallery(focusIndex) {
    galleryGrid.querySelectorAll(".apply-gallery-item").forEach((el) => el.remove());
    galleryFiles.forEach((file, index) => {
      if (!galleryUrls.has(file)) galleryUrls.set(file, URL.createObjectURL(file));
      const item = document.createElement("div");
      item.className = "apply-gallery-item";
      const img = document.createElement("img");
      img.src = galleryUrls.get(file);
      img.alt = "";
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "apply-gallery-remove";
      remove.setAttribute("aria-label", t("apply.removeGallery", { n: index + 1 }));
      remove.textContent = "✕";
      remove.addEventListener("click", () => {
        URL.revokeObjectURL(galleryUrls.get(file));
        galleryUrls.delete(file);
        galleryFiles.splice(index, 1);
        renderGallery(Math.min(index, galleryFiles.length - 1));
      });
      item.appendChild(img);
      item.appendChild(remove);
      galleryGrid.insertBefore(item, galleryAddTile);
    });
    const full = galleryFiles.length >= MAX_GALLERY_PHOTOS;
    galleryAddTile.style.display = full ? "none" : "";
    galleryCount.firstChild.textContent = galleryFiles.length + " / " + MAX_GALLERY_PHOTOS + " ";
    if (typeof focusIndex === "number") {
      const target = focusIndex >= 0 ? galleryGrid.querySelectorAll(".apply-gallery-remove")[focusIndex] : galleryInput;
      if (target) target.focus();
    }
  }

  galleryInput.addEventListener("change", async () => {
    const picked = Array.from(galleryInput.files || []);
    galleryInput.value = "";
    const rejected = [];
    const room = MAX_GALLERY_PHOTOS - galleryFiles.length;
    const accepted = picked.slice(0, Math.max(0, room));
    if (picked.length > room) rejected.push(t("apply.galleryLimit"));
    await track(Promise.all(accepted.map(async (file) => {
      try { galleryFiles.push(await prepareImage(file)); }
      catch (code) { rejected.push(file.name + " (" + t("apply.err." + (typeof code === "string" ? code : "file_decode")) + ")"); }
    })));
    galleryMsg.textContent = rejected.length ? t("apply.galleryRejected", { list: rejected.join("; ") }) : "";
    renderGallery();
  });

  /* ---------- Category-dependent measurements and sizes ---------- */

  const categoryField = document.getElementById("apply-category");
  const measurementsHint = document.getElementById("measurements-hint");
  const measureGroups = { women: document.getElementById("measure-women"), men: document.getElementById("measure-men") };
  const clothingLabel = document.getElementById("clothing-label");
  const CLOTHING_KEY = { women: "apply.dressSize", men: "apply.clothingSizeMen" };

  function applyCategory() {
    const active = measureGroups[categoryField.value];
    Object.values(measureGroups).forEach((group) => {
      const shown = group === active;
      group.style.display = shown ? "" : "none";
      group.querySelectorAll("input").forEach((input) => { input.disabled = !shown; });
    });
    measurementsHint.style.display = active ? "none" : "";
    const key = CLOTHING_KEY[categoryField.value] || "apply.clothingSize";
    clothingLabel.setAttribute("data-i18n", key);
    clothingLabel.textContent = t(key);
  }
  categoryField.addEventListener("change", applyCategory);

  /* ---------- Existing representation (conditional fields) ---------- */

  const repDetails = document.getElementById("rep-details");
  function applyRepresentation() {
    const checked = form.querySelector('input[name="existingRepresentation"]:checked');
    const yes = !!checked && checked.value === "yes";
    repDetails.hidden = !yes;
    repDetails.querySelectorAll("input").forEach((input) => { input.disabled = !yes; });
  }
  form.querySelectorAll('input[name="existingRepresentation"]').forEach((r) => r.addEventListener("change", applyRepresentation));

  /* ---------- CM / IN ---------- */

  /* Height and body measurements are entered in whichever unit the applicant
     picks; the choice travels with the submission as measurementUnit. Shoe,
     clothing and trouser sizes are labels and are never converted. Numbers
     already entered are converted from the exact centimetre value that was
     typed, so flipping back and forth never drifts. */
  const unitToggle = document.getElementById("unit-toggle");
  const unitField = document.getElementById("apply-unit");
  const unitFields = form.querySelectorAll("[data-ph-cm]");
  let currentUnit = "cm";

  function numberOf(field) {
    const n = Rules.parseNumber(field.value);
    return n !== null && Number.isFinite(n) ? n : null;
  }
  unitFields.forEach((field) => field.addEventListener("input", () => {
    const n = numberOf(field);
    if (n !== null) field.dataset.cm = String(currentUnit === "in" ? n * 2.54 : n); else delete field.dataset.cm;
  }));


  /* A slider beside each linear measurement (height, bust, waist, hips and the
     men's measurements) for quick entry on a phone. It is a convenience on top
     of the number field, which stays the source of truth and the keyboard /
     screen-reader control, so the slider is hidden from assistive technology
     and out of the tab order. It starts "unset": an optional measurement stays
     blank until the slider is actually moved. */
  const SLIDER_RANGE_CM = {
    height: [140, 210], bust: [70, 130], waist: [50, 120], hips: [70, 140],
    neck: [30, 50], chest: [80, 130], sleeve: [55, 95], inseam: [65, 95],
  };
  const sliders = [];
  unitFields.forEach((field) => {
    const range = SLIDER_RANGE_CM[field.name];
    if (!range) return;
    const slider = document.createElement("input");
    slider.type = "range";
    slider.className = "measure-slider unset";
    slider.tabIndex = -1;
    slider.setAttribute("aria-hidden", "true");
    field.insertAdjacentElement("afterend", slider);
    slider.addEventListener("input", () => {
      field.value = String(slider.value);
      field.dispatchEvent(new Event("input", { bubbles: true }));
    });
    field.addEventListener("input", () => syncSlider(slider, field));
    sliders.push({ slider, field, range });
  });
  function syncSlider(slider, field) {
    const n = numberOf(field);
    if (n === null) { slider.classList.add("unset"); slider.value = String((Number(slider.min) + Number(slider.max)) / 2); return; }
    slider.classList.remove("unset");
    slider.value = String(n);
  }
  function configureSliders() {
    sliders.forEach(({ slider, field, range }) => {
      const inches = currentUnit === "in";
      slider.min = String(inches ? Math.round(range[0] / 2.54) : range[0]);
      slider.max = String(inches ? Math.round(range[1] / 2.54) : range[1]);
      slider.step = inches ? "0.5" : "1";
      syncSlider(slider, field);
    });
  }

  function setUnit(unit) {
    if (unit !== currentUnit) {
      unitFields.forEach((field) => {
        const n = numberOf(field);
        if (n === null) return;
        const cm = field.dataset.cm ? parseFloat(field.dataset.cm) : (currentUnit === "in" ? n * 2.54 : n);
        field.dataset.cm = String(cm);
        field.value = String(Math.round((unit === "in" ? cm / 2.54 : cm) * 10) / 10);
      });
      currentUnit = unit;
    }
    unitToggle.querySelectorAll(".unit-toggle-btn").forEach((b) => {
      const on = b.dataset.unit === unit;
      b.classList.toggle("active", on);
      b.setAttribute("aria-pressed", on ? "true" : "false");
    });
    unitField.value = unit;
    unitFields.forEach((field) => { field.placeholder = field.dataset[unit === "in" ? "phIn" : "phCm"]; checkWarnings(field); });
    form.querySelectorAll("[data-unit-suffix]").forEach((el) => { el.textContent = "(" + unit + ")"; });
    configureSliders();
  }
  unitToggle.addEventListener("click", (e) => {
    const btn = e.target.closest(".unit-toggle-btn");
    if (btn) setUnit(btn.dataset.unit);
  });

  /* ---------- Submit ---------- */

  let isSubmitting = false;
  const submitLabel = submitButton.textContent;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    isSubmitting = true;
    submitButton.disabled = true;
    submitButton.setAttribute("aria-disabled", "true");
    try {
      await handleSubmit();
    } finally {
      isSubmitting = false;
      submitButton.disabled = false;
      submitButton.removeAttribute("aria-disabled");
      submitButton.textContent = submitLabel;
      progress.hidden = true;
    }
  });

  function send(fd) {
    return new Promise((resolve) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", "/api/apply");
      xhr.setRequestHeader("X-Requested-With", "fetch");
      let announced = -1;
      xhr.upload.onprogress = (ev) => {
        if (!ev.lengthComputable) return;
        const pct = Math.min(100, Math.round((ev.loaded / ev.total) * 100));
        progress.value = pct;
        // The visible bar updates continuously; the live region only at coarse steps.
        const step = Math.floor(pct / 25);
        if (step !== announced) {
          announced = step;
          status.className = "form-status";
          status.textContent = t("apply.uploading", { pct: pct });
        }
      };
      xhr.onload = () => {
        let body = {};
        try { body = JSON.parse(xhr.responseText); } catch (err) { /* non-JSON error page */ }
        resolve({ status: xhr.status, body });
      };
      xhr.onerror = xhr.ontimeout = () => resolve({ status: 0, body: {} });
      xhr.send(fd);
    });
  }

  async function handleSubmit() {
    if (pendingConversions > 0) {
      status.className = "form-status";
      status.textContent = t("apply.preparing");
      while (pendingConversions > 0) await new Promise((r) => setTimeout(r, 50));
    }
    status.textContent = "";

    const errors = validate();
    if (Object.keys(errors).length) {
      showErrors(errors, true);
      return;
    }
    showErrors({}, false);

    status.className = "form-status";
    status.textContent = t("apply.submitting");
    submitButton.textContent = t("apply.submitting");
    progress.value = 0;
    progress.hidden = false;

    const fd = new FormData(form);
    // The prepared photos in memory are the source of truth for the upload.
    PHOTO_SLOTS.forEach((name) => {
      fd.delete(name);
      if (photoFiles[name]) fd.append(name, photoFiles[name], photoFiles[name].name);
    });
    galleryFiles.forEach((file) => fd.append("gallery", file, file.name));

    const res = await send(fd);
    if (res.status === 200 && res.body && res.body.ok) {
      status.className = "form-status success";
      status.textContent = res.body.fileErrors ? t("apply.thankYouPartial") : t("apply.thankYou");
      resetForm();
      status.scrollIntoView({ block: "center" });
      return;
    }
    if (res.status === 400 && res.body && res.body.error === "validation" && res.body.fields) {
      showErrors(res.body.fields, true);
      status.className = "form-status error";
      status.textContent = t("apply.err.server_validation");
      return;
    }
    status.className = "form-status error";
    status.textContent = t("apply.sendError");
  }

  function resetForm() {
    form.reset();
    PHOTO_SLOTS.forEach((name) => { delete photoFiles[name]; renderSlot(name); });
    Object.keys(fileErrors).forEach((k) => delete fileErrors[k]);
    galleryFiles.forEach((f) => { if (galleryUrls.has(f)) URL.revokeObjectURL(galleryUrls.get(f)); });
    galleryFiles = [];
    galleryMsg.textContent = "";
    renderGallery();
    unitFields.forEach((f) => delete f.dataset.cm);
    currentUnit = "in"; // setUnit compares against this; force the visual reset to cm
    setUnit("cm");
    form.querySelectorAll("[data-warn-name]").forEach((el) => { el.hidden = true; el.textContent = ""; });
    applyCategory();
    applyRepresentation();
    showErrors({}, false);
  }

  configureSliders();
  PHOTO_SLOTS.forEach(renderSlot);
  applyCategory();
  applyRepresentation();
  window.addEventListener("photoczaro:i18n-applied", () => { PHOTO_SLOTS.forEach(renderSlot); applyCategory(); });

  if (window.PhotoczaroShortlist && window.PhotoczaroShortlist.render) window.PhotoczaroShortlist.render();
})();
