/**
 * CeraCUT V2.16 Constants
 * V2.16: TOOL_TOOLTIPS — ausfuehrliche Beschreibungen der 7 CAM-Tools (Hover-Tooltip)
 * V2.15: TOOL_TOOLTIPS — VERB (Verband), AUSS (Ausschnitte)
 * V2.14: TOOL_TOOLTIPS — Zuschnitt-Generator (MOSW Mosaik-Wuerfel, MOSR Rechteck, MOSS Sockel)
 * V2.13: GENERAL_SHORTCUTS — Strg+Shift+P Bereich drucken
 * V2.12: GENERAL_SHORTCUTS — F9/F10/F11 + Shift-Ortho-Override
 * Blaues Farbschema
 * V2.10: TOOL_ECHO_NAMES — AutoCAD-Style Command-Echo-Tabelle (_LINE, _CIRCLE, ...)
 * V2.9: TOOL_TOOLTIPS — alle 7 CAM-Tools (EF, REP, AN, BT, PJ, VZ, HULL) eingetragen
 * V2.8: INTARSIA_MATERIALS — 5 Materialgruppen mit Farben
 * Build: 20261105-verband
 * V2.11: Fix — Code-Review 2026-11-04 (tasks/code-review-2026-11-04.md)
 */

const CeraCUT = {
    VERSION: '2.7.0',
    BUILD: '2026-01-27',
    NAME: 'CeraCUT Wasserstrahl-CAM',

    // Toleranzen (in mm)
    TOLERANCES: {
        SNAP: 0.001,
        CHAIN: 0.1,
        CLOSE: 0.01,
        MIN_SEGMENT: 1.0,
        AUTO_CLOSE: 0.5,
        MEASURE_SNAP: 5.0
    },

    // Farben - CeraCUT Blau
    COLORS: {
        // Hintergrund
        BG_PRIMARY: '#0f0f1a',
        BG_SECONDARY: '#16213e',
        BG_CARD: '#1f2940',
        BG_HOVER: '#2a3a5c',
        
        // Akzent
        ACCENT: '#00aaff',
        ACCENT_HOVER: '#0095e6',
        ACCENT_GLOW: 'rgba(0, 170, 255, 0.5)',
        
        // Status
        SUCCESS: '#22c55e',
        WARNING: '#f59e0b',
        DANGER: '#ef4444',
        
        // Borders
        BORDER: '#2d3748',
        BORDER_ACTIVE: '#00aaff',

        // Geometrie
        ORIGINAL: '#FFFFFF',
        KERF: '#FF3333',
        LEAD_IN: '#CC00FF',
        LEAD_OUT: '#CC00FF',
        REFERENCE: '#888888',
        SELECTED: '#00aaff',

        // Messwerkzeug
        MEASUREMENT: '#00FFFF',
        MEASUREMENT_TEXT: '#FFFFFF',
        SNAP: '#FFFF00',
        NULL_POINT: '#00ff88',

        // Text
        TEXT_PRIMARY: '#FFFFFF',
        TEXT_SECONDARY: '#94a3b8',
        TEXT_MUTED: '#64748b',
        
        // Qualität
        Q1: '#22c55e',
        Q2: '#3b82f6',
        Q3: '#f59e0b',
        Q4: '#ef4444',
        Q5: '#a855f7'
    },

    // Rendering
    RENDER: {
        CIRCLE_SEGMENTS: 32,
        ARC_SEGMENTS: 16,
        LINE_JOIN: 'round',
        LINE_CAP: 'round'
    },

    // Defaults
    DEFAULTS: {
        KERF_WIDTH: 0.8,
        LEAD_IN_LENGTH: 3.0,
        LEAD_OUT_LENGTH: 2.0,
        LEAD_ANGLE: 45,
        LEAD_RADIUS: 2.0,
        OVERCUT: 1.0,
        QUALITY: 2
    },

    // Limits
    LIMITS: {
        NORMALIZATION_THRESHOLD: 1000000,
        MIN_AREA: 0.01,
        MAX_ZOOM: 1000,
        MIN_ZOOM: 0.01
    },

    // V2.8: Intarsien-Materialgruppen
    INTARSIA_MATERIALS: [
        { id: 0, name: 'Material A', color: '#ff8c00' },
        { id: 1, name: 'Material B', color: '#2196f3' },
        { id: 2, name: 'Material C', color: '#4caf50' },
        { id: 3, name: 'Material D', color: '#9c27b0' },
        { id: 4, name: 'Material E', color: '#f44336' }
    ]
};

