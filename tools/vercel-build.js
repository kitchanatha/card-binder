// Runs on Vercel only (npm run build). Vercel gives each project its own path for Web Analytics and
// passes it to builds as VERCEL_OBSERVABILITY_BASEPATH; framework apps read it automatically, so this
// does the same for our plain HTML page: it points the analytics <script> at that path.
// Locally (no VERCEL env) it does nothing, so the committed index.html is never changed.
const fs = require('fs'), path = require('path');

if (!process.env.VERCEL) { console.log('vercel-build: not on Vercel, nothing to do'); process.exit(0); }

const file = path.join(__dirname, '..', 'public', 'index.html');
const base = (process.env.VERCEL_OBSERVABILITY_BASEPATH || '').replace(/\/$/, '');
let html = fs.readFileSync(file, 'utf8');
const tag = '<script defer src="/_vercel/insights/script.js"></script>';

if (base && html.includes(tag)) {
  html = html.replace(tag, `<script defer src="${base}/insights/script.js" data-endpoint="${base}/insights"></script>`);
  fs.writeFileSync(file, html);
}
// public record of what the build did (the path is public anyway: it appears in the page)
fs.writeFileSync(path.join(__dirname, '..', 'public', 'build-info.json'), JSON.stringify({
  analyticsBasePath: base || null, commit: (process.env.VERCEL_GIT_COMMIT_SHA || '').slice(0, 7), builtAt: new Date().toISOString(),
}, null, 1));
console.log(`vercel-build: analytics base path ${base ? `set to ${base}` : 'not provided, keeping /_vercel/insights'}`);
