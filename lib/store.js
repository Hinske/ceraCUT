/**
 * CeraCUT Store V1.0
 * Generischer Datei-Store (JSON) für Teile, Pläne, Bleche, Technologie, Aufträge.
 * Keine Dependencies. Schnittstelle bewusst klein, damit später SQLite dahinter tauschbar ist.
 *
 * Zwei Collection-Arten:
 *   - DocCollection:  ein Dokument = eine Datei  (data/<name>/<id>.json), z. B. parts, plans
 *   - ListCollection: ganze Collection = eine Datei (data/<name>.json), z. B. sheets, orders, technology
 *
 * Garantien:
 *   - Atomares Schreiben (tmp + fsync + rename)
 *   - Optimistische Sperre: jedes Dokument hat `version`; put() mit expectedVersion prüft (If-Match)
 *   - Serialisierung aller Schreibzugriffe je Datei (In-Process-Queue) — Server läuft als ein Prozess
 *   - IDs werden gegen Pfad-Injection validiert
 *   - Historie (optional, parts): jeder überschriebene Stand wird in data/<name>/_history/<id>.<rev>.json behalten
 *
 * Created: 2026-11-07
 * Last Modified: 2026-11-07
 * Build: 20261107-store
 *
 * (c) Cerasell GmbH
 */

const fs = require('fs');
const path = require('path');

const ID_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;

class StoreError extends Error {
    constructor(code, message) { super(message); this.code = code; }
}
// Codes: BAD_ID | NOT_FOUND | CONFLICT | EXISTS | CORRUPT | BAD_DOC

function assertId(id) {
    if (typeof id === 'number' && Number.isInteger(id) && id >= 0) id = String(id);
    if (typeof id !== 'string' || !ID_RE.test(id) || id.includes('..')) {
        throw new StoreError('BAD_ID', `Ungültige ID: ${String(id).slice(0, 80)}`);
    }
    return id;
}

// ── Low-Level ────────────────────────────────────────────────────────

function atomicWrite(file, text) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
    const fd = fs.openSync(tmp, 'w', 0o600);
    try {
        fs.writeFileSync(fd, text, 'utf8');
        fs.fsyncSync(fd);
    } finally {
        fs.closeSync(fd);
    }
    try {
        fs.renameSync(tmp, file);
    } catch (err) {
        try { fs.unlinkSync(tmp); } catch { /* ignore */ }
        throw err;
    }
}

function readJson(file, fallback) {
    let raw;
    try {
        raw = fs.readFileSync(file, 'utf8');
    } catch (err) {
        if (err.code === 'ENOENT') return fallback;
        throw err;
    }
    try {
        return JSON.parse(raw);
    } catch (err) {
        // Nie still überschreiben — hart melden
        throw new StoreError('CORRUPT', `${path.basename(file)} nicht lesbar: ${err.message}`);
    }
}

// Pro-Datei-Queue: serialisiert read-modify-write
const _queues = new Map();
function withLock(key, fn) {
    const prev = _queues.get(key) || Promise.resolve();
    const run = prev.then(fn, fn);
    const tail = run.catch(() => {});
    _queues.set(key, tail);
    tail.then(() => { if (_queues.get(key) === tail) _queues.delete(key); });
    return run;
}

function checkVersion(current, expected) {
    if (expected !== undefined && expected !== null && (current ? current.version : 0) !== expected) {
        throw new StoreError('CONFLICT',
            `Versionskonflikt: erwartet ${expected}, aktuell ${current ? current.version : 0}`);
    }
}

function stamp(prev, doc, user) {
    const now = new Date().toISOString();
    return {
        ...doc,
        version: (prev ? prev.version : 0) + 1,
        createdAt: prev ? prev.createdAt : now,
        updatedAt: now,
        updatedBy: user || null
    };
}

// ── DocCollection ────────────────────────────────────────────────────

class DocCollection {
    /**
     * @param {string} dir      Zielverzeichnis
     * @param {object} opts     { idField, history, revisionField }
     *   history: true → alte Stände in _history/ behalten (Revision = doc[revisionField] || version)
     */
    constructor(dir, opts = {}) {
        this.dir = dir;
        this.idField = opts.idField || 'id';
        this.history = !!opts.history;
        this.revisionField = opts.revisionField || 'revision';
        this._index = null; // id → Kurzinfo, für list()/search()
    }

    _file(id) { return path.join(this.dir, `${assertId(id)}.json`); }
    _histFile(id, rev) {
        return path.join(this.dir, '_history', `${assertId(id)}.${Number(rev)}.json`);
    }

    get(id) {
        const doc = readJson(this._file(id), null);
        if (!doc) throw new StoreError('NOT_FOUND', `${id} nicht gefunden`);
        return doc;
    }

    exists(id) { return fs.existsSync(this._file(id)); }

    /** Alle Dokumente (aus Index; Index wird beim ersten Aufruf gebaut). */
    list(filterFn) {
        const idx = this._ensureIndex();
        const docs = [...idx.values()];
        return filterFn ? docs.filter(filterFn) : docs;
    }

