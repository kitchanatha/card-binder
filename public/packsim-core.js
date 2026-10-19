// Pack opening simulator: builds one booster pack from a set's cards. Pure logic, no page access,
// so it can be tested in Node (tools/test-packsim.js) and used by the page (packsim.js).
// Slot structures follow real packs; hit rates are community estimates (see ODDS in index.html).
(function (root) {
  const rand = (rng, list) => list[Math.floor(rng() * list.length)];
  // pick from a pool, avoiding cards already in this pack when there's a choice
  function draw(rng, pool, used) {
    const fresh = pool.filter(c => !used.has(c.id));
    const c = rand(rng, fresh.length ? fresh : pool);
    used.add(c.id); return c;
  }
  // roll one slot: [[pool, chance], ...] in order, falling back to `base` when nothing hits
  function roll(rng, hits, base) {
    let u = rng();
    for (const [pool, p] of hits) { if (!pool.length || !p) continue; if (u < p) return pool; u -= p; }
    return base;
  }

  // Pokémon. English Scarlet & Violet / Mega Evolution boosters: 4 commons, 3 uncommons,
  // 2 reverse-holo slots (the 2nd can be an IR/SIR/HR/MUR), 1 rare slot (R, RR or UR).
  function pokemonPack(cards, { lang, series, tierOf, rng = Math.random }) {
    const by = r => cards.filter(c => c.rarity === r && !c.alt);
    const C = by('Common'), U = by('Uncommon'), used = new Set(), out = [];
    const take = (pool, reverse = false) => out.push({ card: draw(rng, pool, used), reverse });
    if (lang === 'en' && ['sv', 'me'].includes(series) && C.length && U.length) {
      const R = by('Rare'), base = [...C, ...U, ...R];
      for (let i = 0; i < 4; i++) take(C);
      for (let i = 0; i < 3; i++) take(U);
      const rev1 = roll(rng, [[by('ACE SPEC Rare'), 1 / 20]], base);
      take(rev1, rev1 === base);
      const rev2 = roll(rng, [[by('Mega Hyper Rare'), 1 / 1260], [by('Hyper rare'), 1 / 140],
        [by('Special illustration rare'), 1 / 90], [by('Illustration rare'), 1 / 11]], base);
      take(rev2, rev2 === base);
      const rareBase = R.length ? R : by('Double rare').length ? by('Double rare') : base;
      take(roll(rng, [[by('Ultra Rare'), 1 / 14], [by('Double rare'), 1 / 5]], rareBase));
      sortHitsLast(out, 3, tierOf);
      return { cards: out, estimated: false };
    }
    // Any other set (older eras, Japanese 5-card packs): commons/uncommons, then one rare slot
    // whose rarity tier is weighted toward the common end. Clearly marked as an estimate.
    const low = cards.filter(c => tierOf(c) === 0 && !c.alt);
    if (!low.length) return null;                              // promos, decks: not sold in packs
    const size = lang === 'ja' ? 5 : 10;
    for (let i = 0; i < size - 1; i++) take(low);
    const tiers = { 1: 0.70, 2: 0.20, 3: 0.08, 4: 0.02 };
    const present = Object.keys(tiers).filter(t => cards.some(c => tierOf(c) === +t));
    if (!present.length) { take(low); return { cards: out, estimated: true }; }
    const total = present.reduce((s, t) => s + tiers[t], 0);
    let u = rng() * total, tier = present[present.length - 1];
    for (const t of present) { if (u < tiers[t]) { tier = t; break; } u -= tiers[t]; }
    take(cards.filter(c => tierOf(c) === +tier));
    return { cards: out, estimated: true };
  }

  // ONE PIECE boosters (OP, EB, PRB). English packs: 12 cards (7 C, 3 UC, 2 rare slots);
  // Japanese packs: 6 cards (3 C, 2 UC, 1 rare slot). Rare-slot hits use per-box rates
  // (24 packs): SR ~4, leader ~3, alt art ~1.5, SEC ~1 in 3 boxes, SP/TR rarer still.
  function onePiecePack(cards, { lang, code, rng = Math.random }) {
    if (!/^(OP|EB|PRB)/.test(code || '')) return null;           // starter decks are fixed, promos aren't packs
    const by = r => cards.filter(c => c.rarity === r && !c.alt);
    const C = by('Common'), U = by('Uncommon'), R = by('Rare');
    if (!C.length || !R.length) return null;
    const shape = lang === 'en' ? { c: 7, u: 3, r: 2 } : { c: 3, u: 2, r: 1 };
    const slotsPerBox = 24 * shape.r, perSlot = perBox => perBox / slotsPerBox;
    const alts = cards.filter(c => c.alt), used = new Set(), out = [];
    const take = pool => out.push({ card: draw(rng, pool, used), reverse: false });
    for (let i = 0; i < shape.c; i++) take(C);
    for (let i = 0; i < shape.u; i++) take(U.length ? U : C);
    for (let i = 0; i < shape.r; i++) {
      take(roll(rng, [[by('TreasureRare'), perSlot(0.03)], [by('Special'), perSlot(0.2)], [by('SecretRare'), perSlot(1 / 3)],
        [alts, perSlot(1.5)], [by('SuperRare'), perSlot(4)], [by('Leader'), perSlot(3)]], R));
    }
    return { cards: out, estimated: lang !== 'en' };
  }

  // Put the strongest of the last n slots at the very end, so the best card is revealed last
  function sortHitsLast(out, n, tierOf) {
    const tail = out.splice(out.length - n, n).sort((a, b) => tierOf(a.card) - tierOf(b.card));
    out.push(...tail);
  }

  const api = { pokemonPack, onePiecePack };
  if (typeof module !== 'undefined') module.exports = api; else root.PackSimCore = api;
})(this);
