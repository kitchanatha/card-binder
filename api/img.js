// GET /api/img?u=<official ONE PIECE card image URL>
// The official site sends Cross-Origin-Resource-Policy: same-site, which stops browsers showing
// its images on other sites, so they are fetched here and passed through.
const https = require('https');

const IMG_HOSTS = new Set(['www.onepiece-cardgame.com', 'en.onepiece-cardgame.com', 'asia-en.onepiece-cardgame.com']);

module.exports = (req, res) => {
  let target;
  try { target = new URL(new URL(req.url, 'http://x').searchParams.get('u')); } catch { return res.writeHead(400).end(); }
  if (target.protocol !== 'https:' || !IMG_HOSTS.has(target.hostname)) return res.writeHead(403).end();
  https.get(target, up => {
    if (up.statusCode !== 200) { up.resume(); return res.writeHead(up.statusCode || 502).end(); }
    res.writeHead(200, {
      'Content-Type': up.headers['content-type'] || 'image/png',
      // browsers and the Vercel CDN keep card images for a week
      'Cache-Control': 'public, max-age=604800, s-maxage=604800',
    });
    up.pipe(res);
  }).on('error', () => res.writeHead(502).end());
};
