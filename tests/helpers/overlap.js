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
module.exports = { overlaps };
