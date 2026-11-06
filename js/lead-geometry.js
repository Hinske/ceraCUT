/**
 * CeraCUT Lead Geometry V1.1
 * V1.1: offsetSegment/toolPathIn/toolPathOut — reale Strahlmitte nach G41/G42-Kompensation (nur Anzeige).
 *
 * Reine Geometrie fuer Lead-In / Lead-Out / Ueberschnitt (Fahnen): jeder Lead ist eine
 * lueckenlose Liste ECHTER Segmente (Linie oder Kreisbogen). Keine Polylinien-Metadaten-
 * Doppelhaltung mehr; Tessellierung passiert ausschliesslich in toPolyline().
 *
 * Kein DOM, kein Contour-State, keine Abhaengigkeiten (laeuft im Browser und in Node).
 *
 * Segmente (Koordinaten in mm, Welt-KS, ccw = Welt-CCW = steigender Winkel):
 *   { kind:'line', p0:{x,y}, p1:{x,y} }
 *   { kind:'arc',  p0, p1, center:{x,y}, radius, ccw:boolean, span:rad (>0) }
 *
 * Konventionen (identisch zu cam-contour.js):
 *   tangent = Schneidrichtung am Anschlusspunkt (Einheitsvektor)
 *   normal  = Einheitsvektor zur Abfallseite (dort liegt Pierce bzw. Austritt)
 *   Lead-In  : Segmente laufen Pierce -> join (Anschlusspunkt auf der Kontur)
 *   Lead-Out : Segmente laufen join (Kontur-Austritt) -> Ende
 *
 * Last Modified: 2026-11-06
 * Build: 20261106-toolpath
 */

