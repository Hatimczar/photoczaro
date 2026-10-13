/*
 * Roster application submission handler.
 * Stores each application's fields as a JSON record in APPLICATIONS_KV, and
 * uploaded files (headshot, full-length digitals, optional portfolio file)
 * as private objects in the MEDIA R2 bucket under applications/<id>/<field>.
 * Those objects are never served publicly; the admin panel proxies them
 * through /api/admin/media/*, which sits behind Cloudflare Access.
 *
 * Still needed before production: spam protection (Turnstile), rate-
 * limiting, and a reviewer notification (see book-talent.js for the same
 * open items).
 */
import { json, htmlResponse } from "../_lib/http.js";
import { validateImageUpload, validatePortfolioUpload } from "../_lib/image-validate.js";
import Render from "../../js/render.js";
import Rules from "../../js/apply-rules.js";

const MAX_GALLERY_PHOTOS = 12;
const EXT_FOR_TYPE = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "application/pdf": "pdf",
};
const isFile = (f) => f && typeof f === "object" && "size" in f && f.size > 0;

export async function onRequestPost({ request, env }) {
  const isNativeSubmit = request.headers.get("x-requested-with") !== "fetch";

  let form;
  try {
    form = await request.formData();
  } catch {
    return respondError(isNativeSubmit, "Invalid request.", 400);
  }

  // The same rules the page runs, applied again here: the browser is only a
  // convenience, never the check that counts. Field values come from FormData,
  // so a checkbox arrives as "on" and a missing one not at all.
  const input = {};
  for (const key of new Set(form.keys())) {
    if (key === "workInterests") continue;
    const v = form.get(key);
    if (typeof v === "string") input[key] = v;
  }
  input.workInterests = form.getAll("workInterests").filter((v) => typeof v === "string");
  ["ageConfirm", "residencyConfirm", "accuracyConfirm", "privacyConsent", "termsConsent"].forEach((k) => {
    input[k] = form.get(k) === "on";
  });
  const { errors, clean, warnings, flags } = Rules.validateApplication(input, {
    canonicalCity: Render.canonicalCity,
    files: {
      headshot: isFile(form.get("headshot")),
      fullFront: isFile(form.get("fullFront")),
      fullSide: isFile(form.get("fullSide")),
    },
  });
  if (Object.keys(errors).length) {
    if (isNativeSubmit) return htmlResponse("Please check your application", "Some required details are missing or invalid. Please go back, review the form and try again.", "apply", 400);
    return json({ error: "validation", fields: errors }, 400);
  }

  // Double-tap guard: a repeat submission from the same email within a
  // minute is treated as already received. The marker is set before the
  // (slow) uploads so a near-simultaneous second request sees it, and removed
  // again if this attempt fails so a retry is not mistaken for a duplicate.
  const dedupeKey = `dedupe:${clean.email}`;
  if (env.APPLICATIONS_KV) {
    if (await env.APPLICATIONS_KV.get(dedupeKey)) {
      if (isNativeSubmit) {
        return htmlResponse("Application received", "Thank you. Your application has been received.", "apply");
      }
      return json({ ok: true, duplicate: true });
    }
    await env.APPLICATIONS_KV.put(dedupeKey, "1", { expirationTtl: 60 });
  }

  try {
    return await store({ form, env, clean, warnings, flags, isNativeSubmit });
  } catch (err) {
    console.error("apply failed", err && err.message);
    if (env.APPLICATIONS_KV) await env.APPLICATIONS_KV.delete(dedupeKey).catch(() => {});
    return respondError(isNativeSubmit, "Something went wrong saving your application. Please try again.", 500);
  }
}

