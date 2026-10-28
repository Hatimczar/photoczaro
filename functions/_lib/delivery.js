// Shared helpers for the private Image/Video Delivery feature.
// Nothing under /_lib is routable. Deliveries are private by design:
//  - R2 objects are never public; every byte goes through a Function that checks a session.
//  - A delivery id is 128 bits of randomness: the private link itself is the secret, so it is never
//    listed, indexed or cached. Only the admin (password session) can create or change deliveries.
import { getCookie, verifyToken } from './auth.js';

export const ID_RE = /^[A-Za-z0-9_-]{22}$/;
export const FID_RE = /^[a-f0-9]{12}$/;

export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/webm'];
// Camera RAW originals. Browsers cannot display these, so the admin extracts the embedded JPEG
// for the watermarked preview and the RAW itself stays locked until the delivery is released.
export const RAW_TYPES = ['image/x-canon-cr2', 'image/x-nikon-nef'];

export function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow', ...extra },
  });
}

export function randomId(bytes = 16) {
  const b = crypto.getRandomValues(new Uint8Array(bytes));
  return btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
export function randomHex(bytes = 6) {
  return Array.from(crypto.getRandomValues(new Uint8Array(bytes))).map((x) => x.toString(16).padStart(2, '0')).join('');
}

export function normEmail(e) { return String(e || '').trim().toLowerCase(); }
export function validEmail(e) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e) && e.length <= 254; }

export function cleanName(name, fallback = 'file') {
  const n = String(name || '').replace(/[\u0000-\u001f\u007f"\\/<>:*?|]+/g, '_').replace(/\s+/g, ' ').trim().slice(0, 120);
  return n || fallback;
}

export function sameOrigin(request) {
  const origin = request.headers.get('Origin');
  if (!origin) return false;
  try { return new URL(origin).host === new URL(request.url).host; } catch { return false; }
}

export async function requireAdmin(request, env) {
  const token = getCookie(request, 'pcz_admin_session');
  const payload = token ? await verifyToken(token, env.SESSION_SECRET) : null;
  return !!(payload && payload.admin);
}

export async function loadDelivery(env, id) {
  if (!ID_RE.test(id)) return null;
  const raw = await env.DELIVERY_KV.get(`d:${id}`);
  return raw ? JSON.parse(raw) : null;
}
export async function saveDelivery(env, d) { await env.DELIVERY_KV.put(`d:${d.id}`, JSON.stringify(d)); }

export function isExpired(d) { return !!(d.expiresAt && Date.now() > d.expiresAt); }

export async function logEvent(env, id, type, extra = {}) {
  const ts = Date.now();
  await env.DELIVERY_KV.put(`l:${id}:${String(ts).padStart(14, '0')}:${randomHex(3)}`, JSON.stringify({ ts, type, ...extra }), { expirationTtl: 60 * 60 * 24 * 120 });
}

export function publicFile(f, released) {
  return { id: f.id, name: f.name, type: f.type, raw: !!f.raw, size: f.size, width: f.width || null, height: f.height || null, hasPreview: !!f.hasPreview, hasPoster: !!f.hasPoster, downloadable: !!released };
}

// Parses a single "bytes=a-b" Range header. Returns {offset,length} or null.
export function parseRange(header, size) {
  const m = /^bytes=(\d*)-(\d*)$/.exec(header || '');
  if (!m || (m[1] === '' && m[2] === '')) return null;
  let start, end;
  if (m[1] === '') { const n = parseInt(m[2], 10); start = Math.max(0, size - n); end = size - 1; }
  else { start = parseInt(m[1], 10); end = m[2] === '' ? size - 1 : Math.min(parseInt(m[2], 10), size - 1); }
  if (start > end || start >= size) return { invalid: true };
  return { offset: start, length: end - start + 1 };
}

// ---------- ZIP (store method, no compression) ----------
// Sizes and CRC-32 of every original are known up front (the admin's browser computes the CRC at upload),
// so the archive can be streamed straight out of R2 with an exact Content-Length and no CPU-heavy hashing.
const u16 = (n) => [n & 255, (n >>> 8) & 255];
const u32 = (n) => [n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255];

function dosDateTime(ts) {
  const d = new Date(ts);
  const time = (d.getUTCHours() << 11) | (d.getUTCMinutes() << 5) | (d.getUTCSeconds() >> 1);
  const date = ((d.getUTCFullYear() - 1980) << 9) | ((d.getUTCMonth() + 1) << 5) | d.getUTCDate();
  return { time, date };
}

function uniqueNames(files) {
  const seen = new Map();
  return files.map((f) => {
    let name = cleanName(f.name, 'file');
    const key = name.toLowerCase();
    const n = (seen.get(key) || 0) + 1;
    seen.set(key, n);
    if (n > 1) { const dot = name.lastIndexOf('.'); name = dot > 0 ? `${name.slice(0, dot)} (${n})${name.slice(dot)}` : `${name} (${n})`; }
    return name;
  });
}

// Returns { entries, totalSize, centralDirectory, ok, reason }. Each entry has the local header bytes ready to emit.
export function planZip(files, ts = Date.now()) {
  if (!files.length) return { ok: false, reason: 'empty' };
  if (files.length > 65000) return { ok: false, reason: 'too-many' };
  if (files.some((f) => !Number.isInteger(f.crc32) || f.crc32 < 0 || f.crc32 > 0xffffffff)) return { ok: false, reason: 'no-crc' };
  const names = uniqueNames(files);
  const { time, date } = dosDateTime(ts);
  const te = new TextEncoder();
  const entries = [];
  let offset = 0;
  const central = [];
  files.forEach((f, i) => {
    const nameBytes = te.encode(names[i]);
    const local = new Uint8Array([
      ...u32(0x04034b50), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(time), ...u16(date),
      ...u32(f.crc32), ...u32(f.size), ...u32(f.size), ...u16(nameBytes.length), ...u16(0), ...nameBytes,
    ]);
    entries.push({ file: f, local });
    central.push(new Uint8Array([
      ...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(time), ...u16(date),
      ...u32(f.crc32), ...u32(f.size), ...u32(f.size), ...u16(nameBytes.length), ...u16(0), ...u16(0),
      ...u16(0), ...u16(0), ...u32(0), ...u32(offset), ...nameBytes,
    ]));
    offset += local.length + f.size;
  });
  const cdSize = central.reduce((s, c) => s + c.length, 0);
  const eocd = new Uint8Array([...u32(0x06054b50), ...u16(0), ...u16(0), ...u16(files.length), ...u16(files.length), ...u32(cdSize), ...u32(offset), ...u16(0)]);
  const centralDirectory = new Uint8Array(cdSize + eocd.length);
  let o = 0; for (const c of central) { centralDirectory.set(c, o); o += c.length; } centralDirectory.set(eocd, o);
  const totalSize = offset + centralDirectory.length;
  if (totalSize >= 0xffffffff) return { ok: false, reason: 'too-large' };
  return { ok: true, entries, centralDirectory, totalSize };
}
