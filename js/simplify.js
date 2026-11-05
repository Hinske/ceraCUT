/**
 * CeraCUT Simplify V1.0 — Konturen vereinfachen (Punktreduktion mit Toleranz)
 *
 * Verfahren: Douglas-Peucker je Kettenabschnitt zwischen "Ankern".
 * Anker (bleiben immer erhalten):
 *   - Startpunkt (Index 0) — Anschnitt/Leads bleiben stabil
 *   - Ecken: Richtungswechsel >= cornerAngle (Standard 25°), damit scharfe Ecken nicht rundgelutscht werden
 * Schutz je Kontur ("smart"):
 *   - Toleranz wird begrenzt auf 0.3 · Abstand zum naechsten Nachbarn (Nachbarn beruehren/ueberlappen sich nie neu)
 *   - Toleranz wird begrenzt auf 0.25 · Konturbreite (schmale Stege kollabieren nicht)
 *   - Ergebnis darf sich nicht selbst schneiden (sonst Toleranz halbieren, max. 4 Versuche, sonst Original)
 *   - mindestens 3 Punkte (geschlossen) bzw. 2 (offen)
 * Ausgenommen: Referenz, Schraffur, exakte Kreise/Boegen (sourceType CIRCLE/ARC), Spline-Rohdaten.
 *
 * Reine Berechnung — aendert keine Kontur. Anwenden macht der Aufrufer (Undo-Command).
 *
 * Last Modified: 2026-11-05
 * Build: 20261105-simp1
 */

