/**
 * CeraCUT Nesting Worker V1.0
 * Führt NestingEngine.nest() im Hintergrund aus (Autonest mit großen Stückzahlen blockiert sonst die Oberfläche).
 * Nachricht in:  { items, cfg }      Nachrichten aus: { type:'progress', done, total, sheets } · { type:'done', res } · { type:'error', message }
 * Abbruch erfolgt über worker.terminate() im Aufrufer (nesting-plan.js).
 *
 * Created: 2026-11-07
 * Build: 20261107-group
 *
 * (c) Cerasell GmbH
 */

// nesting.js liegt im selben Ordner; die Versionsangabe (?v=…) der Worker-URL wird durchgereicht (Cache-Busting)
importScripts('nesting.js' + (self.location && self.location.search ? self.location.search : ''));

self.onmessage = function (e) {
    const { items, cfg } = e.data;
    try {
        let last = 0;
        const res = NestingEngine.nest(items, Object.assign({}, cfg, {
            onProgress: function (done, total, sheets) {
                const now = Date.now();
                if (done === total || now - last > 100) { last = now; self.postMessage({ type: 'progress', done: done, total: total, sheets: sheets }); }
            }
        }));
        self.postMessage({ type: 'done', res: res });
    } catch (err) {
        self.postMessage({ type: 'error', message: err && err.message ? err.message : String(err) });
    }
};
