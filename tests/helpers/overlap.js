'use strict';
// Brute-Force: zählt Überlappungen (Kantenschnitt oder Umschließung) zwischen Konturen VERSCHIEDENER Instanzen.
const segs = P => P.map((p, k) => [p, P[(k + 1) % P.length]]);
const orient = (p, q, r) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
const cross = (a, b, c, d) => orient(a, b, c) * orient(a, b, d) < 0 && orient(c, d, a) * orient(c, d, b) < 0;
const inPoly = (pt, P) => { let ins = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) if ((P[i].y > pt.y) !== (P[j].y > pt.y) && pt.x < (P[j].x - P[i].x) * (pt.y - P[i].y) / (P[j].y - P[i].y) + P[i].x) ins = !ins; return ins; };
const bb = P => ({ x0: Math.min(...P.map(p => p.x)), x1: Math.max(...P.map(p => p.x)), y0: Math.min(...P.map(p => p.y)), y1: Math.max(...P.map(p => p.y)) });

/** @param {Array<Array<{role,closed,points}>>} instances  Konturen je Instanz;  @param {number[]} [sheets] Blechindex je Instanz (Instanzen auf verschiedenen Blechen dürfen sich decken) */
function overlaps(instances, sheets) {
    let n = 0;
    const closed = instances.map(cs => cs.filter(c => c.closed).map(c => ({ pts: c.points, box: bb(c.points) })));
    for (let i = 0; i < closed.length; i++) for (let j = i + 1; j < closed.length; j++) {
        if (sheets && sheets[i] !== sheets[j]) continue;
        for (const A of closed[i]) for (const B of closed[j]) {
            if (A.box.x1 < B.box.x0 || B.box.x1 < A.box.x0 || A.box.y1 < B.box.y0 || B.box.y1 < A.box.y0) continue;
            let hit = false;
            for (const [a1, a2] of segs(A.pts)) { for (const [b1, b2] of segs(B.pts)) if (cross(a1, a2, b1, b2)) { hit = true; break; } if (hit) break; }
            if (!hit && (inPoly(A.pts[0], B.pts) || inPoly(B.pts[0], A.pts))) hit = true;
            if (hit) n++;
        }
    }
    return n;
}
const sd = (p, a, b) => { const dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy; let t = l2 ? ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2 : 0; t = Math.max(0, Math.min(1, t)); return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy); };
const minDist = (A, B) => { let m = Infinity; for (const [P, Q] of [[A, B], [B, A]]) for (const p of P) for (let j = 0; j < Q.length; j++) m = Math.min(m, sd(p, Q[j], Q[(j + 1) % Q.length])); return m; };

/** Je Instanz der Abstand der Außenkonturen (role 'disc') zum nächsten Nachbarn auf demselben Blech (nur Nachbarn im Umkreis `radius`). */
function nearestGaps(instances, sheets, radius = 40) {
    const discs = instances.map(cs => cs.filter(c => c.closed && c.role === 'disc').map(c => ({ pts: c.points, box: bb(c.points) })));
    return discs.map((A, i) => {
        let best = Infinity;
        discs.forEach((B, j) => {
            if (i === j || (sheets && sheets[i] !== sheets[j])) return;
            for (const a of A) for (const b of B) {
                if (a.box.x1 + radius < b.box.x0 || b.box.x1 + radius < a.box.x0 || a.box.y1 + radius < b.box.y0 || b.box.y1 + radius < a.box.y0) continue;
                best = Math.min(best, minDist(a.pts, b.pts));
            }
        });
        return best;
    }).filter(Number.isFinite);
}
module.exports = { overlaps, nearestGaps };