// ═══════════════════════════════════════════════════════════════
// TOOL TOOLTIPS — Zentrale Registry fuer data-tip + Shortcut-Dialog
// Pflege: Neue Tools hier eintragen, Rest passiert automatisch.
// Format: { label, tip, shortcut, group }
// ═══════════════════════════════════════════════════════════════

const TOOL_TOOLTIPS = {
    // ── Zeichnen ──
    'L':     { label: 'Linie',      tip: 'Linie zeichnen',                          shortcut: 'L',     group: 'draw' },
    'C':     { label: 'Kreis',      tip: 'Kreis zeichnen (Mittelpunkt + Radius)',    shortcut: 'C',     group: 'draw' },
    'A':     { label: 'Bogen',      tip: 'Kreisbogen zeichnen (3 Punkte)',           shortcut: 'A',     group: 'draw' },
    'N':     { label: 'Rechteck',   tip: 'Rechteck zeichnen (2 Eckpunkte)',          shortcut: 'N',     group: 'draw' },
    'P':     { label: 'Polylinie',  tip: 'Polylinie (Linienzug)',                    shortcut: 'P',     group: 'draw' },
    'NG':    { label: 'N-Eck',      tip: 'Regelmaessiges Vieleck',                   shortcut: 'NG',    group: 'draw' },
    'OB':    { label: 'Langloch',   tip: 'Langloch / Overlap Break',                 shortcut: 'OB',    group: 'draw' },
    'AB':    { label: 'Arabeske',   tip: 'Arabeske (Laternenfliese)',                shortcut: 'AB',    group: 'draw' },
    'EL':    { label: 'Ellipse',    tip: 'Ellipse zeichnen',                         shortcut: 'EL',    group: 'draw' },
    'SP':    { label: 'Spline',     tip: 'Freiform-Kurve (Spline)',                  shortcut: 'SP',    group: 'draw' },
    'DO':    { label: 'Donut',      tip: 'Ring / Donut',                             shortcut: 'DO',    group: 'draw' },
    'TX':    { label: 'Text',       tip: 'Text als schneidbare Konturen',            shortcut: 'TX',    group: 'draw' },
    'HT':    { label: 'Schraffur',  tip: 'Flaeche fuellen / schraffieren (Solid, Linien, Kreuz, Punkte)', shortcut: 'HT', group: 'draw' },

    // ── Bearbeiten ──
    'M':     { label: 'Verschieben', tip: 'Objekte verschieben',                     shortcut: 'M',     group: 'edit' },
    'CO':    { label: 'Kopieren',    tip: 'Objekte kopieren',                        shortcut: 'CO',    group: 'edit' },
    'RO':    { label: 'Drehen',      tip: 'Objekte drehen',                          shortcut: 'RO',    group: 'edit' },
    'MI':    { label: 'Spiegeln',    tip: 'Objekte spiegeln',                        shortcut: 'MI',    group: 'edit' },
    'SC':    { label: 'Skalieren',   tip: 'Objekte vergroessern/verkleinern',        shortcut: 'SC',    group: 'edit' },
    'AR':    { label: 'Reihe',       tip: 'Objekte in Reihe/Raster kopieren',        shortcut: 'AR',    group: 'edit' },
    'O':     { label: 'Versetzen',   tip: 'Parallele Kopie mit Abstand',             shortcut: 'O',     group: 'edit' },
    'E':     { label: 'Loeschen',    tip: 'Selektierte Objekte loeschen',            shortcut: 'E / Entf', group: 'edit' },
    'F':     { label: 'Abrunden',    tip: 'Ecke zweier Linien verrunden',            shortcut: 'F',     group: 'edit' },
    'CH':    { label: 'Fase',        tip: 'Ecke abschraegen',                        shortcut: 'CH',    group: 'edit' },
    'T':     { label: 'Stutzen',     tip: 'Linie an Schnittpunkt abschneiden',       shortcut: 'T',     group: 'edit' },
    'EX':    { label: 'Dehnen',      tip: 'Linie bis zur naechsten Kante dehnen',    shortcut: 'EX',    group: 'edit' },
    'X':     { label: 'Explode',     tip: 'Konturen in Einzelteile zerlegen',        shortcut: 'X',     group: 'edit' },
    'J':     { label: 'Join',        tip: 'Linien zu einer Kontur verbinden',        shortcut: 'J',     group: 'edit' },
    'B':     { label: 'Brechen',     tip: 'Kontur an einem Punkt teilen',            shortcut: 'B',     group: 'edit' },
    'BO':    { label: 'Boolesch',    tip: 'Formen verschmelzen/subtrahieren',        shortcut: 'BO',    group: 'edit' },
    'BP':    { label: 'Boundary',    tip: 'Umgrenzung aus kreuzenden Konturen erkennen', shortcut: 'BP', group: 'edit' },
    'CLDCL': { label: 'Aufteilen',   tip: 'Kontur gleichmaessig aufteilen',          shortcut: 'CLDCL', group: 'edit' },
    'OK':    { label: 'Overkill',    tip: 'Duplikate und ueberlappende Linien entfernen', shortcut: 'OK', group: 'edit' },

    // ── CAM / Analyse ──
    'EF':    { label: 'Edgefix',     tip: "Edgefix – Abschnitt durch Bogen/Linie ersetzen\n1) Kontur, 2) Punkt A, 3) Punkt B, 4) Punkt C (Bogenseite).\nB auf einer anderen offenen Kontur: beide werden verbunden.", shortcut: 'EF',  group: 'cam' },
    'REP':   { label: 'Replace',     tip: "Replace – Konturen austauschen\nErst Quell-Kontur, dann Ziele anklicken, Enter.\nZiele erhalten die Form der Quelle (am Flächenschwerpunkt).",     shortcut: 'REP',   group: 'cam' },
    'AN':    { label: 'Analyze',     tip: "Analyze – Geometrie prüfen\nMarkiert Lücken (rot) und Überlappungen (gelb).\nAuswahl oder Enter = alle. Ändert nichts.",            shortcut: 'AN',    group: 'cam' },
    'BT':    { label: 'Boundary Trim', tip: "Boundary Trim – innerhalb/außerhalb löschen\nGeschlossene Grenze anklicken: Konturen komplett innen werden gelöscht.\nShift = außen löschen. Kreuzende bleiben.", shortcut: 'BT', group: 'cam' },
    'PJ':    { label: 'Poly Joint',  tip: "Poly Joint – verbinden oder teilen\nA und B auf zwei Konturen: Join mit Steg (Breite).\nA und B auf einer Kontur: Split in zwei geschlossene Konturen.", shortcut: 'PJ', group: 'cam' },
    'VZ':    { label: 'Vectorize',   tip: "Vectorize – Punkte reduzieren\nToleranz eingeben, Konturen wählen, Enter.\nEcken und Startpunkt bleiben, Abweichung max. Toleranz.", shortcut: 'VZ',    group: 'cam' },
    'HULL':  { label: 'Convex Hull', tip: "Convex Hull – Hüllkontur\nErzeugt eine konvexe Hülle um die gewählten Konturen als neue Kontur. Originale bleiben.",        shortcut: 'HULL',  group: 'cam' },
    'MOSW':  { label: 'Zuschnitt Mosaik Wuerfel',  tip: 'Zuschnitt-Programm Mosaik Wuerfel aus Fliese + Wuerfelmass (+0,8 mm Aufmass)', shortcut: 'MOSW', group: 'cam' },
    'MOSR':  { label: 'Zuschnitt Rechteck', tip: 'Zuschnitt-Programm Rechteck mit Verschnittpruefung, Dekor, Mischlage',   shortcut: 'MOSR', group: 'cam' },
    'FLI':   { label: 'Fliesen-Raster',     tip: 'Raster aus Fliesen (je 4 zusammenhaengende Linien, Layer Fliese) mit Fuge, Nummerierung (Layer Beschriftung) und Maserungspfeil (Layer Konstruktion), beide nicht geschnitten', shortcut: 'FLI', group: 'cam' },
    'VERB':  { label: 'Verband',            tip: 'Verlegemuster auf Wand: Laeufer 1/2, Drittel, Viertel, Gitter, diagonal; Randzuschnitte + Stueckliste', shortcut: 'VERB', group: 'cam' },
    'AUSS':  { label: 'Ausschnitte',        tip: 'Ausschnitte in Fliese: Steckdose, Rohr, Ecke, Randkerbe, eckiges Loch (mit Stegpruefung)', shortcut: 'AUSS', group: 'cam' },
    'MOSS':  { label: 'Zuschnitt Sockel',   tip: 'Sockel-Zuschnitt: Streifen ueber volle Fliesenseite, Raster Hoehe + 0,8 mm', shortcut: 'MOSS', group: 'cam' },
};

