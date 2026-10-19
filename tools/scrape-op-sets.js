// Refresh op-sets.json (ONE PIECE release dates + official names, JP and EN):  node tools/scrape-op-sets.js
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36';
const out = { ja: {}, en: {} };
const strip = h => h.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, '').replace(/<[^>]*>/g, '\n')
  .split('\n').map(s => s.trim()).filter(Boolean);
(async () => {
  for (const [lang, host] of [['ja', 'www'], ['en', 'en']]) for (const sub of ['boosters', 'decks']) for (let p = 1; p <= 8; p++) {
    const html = await (await fetch(`https://${host}.onepiece-cardgame.com/products/?subcategory=${sub}&page=${p}`, { headers: { 'User-Agent': UA } })).text();
    const lines = strip(html); let found = 0;
    lines.forEach((l, i) => {
      const m = l.match(/^(.*?)[【\[]((?:OP|ST|EB|PRB)-?\d+(?:-EB\d+)?)[】\]]\s*$/);
      if (!m) return;
      const dl = lines.slice(i + 1, i + 6).find(x => /\d{4}[./]\d{1,2}[./]\d{1,2}|\w+ \d{1,2},? \d{4}/.test(x));
      if (!dl) return;
      let d = dl.match(/(\d{4})[./](\d{1,2})[./](\d{1,2})/);
      let date = d ? `${d[1]}-${d[2].padStart(2, '0')}-${d[3].padStart(2, '0')}` : new Date(dl.match(/\w+ \d{1,2},? \d{4}/)[0] + ' UTC').toISOString().slice(0, 10);
      out[lang][m[2]] ??= { name: m[1].trim(), date }; found++;
    });
    if (!found) break;
  }
  require('fs').writeFileSync(require('path').join(__dirname, '..', 'public', 'op-sets.json'), JSON.stringify(out, null, 1));
  console.log('ja', Object.keys(out.ja).length, 'en', Object.keys(out.en).length);
})();
