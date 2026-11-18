// Fungsi bantu bersama untuk semua endpoint J CORP
const crypto = require('crypto');

const RURL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const RTOK = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

// Kirim satu perintah ke database Upstash Redis lewat REST
async function redis(...cmd) {
  const r = await fetch(RURL, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + RTOK, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmd),
  });
  const j = await r.json();
  if (j.error) throw new Error(j.error);
  return j.result;
}

// Daftar barang: id -> [nama, kategori, harga, satuan]. Harga dihitung di server, bukan di browser.
const CATS = { bengkel: 'Restock Bengkel', resto: 'Restock Restaurant', badside: 'Restock Badside' };
const P = {
  b1: ['Material', 'bengkel', 400, 'item'], b2: ['Besi', 'bengkel', 400, 'item'],
  b3: ['Tembaga', 'bengkel', 400, 'item'], b4: ['Plastik', 'bengkel', 400, 'item'],
  ayam: ['Ayam Kemas', 'resto', 450, 'ekor'], r2: ['Tomat', 'resto', 380, 'pcs'],
  r3: ['Gula', 'resto', 380, 'pcs'], r4: ['Micin', 'resto', 380, 'pcs'],
  r5: ['Air', 'resto', 300, 'pcs'], r6: ['Minyak Sawit', 'resto', 600, 'pcs'],
  s1: ['Material', 'badside', 450, 'item'], s2: ['Besi', 'badside', 450, 'item'],
  s3: ['Tembaga', 'badside', 450, 'item'], s4: ['Plastik', 'badside', 450, 'item'],
  s5: ['Kulit', 'badside', 500, 'item'],
};
const FEE = 0.2, BULK_MIN = 5000, BULK_PRICE = 445;
const unitPrice = (id, q) => (id === 'ayam' && q > BULK_MIN ? BULK_PRICE : P[id][2]);
const money = n => '$' + Math.round(n).toLocaleString('en-US');

// Sesi login: cookie yang ditandatangani dengan SESSION_SECRET
const SECRET = process.env.SESSION_SECRET || '';
const hmac = s => crypto.createHmac('sha256', SECRET).update(s).digest('base64url');
function sign(payload) {
  const b = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return b + '.' + hmac(b);
}
function verify(token) {
  if (!token || !SECRET) return null;
  const [b, sig] = token.split('.');
  if (!b || !sig) return null;
  const a = Buffer.from(sig), e = Buffer.from(hmac(b));
  if (a.length !== e.length || !crypto.timingSafeEqual(a, e)) return null;
  try {
    const p = JSON.parse(Buffer.from(b, 'base64url').toString());
    return p.exp > Date.now() ? p : null;
  } catch { return null; }
}
function readCookies(req) {
  const o = {};
  (req.headers.cookie || '').split(';').forEach(c => {
    const i = c.indexOf('=');
    if (i > 0) o[c.slice(0, i).trim()] = decodeURIComponent(c.slice(i + 1).trim());
  });
  return o;
}
// Mengembalikan {id, name, avatar, staff} atau null kalau belum login
function session(req) {
  const p = verify(readCookies(req).jc_session);
  if (!p) return null;
  const staff = (process.env.STAFF_IDS || '').split(',').map(s => s.trim()).filter(Boolean);
  return { id: p.id, name: p.name, avatar: p.avatar, staff: staff.includes(p.id) };
}
function body(req) {
  if (typeof req.body === 'string') { try { return JSON.parse(req.body || '{}'); } catch { return {}; } }
  return req.body || {};
}
const fail = (res, code, msg) => res.status(code).json({ error: msg });

// Kirim embed ke channel Discord. URL webhook hanya ada di server (env), tidak terlihat di browser.
const f = (name, value, inline) => ({ name, value: String(value || '-').slice(0, 1000), inline: !!inline });
async function hook(title, color, fields) {
  const u = process.env.DISCORD_WEBHOOK_URL;
  if (!u) return;
  try {
    await fetch(u, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'J CORP Order', embeds: [{ title, color, timestamp: new Date().toISOString(), fields }] }),
    });
  } catch {}
}

module.exports = { redis, CATS, P, FEE, unitPrice, money, sign, readCookies, session, body, fail, hook, f };
