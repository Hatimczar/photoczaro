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
  const MAX_BYTES = 8 * 1024 * 1024;
  const fileFields = ["headshot", "fullFront", "fullSide", "portfolioFile"];
  const files = {};
  for (const field of fileFields) {
    const file = form.get(field);
    if (file && typeof file === "object" && "size" in file && file.size > 0) {
      if (file.size > MAX_BYTES) {
        return respondError(isNativeSubmit, `${field} exceeds the 8MB limit.`, 400);
      }
      const ext = (file.name || "").split(".").pop()?.toLowerCase().slice(0, 8) || "bin";
      const key = `applications/${applicationId}/${field}.${ext}`;
      if (env.MEDIA) {
        await env.MEDIA.put(key, file.stream(), {
          httpMetadata: { contentType: file.type || "application/octet-stream" },
        });
      }
      files[field] = { name: file.name, type: file.type, size: file.size, key: env.MEDIA ? key : null };
    }
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
    portfolioUrl: (form.get("portfolioUrl") || "").toString(),
    introduction: (form.get("introduction") || "").toString(),
    ageConfirm: form.get("ageConfirm") === "on",
    residencyConfirm: form.get("residencyConfirm") === "on",
    accuracyConfirm: form.get("accuracyConfirm") === "on",
    privacyConsent: form.get("privacyConsent") === "on",
    termsConsent: form.get("termsConsent") === "on",
    files,
    receivedAt: new Date().toISOString(),
    status: "pending_review",
  };

  if (env.APPLICATIONS_KV) {
    await env.APPLICATIONS_KV.put(`application:${applicationId}`, JSON.stringify(record));
  } else {
    console.log("roster application (no KV bound):", record);
  }

  if (isNativeSubmit) {
    return htmlResponse(
      "Application received",
      "Thank you. Your application has been received. We review applications on a rolling basis and will contact you only through verified Photoczaro channels.",
      "apply"
    );
  }
  return json({ ok: true });
}

function respondError(isNativeSubmit, message, status) {
  if (isNativeSubmit) {
    return htmlResponse("Something went wrong", message, "apply", status);
  }
  return json({ error: message }, status);
}