const Simplify = (() => {
    'use strict';

    const VERSION = '1.0';
    const PREFIX = `[Simplify V${VERSION}]`;
    const EPS = 1e-9;

    function _dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

    function _distPtSeg(p, a, b) {
        const dx = b.x - a.x, dy = b.y - a.y, l = dx * dx + dy * dy;
        if (l === 0) return _dist(p, a);
        let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / l;
        t = Math.max(0, Math.min(1, t));
        return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
    }

    /** Douglas-Peucker auf pts[i0..i1] (inklusive), liefert Indexliste inkl. i0 und i1. Iterativ (kein Stack-Overflow). */
    function _dp(pts, i0, i1, tol) {
        const keep = new Set([i0, i1]);
        const stack = [[i0, i1]];
        while (stack.length) {
            const [a, b] = stack.pop();
            let maxD = -1, idx = -1;
            for (let i = a + 1; i < b; i++) {
                const d = _distPtSeg(pts[i], pts[a], pts[b]);
                if (d > maxD) { maxD = d; idx = i; }
            }
            if (idx >= 0 && maxD > tol) {
                keep.add(idx);
                stack.push([a, idx], [idx, b]);
            }
        }
        return [...keep].sort((x, y) => x - y);
    }

    function _turnAngleDeg(p0, p1, p2) {
        const ax = p1.x - p0.x, ay = p1.y - p0.y, bx = p2.x - p1.x, by = p2.y - p1.y;
        const la = Math.hypot(ax, ay), lb = Math.hypot(bx, by);
        if (la < EPS || lb < EPS) return 0;
        const c = Math.max(-1, Math.min(1, (ax * bx + ay * by) / (la * lb)));
        return Math.acos(c) * 180 / Math.PI;
    }

    function _segIntersect(a, b, c, d) {
        // echte Kreuzung (ohne Beruehrung an Endpunkten)
        const o = (p, q, r) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
        const o1 = o(a, b, c), o2 = o(a, b, d), o3 = o(c, d, a), o4 = o(c, d, b);
        return ((o1 > EPS && o2 < -EPS) || (o1 < -EPS && o2 > EPS)) &&
               ((o3 > EPS && o4 < -EPS) || (o3 < -EPS && o4 > EPS));
    }

    function _selfIntersects(pts, closed) {
        const n = pts.length, segs = closed ? n : n - 1;
        for (let i = 0; i < segs; i++) {
            const a = pts[i], b = pts[(i + 1) % n];
            for (let j = i + 2; j < segs; j++) {
                if (closed && i === 0 && j === segs - 1) continue;
                const c = pts[j], d = pts[(j + 1) % n];
                if (Math.max(a.x, b.x) < Math.min(c.x, d.x) || Math.max(c.x, d.x) < Math.min(a.x, b.x) ||
                    Math.max(a.y, b.y) < Math.min(c.y, d.y) || Math.max(c.y, d.y) < Math.min(a.y, b.y)) continue;
                if (_segIntersect(a, b, c, d)) return true;
            }
        }
        return false;
    }

    /** Eine Punktliste vereinfachen. Gibt neue Liste (flache Kopien) zurueck. */
    function simplifyPoints(points, tol, closed, cornerAngle) {
        const ang = cornerAngle == null ? 25 : cornerAngle;
        let pts = points.map(p => ({ x: p.x, y: p.y }));
        let dupEnd = false;
        if (closed && pts.length > 3 && _dist(pts[0], pts[pts.length - 1]) < EPS) { pts.pop(); dupEnd = true; }
        const n = pts.length;
        const minPts = closed ? 3 : 2;
        if (n <= minPts || tol <= 0) return points.map(p => ({ x: p.x, y: p.y }));

        // Anker bestimmen
        const anchors = new Set([0]);
        if (!closed) anchors.add(n - 1);
        for (let i = closed ? 0 : 1; i < (closed ? n : n - 1); i++) {
            const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n];
            if (Math.max(_dist(p0, p1), _dist(p1, p2)) <= tol * 2) continue;   // Rauschen, keine echte Ecke
            if (_turnAngleDeg(p0, p1, p2) >= ang) anchors.add(i);
        }
        if (closed && anchors.size < 2) {
            // glatte geschlossene Kontur: zweiten Anker gegenueber (am weitesten von Punkt 0)
            let far = 0, fd = -1;
            for (let i = 1; i < n; i++) { const d = _dist(pts[0], pts[i]); if (d > fd) { fd = d; far = i; } }
            anchors.add(far);
        }
        const A = [...anchors].sort((a, b) => a - b);

        const keep = new Set(A);
        const chains = [];
        for (let k = 0; k < A.length; k++) {
            const a = A[k];
            let b = A[(k + 1) % A.length];
            if (!closed && k === A.length - 1) break;
            chains.push([a, b <= a ? b + n : b]);   // zyklisch: b ueber das Ende hinaus
        }
        for (const [a, b] of chains) {
            const seq = [];
            for (let i = a; i <= b; i++) seq.push(pts[i % n]);
            const idx = _dp(seq, 0, seq.length - 1, tol);
            for (const j of idx) keep.add((a + j) % n);
        }
        let out = [...keep].sort((x, y) => x - y).map(i => ({ x: pts[i].x, y: pts[i].y }));
        if (out.length < minPts) return points.map(p => ({ x: p.x, y: p.y }));
        if (dupEnd) out.push({ x: out[0].x, y: out[0].y });
        return out;
    }

    function _eligible(c) {
        if (!c || !c.points || c.points.length < 4) return false;
        if (c.isReference || c.isHatchContour || c.cuttingMode === 'none') return false;
        const st = (c.sourceType || '').toUpperCase();
        if (st === 'CIRCLE' || st === 'ARC' || st === 'ELLIPSE') return false;
        if (c._splineData || c._fitPoints) return false;
        return true;
    }

    /**
     * @param {Array}  contours
     * @param {number} tol       Toleranz in mm
     * @param {Object} [ctx]     { info: Map<contour,{minGap,width}>, cornerAngle }
     * @returns {{map: Map, before: number, after: number, changed: number, skipped: number}}
     */
    function simplifyContours(contours, tol, ctx) {
        const info = ctx && ctx.info;
        const map = new Map();
        let before = 0, after = 0, changed = 0, skipped = 0;
        for (const c of contours) {
            if (!_eligible(c)) { skipped++; continue; }
            const n0 = c.points.length;
            before += n0;
            let t = tol;
            const f = info && info.get(c);
            if (f) {
                if (isFinite(f.minGap)) t = Math.min(t, f.minGap * 0.3);
                if (f.width > 0) t = Math.min(t, f.width * 0.25);
            }
            let res = c.points;
            for (let attempt = 0; attempt < 4 && t > 0.001; attempt++, t /= 2) {
                const cand = simplifyPoints(c.points, t, !!c.isClosed, ctx && ctx.cornerAngle);
                if (cand.length < n0 && !_selfIntersects(cand, !!c.isClosed)) { res = cand; break; }
                if (cand.length >= n0) break;
            }
            const n1 = res.length;
            after += n1;
            if (n1 < n0) { changed++; map.set(c, { pts: res, before: n0, after: n1, tolUsed: t }); }
        }
        return { map, before, after, changed, skipped };
    }

    return { VERSION, simplifyPoints, simplifyContours };
})();

if (typeof window !== 'undefined') window.Simplify = Simplify;