    _ensureIndex() {
        if (this._index) return this._index;
        const idx = new Map();
        let names = [];
        try { names = fs.readdirSync(this.dir); } catch (err) { if (err.code !== 'ENOENT') throw err; }
        for (const n of names) {
            if (!n.endsWith('.json')) continue;
            const doc = readJson(path.join(this.dir, n), null);
            if (doc && doc[this.idField]) idx.set(doc[this.idField], doc);
        }
        this._index = idx;
        return idx;
    }

    /**
     * Anlegen/Überschreiben.
     * @param {object} doc
     * @param {{expectedVersion?:number, user?:string, createOnly?:boolean}} opts
     */
    put(doc, opts = {}) {
        if (!doc || typeof doc !== 'object') throw new StoreError('BAD_DOC', 'Dokument fehlt');
        const id = assertId(doc[this.idField]);
        const file = this._file(id);
        return withLock(file, () => {
            const prev = readJson(file, null);
            if (opts.createOnly && prev) throw new StoreError('EXISTS', `${id} existiert bereits`);
            checkVersion(prev, opts.expectedVersion);
            if (prev && this.history) {
                const rev = prev[this.revisionField] ?? prev.version;
                atomicWrite(this._histFile(id, rev), JSON.stringify(prev));
            }
            const next = stamp(prev, doc, opts.user);
            atomicWrite(file, JSON.stringify(next, null, 2));
            if (this._index) this._index.set(id, next);
            return next;
        });
    }

    delete(id, opts = {}) {
        const file = this._file(id);
        return withLock(file, () => {
            const prev = readJson(file, null);
            if (!prev) throw new StoreError('NOT_FOUND', `${id} nicht gefunden`);
            checkVersion(prev, opts.expectedVersion);
            fs.unlinkSync(file); // Historie bleibt bewusst erhalten
            if (this._index) this._index.delete(id);
            return true;
        });
    }

    /** Historie: Liste der gespeicherten Revisionen (aufsteigend). */
    revisions(id) {
        assertId(id);
        let names = [];
        try { names = fs.readdirSync(path.join(this.dir, '_history')); } catch (err) {
            if (err.code !== 'ENOENT') throw err;
        }
        const re = new RegExp(`^${id.replace(/[.]/g, '\\.')}\\.(\\d+)\\.json$`);
        return names.map(n => re.exec(n)).filter(Boolean).map(m => Number(m[1])).sort((a, b) => a - b);
    }

    getRevision(id, rev) {
        const doc = readJson(this._histFile(id, rev), null);
        if (!doc) throw new StoreError('NOT_FOUND', `${id} Revision ${rev} nicht gefunden`);
        return doc;
    }
}

// ── ListCollection ───────────────────────────────────────────────────
// Datei enthält { version, items: [...] } — Items haben ein eigenes idField.

class ListCollection {
    constructor(file, opts = {}) {
        this.file = file;
        this.idField = opts.idField || 'id';
        this.empty = opts.empty || { version: 0, items: [] };
    }

    _read() { return readJson(this.file, structuredClone(this.empty)); }

    all() { return this._read().items; }
    version() { return this._read().version; }

    get(id) {
        const it = this._read().items.find(i => String(i[this.idField]) === String(id));
        if (!it) throw new StoreError('NOT_FOUND', `${id} nicht gefunden`);
        return it;
    }

    /** Anlegen/Ersetzen eines Eintrags. */
    upsert(item, opts = {}) {
        assertId(item && item[this.idField]);
        const id = item[this.idField];
        return withLock(this.file, () => {
            const data = this._read();
            checkVersion(data, opts.expectedVersion);
            const i = data.items.findIndex(x => String(x[this.idField]) === String(id));
            const now = new Date().toISOString();
            const stored = { ...item, updatedAt: now, updatedBy: opts.user || null };
            if (i >= 0) data.items[i] = { createdAt: data.items[i].createdAt, ...stored };
            else data.items.push({ createdAt: now, ...stored });
            data.version += 1;
            atomicWrite(this.file, JSON.stringify(data, null, 2));
            return i >= 0 ? data.items[i] : data.items[data.items.length - 1];
        });
    }

    remove(id, opts = {}) {
        return withLock(this.file, () => {
            const data = this._read();
            checkVersion(data, opts.expectedVersion);
            const i = data.items.findIndex(x => String(x[this.idField]) === String(id));
            if (i < 0) throw new StoreError('NOT_FOUND', `${id} nicht gefunden`);
            data.items.splice(i, 1);
            data.version += 1;
            atomicWrite(this.file, JSON.stringify(data, null, 2));
            return true;
        });
    }
}

// ── Fabrik ───────────────────────────────────────────────────────────

function createStores(dataDir) {
    return {
        parts:  new DocCollection(path.join(dataDir, 'parts'), { idField: 'partId', history: true, revisionField: 'revision' }),
        plans:  new DocCollection(path.join(dataDir, 'plans'), { idField: 'planId', history: false }),
        sheets: new ListCollection(path.join(dataDir, 'sheets.json'), { idField: 'sheetId' }),
        orders: new ListCollection(path.join(dataDir, 'orders.json'), { idField: 'orderId' }),
        materials:     new ListCollection(path.join(dataDir, 'materials.json'), { idField: 'materialId' }),
        technologies:  new ListCollection(path.join(dataDir, 'technologies.json'), { idField: 'technologyId' })
    };
}

module.exports = { createStores, DocCollection, ListCollection, StoreError, assertId, atomicWrite };
