// Siapa yang sedang login, dan apakah dia karyawan
const { session } = require('./_lib');
module.exports = (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.json({ user: session(req) });
};
