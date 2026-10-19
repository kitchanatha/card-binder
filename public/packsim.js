// Pack opening simulator UI: tear open a pack, flip cards one by one, see the pack's value.
// Uses the page's globals (I18N, t, tf, esc, rarityInfo, fmtMoney, load, save, getJSON, openDetail…)
// and PackSimCore from packsim-core.js. Simulated pulls are kept apart from the real collection.
(function () {
  Object.assign(I18N.en, {
    openPack: 'Open a pack', open10: 'Open 10', tapToOpen: 'Tap the pack to tear it open', tapToFlip: 'Tap to reveal',
    tapNext: 'Tap for the next card', skip: 'Skip to results', yourPack: 'Your pack', nPacks: '{n}',
    packValue: 'Value of these cards', bestPull: 'Best pull', openAnother: 'Open another', done: 'Done',
    simNote: 'For fun: odds are community estimates, not official. Pulled cards are not added to your collection.',
    estNote: 'Estimated pack: real packs for this set may be built differently.', reverseHolo: 'Reverse holo',
    simStats: 'Simulator: {p} opened here · {u} of {n} cards pulled', moreLow: '+ {n} commons and uncommons',
    noPrice: 'no price', newPull: 'NEW', pricing: 'Looking up prices…', seeResults: 'Tap to see your pack',
  });
  Object.assign(I18N.ja, {
    openPack: 'パックを開封', open10: '10パック開封', tapToOpen: 'パックをタップして開封', tapToFlip: 'タップでめくる',
    tapNext: 'タップで次のカードへ', skip: '結果までスキップ', yourPack: '開封結果', nPacks: '{n}',
    packValue: 'カードの合計相場', bestPull: 'ベストカード', openAnother: 'もう1パック', done: '閉じる',
    simNote: 'お楽しみ用のシミュレーターです。確率はコミュニティの推定値で、公式ではありません。引いたカードはコレクションに追加されません。',
    estNote: '推定パック：実際のパック構成とは異なる場合があります。', reverseHolo: 'ミラー',
    simStats: 'シミュレーター：このエキスパンションで {p}開封 · {n} 種中 {u} 種を獲得', moreLow: '＋ コモン・アンコモン {n} 枚',
    noPrice: '価格なし', newPull: 'NEW', pricing: '価格を取得中…', seeResults: 'タップで結果を見る',
  });

  const packsText = n => lang === 'ja' ? `${n} パック` : `${n} pack${n === 1 ? '' : 's'}`;
  const sim = document.createElement('dialog');
  sim.className = 'packsim'; sim.setAttribute('aria-label', 'Pack opening');
  document.body.append(sim);
  let S = null, refreshRow = null;
  // current session: { g, gameKey, data, setId, setMeta, key, packs, flat, i, flipped }
  // Refresh the set page stats when the simulator closes. Done/× call it directly; the close
  // event (Escape key) can arrive late, so it is only the backup.
  const closeSim = () => { sim.close(); refreshRow?.(); };
  sim.addEventListener('close', () => refreshRow?.());

  // glow tier: alt arts count as hits even when their base rarity is low; manga rares (_p2+) as the top tier
  const tierOf = (gameKey, c) => {
    const base = rarityInfo(gameKey, c.rarity)?.tier ?? 0;
    if (!c.alt) return base;
    return /_p[2-9]$/.test(c.id) && c.rarity === 'SecretRare' ? 4 : Math.max(base, 3);
  };
  function makePack(ctx) {
    const tier = c => tierOf(ctx.gameKey, c);
    return ctx.gameKey === 'pokemon'
      ? PackSimCore.pokemonPack(ctx.data.cards, { lang, series: ctx.data.series, tierOf: tier })
      : PackSimCore.onePiecePack(ctx.data.cards, { lang, code: ctx.setMeta?.code || '' });
  }

  // ---------- stats (separate from the collection) ----------
  const statsKey = gameKey => `pulls:${gameKey}:${lang}`;
  function record(ctx, packs) {
    const st = load(statsKey(ctx.gameKey), { sets: {} }), s = st.sets[ctx.setId] ||= { packs: 0, ids: [] };
    const seen = new Set(s.ids), fresh = new Set();
    for (const p of packs) for (const { card } of p.cards) if (!seen.has(card.id)) { seen.add(card.id); fresh.add(card.id); }
    s.packs += packs.length; s.ids = [...seen];
    save(statsKey(ctx.gameKey), st);
    return fresh;
  }
  const setStats = ctx => load(statsKey(ctx.gameKey), { sets: {} }).sets[ctx.setId] || { packs: 0, ids: [] };

  // ---------- prices for the summary ----------
  async function ensurePrices(ctx, cards) {
    if (ctx.gameKey !== 'pokemon') return;   // ONE PIECE prices arrive with the set
    const need = [...new Set(cards.filter(c => !c.price))];
    await Promise.all(need.map(c => getJSON(`https://api.tcgdex.net/v2/${TCGDEX[lang]}/cards/${encodeURIComponent(c.id)}`)
      .then(d => { const p = cardmarketPrice(d); if (p) c.price = p; }).catch(() => {})));
  }

  // ---------- screens ----------
  function packArt(ctx) {
    // a sharper copy of the pack art for the full-size opening screen
    const src = ctx.setMeta?.pack?.replace('_200w.jpg', '_400w.jpg').replace('&w=240', '&w=640');
    return src ? `<img src="${esc(src)}" alt="" draggable="false">`
      : `<div class="psfake"><span>${esc(ctx.setMeta?.code || '')}</span><b>${esc(ctx.setMeta?.name || ctx.data.name || '')}</b></div>`;
  }
  function frame(inner, foot = '') {
    sim.innerHTML = `<button class="psclose" aria-label="${t('close')}">×</button><div class="psstage">${inner}</div>
      <div class="psfoot">${foot}</div>`;
  }

  function showPack() {
    const est = S.packs[0].estimated;
    frame(`<button class="pspack" id="pspack" aria-label="${t('tapToOpen')}">
        <span class="pstop">${packArt(S)}</span><span class="psbody">${packArt(S)}</span></button>
      <p class="pshint">${S.packs.length > 1 ? tf('nPacks', { n: packsText(S.packs.length) }) + ' · ' : ''}${t('tapToOpen')}</p>
      ${est ? `<p class="psnote">${t('estNote')}</p>` : ''}`, `<p class="psnote">${t('simNote')}</p>`);
  }
  function tear() {
    const p = sim.querySelector('#pspack'); if (!p || p.classList.contains('tearing')) return;
    p.classList.add('tearing');
    const go = () => (S.packs.length > 1 ? showSummary() : showCard());
    matchMedia('(prefers-reduced-motion: reduce)').matches ? go() : setTimeout(go, 650);
  }

  function showCard() {
    const it = S.flat[S.i], c = it.card, tier = tierOf(S.gameKey, c), ri = rarityInfo(S.gameKey, c.rarity);
    frame(`<p class="pscount">${S.i + 1} / ${S.flat.length}</p>
      <button class="pscard t${tier}${it.reverse ? ' rev' : ''}" id="pscard" aria-label="${t('tapToFlip')}">
        <span class="psinner"><span class="psback"><i>★</i></span>
          <span class="psfront">${c.imgHi || c.img ? `<img src="${esc(c.imgHi || c.img)}" alt="${esc(c.name)}" draggable="false">` : `<span class="psnoimg">${esc(c.name)}</span>`}</span></span>
        ${tier >= 4 ? '<span class="psburst"></span>' : ''}</button>
      <p class="psname" id="psname">&nbsp;</p>
      <p class="pshint" id="pshint">${t('tapToFlip')}</p>`,
      `<button class="btn" data-ps="skip">${t('skip')}</button>`);
    // preload the next card so flips feel instant
    const nx = S.flat[S.i + 1]?.card; if (nx?.imgHi || nx?.img) new Image().src = nx.imgHi || nx.img;
    S.flipped = false;
    S.label = `${esc(c.name)} <small>${esc(c.num)}${ri ? ` · ${esc(ri.code)}` : ''}${c.alt ? ` · ${t('parallel')}` : ''}${it.reverse ? ` · ${t('reverseHolo')}` : ''}</small>`;
  }
  function tapCard() {
    const el = sim.querySelector('#pscard'); if (!el) return;
    if (!S.flipped) {
      S.flipped = true; el.classList.add('flipped');
      sim.querySelector('#psname').innerHTML = S.label;
      sim.querySelector('#pshint').textContent = S.i + 1 < S.flat.length ? t('tapNext') : t('seeResults');
      return;
    }
    S.i++;
    S.i < S.flat.length ? showCard() : showSummary();
  }

  async function showSummary() {
    const all = S.packs.flatMap(p => p.cards), cards = all.map(x => x.card);
    const fresh = record(S, S.packs);
    frame(`<p class="pshint">${t('pricing')}</p>`);
    await ensurePrices(S, S.packs.length > 1 ? cards.filter(c => tierOf(S.gameKey, c) >= 1) : cards);
    if (!sim.open) return;
    const val = c => c.price?.main || 0;
    const totals = {};
    for (const c of cards) if (c.price) totals[c.price.currency] = (totals[c.price.currency] || 0) + c.price.main;
    const best = all.slice().sort((a, b) => val(b.card) - val(a.card) || tierOf(S.gameKey, b.card) - tierOf(S.gameKey, a.card))[0];
    // one pack: every card in pack order; many packs: the hits, best first, then a count of the rest
    const multi = S.packs.length > 1;
    const shown = multi ? all.filter(x => tierOf(S.gameKey, x.card) >= 1).sort((a, b) => val(b.card) - val(a.card) || tierOf(S.gameKey, b.card) - tierOf(S.gameKey, a.card)) : all;
    const lowCount = all.length - shown.length;
    const st = setStats(S);
    frame(`<div class="pssum">
        <h2>${multi ? tf('nPacks', { n: packsText(S.packs.length) }) : t('yourPack')}</h2>
        <div class="psvalue"><span>${t('packValue')}</span><strong>${Object.entries(totals).map(([cur, v]) => esc(fmtMoney(v, cur))).join(' + ') || '—'}</strong>
          ${best ? `<small>${t('bestPull')}: ${esc(best.card.name)}${best.card.price ? ` · ${esc(fmtMoney(best.card.price.main, best.card.price.currency))}` : ''}</small>` : ''}</div>
        <div class="psgrid">${shown.map(({ card: c, reverse }) => {
          const ri = rarityInfo(S.gameKey, c.rarity), tier = tierOf(S.gameKey, c);
          const isNew = fresh.delete(c.id);   // only the first copy of a new card gets the badge
          return `<button class="pstile t${tier}${reverse ? ' rev' : ''}" data-id="${esc(c.id)}">
            <span class="img">${c.img ? `<img src="${esc(c.img)}" alt="${esc(c.name)}" loading="lazy">` : ''}
              ${ri ? `<span class="rar t${ri.tier}">${esc(ri.code)}</span>` : ''}${isNew ? `<span class="psnew">${t('newPull')}</span>` : ''}</span>
            <span class="pslabel">${esc(c.name)}</span>
            <span class="psprice">${c.price ? esc(fmtMoney(c.price.main, c.price.currency)) : t('noPrice')}</span></button>`;
        }).join('')}</div>
        ${lowCount ? `<p class="psnote">${tf('moreLow', { n: lowCount })}</p>` : ''}
        <p class="psnote">${tf('simStats', { p: packsText(st.packs), u: st.ids.length, n: S.data.cards.length })}</p>
        <p class="psnote">${t('simNote')}</p></div>`,
      `<button class="btn psmain" data-ps="again">🎁 ${t('openAnother')}</button>
       <button class="btn" data-ps="ten">${t('open10')}</button><button class="btn" data-ps="done">${t('done')}</button>`);
    window.dispatchEvent(new CustomEvent('packsim:opened'));
  }

  function start(ctx, count) {
    const packs = [];
    for (let i = 0; i < count; i++) { const p = makePack(ctx); if (p) packs.push(p); }
    if (!packs.length) return;
    S = { ...ctx, packs, flat: packs.flatMap(p => p.cards), i: 0, flipped: false };
    // warm the card images while the pack is being opened
    S.flat.slice(0, 3).forEach(x => { if (x.card.imgHi || x.card.img) new Image().src = x.card.imgHi || x.card.img; });
    sim.open || sim.showModal();
    showPack();
  }

  sim.addEventListener('click', e => {
    if (e.target.closest('.psclose') || e.target.closest('[data-ps="done"]')) return closeSim();
    if (e.target.closest('#pspack')) return tear();
    if (e.target.closest('#pscard')) return tapCard();
    const a = e.target.closest('[data-ps]')?.dataset.ps;
    if (a === 'skip') return showSummary();
    if (a === 'again') return start(S, 1);
    if (a === 'ten') return start(S, 10);
    const tile = e.target.closest('.pstile');
    if (tile) { const c = S.data.cards.find(x => x.id === tile.dataset.id); if (c) openDetail(S.g, S.gameKey, S.data, c, S.key(c), () => {}); }
  });
  sim.addEventListener('keydown', e => {
    if ((e.key === ' ' || e.key === 'Enter') && sim.querySelector('#pscard') && document.activeElement?.closest('#pscard') == null) { e.preventDefault(); tapCard(); }
  });

  // Called by the set page once rarities have loaded: shows the button if this set can be opened
  window.mountPackSim = ctx => {
    const row = document.getElementById('simrow'); if (!row) return;
    if (!makePack(ctx)) { row.hidden = true; return; }
    const draw = () => {
      const st = setStats(ctx);
      row.hidden = false;
      row.innerHTML = `<button class="btn simbtn" data-sim="1">🎁 ${t('openPack')}</button><button class="btn" data-sim="10">${t('open10')}</button>
        ${st.packs ? `<span class="muted">${tf('simStats', { p: packsText(st.packs), u: st.ids.length, n: ctx.data.cards.length })}</span>` : ''}`;
    };
    draw();
    row.onclick = e => { const n = +e.target.closest('[data-sim]')?.dataset.sim; if (n) start(ctx, n); };
    refreshRow = draw;   // one listener for the dialog; it redraws whichever set page is showing
  };
})();
