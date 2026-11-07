/**
 * CeraCUT Common-Line V1.0
 * Gemeinsame Schnittlinien für rechteckige Teile (Wasserstrahl, Fliesen) — reine Logik, DOM-frei, in Node testbar.
 *
 * Eingabe: platzierte Rechtecke auf EINEM Blech (Teile mit Flag commonLine, im Abstand = Schnittspalt `gap`).
 * Ausgabe je Gruppe (zusammenhängender Rechteckblock mit lückenlosem Guillotine-Schnittplan):
 *   - cuts  : gemeinsame Linien als offene Schnitte, MITTIG im Spalt (Kerf 'online'/G40), in Schnittreihenfolge
 *             (Hauptschnitte zuerst, Teilschnitte enden auf dem Hauptschnitt). Anstich außerhalb der Teile (im Randstreifen).
 *   - frame : Außenrahmen des Blocks (geschlossen, G42 von außen) — wird ZULETZT geschnitten und gibt die Teile frei.
 * Gruppen, die kein lückenloser Rechteckblock sind, werden NICHT zusammengefasst (rest → normale Konturen mit Fuge).
 *
 * Maßhaltigkeit: Abstand zwischen den Teilen = Schnittspalt, Linie mittig → jedes Teil verliert auf beiden Seiten genau
 * die halbe Schnittbreite des Strahls, das ist die Fuge selbst. Der Rahmen läuft mit Kerf-Versatz (G42) außen herum.
 *
 * Created: 2026-11-07
 * Last Modified: 2026-11-07
 * Build: 20261107-commonline
 * V1.0: Feat — Gruppen finden (Union-Find über Kantenkontakt), Guillotine-Zerlegung, Schnittlinien + Rahmen, Ersparnis
 *
 * (c) Cerasell GmbH
 */
