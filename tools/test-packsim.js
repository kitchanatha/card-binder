// Open 10,000 simulated packs from real sets and compare hit rates with the targets.
//   node tools/test-packsim.js
const { pokemonPack, onePiecePack } = require('../public/packsim-core.js');
const TIER = { Common: 0, Uncommon: 0, Rare: 1, 'Double rare': 2, 'ACE SPEC Rare': 2, 'Illustration rare': 3, 'Ultra Rare': 3,
  'Special illustration rare': 4, 'Hyper rare': 4, 'Mega Hyper Rare': 4 };
const tierOf = c => TIER[c.rarity] ?? 1;
const getJSON = async u => { const r = await fetch(u); if (!r.ok) throw new Error(r.status + ' ' + u); return r.json(); };
const N = 10000;
let failures = 0;
const check = (label, got, want, tol) => {
  const ok = Math.abs(got - want) <= tol;
  if (!ok) failures++;
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${label.padEnd(34)} ${got.toFixed(4)} (target ${want.toFixed(4)})`);
};

async function pokemonCards(setId) {
  const base = 'https://api.tcgdex.net/v2/en';
  const s = await getJSON(`${base}/sets/${setId}`), names = await getJSON(`${base}/rarities`), rar = {};
  await Promise.all(names.map(r => getJSON(`${base}/cards?set.id=eq:${setId}&rarity=eq:${encodeURIComponent(r)}`)
    .then(l => l.forEach(c => { rar[c.id] = r; })).catch(() => {})));
  return { cards: s.cards.map(c => ({ id: c.id, name: c.name, rarity: rar[c.id] })), series: s.serie.id };
}

(async () => {
  console.log('Pokémon me01 (Mega Evolution), English');
  const { cards, series } = await pokemonCards('me01');
  const count = {}; let sizes = new Set(), reverse = 0;
  for (let i = 0; i < N; i++) {
    const p = pokemonPack(cards, { lang: 'en', series, tierOf });
    sizes.add(p.cards.length);
    for (const { card, reverse: r } of p.cards) { const k = r ? "reverse" : card.rarity; count[k] = (count[k] || 0) + 1; if (r) reverse++; }
    const last = p.cards[p.cards.length - 1].card;
    if (p.cards.slice(0, -1).some(x => tierOf(x.card) > tierOf(last))) { failures++; console.log('  FAIL best card not last'); break; }
  }
  console.log('  pack sizes:', [...sizes].join(','), '| reverse holos per pack:', (reverse / N).toFixed(2));
  const per = r => (count[r] || 0) / N;
  check('Commons per pack (not reverse)', per('Common'), 4, 0.01);
  check('Double rare per pack', per('Double rare'), 0.2, 0.02);
  check('Ultra Rare per pack', per('Ultra Rare'), 1 / 14, 0.012);
  check('Illustration rare per pack', per('Illustration rare'), 1 / 11, 0.012);
  check('Special illustration rare per pack', per('Special illustration rare'), 1 / 90, 0.004);

  console.log('Pokémon base1 (Base Set): estimated pack');
  const b = await pokemonCards('base1');
  const bp = pokemonPack(b.cards, { lang: 'en', series: b.series, tierOf });
  console.log('  size', bp.cards.length, 'estimated', bp.estimated, 'last:', bp.cards.at(-1).card.name, bp.cards.at(-1).card.rarity);

  console.log('Pokémon promo set (svp): should not be openable');
  const promo = await pokemonCards('svp');
  console.log('  ', pokemonPack(promo.cards, { lang: 'en', series: promo.series, tierOf }) === null ? 'ok   not openable' : (failures++, 'FAIL openable'));

  console.log('ONE PIECE OP-01, English (12-card packs, per box of 24)');
  const raw = await getJSON('https://raw.githubusercontent.com/buhbbl/punk-records/main/english/data/569101.json');
  const op = raw.map(c => ({ id: c.id, name: c.name, rarity: c.rarity, alt: /_p\d+$/.test(c.id) }));
  const oc = {}; sizes = new Set();
  for (let i = 0; i < N; i++) {
    const p = onePiecePack(op, { lang: 'en', code: 'OP-01' }); sizes.add(p.cards.length);
    for (const { card } of p.cards) { const k = card.alt ? 'ALT' : card.rarity; oc[k] = (oc[k] || 0) + 1; }
  }
  console.log('  pack sizes:', [...sizes].join(','));
  const box = k => (oc[k] || 0) / N * 24;
  check('SR per box', box('SuperRare'), 4, 0.25);
  check('Alt arts per box', box('ALT'), 1.5, 0.15);
  check('SEC per box', box('SecretRare'), 1 / 3, 0.07);
  console.log('  starter deck ST-01:', onePiecePack(op, { lang: 'en', code: 'ST-01' }) === null ? 'ok   not openable' : (failures++, 'FAIL openable'));

  console.log(failures ? `\n${failures} check(s) failed` : '\nAll checks passed');
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
