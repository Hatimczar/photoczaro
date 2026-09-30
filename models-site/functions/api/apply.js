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

// Only accept a plain https:// link (Photoczaro doesn't need portfolios
// served over http, and a stray javascript:/data: URL stored here would
// otherwise render as a raw href in the admin panel).
function sanitizePortfolioUrl(value) {
  const trimmed = (value || "").toString().trim();
  if (!trimmed) return "";
  try {
    const url = new URL(trimmed);
    return url.protocol === "https:" ? url.toString() : "";
  } catch {
    return "";
  }
}

export async function onRequestPost({ request, env }) {
  const isNativeSubmit = request.headers.get("x-requested-with") !== "fetch";

  let form;
  try {
    form = await request.formData();
  } catch {
    return respondError(isNativeSubmit, "Invalid request.", 400);
  }

  const email = (form.get("email") || "").toString().trim().toLowerCase();
  const professionalName = (form.get("professionalName") || "").toString().trim();
  const category = (form.get("category") || "").toString().trim().toLowerCase();
  if (
    !professionalName ||
    !email ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    !["women", "men"].includes(category)
  ) {
    return respondError(isNativeSubmit, "Missing or invalid required fields.", 400);
  }

  const applicationId = `${Date.now()}-${crypto.randomUUID()}`;
  const EXT_FOR_TYPE = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/heic": "heic",
    "application/pdf": "pdf",
  };
  // A rejected photo (wrong format, too large, corrupt) must never cost us
  // the applicant's contact details: skip that one file, note it as an
  // error on the record, and keep going. Losing a lead over one bad file is
  // worse than reviewing an application with a missing photo.
  const imageFields = ["headshot", "fullFront", "fullSide"];
  const files = {};
  const fileErrors = {};
  for (const field of [...imageFields, "portfolioFile"]) {
    const file = form.get(field);
    if (!file || typeof file !== "object" || !("size" in file) || file.size === 0) continue;

    const validation = field === "portfolioFile" ? await validatePortfolioUpload(file) : await validateImageUpload(file);
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

  const record = {
    id: applicationId,
    professionalName,
    legalName: (form.get("legalName") || "").toString(),
    category,
    email,
    telephone: (form.get("telephone") || "").toString(),
    uaeCity: (form.get("uaeCity") || "").toString(),
    experience: (form.get("experience") || "").toString(),
    height: (form.get("height") || "").toString(),
    measurementUnit: (form.get("measurementUnit") || "cm").toString(),
    bust: (form.get("bust") || "").toString(),
    waist: (form.get("waist") || "").toString(),
    hips: (form.get("hips") || "").toString(),
    neck: (form.get("neck") || "").toString(),
    chest: (form.get("chest") || "").toString(),
    sleeve: (form.get("sleeve") || "").toString(),
    inseam: (form.get("inseam") || "").toString(),
    hair: (form.get("hair") || "").toString(),
    eyes: (form.get("eyes") || "").toString(),
    languages: (form.get("languages") || "").toString(),
    skills: (form.get("skills") || "").toString(),
    portfolioUrl: sanitizePortfolioUrl(form.get("portfolioUrl")),
    introduction: (form.get("introduction") || "").toString(),
    ageConfirm: form.get("ageConfirm") === "on",
    residencyConfirm: form.get("residencyConfirm") === "on",
    accuracyConfirm: form.get("accuracyConfirm") === "on",
    privacyConsent: form.get("privacyConsent") === "on",
    termsConsent: form.get("termsConsent") === "on",
    files,
    fileErrors,
    receivedAt: new Date().toISOString(),
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
      : "Thank you. Your application has been received. We review applications on a rolling basis and will contact you only through verified Photoczaro channels.";
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
