// Generate the app icons in public/icons/ from one SVG design:   node tools/build-icons.js
// Design: a binder page with a 3×3 grid of card pockets, one pocket filled and starred ("owned").
// "Maskable" versions keep the artwork inside the central safe zone so Android can crop them to any shape.
const sharp = require('sharp'), fs = require('fs'), path = require('path');
const OUT = path.join(__dirname, '..', 'public', 'icons');
fs.mkdirSync(OUT, { recursive: true });

function svg({ maskable = false, round = true } = {}) {
  // maskable: full-bleed background, artwork scaled into the inner 70% safe zone
  const s = maskable ? 0.7 : 0.86, off = (512 - 512 * s) / 2;
  const pockets = [];
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
    const x = 126 + c * 92, y = 112 + r * 104, owned = r === 0 && c === 2;
    pockets.push(`<rect x="${x}" y="${y}" width="76" height="88" rx="9" fill="${owned ? '#c2410c' : '#fde3d3'}"/>`);
    if (owned) pockets.push(`<path d="M${x + 38} ${y + 24}l7.6 15.4 17 2.5-12.3 12 2.9 16.9-15.2-8-15.2 8 2.9-16.9-12.3-12 17-2.5z" fill="#fff"/>`);
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
    <rect width="512" height="512" rx="${maskable || !round ? 0 : 112}" fill="#c2410c"/>
    <g transform="translate(${off} ${off}) scale(${s})">
      <rect x="104" y="88" width="304" height="352" rx="28" fill="#fff"/>
      <g fill="#c2410c" opacity=".9"><circle cx="82" cy="150" r="13"/><circle cx="82" cy="256" r="13"/><circle cx="82" cy="362" r="13"/></g>
      <rect x="70" y="130" width="34" height="252" rx="10" fill="#fff" opacity=".25"/>
      ${pockets.join('')}
    </g></svg>`;
}

(async () => {
  const jobs = [
    ['icon-192.png', 192, svg()], ['icon-512.png', 512, svg()],
    ['maskable-192.png', 192, svg({ maskable: true })], ['maskable-512.png', 512, svg({ maskable: true })],
    ['apple-touch-icon.png', 180, svg({ round: false })],   // iOS rounds the corners itself
    ['favicon-32.png', 32, svg()],
  ];
  for (const [name, size, src] of jobs) {
    await sharp(Buffer.from(src)).resize(size, size).png({ compressionLevel: 9 }).toFile(path.join(OUT, name));
  }
  fs.writeFileSync(path.join(OUT, 'icon.svg'), svg());
  console.log('wrote', jobs.length + 1, 'icons to public/icons:', fs.readdirSync(OUT).map(f => `${f} ${Math.round(fs.statSync(path.join(OUT, f)).size / 1024)}KB`).join(', '));
})().catch(e => { console.error(e); process.exit(1); });
