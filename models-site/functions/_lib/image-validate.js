/*
 * Server-side image upload validation. The browser-supplied File.type is
 * only a hint from the client and is trivially spoofed, so this sniffs the
 * actual file signature instead of trusting it, and only ever stores the
 * sniffed content type. Rejects anything that isn't a plain raster image,
 * which blocks the classic "upload an .svg or .html renamed to .jpg" path
 * used to get active content served back from a media proxy.
 *
 * This does NOT strip embedded metadata (EXIF/ICC/etc.) or re-encode the
 * pixel data, since that needs an actual image-processing library/service
 * that isn't wired into this project yet (e.g. Cloudflare Images, or a
 * WASM decoder). Flagged as a known follow-up, not silently skipped.
 */

const MAX_BYTES = 8 * 1024 * 1024;
const MAX_DIMENSION = 6000; // sanity cap, not a design constraint

const SIGNATURES = [
  { type: "image/jpeg", bytes: [0xff, 0xd8, 0xff] },
  { type: "image/png", bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  // WEBP: "RIFF"....'WEBP'; the middle 4 bytes are a file-size field, checked separately.
  { type: "image/webp", bytes: [0x52, 0x49, 0x46, 0x46], webp: true },
];

function matchSignature(bytes) {
  for (const sig of SIGNATURES) {
    if (sig.bytes.every((b, i) => bytes[i] === b)) {
      if (sig.webp) {
        const isWebp = bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50;
        if (!isWebp) continue;
      }
      return sig.type;
    }
  }
  return null;
}

// Best-effort dimension check. PNG stores width/height at a fixed offset in
// its IHDR chunk, so this is exact for PNG. JPEG/WEBP dimension parsing is
// more involved (segment/chunk scanning); skipped for now rather than
// half-implemented, so those two formats only get the size + signature checks.
function readPngDimensions(bytes) {
  if (bytes.length < 24) return null;
  const width = (bytes[16] << 24) | (bytes[17] << 16) | (bytes[18] << 8) | bytes[19];
  const height = (bytes[20] << 24) | (bytes[21] << 16) | (bytes[22] << 8) | bytes[23];
  return { width, height };
}

export async function validateImageUpload(file) {
  if (!file || typeof file !== "object" || !("size" in file)) {
    return { ok: false, error: "No file provided." };
  }
  if (file.size === 0) return { ok: false, error: "File is empty." };
  if (file.size > MAX_BYTES) return { ok: false, error: "File exceeds the 8MB limit." };

  const head = new Uint8Array(await file.slice(0, 32).arrayBuffer());
  const sniffedType = matchSignature(head);
  if (!sniffedType) {
    return { ok: false, error: "Unsupported file. Only JPEG, PNG or WEBP images are accepted." };
  }

  if (sniffedType === "image/png") {
    const dims = readPngDimensions(head);
    if (dims && (dims.width > MAX_DIMENSION || dims.height > MAX_DIMENSION)) {
      return { ok: false, error: `Image dimensions exceed the ${MAX_DIMENSION}px limit.` };
    }
  }

  return { ok: true, contentType: sniffedType };
}

// Same signature-sniffing approach, but for the one upload field that's
// allowed to be either an image or a PDF (apply.html's optional portfolio
// file, accept="image/*,application/pdf").
export async function validatePortfolioUpload(file) {
  if (!file || typeof file !== "object" || !("size" in file)) {
    return { ok: false, error: "No file provided." };
  }
  if (file.size === 0) return { ok: false, error: "File is empty." };
  if (file.size > MAX_BYTES) return { ok: false, error: "File exceeds the 8MB limit." };

  const head = new Uint8Array(await file.slice(0, 32).arrayBuffer());
  const isPdf = head[0] === 0x25 && head[1] === 0x50 && head[2] === 0x44 && head[3] === 0x46; // "%PDF"
  if (isPdf) return { ok: true, contentType: "application/pdf" };

  const sniffedType = matchSignature(head);
  if (!sniffedType) {
    return { ok: false, error: "Unsupported file. Only JPEG, PNG, WEBP or PDF are accepted." };
  }
  return { ok: true, contentType: sniffedType };
}
