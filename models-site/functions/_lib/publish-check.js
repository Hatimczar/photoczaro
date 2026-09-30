// Shared "is this profile actually ready to go live" gate. Used by the
// dedicated publish endpoint (server-side, authoritative) and mirrored by
// admin/app.js (client-side, so the Publish button can be disabled with a
// helpful reason before a round trip). Keep the two in sync.
export function publishReadiness(model) {
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
