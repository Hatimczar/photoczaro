/*
 * SAMPLE DATA: NOT REAL PEOPLE.
 * These two records exist only to demonstrate the roster layout, filters,
 * shortlist and booking flow while real talent onboarding is in progress.
 * Every card and profile page also carries a visible "Sample profile" badge
 * (see .sample-badge in css/style.css) so this is never mistaken for a real,
 * bookable model, on-page and not just in this comment. Replace entirely with
 * genuine roster records, routed through a private application/onboarding
 * process, before removing the site-wide noindex block.
 * No photographs are used; cards render a gradient swatch + initials instead.
 */
window.PHOTOCZARO_MODELS = [
  {
    slug: "sample-profile-women",
    name: "Sample Profile (Women)",
    sample: true,
    status: "active",
    categories: ["women"],
    subcategories: ["editorial-fashion", "commercial"],
    newFace: false,
    featured: true,
    location: "Dubai, UAE",
    height: "177 cm",
    measurements: "81-61-88 cm",
    hair: "Black",
    eyes: "Brown",
    languages: ["English", "Arabic"],
    skills: ["Runway", "Editorial", "Swimwear"],
    displayOrder: 1,
    swatch: ["#2b2621", "#14120f"],
    seoTitle: "Sample Profile (Women) | Photoczaro Models Dubai",
    seoDescription: "A sample roster profile shown to demonstrate the Photoczaro Models layout. Not a real person and not available for booking.",
  },
  {
    slug: "sample-profile-men",
    name: "Sample Profile (Men)",
    sample: true,
    status: "active",
    categories: ["men"],
    subcategories: ["commercial", "fitness"],
    newFace: false,
    featured: true,
    location: "Dubai, UAE",
    height: "186 cm",
    measurements: "Chest 98 / Waist 81 cm",
    hair: "Black",
    eyes: "Brown",
    languages: ["English", "Arabic", "French"],
    skills: ["Commercial", "Fitness", "Lifestyle"],
    displayOrder: 2,
    swatch: ["#26221d", "#131110"],
    seoTitle: "Sample Profile (Men) | Photoczaro Models Dubai",
    seoDescription: "A sample roster profile shown to demonstrate the Photoczaro Models layout. Not a real person and not available for booking.",
  },
];

window.PHOTOCZARO_CATEGORY_LABELS = {
  women: "Women",
  men: "Men",
};
window.PHOTOCZARO_SUBCATEGORY_LABELS = {
  commercial: "Commercial",
  "editorial-fashion": "Editorial / Fashion",
  beauty: "Beauty",
  fitness: "Fitness",
};
