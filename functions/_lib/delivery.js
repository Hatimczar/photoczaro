// Shared helpers for the private Image/Video Delivery feature.
// Nothing under /_lib is routable. Deliveries are private by design:
//  - R2 objects are never public; every byte goes through a Function that checks a session.
//  - A delivery id is 128 bits of randomness; opening it also needs an emailed one-time code.
import { getCookie, verifyToken, signToken } from './auth.js';

const enc = new TextEncoder();

export const ID_RE = /^[A-Za-z0-9_-]{22}$/;
export const FID_RE = /^[a-f0-9]{12}$/;
export const SESSION_SECONDS = 12 * 60 * 60;
export const CODE_TTL_MS = 10 * 60 * 1000;
export const MAX_CODE_ATTEMPTS = 5;

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

export function sixDigitCode() {
  // Rejection sampling so every code 000000-999999 is equally likely.
  const limit = Math.floor(0xffffffff / 1000000) * 1000000;
  let n;
  do { n = crypto.getRandomValues(new Uint32Array(1))[0]; } while (n >= limit);
  return String(n % 1000000).padStart(6, '0');
}

export async function hmacHex(secret, message) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return Array.from(new Uint8Array(sig)).map((x) => x.toString(16).padStart(2, '0')).join('');
}

export function safeEqual(a, b) {
  a = String(a); b = String(b);
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

export function normEmail(e) { return String(e || '').trim().toLowerCase(); }
export function validEmail(e) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e) && e.length <= 254; }

export function cleanName(name, fallback = 'file') {
  const n = String(name || '').replace(/[\u0000-\u001f\u007f"\\/<>:*?|]+/g, '_').replace(/\s+/g, ' ').trim().slice(0, 120);
  return n || fallback;
}

export function clientIp(request) { return request.headers.get('CF-Connecting-IP') || 'unknown'; }

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

export function sessionCookieName(id) { return `pcz_dlv_${id}`; }

export async function issueSession(id, env) {
  const token = await signToken({ dlv: id, exp: Date.now() + SESSION_SECONDS * 1000 }, env.SESSION_SECRET);
  return `${sessionCookieName(id)}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_SECONDS}`;
}

export async function hasSession(request, env, id) {
  const token = getCookie(request, sessionCookieName(id));
  const payload = token ? await verifyToken(token, env.SESSION_SECRET) : null;
  return !!(payload && payload.dlv === id);
}

// Access modes: 'link' = anyone holding the private link may view/download (the 128-bit link is the secret);
// 'code' = the link plus an emailed one-time code is required.
export async function canAccess(request, env, d) {
  if (d.access === 'link') return true;
  return hasSession(request, env, d.id);
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

// Counts events in an hour bucket; returns true when the limit is exceeded.
export async function rateLimited(env, key, limit) {
  const k = `rl:${key}:${Math.floor(Date.now() / 3600000)}`;
  const n = parseInt((await env.DELIVERY_KV.get(k)) || '0', 10);
  if (n >= limit) return true;
  await env.DELIVERY_KV.put(k, String(n + 1), { expirationTtl: 7200 });
  return false;
}

// Creates and stores a fresh one-time code for a delivery; returns the plain code.
export async function createCode(env, id) {
  const code = sixDigitCode();
  const hash = await hmacHex(env.SESSION_SECRET, `${id}:${code}`);
  await env.DELIVERY_KV.put(`c:${id}`, JSON.stringify({ hash, exp: Date.now() + CODE_TTL_MS, attempts: 0 }), { expirationTtl: 1800 });
  return code;
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