async function store({ form, env, clean, warnings, flags, isNativeSubmit }) {
  const marketing = form.get("marketingConsent") === "on";
  const applicationId = `${Date.now()}-${crypto.randomUUID()}`;
  // A rejected photo (wrong format, too large, corrupt) must never cost us
  // the applicant's contact details: skip that one file, note it as an
  // error on the record, and keep going. Losing a lead over one bad file is
  // worse than reviewing an application with a missing photo.
  const files = {};
  const fileErrors = {};
  const noHeic = { allowHeic: false };
  for (const field of ["headshot", "fullFront", "fullSide", "facialProfile", "portfolioFile"]) {
    const file = form.get(field);
    if (!isFile(file)) continue;

    const validation = field === "portfolioFile" ? await validatePortfolioUpload(file, noHeic) : await validateImageUpload(file, noHeic);
    if (!validation.ok) {
      fileErrors[field] = validation.error;
      continue;
    }

    const ext = EXT_FOR_TYPE[validation.contentType] || "bin";
    const key = `applications/${applicationId}/${field}.${ext}`;
    if (env.MEDIA) {
      await env.MEDIA.put(key, file.stream(), {
        httpMetadata: { contentType: validation.contentType },
      });
    }
    files[field] = { name: file.name, type: validation.contentType, size: file.size, key: env.MEDIA ? key : null };
  }

  // Additional gallery photos, submitted as repeated "gallery" fields (up to
  // MAX_GALLERY_PHOTOS). Same skip-and-note-the-error handling as the named
  // slots above: one bad photo shouldn't sink the whole application.
  const allGallery = form.getAll("gallery").filter(isFile);
  const galleryUploads = allGallery.slice(0, MAX_GALLERY_PHOTOS);
  const gallery = [];
  const galleryErrors = [];
  if (allGallery.length > MAX_GALLERY_PHOTOS) {
    galleryErrors.push(`Only ${MAX_GALLERY_PHOTOS} additional photos are accepted; ${allGallery.length - MAX_GALLERY_PHOTOS} extra photo(s) were not attached.`);
  }
  for (let i = 0; i < galleryUploads.length; i++) {
    const file = galleryUploads[i];
    const validation = await validateImageUpload(file, noHeic);
    if (!validation.ok) {
      galleryErrors.push(validation.error);
      continue;
    }
    const ext = EXT_FOR_TYPE[validation.contentType] || "bin";
    const key = `applications/${applicationId}/gallery-${i}.${ext}`;
    if (env.MEDIA) {
      await env.MEDIA.put(key, file.stream(), { httpMetadata: { contentType: validation.contentType } });
    }
    gallery.push({ name: file.name, type: validation.contentType, size: file.size, key: env.MEDIA ? key : null });
  }
  files.gallery = gallery;
  if (galleryErrors.length) fileErrors.gallery = galleryErrors;

  const now = new Date().toISOString();
  const record = {
    id: applicationId,
    schemaVersion: 2,
    professionalName: clean.professionalName,
    legalName: clean.legalName,
    category: clean.category,
    email: clean.email,
    telephone: clean.telephone,
    uaeCity: clean.uaeCity,
    birthYear: clean.birthYear,
    existingRepresentation: clean.existingRepresentation,
    agencyName: clean.agencyName,
    representationRestrictions: clean.representationRestrictions,
    experience: clean.experience,
    height: clean.height,
    measurementUnit: clean.measurementUnit,
    bust: clean.bust,
    waist: clean.waist,
    hips: clean.hips,
    neck: clean.neck,
    chest: clean.chest,
    sleeve: clean.sleeve,
    inseam: clean.inseam,
    hair: clean.hair,
    eyes: clean.eyes,
    shoeSize: clean.shoeSize,
    shoeSystem: clean.shoeSystem,
    clothingSize: clean.clothingSize,
    clothingSystem: clean.clothingSystem,
    trouserSize: clean.trouserSize,
    trouserSystem: clean.trouserSystem,
    missingSizes: clean.missingSizes,
    measurementWarnings: warnings,
    languages: clean.languages,
    skills: clean.skills,
    workInterests: clean.workInterests,
    availability: clean.availability,
    travelPreference: clean.travelPreference,
    bookingNotes: clean.bookingNotes,
    // Older records carry one combined Instagram/portfolio field; it is kept
    // as-is on those records and left empty here.
    portfolioUrl: "",
    instagram: clean.instagram,
    instagramUrl: clean.instagramUrl,
    portfolioWebsite: clean.portfolioWebsite,
    showreelUrl: clean.showreelUrl,
    introduction: clean.introduction,
    ageConfirm: true,
    residencyConfirm: true,
    accuracyConfirm: true,
    privacyConsent: true,
    termsConsent: true,
    // Optional and separate from the required confirmations; never pre-ticked.
    marketingConsent: marketing,
    marketingConsentAt: marketing ? now : null,
    termsVersion: Rules.TERMS_VERSION,
    termsAcceptedAt: now,
    privacyAcknowledgedAt: now,
    flags,
    files,
    fileErrors,
    receivedAt: now,
    status: "pending_review",
  };

  if (env.APPLICATIONS_KV) {
    await env.APPLICATIONS_KV.put(`application:${applicationId}`, JSON.stringify(record));
  } else {
    console.log("roster application (no KV bound):", record);
  }

  const hasFileErrors = Object.keys(fileErrors).length > 0;
  if (isNativeSubmit) {
    const message = hasFileErrors
      ? "Thank you. Your application has been received, but one or more photos could not be used (unsupported format or file size) and were not attached. We'll follow up by email if we need you to resend them."
      : "Thank you. Your application has been received. We'll contact you using the details provided if we would like to proceed.";
    return htmlResponse("Application received", message, "apply");
  }
  return json({ ok: true, fileErrors: hasFileErrors ? fileErrors : undefined });
}

function respondError(isNativeSubmit, message, status) {
  if (isNativeSubmit) {
    return htmlResponse("Something went wrong", message, "apply", status);
  }
  return json({ error: message }, status);
}
