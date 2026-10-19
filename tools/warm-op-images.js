// Pre-load every ONE PIECE grid image into the site's CDN cache, so visitors never wait for a
// first-time download + resize.   node tools/warm-op-images.js [site] [--detail]
//   site      defaults to https://card-binder-xi.vercel.app
//   --detail  also warm the 640px detail-view size
// Re-run after a new set is released. Vercel caches per region, so this warms the region
// nearest to where it runs.
const PUNK = 'https://raw.githubusercontent.com/buhbbl/punk-records/main';
const args = process.argv.slice(2);
const site = (args.find(a => a.startsWith('http')) || 'https://card-binder-xi.vercel.app').replace(/\/$/, '');
const widths = args.includes('--detail') ? [240, 640] : [240];
const CONCURRENCY = 6;

const getJSON = async url => { const r = await fetch(url); if (!r.ok) throw new Error(`${r.status} ${url}`); return r.json(); };

(async () => {
  const urls = new Set();
  for (const dir of ['english', 'japanese']) {
    const files = await getJSON(`https://api.github.com/repos/buhbbl/punk-records/contents/${dir}/data`);
    for (const f of files.filter(f => f.name.endsWith('.json'))) {
      for (const c of await getJSON(`${PUNK}/${dir}/data/${f.name}`)) if (c.img_full_url) urls.add(c.img_full_url);
    }
    console.log(`${dir}: ${urls.size} images so far`);
  }
  const jobs = [...urls].flatMap(u => widths.map(w => `${site}/api/img?u=${encodeURIComponent(u)}&w=${w}`));
  const stats = { HIT: 0, MISS: 0, other: 0, failed: 0 };
  let done = 0, next = 0;
  const started = Date.now();
  await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
    while (next < jobs.length) {
      const url = jobs[next++];
      try {
        const r = await fetch(url); await r.arrayBuffer();
        if (!r.ok) stats.failed++;
        else { const c = r.headers.get('x-vercel-cache'); stats[c === 'HIT' || c === 'MISS' ? c : 'other']++; }
      } catch { stats.failed++; }
      if (++done % 200 === 0 || done === jobs.length) {
        const s = (Date.now() - started) / 1000;
        console.log(`${done}/${jobs.length}  ${JSON.stringify(stats)}  ${Math.round(s)}s, ~${Math.round((jobs.length - done) * s / done)}s left`);
      }
    }
  }));
  console.log('Done.', stats);
})().catch(e => { console.error(e.message); process.exit(1); });
