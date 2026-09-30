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
const JPEG_SCAN_BYTES = 512 * 1024; // enough to reach the SOF marker in the vast majority of real photos

const SIGNATURES = [
  { type: "image/jpeg", bytes: [0xff, 0xd8, 0xff] },
  { type: "image/png", bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  // WEBP: "RIFF"....'WEBP'; the middle 4 bytes are a file-size field, checked separately.
  { type: "image/webp", bytes: [0x52, 0x49, 0x46, 0x46], webp: true },
];

// HEIC/HEIF: iPhone cameras save photos in this format by default, so a
// model applying from her phone is the normal case, not the exception.
// It's an ISOBMFF container (same family as MP4): bytes 4-7 are "ftyp",
// followed by a 4-byte brand identifying the specific flavor.
const HEIF_BRANDS = ["heic", "heix", "hevc", "hevx", "heim", "heis", "hevm", "hevs", "mif1", "msf1"];

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
  if (bytes.length >= 12 && String.fromCharCode(...bytes.slice(4, 8)) === "ftyp") {
    const brand = String.fromCharCode(...bytes.slice(8, 12)).toLowerCase();
    if (HEIF_BRANDS.includes(brand)) return "image/heic";
  }
  return null;
}

// PNG stores width/height at a fixed offset in its IHDR chunk, so this is exact.
function readPngDimensions(bytes) {
  if (bytes.length < 24) return null;
  const width = (bytes[16] << 24) | (bytes[17] << 16) | (bytes[18] << 8) | bytes[19];
  const height = (bytes[20] << 24) | (bytes[21] << 16) | (bytes[22] << 8) | bytes[23];
  return { width, height };
}

// Walks JPEG marker segments looking for a Start-Of-Frame marker (0xC0-0xCF,
// excluding the DHT/JPG-ext/DAC markers which reuse that range), which
// stores height/width right after its 2-byte length field. Returns null if
// no SOF is found within the scanned window rather than throwing; callers
// treat that as "couldn't determine dimensions" and don't block the upload
// on it, since this is a sanity cap, not a hard requirement.
function readJpegDimensions(bytes) {
  let offset = 2; // skip the SOI marker (0xFFD8)
  while (offset + 3 < bytes.length) {
    if (bytes[offset] !== 0xff) { offset++; continue; }
    const marker = bytes[offset + 1];
    if (marker === 0xff) { offset++; continue; } // fill byte
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset += 2; // markers with no length/data field
      continue;
    }
    if (marker === 0xd9) break; // EOI
    const segLength = (bytes[offset + 2] << 8) | bytes[offset + 3];
    const isSOF = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isSOF) {
      if (offset + 8 >= bytes.length) return null;
      const height = (bytes[offset + 5] << 8) | bytes[offset + 6];
      const width = (bytes[offset + 7] << 8) | bytes[offset + 8];
      return { width, height };
    }
    if (marker === 0xda) break; // Start Of Scan: no SOF found before actual image data
    offset += 2 + segLength;
  }
  return null;
}

function exceedsMaxDimension(dims) {
  return !!dims && (dims.width > MAX_DIMENSION || dims.height > MAX_DIMENSION);
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
    return { ok: false, error: "Unsupported file. Only JPEG, PNG, WEBP or HEIC images are accepted." };
  }

  let dims = null;
  if (sniffedType === "image/png") {
    dims = readPngDimensions(head);
  } else if (sniffedType === "image/jpeg") {
    const scanBuf = new Uint8Array(await file.slice(0, Math.min(file.size, JPEG_SCAN_BYTES)).arrayBuffer());
    dims = readJpegDimensions(scanBuf);
  }
  if (exceedsMaxDimension(dims)) {
    return { ok: false, error: `Image dimensions exceed the ${MAX_DIMENSION}px limit.` };
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
    return { ok: false, error: "Unsupported file. Only JPEG, PNG, WEBP, HEIC or PDF are accepted." };
  }
  return { ok: true, contentType: sniffedType };
}
