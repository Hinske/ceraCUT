/**
 * CeraCUT Feasibility V1.0 — Strahlbreiten-Check ("Machbarkeit")
 *
 * Prueft geschlossene Konturen gegen die Schnittbreite (Kerf) des Wasserstrahls:
 *   - zu schmal : Konturbreite < Strahlbreite (Loch wird groesser, Insel wird zerstoert)
 *   - zu nah    : Abstand zu einer Nachbarkontur < Strahlbreite (Steg dazwischen verschwindet)
 * Ausserdem: Schachtelungstiefe (gerade = Scheibe, ungerade = Loch) und Auswahl nach Kriterien.
 *
 * Reine Analyse — veraendert keine Geometrie. Ergebnis: Map<CamContour, Info>.
 *
 * Breitenschaetzung: w ≈ 2·Flaeche / Umfang (exakt fuer lange schmale Streifen,
 * bei kompakten Formen eher zu klein = konservativ, d.h. warnt eher zu frueh).
 *
 * Last Modified: 2026-11-05
 * Build: 20261105-feas1
 */

const Feasibility = (() => {
    'use strict';

    const VERSION = '1.0';
    const PREFIX = `[Feasibility V${VERSION}]`;
    const MAX_SAMPLES = 240;   // max. Stuetzpunkte je Kontur fuer Abstandsberechnung

    // ── Geometrie-Helfer ────────────────────────────────────────────────

    function _area(pts) {
        let a = 0;
        for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
            a += (pts[j].x + pts[i].x) * (pts[j].y - pts[i].y);
        }
        return Math.abs(a / 2);
    }

    function _perimeter(pts, closed) {
        let l = 0;
        for (let i = 1; i < pts.length; i++) l += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
        if (closed && pts.length > 2) {
            const f = pts[0], e = pts[pts.length - 1];
            if (Math.hypot(f.x - e.x, f.y - e.y) > 1e-9) l += Math.hypot(f.x - e.x, f.y - e.y);
        }
        return l;
    }

    function _bbox(pts) {
        let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
        for (const p of pts) {
            if (p.x < x0) x0 = p.x; if (p.x > x1) x1 = p.x;
            if (p.y < y0) y0 = p.y; if (p.y > y1) y1 = p.y;
        }
        return { x0, y0, x1, y1 };
    }

    function _inPoly(pt, pts) {
        let c = false;
        for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
            const a = pts[i], b = pts[j];
            if ((a.y > pt.y) !== (b.y > pt.y) &&
                pt.x < (b.x - a.x) * (pt.y - a.y) / (b.y - a.y) + a.x) c = !c;
        }
        return c;
    }

    function _distPtSeg(p, a, b) {
        const dx = b.x - a.x, dy = b.y - a.y, l = dx * dx + dy * dy;
        if (l === 0) return Math.hypot(p.x - a.x, p.y - a.y);
        let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / l;
        t = Math.max(0, Math.min(1, t));
        return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
    }

    function _sample(pts) {
        if (pts.length <= MAX_SAMPLES) return pts;
        const step = pts.length / MAX_SAMPLES, out = [];
        for (let i = 0; i < MAX_SAMPLES; i++) out.push(pts[Math.floor(i * step)]);
        return out;
    }

    /** Kleinster Abstand zwischen zwei Polylinien (Stuetzpunkte gegen Segmente, beidseitig). */
    function _minDist(A, B, limit) {
        let best = Infinity;
        const sa = _sample(A), sb = _sample(B);
        for (const p of sa) {
            for (let i = 0; i < B.length; i++) {
                const d = _distPtSeg(p, B[i], B[(i + 1) % B.length]);
                if (d < best) { best = d; if (best <= limit * 0.02) return best; }
            }
        }
        for (const p of sb) {
            for (let i = 0; i < A.length; i++) {
                const d = _distPtSeg(p, A[i], A[(i + 1) % A.length]);
                if (d < best) { best = d; if (best <= limit * 0.02) return best; }
            }
        }
        return best;
    }

    // ── Analyse ─────────────────────────────────────────────────────────

    /**
     * @param {Array} contours  app.contours
     * @param {number} kerf     Strahlbreite in mm
     * @returns {{map: Map, kerf: number, counts: Object, items: Array}}
     */
    function analyze(contours, kerf) {
        const t0 = (typeof performance !== 'undefined') ? performance.now() : Date.now();
        const list = (contours || []).filter(c =>
            c && c.isClosed && !c.isReference && !c.isHatchContour && c.cuttingMode !== 'none' &&
            c.points && c.points.length >= 3);

        const info = list.map(c => {
            const pts = c.points;
            const area = _area(pts), per = _perimeter(pts, true);
            return {
                contour: c, pts, bb: _bbox(pts), area, perimeter: per,
                width: per > 0 ? 2 * area / per : 0,
                depth: 0, parent: -1, minGap: Infinity, gapTo: -1, narrow: false, close: false
            };
        });

        // Schachtelung: kleinste umschliessende Kontur = Parent
        for (let i = 0; i < info.length; i++) {
            let best = -1;
            for (let j = 0; j < info.length; j++) {
                if (i === j || info[j].area <= info[i].area) continue;
                const a = info[i].bb, b = info[j].bb;
                if (a.x0 < b.x0 || a.y0 < b.y0 || a.x1 > b.x1 || a.y1 > b.y1) continue;
                if (!_inPoly(info[i].pts[0], info[j].pts)) continue;
                if (best < 0 || info[j].area < info[best].area) best = j;
            }
            info[i].parent = best;
        }
        for (let i = 0; i < info.length; i++) {
            let d = 0, k = info[i].parent, guard = 0;
            while (k >= 0 && guard++ < 1000) { d++; k = info[k].parent; }
            info[i].depth = d;
        }

        // Abstaende zwischen benachbarten Konturen (bbox-Vorfilter)
        const reach = Math.max(kerf, 0.01);
        for (let i = 0; i < info.length; i++) {
            for (let j = i + 1; j < info.length; j++) {
                const a = info[i].bb, b = info[j].bb;
                if (a.x1 + reach < b.x0 || b.x1 + reach < a.x0 || a.y1 + reach < b.y0 || b.y1 + reach < a.y0) continue;
                const d = _minDist(info[i].pts, info[j].pts, reach);
                if (d < info[i].minGap) { info[i].minGap = d; info[i].gapTo = j; }
                if (d < info[j].minGap) { info[j].minGap = d; info[j].gapTo = i; }
            }
        }

        const map = new Map();
        const counts = { total: info.length, narrow: 0, close: 0, both: 0, ok: 0 };
        for (const it of info) {
            it.narrow = it.width < kerf;
            it.close = it.minGap < kerf;
            if (it.narrow && it.close) counts.both++;
            else if (it.narrow) counts.narrow++;
            else if (it.close) counts.close++;
            else counts.ok++;
            map.set(it.contour, it);
        }
        const ms = Math.round(((typeof performance !== 'undefined') ? performance.now() : Date.now()) - t0);
        console.debug(`${PREFIX} ${info.length} Konturen, Kerf ${kerf} mm → schmal ${counts.narrow + counts.both}, nah ${counts.close + counts.both}, ok ${counts.ok} (${ms} ms)`);
        return { map, kerf, counts, items: info };
    }

    /**
     * Auswahl nach Kriterien.
     * @param {Object} result   Ergebnis von analyze()
     * @param {Object} crit     { widthLt?, areaLt?, narrow?, close?, depth? }  (alle gesetzten = UND)
     */
    function filter(result, crit) {
        if (!result) return [];
        return result.items.filter(it => {
            if (crit.widthLt != null && !(it.width < crit.widthLt)) return false;
            if (crit.areaLt != null && !(it.area < crit.areaLt)) return false;
            if (crit.narrow && !it.narrow) return false;
            if (crit.close && !it.close) return false;
            if (crit.depth != null && it.depth !== crit.depth) return false;
            return true;
        }).map(it => it.contour);
    }

    /** Scheibe/Loch aus Schachtelung: gerade Tiefe = Scheibe, ungerade = Loch. */
    function classifyByNesting(result) {
        if (!result) return [];
        return result.items.map(it => ({ contour: it.contour, mode: it.depth % 2 === 0 ? 'disc' : 'hole' }));
    }

    return { VERSION, analyze, filter, classifyByNesting };
})();

if (typeof window !== 'undefined') window.Feasibility = Feasibility;