const LeadGeometry = (() => {
    'use strict';

    const VERSION = '1.1';
    const EPS = 1e-9;
    const TWO_PI = Math.PI * 2;

    // ──────────────────────────────────────────────────────────────
    // Basis
    // ──────────────────────────────────────────────────────────────

    const _pt = (x, y) => ({ x, y });
    const _mod2pi = a => ((a % TWO_PI) + TWO_PI) % TWO_PI;

    function line(p0, p1) {
        return { kind: 'line', p0: _pt(p0.x, p0.y), p1: _pt(p1.x, p1.y) };
    }

    /** Bogen aus Mittelpunkt, Radius, Startwinkel, Spannweite (rad, >0) und Drehsinn. */
    function arc(center, radius, startAngle, span, ccw) {
        const endAngle = ccw ? startAngle + span : startAngle - span;
        return {
            kind: 'arc',
            p0: _pt(center.x + radius * Math.cos(startAngle), center.y + radius * Math.sin(startAngle)),
            p1: _pt(center.x + radius * Math.cos(endAngle), center.y + radius * Math.sin(endAngle)),
            center: _pt(center.x, center.y),
            radius,
            ccw: !!ccw,
            span
        };
    }

    function segLength(s) {
        return s.kind === 'arc' ? s.radius * s.span : Math.hypot(s.p1.x - s.p0.x, s.p1.y - s.p0.y);
    }

    function pathLength(segs) {
        let l = 0;
        for (const s of segs || []) l += segLength(s);
        return l;
    }

    function startAngle(s) { return Math.atan2(s.p0.y - s.center.y, s.p0.x - s.center.x); }
    function endAngle(s)   { return Math.atan2(s.p1.y - s.center.y, s.p1.x - s.center.x); }

    /** Einheitstangente (Laufrichtung) am Anfang bzw. Ende eines Segments. */
    function tangentAt(s, where) {
        if (s.kind === 'line') {
            const dx = s.p1.x - s.p0.x, dy = s.p1.y - s.p0.y;
            const l = Math.hypot(dx, dy) || 1;
            return { x: dx / l, y: dy / l };
        }
        const a = where === 'start' ? startAngle(s) : endAngle(s);
        return s.ccw ? { x: -Math.sin(a), y: Math.cos(a) } : { x: Math.sin(a), y: -Math.cos(a) };
    }

    // ──────────────────────────────────────────────────────────────
    // Lead-In (Pierce -> join)
    // ──────────────────────────────────────────────────────────────

    /** Linearer Einlauf: Winkel zur Kontur (0 = tangential, 90 = senkrecht). */
    function leadInLinear({ join, tangent, normal, angleDeg, length }) {
        const a = angleDeg * Math.PI / 180;
        const ax = normal.x * Math.sin(a) - tangent.x * Math.cos(a);
        const ay = normal.y * Math.sin(a) - tangent.y * Math.cos(a);
        const pierce = _pt(join.x + ax * length, join.y + ay * length);
        return [line(pierce, join)];
    }

    /** Tangentialer Einlauf: gerade entgegen der Schneidrichtung. */
    function leadInTangent({ join, tangent, length }) {
        const pierce = _pt(join.x - tangent.x * length, join.y - tangent.y * length);
        return [line(pierce, join)];
    }

    /**
     * Bogen-Einlauf: Bogen (Spannweite span, Default 90 Grad) tangential in die Kontur,
     * davor optional Gerade, falls length > Bogenlaenge. Bei radius<=0 -> tangentialer Lead.
     */
    function leadInArc({ join, tangent, normal, radius, length, span = Math.PI / 2 }) {
        if (!(radius > 1e-6)) return leadInTangent({ join, tangent, length });
        const center = _pt(join.x + normal.x * radius, join.y + normal.y * radius);
        const entryAngle = Math.atan2(join.y - center.y, join.x - center.x);
        const ccw = (normal.y * tangent.x - normal.x * tangent.y) > 0;
        const a0 = ccw ? entryAngle - span : entryAngle + span;
        const segs = [];
        const lineLen = Math.max(0, length - radius * span);
        const a = arc(center, radius, a0, span, ccw);
        a.p1 = _pt(join.x, join.y); // exakt auf den Anschlusspunkt (keine Rundungsluecke)
        if (lineLen > 0.1) {
            const t = tangentAt(a, 'start');
            segs.push(line(_pt(a.p0.x - t.x * lineLen, a.p0.y - t.y * lineLen), a.p0));
        }
        segs.push(a);
        return segs;
    }

    // ──────────────────────────────────────────────────────────────
    // Lead-Out (join -> Ende)
    // ──────────────────────────────────────────────────────────────

    function leadOutLinear({ join, tangent, normal, angleDeg, length }) {
        const a = angleDeg * Math.PI / 180;
        const dx = normal.x * Math.sin(a) + tangent.x * Math.cos(a);
        const dy = normal.y * Math.sin(a) + tangent.y * Math.cos(a);
        return [line(join, _pt(join.x + dx * length, join.y + dy * length))];
    }

    function leadOutTangent({ join, tangent, length }) {
        return [line(join, _pt(join.x + tangent.x * length, join.y + tangent.y * length))];
    }

    function leadOutArc({ join, tangent, normal, radius, length, span = Math.PI / 2 }) {
        if (!(radius > 1e-6)) return leadOutTangent({ join, tangent, length });
        const center = _pt(join.x + normal.x * radius, join.y + normal.y * radius);
        const exitAngle = Math.atan2(join.y - center.y, join.x - center.x);
        const ccw = (normal.y * tangent.x - normal.x * tangent.y) > 0;
        const a = arc(center, radius, exitAngle, span, ccw);
        a.p0 = _pt(join.x, join.y);
        const segs = [a];
        const lineLen = Math.max(0, length - radius * span);
        if (lineLen > 0.1) {
            const t = tangentAt(a, 'end');
            segs.push(line(a.p1, _pt(a.p1.x + t.x * lineLen, a.p1.y + t.y * lineLen)));
        }
        return segs;
    }

    // ──────────────────────────────────────────────────────────────
    // Kuerzen — Boegen bleiben Boegen
    // ──────────────────────────────────────────────────────────────

    /**
     * Entfernt `dist` mm Weglaenge am Anfang ('start') oder Ende ('end') des Pfads.
     * Lead-In kuerzt man am Pierce-Ende ('start'), Lead-Out am freien Ende ('end').
     * Rueckgabe: neue Segmentliste (Eingabe bleibt unveraendert); [] wenn dist >= Gesamtlaenge.
     */
    function trim(segs, dist, end) {
        if (!(dist > 0)) return segs.map(_cloneSeg);
        const list = end === 'start' ? segs.map(_cloneSeg) : segs.map(_cloneSeg).reverse();
        let remaining = dist;
        const out = [];
        for (let i = 0; i < list.length; i++) {
            const s = list[i];
            const len = segLength(s);
            if (remaining >= len - EPS) { remaining -= len; continue; }
            out.push(remaining > EPS ? _cutSegment(s, remaining, end === 'start') : s);
            remaining = 0;
            for (let j = i + 1; j < list.length; j++) out.push(list[j]);
            break;
        }
        return end === 'start' ? out : out.reverse();
    }

    // Segment s liegt in 'list'-Reihenfolge; `fromStart` = Laufrichtung des Segments?
    // Bei end==='start' wird vorn gekuerzt (Segmentanfang), bei 'end' hinten (Segmentende).
    function _cutSegment(s, d, trimSegmentStart) {
        // In trim() ist fuer end==='end' die Liste umgekehrt, das Segment selbst aber NICHT
        // gedreht -> hier immer am Segmentanfang (start) bzw. -ende (end) kuerzen.
        // Aufrufer-Vertrag: trimSegmentStart === true  -> Segmentanfang kuerzen
        //                   trimSegmentStart === false -> Segmentende kuerzen
        if (s.kind === 'line') {
            const l = segLength(s);
            const f = d / l;
            if (trimSegmentStart) {
                return line(_pt(s.p0.x + (s.p1.x - s.p0.x) * f, s.p0.y + (s.p1.y - s.p0.y) * f), s.p1);
            }
            return line(s.p0, _pt(s.p1.x - (s.p1.x - s.p0.x) * f, s.p1.y - (s.p1.y - s.p0.y) * f));
        }
        const dAng = d / s.radius;
        const newSpan = s.span - dAng;
        if (trimSegmentStart) {
            const a0 = startAngle(s) + (s.ccw ? dAng : -dAng);
            const n = arc(s.center, s.radius, a0, newSpan, s.ccw);
            n.p1 = _pt(s.p1.x, s.p1.y);
            return n;
        }
        const n = arc(s.center, s.radius, startAngle(s), newSpan, s.ccw);
        n.p0 = _pt(s.p0.x, s.p0.y);
        return n;
    }

    function _cloneSeg(s) {
        const c = { ...s, p0: _pt(s.p0.x, s.p0.y), p1: _pt(s.p1.x, s.p1.y) };
        if (s.center) c.center = _pt(s.center.x, s.center.y);
        return c;
    }

    // ──────────────────────────────────────────────────────────────
    // Tessellierung (einzige Stelle) + Validierung
    // ──────────────────────────────────────────────────────────────

    /** Punktliste fuer Kollision/Simulator. tol = max. Sehnenfehler in mm. */
    function toPolyline(segs, tol = 0.01) {
        const pts = [];
        for (const s of segs || []) {
            if (!pts.length) pts.push(_pt(s.p0.x, s.p0.y));
            if (s.kind === 'line') { pts.push(_pt(s.p1.x, s.p1.y)); continue; }
            const maxStep = s.radius > tol ? 2 * Math.acos(1 - tol / s.radius) : Math.PI / 2;
            const n = Math.max(2, Math.ceil(s.span / Math.max(maxStep, 1e-3)));
            const a0 = startAngle(s);
            for (let i = 1; i < n; i++) {
                const a = s.ccw ? a0 + s.span * i / n : a0 - s.span * i / n;
                pts.push(_pt(s.center.x + s.radius * Math.cos(a), s.center.y + s.radius * Math.sin(a)));
            }
            pts.push(_pt(s.p1.x, s.p1.y));
        }
        return pts;
    }

    /** Prueft Lueckenfreiheit und Bogen-Konsistenz. Rueckgabe { ok, errors[] }. */
    function validate(segs, tol = 1e-6) {
        const errors = [];
        if (!Array.isArray(segs) || !segs.length) return { ok: false, errors: ['leer'] };
        segs.forEach((s, i) => {
            const vals = [s.p0?.x, s.p0?.y, s.p1?.x, s.p1?.y];
            if (!vals.every(Number.isFinite)) { errors.push(`seg ${i}: nicht endlich`); return; }
            if (s.kind === 'arc') {
                const r0 = Math.hypot(s.p0.x - s.center.x, s.p0.y - s.center.y);
                const r1 = Math.hypot(s.p1.x - s.center.x, s.p1.y - s.center.y);
                if (Math.abs(r0 - s.radius) > tol * 10 || Math.abs(r1 - s.radius) > tol * 10)
                    errors.push(`seg ${i}: Bogenradius inkonsistent (${r0.toFixed(6)}/${r1.toFixed(6)} vs ${s.radius})`);
                if (!(s.span > 0)) errors.push(`seg ${i}: span <= 0`);
            }
            if (i > 0) {
                const g = Math.hypot(s.p0.x - segs[i - 1].p1.x, s.p0.y - segs[i - 1].p1.y);
                if (g > tol) errors.push(`seg ${i}: Luecke ${g.toExponential(2)} mm`);
            }
        });
        return { ok: errors.length === 0, errors };
    }

    // ──────────────────────────────────────────────────────────────
    // Werkzeugbahn nach Controller-Kompensation (G41/G42)
    // ──────────────────────────────────────────────────────────────

    /**
     * Parallelversatz eines Segments um d (>0) nach links (left=true) oder rechts der Laufrichtung.
     * Linie: verschoben. Bogen: gleicher Mittelpunkt, Radius -d (Mittelpunkt auf der Versatzseite)
     * bzw. +d. Rueckgabe null, wenn der Bogenradius dabei verschwindet.
     */
    function offsetSegment(s, d, left) {
        if (s.kind === 'line') {
            const t = tangentAt(s, 'start');
            const k = left ? 1 : -1;
            const n = { x: -t.y * k, y: t.x * k };
            return line(_pt(s.p0.x + n.x * d, s.p0.y + n.y * d), _pt(s.p1.x + n.x * d, s.p1.y + n.y * d));
        }
        const toward = (s.ccw === !!left);   // CCW-Bogen: Mittelpunkt links; CW-Bogen: rechts
        const r2 = toward ? s.radius - d : s.radius + d;
        if (!(r2 > 1e-6)) return null;
        return arc(s.center, r2, startAngle(s), s.span, s.ccw);
    }

    /**
     * Reale Strahlmitte eines Lead-In unter G41/G42: Anfahrsatz startet unkompensiert am Anschuss
     * und endet auf der kompensierten Bahn (joinOff = versetzter Konturstart); Folgesaetze laufen
     * um d versetzt. Rueckgabe: neue Segmentliste (nicht lueckenlos validiert, nur zur Anzeige).
     */
    function toolPathIn(segs, { d, left, joinOff }) {
        if (!segs || !segs.length) return [];
        const out = [];
        for (const s of segs) {
            const o = offsetSegment(s, d, left);
            if (!o) return segs.map(_cloneSeg);
            out.push(o);
        }
        const last = out.length - 1;
        if (out[0].kind === 'line') out[0].p0 = _pt(segs[0].p0.x, segs[0].p0.y);   // unkompensierter Anfahrpunkt
        if (out[last].kind === 'line' && joinOff) out[last].p1 = _pt(joinOff.x, joinOff.y);
        for (let i = 1; i < out.length; i++) {
            if (out[i].kind === 'line') out[i].p0 = _pt(out[i - 1].p1.x, out[i - 1].p1.y);
        }
        return out;
    }

    /**
     * Reale Strahlmitte eines Lead-Out: startet auf der kompensierten Bahn (exitOff = versetzter
     * Kontur-/Ueberschnitt-Endpunkt), der G40-Satz endet unkompensiert am programmierten Ende.
     */
    function toolPathOut(segs, { d, left, exitOff }) {
        if (!segs || !segs.length) return [];
        const out = [];
        for (const s of segs) {
            const o = offsetSegment(s, d, left);
            if (!o) return segs.map(_cloneSeg);
            out.push(o);
        }
        if (out[0].kind === 'line' && exitOff) out[0].p0 = _pt(exitOff.x, exitOff.y);
        const last = out.length - 1;
        if (out[last].kind === 'line') out[last].p1 = _pt(segs[last].p1.x, segs[last].p1.y);   // G40: unkompensiertes Ende
        for (let i = 1; i < out.length; i++) {
            if (out[i].kind === 'line') out[i].p0 = _pt(out[i - 1].p1.x, out[i - 1].p1.y);
        }
        return out;
    }

    const api = {
        VERSION, line, arc, segLength, pathLength, tangentAt, startAngle, endAngle,
        leadInLinear, leadInTangent, leadInArc,
        leadOutLinear, leadOutTangent, leadOutArc,
        trim, toPolyline, validate, offsetSegment, toolPathIn, toolPathOut
    };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    return api;
})();
