// Build public/pokemon-packs.json: a booster pack photo for each Pokémon set (EN + JP), taken from
// TCGCSV's free copy of the TCGplayer catalog.   npm run update-pokemon-packs
// TCGCSV has no browser (CORS) access, so this runs offline and the app reads the static result.
// Matching: English sets by their official abbreviation (TCGdex "MEG" = TCGplayer group "MEG"),
// Japanese sets by code ("M4" = group "M4: Ninja Spinner"), then by release date as a fallback.
const fs = require('fs'), path = require('path');
const OUT = path.join(__dirname, '..', 'public', 'pokemon-packs.json');
const TCGDEX = 'https://api.tcgdex.net/v2', TCGCSV = 'https://tcgcsv.com/tcgplayer';

async function getJSON(url, tries = 3) {
  for (let i = 0; ; i++) {
    try { const r = await fetch(url, { headers: { 'User-Agent': 'card-binder-pack-builder/1.0 (+https://github.com/kitchanatha/card-binder)' } }); if (!r.ok) throw new Error(`${r.status} ${url}`); return await r.json(); }
    catch (e) { if (i >= tries - 1) throw e; await new Promise(r => setTimeout(r, 800 * (i + 1))); }
  }
}
async function mapLimit(items, n, fn) {
  const out = []; let i = 0;
  await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) { const k = i++; out[k] = await fn(items[k]); } }));
  return out;
}
const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const STOP = new Set(['the', 'and', 'set', 'pokemon', 'booster', 'pack', 'base']);
const day = s => String(s || '').slice(0, 10);

// Prefer the plain booster pack; skip sleeved/art/bundle/case/blister variants. Fall back to a booster box.
function pickPack(products) {
  const sealed = products.filter(p => !(p.extendedData || []).some(e => e.name === 'Number'));
  const bad = /sleeved|art bundle|set of|bundle|case|display|blister|code card|jumbo|lot|\bx\d/i;
  const by = re => sealed.filter(p => re.test(p.name) && !bad.test(p.name)).sort((a, b) => a.name.length - b.name.length)[0];
  const pack = by(/booster pack/i) || by(/\bpack\b/i), box = by(/booster box/i);
  const img = p => p && p.imageUrl ? p.imageUrl.replace(/_200w\.jpg$/, '_200w.jpg') : null;
  return pack || box ? { pack: img(pack), box: img(box), name: (pack || box).name, productId: (pack || box).productId } : null;
}

async function build(lang, categoryId) {
  const sets = await getJSON(`${TCGDEX}/${lang}/sets`);
  const details = await mapLimit(sets, 8, s => getJSON(`${TCGDEX}/${lang}/sets/${encodeURIComponent(s.id)}`).catch(() => null));
  const groups = (await getJSON(`${TCGCSV}/${categoryId}/groups`)).results;
  const result = {}; let matched = 0, withImg = 0;
  const words = s => new Set(String(s).toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(w => w.length > 2 && !STOP.has(w)));
  const sharesWord = (a, b) => { const B = words(b); return [...words(a)].some(w => B.has(w)); };
  await mapLimit(details.filter(Boolean), 6, async s => {
    if (/promo/i.test(s.name)) return;   // promo sets aren't sold in booster packs
    const abbr = norm(s.abbreviation?.official), code = norm(s.id);
    const group =
      (lang === 'en' && abbr && groups.find(g => norm(g.abbreviation) === abbr)) ||
      groups.find(g => norm(g.name.split(':')[0]) === code) ||
      groups.find(g => norm(g.abbreviation) === code) ||
      // same release date alone isn't enough (several sets can share one), so the names must overlap too
      (lang === 'en' && groups.find(g => day(g.publishedOn) === day(s.releaseDate) && sharesWord(s.name, g.name)));
    if (!group || /promo/i.test(group.name)) return;
    matched++;
    const pick = pickPack((await getJSON(`${TCGCSV}/${categoryId}/${group.groupId}/products`)).results);
    if (pick) { result[s.id] = { ...pick, group: group.name }; withImg++; }
  });
  console.log(`${lang}: ${sets.length} sets, ${matched} matched to TCGplayer, ${withImg} with a pack image`);
  return result;
}

(async () => {
  const out = { en: await build('en', 3), ja: await build('ja', 85) };
  fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
  console.log('wrote', path.relative(process.cwd(), OUT));
})().catch(e => { console.error(e.message); process.exit(1); });
