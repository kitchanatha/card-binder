// Build the ONE PIECE card-name search index: public/op-cards-en.json and public/op-cards-ja.json
//   npm run update-op-index        (re-run after a new set is released)
// Each card is [id, name, packId, imageVersion]; the image URL is rebuilt from `tpl`.
// The app loads the file for the current language the first time someone searches.
const fs = require('fs'), path = require('path');
const PUNK = 'https://raw.githubusercontent.com/buhbbl/punk-records/main';
const LANGS = { en: 'english', ja: 'japanese' };

const getJSON = async url => { const r = await fetch(url); if (!r.ok) throw new Error(`${r.status} ${url}`); return r.json(); };

(async () => {
  for (const [lang, dir] of Object.entries(LANGS)) {
    const files = (await getJSON(`https://api.github.com/repos/buhbbl/punk-records/contents/${dir}/data`))
      .filter(f => f.name.endsWith('.json'));
    const cards = []; let tpl = null;
    for (const f of files) {
      for (const c of await getJSON(`${PUNK}/${dir}/data/${f.name}`)) {
        const m = c.img_full_url?.match(/^(.*\/)([^/]+)\.png\?(\d+)$/);
        if (!m || m[2] !== c.id) continue;
        tpl ??= `${m[1]}{id}.png?{v}`;
        cards.push([c.id, c.name, c.pack_id, m[3]]);
      }
    }
    const out = path.join(__dirname, '..', 'public', `op-cards-${lang}.json`);
    fs.writeFileSync(out, JSON.stringify({ tpl, cards }));
    console.log(`${lang}: ${cards.length} cards from ${files.length} packs → ${path.basename(out)} (${Math.round(fs.statSync(out).size / 1024)} KB)`);
  }
})().catch(e => { console.error(e.message); process.exit(1); });
