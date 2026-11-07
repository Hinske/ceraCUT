'use strict';
// Startet die echte ceraCUT-App (index.html + alle Skripte) in jsdom ueber einen lokalen statischen Server (ohne Login).
// Canvas/IndexedDB/fetch sind gestubbt. Rueckgabe: { w, app, logs, close }.
const { JSDOM, VirtualConsole } = require('jsdom');
const fs = require('fs'), path = require('path'), http = require('http');
const ROOT = path.join(__dirname, '../..');
const MIME = { '.js': 'text/javascript', '.html': 'text/html', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml' };

async function bootApp({ timeout = 15000 } = {}) {
    const srv = http.createServer((q, r) => {
        const u = decodeURIComponent(new URL(q.url, 'http://x').pathname);
        const f = path.join(ROOT, u === '/' ? 'index.html' : u);
        try { const b = fs.readFileSync(f); r.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); r.end(b); }
        catch { r.writeHead(404); r.end(''); }
    });
    await new Promise(r => srv.listen(0, '127.0.0.1', r));
    const vc = new VirtualConsole(), logs = [];
    vc.on('log', (...a) => logs.push(a.join(' '))); vc.on('error', (...a) => logs.push('ERR ' + a.join(' '))); vc.on('jsdomError', e => logs.push('JSDOMERR ' + e.message.slice(0, 200)));
    const dom = await JSDOM.fromURL(`http://127.0.0.1:${srv.address().port}/index.html`, {
        runScripts: 'dangerously', resources: 'usable', pretendToBeVisual: true, virtualConsole: vc,
        beforeParse(w) {
            w.HTMLCanvasElement.prototype.getContext = function () { return new Proxy({}, { get: (t, k) => (k === 'canvas' ? this : (k === 'measureText' ? () => ({ width: 10 }) : () => {})), set: () => true }); };
            w.indexedDB = { open: () => ({}) };
            w.fetch = async () => ({ ok: false, status: 404, json: async () => ({}), text: async () => '', headers: new Map() });
        }
    });
    const w = dom.window, t0 = Date.now();
    while (!(w.app && typeof w.app.loadDXFContent === 'function') && Date.now() - t0 < timeout) await new Promise(r => setTimeout(r, 100));
    if (!w.app) throw new Error('App nicht gestartet: ' + logs.filter(l => /ERR/.test(l)).slice(0, 3).join(' | '));
    await new Promise(r => setTimeout(r, 300));
    return { w, app: w.app, logs, close: () => { try { w.close(); } catch { /* */ } srv.close(); } };
}
module.exports = { bootApp };
