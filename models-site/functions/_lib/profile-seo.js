/*
 * Search-facing copy for a model profile. New models are created with a
 * generic stored description ("<name>, a Photoczaro Models roster talent
 * based in the UAE."); that is the same text for every model, so for search
 * results and link previews it is replaced by one built from the profile's
 * own facts. A description an editor has written by hand is always kept.
 */
const GENERIC = /a Photoczaro Models roster talent based in the UAE\.?\s*$/i;

export function profileDescription(model) {
  const stored = (model.seoDescription || "").trim();
  if (stored && !GENERIC.test(stored)) return stored;

  const city = (model.location || "").split(",")[0].trim() || "the UAE";
  const gender = (model.categories || [])[0] === "men" ? "male" : "female";
  const bits = [`${model.name} is a ${gender} model based in ${city}, UAE.`];
  const stats = [model.height, model.hair && `${model.hair} hair`, model.eyes && `${model.eyes} eyes`].filter(Boolean);
  if (stats.length) bits.push(stats.join(", ") + ".");
  const langs = (model.languages || []).filter(Boolean);
  if (langs.length) bits.push(`Speaks ${langs.join(", ")}.`);
  bits.push("Book through Photoczaro Models Dubai.");

  let text = bits.join(" ");
  if (text.length > 158) {
    text = text.slice(0, 157).replace(/\s+\S*$/, "") + "…";
  }
  return text;
}

/* One Person identity per profile, shared by every language version; each
   language gets its own ProfilePage, labels and description. */
export function profileJsonLd(model, url, image, locale) {
  const o = locale || {};
  const origin = "https://models.photoczaro.com";
  const personId = `${origin}/models/${model.slug}#person`;
  const person = {
    "@type": "Person",
    "@id": personId,
    name: model.name,
    url,
    jobTitle: "Model",
    description: o.description || profileDescription(model),
  };
  if (image) person.image = image;
  if (model.height) person.height = model.height;
  if ((model.languages || []).length) person.knowsLanguage = model.languages;
  const prefix = o.prefix || "";
  const graph = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "ProfilePage", "@id": `${url}#profilepage`, url, inLanguage: o.lang || "en",
        name: o.title || model.seoTitle || `${model.name} | Photoczaro Models Dubai`,
        mainEntity: { "@id": personId },
        isPartOf: { "@id": `${origin}/#website` },
      },
      person,
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: o.home || "Home", item: `${origin}${prefix}/` },
          { "@type": "ListItem", position: 2, name: o.models || "Models", item: `${origin}${prefix}/models` },
          { "@type": "ListItem", position: 3, name: model.name, item: url },
        ],
      },
    ],
  };
  // "<" is escaped so a name can never close the script tag.
  return JSON.stringify(graph).replace(/</g, "\\u003c");
}
