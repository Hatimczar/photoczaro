/*
 * Validation and normalisation rules for the roster application.
 *
 * One source for two runtimes, like render.js: the apply page loads this as a
 * classic script (window.PhotoczaroApplyRules) and the apply Function imports
 * it, so the browser and the server can never disagree about what a valid
 * application looks like. The server is still the authority: the browser only
 * uses these rules to give feedback early.
 *
 * Errors are short codes keyed by the form field name; the page maps each code
 * to a translated message (apply.err.<code>).
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.PhotoczaroApplyRules = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const TERMS_VERSION = "application-terms-1.1";

  const CATEGORIES = ["women", "men"];
  const MEASURE_FIELDS = {
    women: ["bust", "waist", "hips"],
    men: ["neck", "chest", "waist", "sleeve", "inseam"],
  };
  const ALL_MEASURE_FIELDS = ["height", "bust", "waist", "hips", "neck", "chest", "sleeve", "inseam"];

  /* Plausible ranges in centimetres. Outside them the applicant sees a gentle
     "please double-check" and the reviewer sees a note; nobody is rejected for
     their stature. */
  const PLAUSIBLE_CM = {
    height: [120, 230], bust: [60, 160], waist: [45, 150], hips: [60, 170],
    neck: [25, 55], chest: [70, 160], sleeve: [40, 110], inseam: [50, 110],
  };
  /* Beyond this a number cannot be a body measurement in either unit, so it is
     a typo (e.g. a missing decimal point) and is asked again. */
  const ABSOLUTE_MAX = 500;

  const ENUMS = {
    experience: ["new-face", "some-experience", "experienced"],
    existingRepresentation: ["yes", "no"],
    availability: ["weekdays", "weekends", "flexible", "varies"],
    travelPreference: ["yes", "depends", "current-emirate"],
    shoeSystem: ["EU", "UK", "US"],
    clothingSystem: ["EU", "UK", "US", "SML"],
    trouserSystem: ["EU", "UK", "US", "WAIST_IN"],
    measurementUnit: ["cm", "in"],
  };
  const WORK_INTERESTS = ["editorial", "fashion", "commercial", "ecommerce", "beauty", "lifestyle", "fitness", "runway", "acting-video"];

  const MAX_LEN = {
    professionalName: 100, legalName: 120, agencyName: 120, representationRestrictions: 300,
    bookingNotes: 600, introduction: 600, hair: 40, eyes: 40, languages: 200, skills: 200,
    shoeSize: 12, clothingSize: 12, trouserSize: 12, email: 254, telephone: 30,
  };

  /* Instagram path segments that are not profiles. */
  const INSTAGRAM_RESERVED = ["p", "reel", "reels", "tv", "stories", "explore", "accounts", "direct", "about", "legal", "web", "developer"];

  function str(value) {
    // eslint-disable-next-line no-control-regex
    return (value == null ? "" : String(value)).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").trim();
  }

  /* Blank stays blank (null); a number is finite or NaN. Accepts a comma as
     the decimal separator because several supported languages use one. */
  function parseNumber(value) {
    const s = str(value).replace(",", ".");
    if (s === "") return null;
    if (!/^\d+(\.\d+)?$/.test(s)) return NaN;
    return Number(s);
  }

  function normalizeInstagram(input) {
    let s = str(input);
    if (!s) return { ok: true, handle: "", url: "" };
    if (/^[a-z][a-z0-9+.-]*:/i.test(s) && !/^https?:\/\//i.test(s)) return { ok: false };
    if (/^https?:\/\//i.test(s) || /^(www\.)?(instagram\.com|instagr\.am)\//i.test(s)) {
      let url;
      try { url = new URL(/^https?:\/\//i.test(s) ? s : "https://" + s); } catch (e) { return { ok: false }; }
      const host = url.hostname.toLowerCase().replace(/^www\./, "");
      if (!["instagram.com", "instagr.am", "m.instagram.com"].includes(host)) return { ok: false };
      const first = url.pathname.split("/").filter(Boolean)[0] || "";
      if (!first || INSTAGRAM_RESERVED.includes(first.toLowerCase())) return { ok: false };
      s = first;
    }
    s = s.replace(/^@/, "");
    if (!/^[A-Za-z0-9._]{1,30}$/.test(s) || /^\.|\.$|\.\./.test(s)) return { ok: false };
    return { ok: true, handle: s, url: "https://www.instagram.com/" + s + "/" };
  }

  /* Plain http(s) links only. A bare domain gets https:// added; any other
     scheme (javascript:, data:, ftp:, mailto: ...) is rejected. */
  function normalizeWebUrl(input) {
    const s = str(input);
    if (!s) return { ok: true, url: "" };
    if (s.length > 300 || /\s/.test(s)) return { ok: false };
    const hasScheme = /^[a-z][a-z0-9+.-]*:/i.test(s);
    const hostPort = /^[^/:?#]+:\d+([/?#]|$)/.test(s);
    if (hasScheme && !hostPort && !/^https?:\/\//i.test(s)) return { ok: false };
    let url;
    try { url = new URL(/^https?:\/\//i.test(s) ? s : "https://" + s); } catch (e) { return { ok: false }; }
    if (!["http:", "https:"].includes(url.protocol)) return { ok: false };
    if (url.username || url.password) return { ok: false };
    if (!/^[^.]+(\.[^.]+)+$/.test(url.hostname) && !/^\[/.test(url.hostname)) return { ok: false };
    return { ok: true, url: url.toString() };
  }

  /* A birth year is private context, never proof of age. Someone whose year is
     eighteen or fewer calendar years before now might still be 18, so only a
     year that makes them 17 or younger in every case is flagged. */
  function checkBirthYear(value, now) {
    const s = str(value);
    if (!s) return { ok: true, year: null };
    if (!/^\d{4}$/.test(s)) return { ok: false, code: "invalid_year" };
    const year = Number(s);
    const thisYear = (now || new Date()).getUTCFullYear();
    if (year > thisYear) return { ok: false, code: "future_year" };
    if (year < 1900) return { ok: false, code: "invalid_year" };
    return { ok: true, year, underage: thisYear - year <= 17 };
  }

  /* International numbers are welcome: an optional +, then digits with the
     usual separators, 7-15 digits in total. */
  function checkPhone(value) {
    const s = str(value);
    if (!s) return { ok: false, code: "required" };
    if (!/^\+?[\d\s().-]+$/.test(s)) return { ok: false, code: "invalid_phone" };
    const digits = s.replace(/\D/g, "");
    if (digits.length < 7 || digits.length > 15) return { ok: false, code: "invalid_phone" };
    return { ok: true, value: s.replace(/\s+/g, " ") };
  }

  function checkMeasurement(name, value, unit, required) {
    const n = parseNumber(value);
    if (n === null) return required ? { error: "required" } : { value: "" };
    if (!Number.isFinite(n) || n <= 0 || n > ABSOLUTE_MAX) return { error: "invalid_number" };
    const cm = unit === "in" ? n * 2.54 : n;
    const range = PLAUSIBLE_CM[name];
    const unusual = !!range && (cm < range[0] || cm > range[1]);
    return { value: String(n), unusual };
  }

  function oneOf(list, value) {
    const v = str(value);
    return v === "" ? "" : list.includes(v) ? v : null;
  }

  /*
   * input: plain object of strings as submitted (workInterests may be an
   * array). `files` is { headshot: bool, fullFront: bool, fullSide: bool }.
   * Returns { errors, clean, warnings, flags }.
   */
  function validateApplication(input, opts) {
    const o = opts || {};
    const errors = {};
    const warnings = [];
    const flags = [];
    const clean = {};

    function text(name, required) {
      const v = str(input[name]);
      if (required && !v) errors[name] = "required";
      else if (v.length > (MAX_LEN[name] || 600)) errors[name] = "too_long";
      clean[name] = v;
      return v;
    }

    text("professionalName", true);
    text("legalName", true);

    const email = str(input.email).toLowerCase();
    if (!email) errors.email = "required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > MAX_LEN.email) errors.email = "invalid_email";
    clean.email = email;

    const phone = checkPhone(input.telephone);
    if (!phone.ok) errors.telephone = phone.code; else clean.telephone = phone.value;

    const category = str(input.category).toLowerCase();
    if (!category) errors.category = "required";
    else if (!CATEGORIES.includes(category)) errors.category = "invalid_choice";
    clean.category = CATEGORIES.includes(category) ? category : "";

    clean.uaeCity = str(input.uaeCity);
    if (!clean.uaeCity) errors.uaeCity = "required";
    else if (o.canonicalCity) {
      const city = o.canonicalCity(clean.uaeCity);
      if (!city) errors.uaeCity = "invalid_choice"; else clean.uaeCity = city;
    }

    const by = checkBirthYear(input.birthYear, o.now);
    if (!by.ok) errors.birthYear = by.code;
    else {
      clean.birthYear = by.year == null ? "" : String(by.year);
      if (by.underage) flags.push("birth_year_under_18");
    }

    // Enumerated choices. An unknown value is an error, a blank is fine.
    ["experience", "existingRepresentation", "availability", "travelPreference", "shoeSystem", "clothingSystem", "trouserSystem"].forEach(function (name) {
      const v = oneOf(ENUMS[name], input[name]);
      if (v === null) errors[name] = "invalid_choice"; else clean[name] = v;
    });
    const unit = str(input.measurementUnit) || "cm";
    if (!ENUMS.measurementUnit.includes(unit)) errors.measurementUnit = "invalid_choice";
    clean.measurementUnit = ENUMS.measurementUnit.includes(unit) ? unit : "cm";

    // Representation details only mean something when the applicant is represented.
    if (clean.existingRepresentation === "yes") {
      text("agencyName", false);
      text("representationRestrictions", false);
    } else {
      clean.agencyName = "";
      clean.representationRestrictions = "";
    }

    // Measurements: height always, the rest by category, all in the chosen unit.
    const h = checkMeasurement("height", input.height, clean.measurementUnit, true);
    if (h.error) errors.height = h.error; else { clean.height = h.value; if (h.unusual) warnings.push("height"); }
    const applicable = MEASURE_FIELDS[clean.category] || [];
    ALL_MEASURE_FIELDS.filter(function (n) { return n !== "height"; }).forEach(function (name) {
      if (!applicable.includes(name)) { clean[name] = ""; return; }
      const r = checkMeasurement(name, input[name], clean.measurementUnit, false);
      if (r.error) errors[name] = r.error; else { clean[name] = r.value; if (r.unusual) warnings.push(name); }
    });

    text("hair", false);
    text("eyes", false);

    // A size without a system is ambiguous ("38" means different things), and
    // a system without a size is just a leftover selection.
    [["shoeSize", "shoeSystem"], ["clothingSize", "clothingSystem"], ["trouserSize", "trouserSystem"]].forEach(function (pair) {
      const size = text(pair[0], false);
      if (size && !clean[pair[1]]) errors[pair[1]] = "system_required";
      if (!size) clean[pair[1]] = "";
    });

    text("languages", false);
    text("skills", false);
    text("introduction", false);
    text("bookingNotes", false);

    const interests = [].concat(input.workInterests || []).map(str).filter(Boolean);
    if (interests.some(function (v) { return !WORK_INTERESTS.includes(v); })) errors.workInterests = "invalid_choice";
    clean.workInterests = WORK_INTERESTS.filter(function (v) { return interests.includes(v); });

    const ig = normalizeInstagram(input.instagram);
    if (!ig.ok) errors.instagram = "invalid_instagram"; else { clean.instagram = ig.handle; clean.instagramUrl = ig.url; }
    const site = normalizeWebUrl(input.portfolioWebsite);
    if (!site.ok) errors.portfolioWebsite = "invalid_url"; else clean.portfolioWebsite = site.url;
    const reel = normalizeWebUrl(input.showreelUrl);
    if (!reel.ok) errors.showreelUrl = "invalid_url"; else clean.showreelUrl = reel.url;

    ["ageConfirm", "residencyConfirm", "accuracyConfirm", "privacyConsent", "termsConsent"].forEach(function (name) {
      if (!input[name]) errors[name] = "required"; else clean[name] = true;
    });

    const files = o.files || {};
    ["headshot", "fullFront", "fullSide"].forEach(function (name) {
      if (!files[name]) errors[name] = "required";
    });

    // Sizes the reviewer will need before a profile is booking-ready.
    clean.missingSizes = [];
    if (!clean.shoeSize) clean.missingSizes.push("shoe");
    if (!clean.clothingSize) clean.missingSizes.push("clothing");
    if (!clean.trouserSize) clean.missingSizes.push("trouser");

    return { errors: errors, clean: clean, warnings: warnings, flags: flags };
  }

  return {
    TERMS_VERSION, CATEGORIES, MEASURE_FIELDS, ALL_MEASURE_FIELDS, PLAUSIBLE_CM, ENUMS, WORK_INTERESTS, MAX_LEN,
    parseNumber, normalizeInstagram, normalizeWebUrl, checkBirthYear, checkPhone, checkMeasurement, validateApplication,
  };
});
