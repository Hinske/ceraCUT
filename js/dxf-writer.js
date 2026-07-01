/**
 * CeraCUT DXF Writer V1.14
 * V1.14: Fehlender Zeilenumbruch nach EOF-Marker behoben — AutoCAD (R11/R12) wertete
 *        Datei sonst als abgeschnitten und verweigerte das Oeffnen. join('\r\n') liefert
 *        keinen Trailing-Terminator nach der letzten Zeile (EOF) → jetzt ergaenzt.
 * V1.13: Downgrade AC1015 → AC1009 (R12) — eliminiert Handle/Owner/SubclassMarker-
 *        Komplexität, die trotz mehrerer Patches (V1.6–V1.12) immer wieder zu AutoCAD 2017
 *        Crashes geführt hat. R12 kennt keine Handles (5), Owner-Refs (330) oder
 *        SubclassMarker (100) — diese Probleme sind strukturell ausgeschlossen.
 *        SPLINE-Entity existiert in R12 nicht → Splines werden immer als Polyline exportiert.
 *        EXTMIN/EXTMAX werden aus den tatsächlichen Konturen berechnet.
 * V1.12: VERTEX/SEQEND Owner-Handle fix (half nicht — root cause ist AC1015-Komplexität)
 * V1.11: Defense-in-Depth SPLINE Closed-Flag Validierung
 * V1.10: Cache-Staleness-Check vor SPLINE/CIRCLE-Export
 * V1.9: _writeLayerTable defensiv: fehlende Layer-Namen automatisch eintragen
 * V1.8: BLOCK/ENDBLK Owner-Handle fix (half nicht dauerhaft)
 * V1.7: stats.circleFallbacks
 * V1.6: AC1015 mit Handles (erste R2000-Implementierung)
 * V1.5: Downgrade AC1015→AC1009 (damals zu simpel für Splines — jetzt Polyline-Fallback)
 * V1.4: AC1015 ohne Handles (crashte AutoCAD)
 *
 * Unterstützte Entity-Typen (R12):
 * - LINE, POLYLINE/VERTEX/SEQEND, CIRCLE
 * - SPLINE → Polyline-Fallback
 * - ARC → Polyline-Fallback (contour.points ist bereits tesselliert)
 *
 * Encoding: ANSI_1252 (Windows Western) — korrekte Umlaute in Layer-Namen
 *
 * Created: 2026-02-15 MEZ
 * Last Modified: 2026-07-01 MEZ
 * Build: 20260701-eoftrailingnewline
 */

class DXFWriter {

    constructor() {
        this.lines = [];
        this.precision = 6;
    }

    // ═══ ÖFFENTLICHE API ═══

    generate(contours, layerManager, options = {}) {
        this.lines = [];
        const stats = { entities: 0, layers: 0, lines: 0, polylines: 0, circles: 0, arcs: 0, splines: 0, images: 0 };

        // Bounding Box aus tatsächlichen Konturen berechnen
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const c of contours) {
            if (!c.points) continue;
            for (const p of c.points) {
                if (p.x < minX) minX = p.x; if (p.y < minY) minY = p.y;
                if (p.x > maxX) maxX = p.x; if (p.y > maxY) maxY = p.y;
            }
        }
        if (!isFinite(minX)) { minX = 0; minY = 0; maxX = 1000; maxY = 1000; }

        // ── HEADER ──
        this._writeHeader(minX, minY, maxX, maxY);

        // ── TABLES (R12: nur LTYPE + LAYER) ──
        this._writeSectionStart('TABLES');
        this._writeLineTypeTable();
        this._writeLayerTable(layerManager, stats, contours);
        this._writeSectionEnd();

        // ── BLOCKS (leer, aber Pflicht-Sektion in R12) ──
        this._writeSectionStart('BLOCKS');
        this._writeSectionEnd();

        // ── ENTITIES ──
        this._writeSectionStart('ENTITIES');

        for (const contour of contours) {
            if (!contour.points || contour.points.length < 2) continue;
            const layerName = contour.layer || '0';
            if (layerManager && !layerManager.isVisible(layerName)) continue;

            const sourceType = (contour.sourceType || '').toUpperCase();

            if (sourceType === 'CIRCLE' && contour.isClosed) {
                this._writeCircle(contour, stats);
            } else if (contour.points.length === 2 && !contour.isClosed) {
                this._writeLine(contour.points[0], contour.points[1], layerName, stats);
            } else {
                // SPLINE, ARC, POLYLINE, etc. → alle als Polyline (R12 hat kein SPLINE-Entity)
                this._writePolyline(contour, stats);
            }
        }

        if (options.imageUnderlayManager?.underlays?.length > 0) {
            const imgLines = options.imageUnderlayManager.getDXFEntities();
            for (const line of imgLines) this.lines.push(line.trim());
            stats.images = options.imageUnderlayManager.underlays.length;
            stats.entities += stats.images;
        }

        this._writeSectionEnd();

        // ── EOF ──
        this._write(0, 'EOF');

