'use strict';
// UI-Testumgebung: echte Daten-API (Stores in Temp-Dir) + jsdom, dessen fetch() gegen den lokalen Server läuft.
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const url = require('url');
const { JSDOM } = require('jsdom');
const { createStores } = require('../../lib/store');
const { handleDataApi } = require('../../lib/data-api');

async function start(user = { username: 'mh', role: 'admin' }) {
    const stores = createStores(fs.mkdtempSync(path.join(os.tmpdir(), 'ceracut-ui-')));
    const server = http.createServer((req, res) => {
        const p = url.parse(req.url, true);
        if (!handleDataApi(req, res, decodeURIComponent(p.pathname), p.query, user, stores)) { res.writeHead(404); res.end(); }
    });
    await new Promise(r => server.listen(0, '127.0.0.1', r));
    const base = `http://127.0.0.1:${server.address().port}`;
    const dom = new JSDOM('<!doctype html><body></body>', { url: base + '/', pretendToBeVisual: true, runScripts: 'outside-only' });
    const w = dom.window;
    w.fetch = (u, o) => fetch(new URL(u, base), o);
    w.CeraCutCurrentRole = user.role;
    w.confirm = () => true;
    w.structuredClone = structuredClone;
    // Browser-Globals für die Skripte (Klassen/Konstanten werden per Funktionskonstruktor in den Fenster-Kontext gelegt)
    const toasts = [];
    const app = { showToast: (m, t) => toasts.push([m, t]), currentUser: user };
    function load(file, exports) {
        const src = fs.readFileSync(path.join(__dirname, '..', '..', 'js', file), 'utf8');
        const keys = exports.join(',');
        const fn = new w.Function('module', `${src}\n;return { ${keys} };`);
        const m = { exports: undefined };
        const out = fn.call(w, m);
        Object.assign(w, out);
        return out;
    }
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    async function waitFor(fn, ms = 3000) {
        const t0 = Date.now();
        while (Date.now() - t0 < ms) { const v = fn(); if (v) return v; await sleep(20); }
        throw new Error('waitFor: Zeitüberschreitung');
    }
    return { stores, w, doc: w.document, app, toasts, load, sleep, waitFor, base,
             close: () => { server.closeAllConnections(); server.close(); dom.window.close(); } };
}

module.exports = { start };
