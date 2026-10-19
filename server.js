// Local dev server: node server.js  →  http://localhost:8137
// Serves public/ and runs the same api/*.js handlers that Vercel deploys as functions.
const http = require('http'), fs = require('fs'), path = require('path');

const PUBLIC = path.join(__dirname, 'public');
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
const API = { '/api/img': require('./api/img'), '/api/psa10': require('./api/psa10') };

http.createServer((req, res) => {
  const route = req.url.split('?')[0];
  if (API[route]) return API[route](req, res);
  const file = path.join(PUBLIC, route === '/' ? 'index.html' : decodeURIComponent(route));
  // only files inside public/ (Windows paths are case-insensitive, so compare lower-cased)
  if (!file.toLowerCase().startsWith(PUBLIC.toLowerCase() + path.sep)) return res.writeHead(403).end();
  fs.readFile(file, (err, data) => err ? res.writeHead(404).end('Not found')
    : res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' }).end(data));
}).listen(process.env.PORT || 8137, () => console.log(`Card Binder running at http://localhost:${process.env.PORT || 8137}`));