        // Trailing \r\n nach EOF ist Pflicht — ohne diesen Zeilenterminator
        // interpretieren AutoCAD-Reader (R11/R12) die Datei als abgeschnitten
        // und verweigern das Oeffnen (siehe FliesenMeyer_Logo_Entwurf5.dxf).
        const content = this.lines.join('\r\n') + '\r\n';
        return {
            content,
            filename: options.filename || 'export.dxf',
            stats: { ...stats, totalLines: this.lines.length, fileSize: content.length }
        };
    }

    generateDownload(contours, layerManager, options = {}) {
        const result = this.generate(contours, layerManager, options);
        const bytes = this._encodeAnsi1252(result.content);
        const blob = new Blob([bytes], { type: 'application/dxf' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = result.filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        return result;
    }

    _encodeAnsi1252(str) {
        const bytes = new Uint8Array(str.length);
        for (let i = 0; i < str.length; i++) {
            const code = str.charCodeAt(i);
            if (code < 128) {
                bytes[i] = code;
            } else {
                bytes[i] = DXFWriter._ANSI1252_MAP[code] || 0x3F;
            }
        }
        return bytes;
    }

    // ═══ HEADER ═══

    _writeHeader(minX, minY, maxX, maxY) {
        this._writeSectionStart('HEADER');
        this._write(9, '$ACADVER');
        this._write(1, 'AC1009');
        this._write(9, '$EXTMIN');
        this._write(10, this._fmt(minX)); this._write(20, this._fmt(minY)); this._write(30, '0.0');
        this._write(9, '$EXTMAX');
        this._write(10, this._fmt(maxX)); this._write(20, this._fmt(maxY)); this._write(30, '0.0');
        this._write(9, '$INSBASE');
        this._write(10, '0.0'); this._write(20, '0.0'); this._write(30, '0.0');
        this._writeSectionEnd();
    }

    // ═══ TABLES ═══

    _writeLineTypeTable() {
        const ltypes = [
            { name: 'CONTINUOUS', desc: 'Solid line',        count: 0, len: 0,   dashes: [] },
            { name: 'DASHED',     desc: 'Dashed __ __ __',   count: 2, len: 6,   dashes: [4, -2] },
            { name: 'DASHDOT',    desc: 'Dash dot __.__.__', count: 4, len: 8,   dashes: [4, -1, 0, -1] },
            { name: 'DOT',        desc: 'Dot . . . .',       count: 2, len: 2,   dashes: [0, -2] }
        ];
        this._write(0, 'TABLE');
        this._write(2, 'LTYPE');
        this._write(70, ltypes.length.toString());
        for (const lt of ltypes) {
            this._write(0, 'LTYPE');
            this._write(2, lt.name);
            this._write(70, '0');
            this._write(3, lt.desc);
            this._write(72, '65');
            this._write(73, lt.count.toString());
            this._write(40, lt.len.toFixed(1));
            for (const d of lt.dashes) this._write(49, d.toFixed(1));
        }
        this._write(0, 'ENDTAB');
    }

    _writeLayerTable(layerManager, stats, contours) {
        const layers = layerManager ? layerManager.getAllLayers() : [{ name: '0', color: '#ffffff', lineType: 'Continuous' }];

        // Defensiv: Layer die in Konturen referenziert werden aber im Manager fehlen, eintragen
        const knownNames = new Set(layers.map(l => l.name));
        if (contours) {
            for (const contour of contours) {
                const name = contour.layer || '0';
                if (!knownNames.has(name)) {
                    knownNames.add(name);
                    layers.push({ name, color: '#ffffff', lineType: 'Continuous' });
                }
            }
        }

        this._write(0, 'TABLE');
        this._write(2, 'LAYER');
        this._write(70, layers.length.toString());

        for (const layer of layers) {
            this._write(0, 'LAYER');
            this._write(2, layer.name);
            this._write(70, layer.locked ? '4' : '0');
            const aci = (typeof hexToACI === 'function') ? hexToACI(layer.color) : 7;
            this._write(62, aci.toString());
            this._write(6, this._mapLineType(layer.lineType));
            stats.layers++;
        }
        this._write(0, 'ENDTAB');
    }

    // ═══ ENTITIES ═══

    _writeLine(p1, p2, layer, stats) {
        this._write(0, 'LINE');
        this._write(8, layer || '0');
        this._write(10, this._fmt(p1.x));
        this._write(20, this._fmt(p1.y));
        this._write(30, '0.0');
        this._write(11, this._fmt(p2.x));
        this._write(21, this._fmt(p2.y));
        this._write(31, '0.0');
        stats.lines++;
        stats.entities++;
    }

    _writePolyline(contour, stats) {
        const layer = contour.layer || '0';
        const isClosed = contour.isClosed;
        const points = contour.points;

        let count = points.length;
        if (isClosed && points.length > 1) {
            const first = points[0], last = points[points.length - 1];
            if (Math.abs(first.x - last.x) < 0.001 && Math.abs(first.y - last.y) < 0.001) {
                count = points.length - 1;
            }
        }

        this._write(0, 'POLYLINE');
        this._write(8, layer);
        this._write(66, '1');
        this._write(70, isClosed ? '1' : '0');

        for (let i = 0; i < count; i++) {
            this._write(0, 'VERTEX');
            this._write(8, layer);
            this._write(10, this._fmt(points[i].x));
            this._write(20, this._fmt(points[i].y));
            this._write(30, '0.0');
            if (points[i].bulge) {
                this._write(42, this._fmt(points[i].bulge));
            }
        }

        this._write(0, 'SEQEND');
        this._write(8, layer);
        stats.polylines++;
        stats.entities++;
    }

    _writeCircle(contour, stats) {
        const layer = contour.layer || '0';
        let cx, cy, radius;

        if (contour._center && contour._radius && !this._isCacheStale(contour.points, [contour._center])) {
            cx = contour._center.x;
            cy = contour._center.y;
            radius = contour._radius;
        } else {
            const fit = this._fitCircle(contour.points);
            if (fit) { cx = fit.cx; cy = fit.cy; radius = fit.radius; }
            else {
                console.warn('[DXF-Writer V1.14] Kreis-Validierung fehlgeschlagen → Polyline');
                stats.circleFallbacks = (stats.circleFallbacks || 0) + 1;
                this._writePolyline(contour, stats);
                return;
            }
        }

        this._write(0, 'CIRCLE');
        this._write(8, layer);
        this._write(10, this._fmt(cx));
        this._write(20, this._fmt(cy));
        this._write(30, '0.0');
        this._write(40, this._fmt(radius));
        stats.circles++;
        stats.entities++;
    }

    // ═══ HELFER ═══

    _isCacheStale(points, rawPoints) {
        if (!points || points.length === 0 || !rawPoints || rawPoints.length === 0) return true;
        const pb = this._bbox(points);
        const rb = this._bbox(rawPoints);
        const pCenterX = (pb.minX + pb.maxX) / 2, pCenterY = (pb.minY + pb.maxY) / 2;
        const rCenterX = (rb.minX + rb.maxX) / 2, rCenterY = (rb.minY + rb.maxY) / 2;
        const diag = Math.hypot(pb.maxX - pb.minX, pb.maxY - pb.minY);
        const tolerance = Math.max(5, diag);
        return Math.hypot(pCenterX - rCenterX, pCenterY - rCenterY) > tolerance;
    }

    _bbox(points) {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const p of points) {
            if (p.x < minX) minX = p.x; if (p.y < minY) minY = p.y;
            if (p.x > maxX) maxX = p.x; if (p.y > maxY) maxY = p.y;
        }
        return { minX, minY, maxX, maxY };
    }

    _fitCircle(points) {
        if (!points || points.length < 3) return null;
        const n = points.length;
        const p1 = points[0], p2 = points[Math.floor(n / 3)], p3 = points[Math.floor(2 * n / 3)];
        const ax = p1.x, ay = p1.y, bx = p2.x, by = p2.y, cx = p3.x, cy = p3.y;
        const D = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by));
        if (Math.abs(D) < 1e-10) return null;
        const ux = ((ax*ax+ay*ay)*(by-cy)+(bx*bx+by*by)*(cy-ay)+(cx*cx+cy*cy)*(ay-by)) / D;
        const uy = ((ax*ax+ay*ay)*(cx-bx)+(bx*bx+by*by)*(ax-cx)+(cx*cx+cy*cy)*(bx-ax)) / D;
        const r = Math.hypot(p1.x - ux, p1.y - uy);
        if (r < 1e-10) return null;
        const tol = r * 0.01;
        for (const p of points) {
            if (Math.abs(Math.hypot(p.x - ux, p.y - uy) - r) > tol) return null;
        }
        return { cx: ux, cy: uy, radius: r };
    }

    _writeSectionStart(name) { this._write(0, 'SECTION'); this._write(2, name); }
    _writeSectionEnd() { this._write(0, 'ENDSEC'); }
    _write(gc, val) { this.lines.push(gc.toString()); this.lines.push(val.toString()); }
    _fmt(num) { return Number(num).toFixed(this.precision); }

    _mapLineType(lineType) {
        switch ((lineType || '').toLowerCase()) {
            case 'dashed':  return 'DASHED';
            case 'dashdot': return 'DASHDOT';
            case 'dotted': case 'dot': return 'DOT';
            default: return 'CONTINUOUS';
        }
    }
}

// Unicode → ANSI_1252 Mapping
DXFWriter._ANSI1252_MAP = {
    0xC4: 0xC4, 0xD6: 0xD6, 0xDC: 0xDC,  // Ä Ö Ü
    0xE4: 0xE4, 0xF6: 0xF6, 0xFC: 0xFC,  // ä ö ü
    0xDF: 0xDF, 0xB0: 0xB0, 0xB5: 0xB5,  // ß ° µ
    0xD8: 0xD8, 0xF8: 0xF8,               // Ø ø
    0xC9: 0xC9, 0xE9: 0xE9, 0xE8: 0xE8, 0xEA: 0xEA, 0xE0: 0xE0, 0xE2: 0xE2,
    0x2013: 0x96, 0x2014: 0x97,            // – —
    0x2018: 0x91, 0x2019: 0x92, 0x201C: 0x93, 0x201D: 0x94, // '' ""
    0x20AC: 0x80,                           // €
};
