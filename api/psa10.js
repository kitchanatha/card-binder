// GET /api/psa10?id=<tcgdex card id>&name=&number=&set=&lang=en|ja
// PSA 10 sold prices from Pokémon Price Tracker. The API key stays server-side:
// the PPT_API_KEY environment variable (Vercel), or secrets/pokemonpricetracker.key (local).
// Response format (from /api/openapi): card.ebay.salesByGrade.psa10 =
// { count, averagePrice, medianPrice, marketPrice7Day, lastSaleDate, smartMarketPrice: { price } }
const https = require('https'), fs = require('fs'), path = require('path');

const KEY_FILE = path.join(__dirname, '..', 'secrets', 'pokemonpricetracker.key');
const CACHE_MS = 24 * 3600 * 1000;   // free tier is 100 credits/day, so each card is looked up at most daily
const cache = new Map();             // per server instance; the CDN header below covers the rest

const readKey = () => { try { return (process.env.PPT_API_KEY || fs.readFileSync(KEY_FILE, 'utf8')).trim(); } catch { return ''; } };
const num = v => typeof v === 'number' && isFinite(v) ? v : null;
const normNo = s => String(s ?? '').split('/')[0].replace(/^0+(?=.)/, '').toLowerCase();

function getJSON(url, key) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { Authorization: `Bearer ${key}` } }, r => {
      let body = ''; r.on('data', c => body += c);
      r.on('end', () => {
        let j = null; try { j = JSON.parse(body); } catch {}
        r.statusCode === 200 && j ? resolve(j) : reject(Object.assign(new Error(`HTTP ${r.statusCode}`), { status: r.statusCode, body: body.slice(0, 300) }));
      });
    }).on('error', reject);
  });
}

module.exports = async (req, res) => {
  const send = (code, obj, cacheable) => res.writeHead(code, {
    'Content-Type': 'application/json',
    'Cache-Control': cacheable ? 'public, max-age=3600, s-maxage=86400' : 'no-store',
  }).end(JSON.stringify(obj));
  const q = new URL(req.url, 'http://x').searchParams;
  const key = readKey();
  if (!key) return send(200, { ok: false, reason: 'no-key' });
  const id = q.get('id') || '', name = q.get('name') || '', number = q.get('number') || '', set = q.get('set') || '';
  const lang = q.get('lang') === 'ja' ? 'japanese' : 'english';
  if (!name) return send(400, { ok: false, reason: 'bad-request' });
  const ck = [lang, id, set, name, number].join('|');
  const hit = cache.get(ck);
  if (hit && Date.now() - hit.at < CACHE_MS) return send(200, { ...hit.data, cached: true }, true);

  const url = new URL('https://www.pokemonpricetracker.com/api/v2/cards');
  url.searchParams.set('search', `${name} ${number}`.trim());
  if (set) url.searchParams.set('set', set);
  url.searchParams.set('language', lang);
  url.searchParams.set('includeEbay', 'true');
  url.searchParams.set('limit', '3');           // credits are charged per card returned (2 each with eBay data)
  try {
    const j = await getJSON(url, key);
    const list = Array.isArray(j.data) ? j.data : j.data ? [j.data] : [];
    if (process.env.PSA_DEBUG) console.log(JSON.stringify(list.map(c => ({ id: c.externalCatalogId, no: c.cardNumber, name: c.name, psa10: c.ebay?.salesByGrade?.psa10 })), null, 1));
    // externalCatalogId is the TCGdex card id — an exact match when present; otherwise match the card number
    const card = list.find(c => id && c.externalCatalogId === id)
      || list.find(c => number && normNo(c.cardNumber) === normNo(number))
      || (list.length === 1 ? list[0] : null);
    const p = card?.ebay?.salesByGrade?.psa10;
    const data = !p ? { ok: false, reason: card ? 'no-psa10-sales' : 'not-found' } : {
      ok: true, currency: 'USD',
      market: num(p.smartMarketPrice?.price) ?? num(p.marketPrice7Day),
      trend: ['up', 'down', 'stable'].includes(p.marketTrend) ? p.marketTrend : null,
      avg: num(p.averagePrice), median: num(p.medianPrice), sales: num(p.count),
      lastSale: p.lastSaleDate || null, updated: card.ebay.updatedAt || null,
    };
    cache.set(ck, { at: Date.now(), data });
    send(200, data, true);
  } catch (e) {
    console.error('psa10 lookup failed:', e.message, e.body || '');
    send(200, { ok: false, reason: e.status === 401 || e.status === 403 ? 'bad-key' : e.status === 429 ? 'limit' : 'error' });
  }
};
