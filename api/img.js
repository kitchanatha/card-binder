// GET /api/img?u=<official ONE PIECE card image URL>[&w=240|640]
// The official site sends Cross-Origin-Resource-Policy: same-site, which stops browsers showing
// its images on other sites, so they are fetched here and passed through.
// The originals are ~1.7 MB print-size PNGs; with w= they are shrunk to a WebP of that width
// (240px ≈ 20 KB for the grid, 640px for the detail view) and cached by the CDN for a year.
// Each official URL carries a version (?261007), so a cached copy never goes stale.
const https = require('https');

const IMG_HOSTS = new Set(['www.onepiece-cardgame.com', 'en.onepiece-cardgame.com', 'asia-en.onepiece-cardgame.com']);
const WIDTHS = new Set([240, 640]);
const CACHE = 'public, max-age=31536000, s-maxage=31536000, immutable';
let sharp = null;
try { sharp = require('sharp'); } catch {}   // without it, originals are passed through

function download(url) {
  return new Promise((resolve, reject) => {
    https.get(url, up => {
      if (up.statusCode !== 200) { up.resume(); return reject(Object.assign(new Error('upstream'), { status: up.statusCode })); }
      const chunks = []; up.on('data', c => chunks.push(c));
      up.on('end', () => resolve({ body: Buffer.concat(chunks), type: up.headers['content-type'] || 'image/png' }));
    }).on('error', reject);
  });
}

module.exports = async (req, res) => {
  const q = new URL(req.url, 'http://x').searchParams;
  let target;
  try { target = new URL(q.get('u')); } catch { return res.writeHead(400).end(); }
  if (target.protocol !== 'https:' || !IMG_HOSTS.has(target.hostname)) return res.writeHead(403).end();
  const w = Number(q.get('w')), trim = q.get('trim') === '1';
  try {
    const { body, type } = await download(target);
    if (sharp && WIDTHS.has(w)) {
      // trim=1 crops the plain border around product photos (official pack images are square with lots of margin)
      let img = sharp(body);
      if (trim) img = sharp(await img.trim({ threshold: 12 }).toBuffer());
      const out = await img.resize({ width: w, withoutEnlargement: true }).webp({ quality: 75, effort: 4 }).toBuffer();
      return res.writeHead(200, { 'Content-Type': 'image/webp', 'Cache-Control': CACHE }).end(out);
    }
    res.writeHead(200, { 'Content-Type': type, 'Cache-Control': CACHE }).end(body);
  } catch (e) {
    res.writeHead(e.status && e.status !== 200 ? e.status : 502).end();
  }
};
