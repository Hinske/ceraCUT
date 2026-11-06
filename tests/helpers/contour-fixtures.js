'use strict';
// Node-Harness: laedt CamContour (Browser-Globals bereitstellen) und liefert Test-Szenarien.
const path = require('path');
global.Geometry = require(path.join(__dirname, '../../js/geometry.js')).Geometry;
try { global.LeadGeometry = require(path.join(__dirname, '../../js/lead-geometry.js')); } catch (e) { /* optional */ }
const CamContour = require(path.join(__dirname, '../../js/cam-contour.js'));

const rect = (x, y, w, h, ccw = true) => {
    const p = [{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }, { x, y }];
    return ccw ? p : p.slice().reverse();
};
const circle = (cx, cy, r, n = 72, ccw = true) => {
    const p = [];
    for (let i = 0; i <= n; i++) {
        const a = (ccw ? 1 : -1) * 2 * Math.PI * i / n;
        p.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
    }
    p[p.length - 1] = { ...p[0] };
    return p;
};
const lshape = (ccw = true) => {
    const p = [{ x: 0, y: 0 }, { x: 80, y: 0 }, { x: 80, y: 30 }, { x: 30, y: 30 }, { x: 30, y: 80 }, { x: 0, y: 80 }, { x: 0, y: 0 }];
    return ccw ? p : p.slice().reverse();
};
const rotateStart = (pts, k) => { const c = pts.slice(0, -1); const r = c.slice(k).concat(c.slice(0, k)); r.push({ ...r[0] }); return r; };

const SHAPES = {
    rectCCW:  { pts: rect(0, 0, 100, 60, true),  mode: 'disc' },
    rectCW:   { pts: rect(0, 0, 100, 60, false), mode: 'disc' },
    rectStart2: { pts: rotateStart(rect(0, 0, 100, 60, true), 2), mode: 'disc' },
    rectHole: { pts: rect(10, 10, 40, 25, true), mode: 'hole' },
    circDisc: { pts: circle(0, 0, 30), mode: 'disc' },
    circDiscCW: { pts: circle(0, 0, 30, 72, false), mode: 'disc' },
    circHole: { pts: circle(0, 0, 15), mode: 'hole' },
    smallHole: { pts: circle(0, 0, 3), mode: 'hole' },
    lDisc:    { pts: lshape(true), mode: 'disc' },
    lDiscCW:  { pts: lshape(false), mode: 'disc' },
    lHole:    { pts: lshape(true).map(p => ({ x: p.x * 0.5 + 5, y: p.y * 0.5 + 5 })), mode: 'hole' },
    slotNarrow: { pts: rect(0, 0, 60, 4, true), mode: 'hole' },
    slotNarrowDisc: { pts: rect(0, 0, 60, 4, true), mode: 'disc' },
};

const LEADS = {
    arcDefault:   {},
    arcR3L8:      { leadInType: 'arc', leadInRadius: 3, leadInLength: 8, leadOutType: 'arc', leadOutRadius: 3, leadOutLength: 8 },
    arcL2:        { leadInType: 'arc', leadInRadius: 2, leadInLength: 2, leadOutType: 'arc', leadOutRadius: 2, leadOutLength: 2 },
    arcR0:        { leadInType: 'arc', leadInRadius: 0, leadInLength: 4, leadOutType: 'arc', leadOutRadius: 0, leadOutLength: 4 },
    linear45:     { leadInType: 'linear', leadInLength: 5, leadInAngle: 45, leadOutType: 'linear', leadOutLength: 5, leadOutAngle: 45 },
    linear20:     { leadInType: 'linear', leadInLength: 6, leadInAngle: 20, leadOutType: 'linear', leadOutLength: 6, leadOutAngle: 20 },
    linear90:     { leadInType: 'linear', leadInLength: 4, leadInAngle: 90, leadOutType: 'linear', leadOutLength: 4, leadOutAngle: 90 },
    tangent:      { leadInType: 'tangent', leadInLength: 6, leadOutType: 'tangent', leadOutLength: 6 },
    onGeometry:   { leadInType: 'on_geometry', leadOutType: 'on_geometry' },
    mixed:        { leadInType: 'arc', leadInLength: 6, leadInRadius: 2, leadOutType: 'linear', leadOutLength: 3, leadOutAngle: 30 },
    overcutPos:   { overcutLength: 2.5 },
    overcutNeg:   { overcutLength: -1.5 },
    overcutZero:  { overcutLength: 0 },
    dynamic:      { leadInDynamic: true, leadInLength: 10 },
    cornerArcDeg: { leadInType: 'arc', cornerLeadType: 'tangent', cornerLeadAngle: 0 },
    // Ecken-Degradierung aus (cornerDegradeThreshold 999): erzwingt echte Arc-Leads fuer die Golden-Tests
    // (siehe Befund _isAtCorner: im Default degradiert JEDER Arc zu linear)
    arcNoDeg:     { cornerDegradeThreshold: 999 },
    arcNoDegR3L8: { cornerDegradeThreshold: 999, leadInType: 'arc', leadInRadius: 3, leadInLength: 8, leadOutType: 'arc', leadOutRadius: 3, leadOutLength: 8 },
    arcNoDegL12:  { cornerDegradeThreshold: 999, leadInType: 'arc', leadInRadius: 2, leadInLength: 12, leadOutType: 'arc', leadOutRadius: 2, leadOutLength: 12 },
    arcNoDegBig:  { cornerDegradeThreshold: 999, leadInType: 'arc', leadInRadius: 12, leadInLength: 20, leadOutType: 'arc', leadOutRadius: 12, leadOutLength: 20 },
    arcNoDegDyn:  { cornerDegradeThreshold: 999, leadInDynamic: true, leadInLength: 10 },
    long:         { leadInLength: 30, leadOutLength: 30, leadInRadius: 8, leadOutRadius: 8 },
};

