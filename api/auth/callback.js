// Discord mengembalikan pengguna ke sini membawa "code"; ditukar di server dengan client secret
const { sign, readCookies } = require('../_lib');
module.exports = async (req, res) => {
  try {
    const { code, state } = req.query;
    if (!code || !state || state !== readCookies(req).jc_state) {
      return res.status(400).send('Login gagal: state tidak cocok. Coba masuk lagi dari halaman utama.');
    }
    const tr = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.DISCORD_CLIENT_ID,
        client_secret: process.env.DISCORD_CLIENT_SECRET,
        grant_type: 'authorization_code',
        code,
        redirect_uri: 'https://j-corp.vercel.app' + req.headers.host + '/api/auth/callback',
      }),
    });
    const tok = await tr.json();
    if (!tok.access_token) return res.status(400).send('Login gagal: Discord menolak kode. Cek CLIENT_SECRET dan alamat Redirect.');
    const u = await (await fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: 'Bearer ' + tok.access_token },
    })).json();
    const token = sign({ id: u.id, name: u.username, avatar: u.avatar || null, exp: Date.now() + 7 * 864e5 });
    res.setHeader('Set-Cookie', [
      'jc_session=' + token + '; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=604800',
      'jc_state=; Path=/; Max-Age=0',
    ]);
    res.redirect(302, '/');
  } catch (e) {
    res.status(500).send('Error login: ' + e.message);
  }
};
