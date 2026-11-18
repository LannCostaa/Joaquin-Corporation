// POST /api/orders/JC-0001  { action: 'start' | 'finish' | 'receive', ... }
//  start   : hanya karyawan, Disiapkan -> Dalam Perjalanan
//  finish  : hanya karyawan, Dalam Perjalanan -> Menunggu Konfirmasi (form pengiriman selesai)
//  receive : hanya pemesan (penerima) order itu, Menunggu Konfirmasi -> Terkirim
const { redis, session, body, fail, hook, f } = require('../_lib');

module.exports = async (req, res) => {
  try {
    res.setHeader('Cache-Control', 'no-store');
    const s = session(req);
    if (!s) return fail(res, 401, 'Belum login');
    if (req.method !== 'POST') return fail(res, 405, 'Metode tidak didukung');

    const id = String(req.query.id || '');
    const raw = await redis('HGET', 'orders', id);
    if (!raw) return fail(res, 404, 'Order tidak ditemukan');
    const o = JSON.parse(raw), b = body(req), a = b.action;
    const mention = '<@' + o.uid + '> (' + o.name + ')';

    if (a === 'start') {
      if (!s.staff) return fail(res, 403, 'Hanya karyawan J CORP yang bisa memulai pengiriman');
      if (o.st !== 0) return fail(res, 409, 'Status order tidak sesuai');
      o.st = 1; o.startedBy = s.name; o.startedAt = Date.now();
      await redis('HSET', 'orders', id, JSON.stringify(o));
      await hook('Pengiriman dimulai ' + id, 0xf2a900, [f('Pemesan', mention, true), f('Petugas', s.name, true), f('Lokasi', o.dest, true)]);
    } else if (a === 'finish') {
      if (!s.staff) return fail(res, 403, 'Hanya karyawan J CORP yang bisa menyelesaikan pengiriman');
      if (o.st !== 1) return fail(res, 409, 'Status order tidak sesuai');
      const petugas = String(b.petugas || '').trim().slice(0, 60);
      if (!petugas) return fail(res, 400, 'Nama petugas wajib diisi');
      o.st = 2;
      o.finish = { petugas, time: String(b.time || '').slice(0, 5), note: String(b.note || '').trim().slice(0, 300), by: s.name };
      o.finishedAt = Date.now();
      await redis('HSET', 'orders', id, JSON.stringify(o));
      await hook('Barang sudah diantar ' + id + ', menunggu konfirmasi penerima', 0xe67e22, [
        f('Penerima', mention, true), f('Petugas', petugas, true), f('Jam tiba', o.finish.time || '-', true),
        f('Lokasi', o.dest, true), f('Catatan', o.finish.note),
      ]);
    } else if (a === 'receive') {
      if (s.id !== o.uid) return fail(res, 403, 'Hanya penerima (pemesan) yang bisa mengonfirmasi');
      if (o.st !== 2) return fail(res, 409, 'Barang belum ditandai selesai diantar oleh karyawan');
      o.st = 3; o.receivedAt = Date.now(); o.receiveNote = String(b.note || '').trim().slice(0, 300);
      await redis('HSET', 'orders', id, JSON.stringify(o));
      await hook('Terkirim ' + id, 0x1b7f4b, [f('Diterima oleh', mention, true), f('Catatan', o.receiveNote)]);
    } else {
      return fail(res, 400, 'Aksi tidak dikenal');
    }
    res.json({ order: o });
  } catch (e) {
    fail(res, 500, e.message);
  }
};
