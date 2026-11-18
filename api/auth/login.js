// Mulai login: arahkan ke halaman izin Discord
const crypto = require('crypto');
module.exports = (req, res) => {
  const state = crypto.randomBytes(16).toString('hex');
  const redirect = 'https://' + req.headers.host + '/api/auth/callback';
  res.setHeader('Set-Cookie', 'jc_state=' + state + '; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600');
  res.redirect(302, 'https://discord.com/oauth2/authorize?' + new URLSearchParams({
    client_id: process.env.DISCORD_CLIENT_ID, response_type: 'code', scope: 'identify', state, redirect_uri: redirect,
  }));
};