(function () {
'use strict';

const VERSION = 'V1.0';
const TOL = 0.02;           // mm: Toleranz für Lage/Abstand (Positionen sind auf 0,001 gerundet)
const MIN_EXT = 1;          // mm: kürzester Anstichabstand vor dem Block (sonst Fallback)

const near = (a, b, t = TOL) => Math.abs(a - b) <= t;

/**
 * @param {Array<{id:*, minX:number, minY:number, maxX:number, maxY:number}>} rects  Common-Line-Rechtecke eines Blechs
 * @param {{gap:number, sheetWidth:number, sheetHeight:number, ext?:number}} opt
 * @returns {{groups:Array, rest:Array, stats:{groups:number, parts:number, pierces:number, piercesBefore:number, length:number, lengthBefore:number, savedPierces:number, savedLength:number}}}
 */
function build(rects, opt) {
    const gap = opt.gap, ext = opt.ext ?? 3;
    const sw = opt.sheetWidth, sh = opt.sheetHeight;

    // 1) Gruppen: Rechtecke, die im Abstand `gap` mit überlappender Ausdehnung nebeneinander liegen
    const n = rects.length, parent = rects.map((_, i) => i);
    const find = i => { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; };
    const unite = (a, b) => { parent[find(a)] = find(b); };
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
        const a = rects[i], b = rects[j];
        const ovY = Math.min(a.maxY, b.maxY) - Math.max(a.minY, b.minY);
        const ovX = Math.min(a.maxX, b.maxX) - Math.max(a.minX, b.minX);
        const gx = Math.max(a.minX - b.maxX, b.minX - a.maxX), gy = Math.max(a.minY - b.maxY, b.minY - a.maxY);
        if ((near(gx, gap) && ovY > TOL) || (near(gy, gap) && ovX > TOL)) unite(i, j);
    }
    const byRoot = new Map();
    for (let i = 0; i < n; i++) { const r = find(i); (byRoot.get(r) || byRoot.set(r, []).get(r)).push(rects[i]); }

    const groups = [], rest = [];
    for (const members of byRoot.values()) {
        if (members.length < 2) { rest.push(...members.map(m => m.id)); continue; }
        const g = _group(members, gap, ext, sw, sh);
        if (g) groups.push(g); else rest.push(...members.map(m => m.id));
    }

    // 2) Ersparnis gegenüber Einzelkonturen (Pierces, Schnittlänge)
    let piercesBefore = 0, lengthBefore = 0, pierces = 0, length = 0, parts = 0;
    for (const g of groups) {
        parts += g.rectIds.length;
        for (const r of g.rects) { piercesBefore += 1; lengthBefore += 2 * ((r.maxX - r.minX) + (r.maxY - r.minY)); }
        pierces += g.cuts.length + 1;
        length += g.cuts.reduce((s, c) => s + Math.hypot(c.b.x - c.a.x, c.b.y - c.a.y), 0)
               + 2 * ((g.bbox.maxX - g.bbox.minX) + (g.bbox.maxY - g.bbox.minY));
    }
    const r3 = v => Math.round(v * 1000) / 1000;
    return {
        groups: groups.map(({ rects: _r, ...g }) => g), rest,
        stats: { groups: groups.length, parts, pierces, piercesBefore, length: r3(length), lengthBefore: r3(lengthBefore),
                 savedPierces: piercesBefore - pierces, savedLength: r3(lengthBefore - length) }
    };
}

/** Eine Gruppe: Guillotine-Zerlegung in Schnittlinien (Hauptschnitte zuerst) + Außenrahmen; null wenn nicht lückenlos. */
function _group(members, gap, ext, sw, sh) {
    const bbox = _bbox(members);
    const cuts = [];
    if (!_split(members, bbox, gap, cuts, 0, bbox)) return null;

    // Anstich außerhalb des Blocks: Platz bis Blechrand reicht? (Schnitte laufen am Blockrand los)
    const availX = Math.min(bbox.minX, sw - bbox.maxX), availY = Math.min(bbox.minY, sh - bbox.maxY);
    const e = Math.min(ext, availX, availY);
    if (e < MIN_EXT) return null;

    const out = _mergeCollinear(cuts, gap).sort((p, q) => p.level - q.level).map(c => {
        // Ende am Gruppenrand: um e verlängert (Anstich/Austritt im Randstreifen); sonst auf der Mittellinie des Nachbarschnitts (T-Stoß)
        const a = { x: c.a.x, y: c.a.y }, b = { x: c.b.x, y: c.b.y };
        const k = c.vertical ? 'y' : 'x';
        a[k] += c.startOutside ? -e : -gap / 2;
        b[k] += c.endOutside ? e : gap / 2;
        return { a, b, level: c.level, vertical: c.vertical };
    });
    const frame = [{ x: bbox.minX, y: bbox.minY }, { x: bbox.maxX, y: bbox.minY }, { x: bbox.maxX, y: bbox.maxY },
                   { x: bbox.minX, y: bbox.maxY }, { x: bbox.minX, y: bbox.minY }];
    return { rectIds: members.map(m => m.id), rects: members, bbox, cuts: out, frame, ext: e };
}

/**
 * Rekursive Guillotine-Zerlegung: sucht eine durchgehende Spaltlinie (vertikal oder horizontal), die kein Rechteck kreuzt
 * und beide Seiten mit gleicher Höhe/Breite wie der Block lässt (Vereinigung = Rechteck, sonst ist der Block nicht lückenlos).
 */
function _split(set, bb, gap, cuts, level, root) {
    if (set.length === 1) return _isBox(set[0], bb);
    for (const vertical of [true, false]) {
        const lo = vertical ? 'minX' : 'minY', hi = vertical ? 'maxX' : 'maxY';
        const olo = vertical ? 'minY' : 'minX', ohi = vertical ? 'maxY' : 'maxX';
        const edges = [...new Set(set.map(r => Math.round(r[hi] * 100) / 100))].sort((a, b) => a - b);
        for (const e of edges) {
            const a = set.filter(r => r[hi] <= e + TOL), b = set.filter(r => r[lo] >= e + gap - TOL);
            if (!a.length || !b.length || a.length + b.length !== set.length) continue;
            if (!set.every(r => r[hi] <= e + TOL || r[lo] >= e + gap - TOL)) continue;
            const ba = _bbox(a), bb2 = _bbox(b);
            if (!near(ba[hi], e) || !near(bb2[lo], e + gap)) continue;
            // Beide Hälften spannen die volle Querausdehnung des Blocks
            if (!near(ba[olo], bb[olo]) || !near(ba[ohi], bb[ohi]) || !near(bb2[olo], bb[olo]) || !near(bb2[ohi], bb[ohi])) continue;
            const mid = e + gap / 2, sub = [];
            if (!_split(a, ba, gap, sub, level + 1, root) || !_split(b, bb2, gap, sub, level + 1, root)) continue;
            const so = near(bb[olo], root[olo]), eo = near(bb[ohi], root[ohi]);   // Linienende liegt am Gruppenrand?
            cuts.push(vertical
                ? { a: { x: mid, y: bb.minY }, b: { x: mid, y: bb.maxY }, vertical, level, startOutside: so, endOutside: eo }
                : { a: { x: bb.minX, y: mid }, b: { x: bb.maxX, y: mid }, vertical, level, startOutside: so, endOutside: eo });
            cuts.push(...sub);
            return true;
        }
    }
    return false;
}

/**
 * Teilschnitte, die auf einer Linie liegen und sich am Hauptschnitt treffen (je Hälfte ein Stück), werden zu EINEM Schnitt
 * zusammengefasst: ein Anstich statt mehrerer. Die Rohlinien enden dort auf der Mittellinie des Nachbarspalts.
 */
function _mergeCollinear(cuts, gap) {
    const out = [];
    for (const vertical of [true, false]) {
        const pk = vertical ? 'x' : 'y', ek = vertical ? 'y' : 'x';
        const list = cuts.filter(c => c.vertical === vertical).sort((p, q) => p.a[pk] - q.a[pk] || p.a[ek] - q.a[ek]);
        const used = new Set();
        for (let i = 0; i < list.length; i++) {
            if (used.has(i)) continue;
            const cur = { ...list[i], a: { ...list[i].a }, b: { ...list[i].b } };
            let grew = true;
            while (grew) {
                grew = false;
                for (let j = 0; j < list.length; j++) {
                    if (used.has(j) || j === i) continue;
                    const o = list[j];
                    if (!near(o.a[pk], cur.a[pk])) continue;
                    // Anschluss: Ende des einen = Anfang des anderen, jeweils auf der Mittellinie des Nachbarspalts (± gap/2)
                    if (near(o.a[ek] - gap / 2, cur.b[ek] + gap / 2) || near(o.a[ek], cur.b[ek])) {
                        cur.b[ek] = o.b[ek]; cur.endOutside = o.endOutside; cur.level = Math.min(cur.level, o.level); used.add(j); grew = true;
                    } else if (near(o.b[ek] + gap / 2, cur.a[ek] - gap / 2) || near(o.b[ek], cur.a[ek])) {
                        cur.a[ek] = o.a[ek]; cur.startOutside = o.startOutside; cur.level = Math.min(cur.level, o.level); used.add(j); grew = true;
                    }
                }
            }
            used.add(i);
            out.push(cur);
        }
    }
    return out;
}

const _isBox = (r, bb) => near(r.minX, bb.minX) && near(r.maxX, bb.maxX) && near(r.minY, bb.minY) && near(r.maxY, bb.maxY);
function _bbox(rs) {
    return { minX: Math.min(...rs.map(r => r.minX)), minY: Math.min(...rs.map(r => r.minY)),
             maxX: Math.max(...rs.map(r => r.maxX)), maxY: Math.max(...rs.map(r => r.maxY)) };
}

const CommonLine = { VERSION, build };
if (typeof module !== 'undefined' && module.exports) module.exports = CommonLine;
if (typeof window !== 'undefined') window.CommonLine = CommonLine;
})();
