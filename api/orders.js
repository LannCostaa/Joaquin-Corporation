// GET  /api/orders : daftar order (karyawan melihat semua, pemesan hanya miliknya)
// POST /api/orders : buat order baru
const { redis, CATS, P, FEE, unitPrice, money, session, body, fail, hook, f } = require('./_lib');

module.exports = async (req, res) => {
  try {
    res.setHeader('Cache-Control', 'no-store');
    const s = session(req);
    if (!s) return fail(res, 401, 'Belum login');

    if (req.method === 'GET') {
      const raw = (await redis('HGETALL', 'orders')) || [];
      let list = [];
      for (let i = 1; i < raw.length; i += 2) list.push(JSON.parse(raw[i]));
      if (!s.staff) list = list.filter(o => o.uid === s.id);
      list.sort((a, b) => b.ts - a.ts);
      return res.json({ orders: list.slice(0, 300) });
    }

    if (req.method === 'POST') {
      const b = body(req);
      const grp = String(b.grp || '').trim().slice(0, 60);
      const dest = String(b.dest || '').trim().slice(0, 80);
      const date = String(b.date || '').slice(0, 10);
      if (!grp || !dest || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return fail(res, 400, 'Form belum lengkap');

      const lines = Array.isArray(b.items) ? b.items.slice(0, 30) : [];
      if (!lines.length) return fail(res, 400, 'Keranjang kosong');
      let cat = null;
      const items = [];
      for (const l of lines) {
        const p = P[l.id], q = Math.floor(Number(l.qty));
        if (!p || !(q > 0) || q > 999999) return fail(res, 400, 'Barang atau jumlah tidak valid');
        if (cat && cat !== p[1]) return fail(res, 400, 'Satu order hanya boleh satu kategori');
        cat = p[1];
        items.push({ id: l.id, n: p[0], cat, q, u: p[3], price: unitPrice(l.id, q) });
      }
      const sub = items.reduce((a, i) => a + i.price * i.q, 0);
      const fee = Math.round(sub * FEE);
      const n = await redis('INCR', 'order:seq');
      const id = 'JC-' + String(n).padStart(4, '0');
      // Nama pemesan diambil dari sesi Discord, bukan dari kiriman browser
      const o = { id, ts: Date.now(), uid: s.id, name: s.name, grp, dest, date, cat, items, sub, fee, total: sub + fee, st: 0 };
      await redis('HSET', 'orders', id, JSON.stringify(o));
      await hook('Order baru ' + id, 0x0e5c8a, [
        f('Pemesan', '<@' + s.id + '> (' + s.name + ')', true), f('Perusahaan/Kelompok', grp, true),
        f('Jenis Barang', CATS[cat]),
        f('Rincian', items.map(i => '• ' + i.n + ' × ' + i.q + ' ' + i.u + ' = ' + money(i.price * i.q)).join('\n')),
        f('Jumlah Pesanan', items.reduce((a, i) => a + i.q, 0) + ' barang', true),
        f('Lokasi Pengiriman', dest, true), f('Tanggal Pengiriman', date, true),
        f('Subtotal', money(sub), true), f('Biaya operasional 20%', money(fee), true), f('Total', money(o.total), true),
      ]);
      return res.status(201).json({ order: o });
    }
    fail(res, 405, 'Metode tidak didukung');
  } catch (e) {
    fail(res, 500, e.message);
  }
};