function buildScenarios() {
    const out = [];
    for (const [sn, s] of Object.entries(SHAPES)) {
        for (const [ln, l] of Object.entries(LEADS)) {
            out.push({
                name: `${sn}/${ln}`,
                make: () => new CamContour(s.pts.map(p => ({ ...p })), { name: `${sn}/${ln}`, cuttingMode: s.mode, kerfWidth: 0.8, isClosed: true, ...l })
            });
        }
    }
    return out;
}

/** Zwei dicht benachbarte Konturen -> checkMultiContourCollision (Rotieren/Dog-Leg/Kuerzen) */
function buildMultiScenarios() {
    const mk = (gap, extra = {}) => () => {
        const a = new CamContour(rect(0, 0, 30, 30), { name: 'A', cuttingMode: 'disc', kerfWidth: 0.8, isClosed: true, leadInLength: 6, leadOutLength: 6, ...extra });
        const b = new CamContour(rect(30 + gap, 0, 30, 30), { name: 'B', cuttingMode: 'disc', kerfWidth: 0.8, isClosed: true, leadInLength: 6, leadOutLength: 6, ...extra });
        const c = new CamContour(rect(0, 30 + gap, 30, 30), { name: 'C', cuttingMode: 'disc', kerfWidth: 0.8, isClosed: true, leadInLength: 6, leadOutLength: 6, ...extra });
        return [a, b, c];
    };
    return [{ name: 'multi/gap1', make: mk(1) }, { name: 'multi/gap3', make: mk(3) }, { name: 'multi/gap8', make: mk(8) },
        { name: 'multiArc/gap1', make: mk(1, { cornerDegradeThreshold: 999, leadInRadius: 3 }) },
        { name: 'multiArc/gap3', make: mk(3, { cornerDegradeThreshold: 999, leadInRadius: 3 }) },
        { name: 'multiArc/gap8', make: mk(8, { cornerDegradeThreshold: 999, leadInRadius: 3 }) }];
}

// Normalisiert ein Lead-Objekt zu vergleichbaren Daten
function snapshot(lp) {
    if (!lp) return null;
    const pts = lp.points ? lp.points.map(p => ({ x: +p.x.toFixed(6), y: +p.y.toFixed(6) })) : [];
    return {
        type: lp.type || null,
        shortened: !!lp.shortened, isRotated: !!lp.isRotated, isAlternative: !!lp.isAlternative,
        isFallbackCenterPierce: !!lp.isFallbackCenterPierce, isFallbackCenterExit: !!lp.isFallbackCenterExit,
        points: pts,
        arc: lp.arcCenter ? { c: lp.arcCenter, r: lp.arcRadius, ccw: lp.arcSweepCCW, a0: lp.arcStartAngle, a1: lp.arcEndAngle } : null
    };
}
function snapshotContour(c) {
    return { leadIn: snapshot(c.getLeadInPath()), leadOut: snapshot(c.getLeadOutPath()), overcut: snapshot(c.getOvercutPath()) };
}

module.exports = { CamContour, buildScenarios, buildMultiScenarios, snapshotContour, rect, circle };
