// Refresh public/op-sets.json (ONE PIECE release dates, official names and pack images, JP and EN)
// from the official product pages:  npm run update-op-sets
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36';
const out = { ja: {}, en: {} };
const strip = h => h.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, '').replace(/<[^>]*>/g, '\n')
  .split('\n').map(s => s.trim()).filter(Boolean);

// The product's image is the last lazy-loaded <img data-src> before its title in the page
function imageFor(html, code, base) {
  const at = Math.max(html.indexOf(`【${code}】`), html.indexOf(`[${code}]`));
  if (at < 0) return null;
  const m = [...html.slice(Math.max(0, at - 4000), at).matchAll(/data-src="([^"]+)"/g)].pop();
  if (!m || /thumbnail/.test(m[1])) return null;
  const u = new URL(m[1].replace(/&amp;/g, '&'), base);
  // keep only the official version marker (?reset=...), not the per-deploy cache buster
  const reset = u.search.match(/reset=\d+/)?.[0];
  return `${u.origin}${u.pathname}${reset ? `?${reset}` : ''}`;
}

(async () => {
  for (const [lang, host] of [['ja', 'www'], ['en', 'en']]) for (const sub of ['boosters', 'decks']) for (let p = 1; p <= 8; p++) {
    const base = `https://${host}.onepiece-cardgame.com/products/?subcategory=${sub}&page=${p}`;
    const html = await (await fetch(base, { headers: { 'User-Agent': UA } })).text();
    const lines = strip(html); let found = 0;
    lines.forEach((l, i) => {
      const m = l.match(/^(.*?)[【\[]((?:OP|ST|EB|PRB)-?\d+(?:-EB\d+)?)[】\]]\s*$/);
      if (!m) return;
      const dl = lines.slice(i + 1, i + 6).find(x => /\d{4}[./]\d{1,2}[./]\d{1,2}|\w+ \d{1,2},? \d{4}/.test(x));
      if (!dl) return;
      const d = dl.match(/(\d{4})[./](\d{1,2})[./](\d{1,2})/);
      const date = d ? `${d[1]}-${d[2].padStart(2, '0')}-${d[3].padStart(2, '0')}` : new Date(dl.match(/\w+ \d{1,2},? \d{4}/)[0] + ' UTC').toISOString().slice(0, 10);
      out[lang][m[2]] ??= { name: m[1].trim(), date, img: imageFor(html, m[2], base) }; found++;
    });
    if (!found) break;
  }
  require('fs').writeFileSync(require('path').join(__dirname, '..', 'public', 'op-sets.json'), JSON.stringify(out, null, 1));
  for (const l of ['ja', 'en']) {
    const v = Object.values(out[l]);
    console.log(l, v.length, 'sets,', v.filter(x => x.img).length, 'with pack image');
  }
})();