// V1.0: AutoCAD-Style Command-Echo (Unterstrich-Praefix in Command-Line, z.B. "_LINE")
const TOOL_ECHO_NAMES = {
    L: 'LINE', C: 'CIRCLE', A: 'ARC', N: 'RECTANG', P: 'PLINE',
    NG: 'POLYGON', OB: 'OBREAK', AB: 'ARABESQUE', EL: 'ELLIPSE',
    SP: 'SPLINE', DO: 'DONUT', TX: 'TEXT', H: 'HATCH',
    M: 'MOVE', CO: 'COPY', RO: 'ROTATE', MI: 'MIRROR', SC: 'SCALE',
    AR: 'ARRAY', O: 'OFFSET', E: 'ERASE', F: 'FILLET', CH: 'CHAMFER',
    T: 'TRIM', EX: 'EXTEND', X: 'EXPLODE', J: 'JOIN', B: 'BREAK',
    BO: 'BOOLEAN', BP: 'BOUNDARY', OK: 'OVERKILL',
};

// Nicht-Tool-Shortcuts (fuer Shortcut-Dialog, nicht fuer data-tip)
const GENERAL_SHORTCUTS = [
    { shortcut: 'Strg+Z',       label: 'Rueckgaengig' },
    { shortcut: 'Strg+Y',       label: 'Wiederholen' },
    { shortcut: 'Strg+A',       label: 'Alles waehlen' },
    { shortcut: 'Strg+S',       label: 'Speichern' },
    { shortcut: 'Strg+P',       label: 'Drucken' },
    { shortcut: 'Strg+Shift+P', label: 'Bereich drucken (Rahmen aufziehen)' },
    { shortcut: 'F1',           label: 'Hilfe / Tastenkuerzel' },
    { shortcut: 'F3',           label: 'Messen' },
    { shortcut: 'F8',           label: 'Ortho-Modus' },
    { shortcut: 'F9',           label: 'Rasterfang' },
    { shortcut: 'F10',          label: 'Polar-Tracking (45°)' },
    { shortcut: 'F11',          label: 'Objektfang-Tracking' },
    { shortcut: 'Shift halten', label: 'Ortho temporaer umkehren' },
    { shortcut: 'ESC',          label: 'Abbrechen' },
    { shortcut: 'Home',         label: 'Alles zeigen' },
];

const MOUSE_SHORTCUTS = [
    'Scrollrad: Zoom',
    'Mittelklick-Drag: Verschieben',
    'Leertaste+Drag: Verschieben',
    'Pinch: Zoom (Trackpad)',
    'Rechtsklick: Bestaetigen / Menu',
];

// Freeze
Object.freeze(CeraCUT);
Object.freeze(CeraCUT.TOLERANCES);
Object.freeze(CeraCUT.COLORS);
Object.freeze(CeraCUT.RENDER);
Object.freeze(CeraCUT.DEFAULTS);
Object.freeze(CeraCUT.LIMITS);
Object.freeze(CeraCUT.INTARSIA_MATERIALS);

if (typeof module !== 'undefined' && module.exports) {
    module.exports = CeraCUT;
}
