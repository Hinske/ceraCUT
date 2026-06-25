/**
 * CeraCUT Lead Profiles V1.4
 *
 * Profil-basierte Lead-Verwaltung für Wasserstrahl-CAM.
 * Built-in Profile für typische Material/Dicke-Kombinationen.
 * Batch-Engine wendet Profile regelbasiert auf Konturen an.
 *
 * Persistenz via localStorage.
 * V1.4: Feat — Eigene "corner"-Sektion (analog IGEMS External/Internal/Corner/
 *       Alternative, Kap. 10.13.2) je Profil: { leadType, leadAngle, degradeThreshold }.
 *       Ersetzt die bisher in cam-contour.js hart codierten Magic Numbers (60°/0°/
 *       linear) für das Ecken-Verhalten. Alle 8 Built-ins identisch befüllt (= 1:1
 *       altes Verhalten), _migrateProfile/_applyProfileSection/saveCustom ergänzt.
 *       Noch ohne UI (Backend-Refactor, Properties-Panel/Profil-Editor folgt separat).
 * V1.2: Aktive Profil-Auswahl (ACTIVE_KEY) pro User (_userKey()) — die Profil-
 *       Liste selbst (STORAGE_KEY) bleibt firmenweit geteilt (Login/User-Management V6.32)
 * V1.3: Lead-Überarbeitung — Custom-Profil-Migration/-Validierung beim Laden
 *       (_migrateProfile, verhindert Crash bei alten Profilen ohne smallHole/slit/alt),
 *       Area-Class-Schutz (areaClassApplied wird von applyBatchRules nicht mehr
 *       überschrieben), isModified() prüft jetzt auch Piercing-Zeiten + Lead-Längen-
 *       Grenzen, Lead-Out wird in Small-Hole/Slit-Zweigen mitgesetzt (war zuvor nur
 *       im Normalzweig), smallHole.strategy ausgewertet, DEFAULT_PROFILE_ID-Konstante
 *
 * Last Modified: 2026-06-25
 * Build: 20260625-cornerleadslot
 */

const LeadProfiles = (() => {
    'use strict';

    const VERSION = '1.4';
    const STORAGE_KEY = 'ceracut_lead_profiles';
    const ACTIVE_KEY = 'ceracut_active_lead_profile';
    const PREFIX = `[LeadProfiles V${VERSION}]`;
    const DEFAULT_PROFILE_ID = 'builtin-stahl-mittel';

    /** Pro-User-Namespacing für die aktive Profil-Auswahl (Profil-Liste bleibt global). */
    function _userKey(base) {
        return (typeof window !== 'undefined' && window.CeraCutCurrentUser) ? base + '::' + window.CeraCutCurrentUser : base;
    }

    // ════════════════════════════════════════════════════════════════
    // INTERNER STATE
    // ════════════════════════════════════════════════════════════════

    let _profiles = [];
    let _activeProfileId = null;

    // ════════════════════════════════════════════════════════════════
    // BUILT-IN PROFILE (8 Stück)
    // ════════════════════════════════════════════════════════════════

    function _createBuiltinProfiles() {
        return [
            {
                id: 'builtin-stahl-duenn',
                name: 'Stahl dünn (1-3mm)',
                isBuiltin: true,
                ext: {
                    leadInType: 'arc', leadInLength: 3.0, leadInRadius: 1.5, leadInAngle: 90,
                    leadOutLength: 2.0, overcutLength: 0.5,
                    piercingType: 'auto', piercingStationaryTime: 1.5,
                    piercingCircularRadius: 2.0, piercingCircularTime: 2.0,
                    preferCorners: true, leadInDynamic: false,
                    leadInLengthMin: 1.0, leadInLengthMax: 10.0
                },
                int: {
                    leadInType: 'arc', leadInLength: 2.0, leadInRadius: 1.0, leadInAngle: 90,
                    leadOutLength: 1.5, overcutLength: 0.3,
                    piercingType: 'auto', piercingStationaryTime: 1.5,
                    piercingCircularRadius: 2.0, piercingCircularTime: 2.0,
                    preferCorners: true, leadInDynamic: false,
                    leadInLengthMin: 1.0, leadInLengthMax: 8.0
                },
                alt: {
                    altLeadEnabled: true, altLeadType: 'linear',
                    altLeadInLength: 2.0, altLeadInAngle: 5,
                    altLeadOutLength: 1.5, altOvercutLength: 0.5
                },
                smallHole: { thresholdDiameter: 8.0, strategy: 'center_pierce' },
                slit: { leadInType: 'on_geometry', overcutLength: 0 },
                corner: { leadType: 'linear', leadAngle: 0, degradeThreshold: 60 }
            },
            {
                id: 'builtin-stahl-mittel',
                name: 'Stahl mittel (4-12mm)',
                isBuiltin: true,
                ext: {
                    leadInType: 'arc', leadInLength: 5.0, leadInRadius: 2.5, leadInAngle: 90,
                    leadOutLength: 4.0, overcutLength: 1.0,
                    piercingType: 'auto', piercingStationaryTime: 1.5,
                    piercingCircularRadius: 2.0, piercingCircularTime: 2.0,
                    preferCorners: true, leadInDynamic: false,
                    leadInLengthMin: 1.0, leadInLengthMax: 15.0
                },
                int: {
                    leadInType: 'arc', leadInLength: 3.0, leadInRadius: 1.5, leadInAngle: 90,
                    leadOutLength: 3.0, overcutLength: 0.5,
                    piercingType: 'auto', piercingStationaryTime: 1.5,
                    piercingCircularRadius: 2.0, piercingCircularTime: 2.0,
                    preferCorners: true, leadInDynamic: false,
                    leadInLengthMin: 1.0, leadInLengthMax: 10.0
                },
                alt: {
                    altLeadEnabled: true, altLeadType: 'linear',
                    altLeadInLength: 3.0, altLeadInAngle: 5,
                    altLeadOutLength: 2.0, altOvercutLength: 1.0
                },
                smallHole: { thresholdDiameter: 8.0, strategy: 'center_pierce' },
                slit: { leadInType: 'on_geometry', overcutLength: 0 },
                corner: { leadType: 'linear', leadAngle: 0, degradeThreshold: 60 }
            },
            {
                id: 'builtin-stahl-dick',
                name: 'Stahl dick (13-30mm)',
                isBuiltin: true,
                ext: {
                    leadInType: 'linear', leadInLength: 8.0, leadInRadius: 3.0, leadInAngle: 60,
                    leadOutLength: 6.0, overcutLength: 1.5,
                    piercingType: 'stationary', piercingStationaryTime: 2.5,
                    piercingCircularRadius: 3.0, piercingCircularTime: 3.0,
                    preferCorners: true, leadInDynamic: false,
                    leadInLengthMin: 2.0, leadInLengthMax: 20.0
                },
                int: {
                    leadInType: 'linear', leadInLength: 5.0, leadInRadius: 2.0, leadInAngle: 60,
                    leadOutLength: 4.0, overcutLength: 1.0,
                    piercingType: 'stationary', piercingStationaryTime: 2.5,
                    piercingCircularRadius: 3.0, piercingCircularTime: 3.0,
                    preferCorners: true, leadInDynamic: false,
                    leadInLengthMin: 2.0, leadInLengthMax: 15.0
                },
                alt: {
                    altLeadEnabled: true, altLeadType: 'linear',
                    altLeadInLength: 5.0, altLeadInAngle: 5,
                    altLeadOutLength: 3.0, altOvercutLength: 1.5
                },
                smallHole: { thresholdDiameter: 10.0, strategy: 'center_pierce' },
                slit: { leadInType: 'on_geometry', overcutLength: 0 },
                corner: { leadType: 'linear', leadAngle: 0, degradeThreshold: 60 }
            },
            {
                id: 'builtin-aluminium',
                name: 'Aluminium',
                isBuiltin: true,
                ext: {
                    leadInType: 'arc', leadInLength: 4.0, leadInRadius: 2.0, leadInAngle: 90,
                    leadOutLength: 3.0, overcutLength: 0.5,
                    piercingType: 'auto', piercingStationaryTime: 1.0,
                    piercingCircularRadius: 2.0, piercingCircularTime: 1.5,
                    preferCorners: true, leadInDynamic: false,
                    leadInLengthMin: 1.0, leadInLengthMax: 12.0
                },
                int: {
                    leadInType: 'arc', leadInLength: 2.5, leadInRadius: 1.5, leadInAngle: 90,
                    leadOutLength: 2.0, overcutLength: 0.3,
                    piercingType: 'auto', piercingStationaryTime: 1.0,
                    piercingCircularRadius: 2.0, piercingCircularTime: 1.5,
                    preferCorners: true, leadInDynamic: false,
                    leadInLengthMin: 1.0, leadInLengthMax: 8.0
                },
                alt: {
                    altLeadEnabled: true, altLeadType: 'linear',
                    altLeadInLength: 2.5, altLeadInAngle: 5,
                    altLeadOutLength: 2.0, altOvercutLength: 0.5
                },
                smallHole: { thresholdDiameter: 8.0, strategy: 'center_pierce' },
                slit: { leadInType: 'on_geometry', overcutLength: 0 },
                corner: { leadType: 'linear', leadAngle: 0, degradeThreshold: 60 }
            },
            {
                id: 'builtin-glas-keramik',
                name: 'Glas / Keramik',
                isBuiltin: true,
                ext: {
                    leadInType: 'linear', leadInLength: 2.0, leadInRadius: 1.0, leadInAngle: 45,
                    leadOutLength: 1.5, overcutLength: 0.3,
                    piercingType: 'blind', piercingStationaryTime: 2.0,
                    piercingCircularRadius: 1.5, piercingCircularTime: 2.0,
                    preferCorners: false, leadInDynamic: false,
                    leadInLengthMin: 1.0, leadInLengthMax: 5.0
                },
                int: {
                    leadInType: 'linear', leadInLength: 1.5, leadInRadius: 1.0, leadInAngle: 45,
                    leadOutLength: 1.0, overcutLength: 0.2,
                    piercingType: 'blind', piercingStationaryTime: 2.0,
                    piercingCircularRadius: 1.5, piercingCircularTime: 2.0,
                    preferCorners: false, leadInDynamic: false,
                    leadInLengthMin: 1.0, leadInLengthMax: 4.0
                },
                alt: {
                    altLeadEnabled: false, altLeadType: 'linear',
                    altLeadInLength: 1.5, altLeadInAngle: 5,
                    altLeadOutLength: 1.0, altOvercutLength: 0.3
                },
                smallHole: { thresholdDiameter: 6.0, strategy: 'center_pierce' },
                slit: { leadInType: 'on_geometry', overcutLength: 0 },
                corner: { leadType: 'linear', leadAngle: 0, degradeThreshold: 60 }
            },
            {
                id: 'builtin-schnell',
                name: 'Schnell (Trenn)',
                isBuiltin: true,
                ext: {
                    leadInType: 'linear', leadInLength: 1.5, leadInRadius: 1.0, leadInAngle: 45,
                    leadOutLength: 1.0, overcutLength: 0,
                    piercingType: 'auto', piercingStationaryTime: 1.0,
                    piercingCircularRadius: 2.0, piercingCircularTime: 1.5,
                    preferCorners: true, leadInDynamic: false,
                    leadInLengthMin: 1.0, leadInLengthMax: 5.0
                },
                int: {
                    leadInType: 'linear', leadInLength: 1.0, leadInRadius: 1.0, leadInAngle: 45,
                    leadOutLength: 0.5, overcutLength: 0,
                    piercingType: 'auto', piercingStationaryTime: 1.0,
                    piercingCircularRadius: 2.0, piercingCircularTime: 1.5,
                    preferCorners: true, leadInDynamic: false,
                    leadInLengthMin: 1.0, leadInLengthMax: 4.0
                },
                alt: {
                    altLeadEnabled: true, altLeadType: 'linear',
                    altLeadInLength: 1.0, altLeadInAngle: 5,
                    altLeadOutLength: 0.5, altOvercutLength: 0
                },
                smallHole: { thresholdDiameter: 6.0, strategy: 'center_pierce' },
                slit: { leadInType: 'on_geometry', overcutLength: 0 },
                corner: { leadType: 'linear', leadAngle: 0, degradeThreshold: 60 }
            },
            {
                id: 'builtin-qualitaet',
                name: 'Qualität (Fein)',
                isBuiltin: true,
                ext: {
                    leadInType: 'arc', leadInLength: 8.0, leadInRadius: 4.0, leadInAngle: 90,
                    leadOutLength: 6.0, overcutLength: 2.0,
                    piercingType: 'stationary', piercingStationaryTime: 2.0,
                    piercingCircularRadius: 3.0, piercingCircularTime: 2.5,
                    preferCorners: true, leadInDynamic: true,
                    leadInLengthMin: 2.0, leadInLengthMax: 20.0
                },
                int: {
                    leadInType: 'arc', leadInLength: 5.0, leadInRadius: 2.5, leadInAngle: 90,
                    leadOutLength: 4.0, overcutLength: 1.5,
                    piercingType: 'stationary', piercingStationaryTime: 2.0,
                    piercingCircularRadius: 3.0, piercingCircularTime: 2.5,
                    preferCorners: true, leadInDynamic: true,
                    leadInLengthMin: 2.0, leadInLengthMax: 15.0
                },
                alt: {
                    altLeadEnabled: true, altLeadType: 'linear',
                    altLeadInLength: 5.0, altLeadInAngle: 5,
                    altLeadOutLength: 3.0, altOvercutLength: 2.0
                },
                smallHole: { thresholdDiameter: 10.0, strategy: 'center_pierce' },
                slit: { leadInType: 'on_geometry', overcutLength: 0 },
                corner: { leadType: 'linear', leadAngle: 0, degradeThreshold: 60 }
            },
            {
                id: 'builtin-intarsia',
                name: 'Intarsien',
                isBuiltin: true,
                ext: {
                    leadInType: 'linear', leadInLength: 2.0, leadInRadius: 0, leadInAngle: 45,
                    leadOutLength: 1.5, overcutLength: 0.3,
                    piercingType: 'auto', piercingStationaryTime: 1.5,
                    piercingCircularRadius: 2.0, piercingCircularTime: 2.0,
                    preferCorners: true, leadInDynamic: false,
                    leadInLengthMin: 1.0, leadInLengthMax: 5.0
                },
                int: {
                    leadInType: 'linear', leadInLength: 1.5, leadInRadius: 0, leadInAngle: 45,
                    leadOutLength: 1.0, overcutLength: 0.2,
                    piercingType: 'auto', piercingStationaryTime: 1.5,
                    piercingCircularRadius: 2.0, piercingCircularTime: 2.0,
                    preferCorners: true, leadInDynamic: false,
                    leadInLengthMin: 1.0, leadInLengthMax: 4.0
                },
                alt: {
                    altLeadEnabled: false, altLeadType: 'linear',
                    altLeadInLength: 1.5, altLeadInAngle: 5,
                    altLeadOutLength: 1.0, altOvercutLength: 0.3
                },
                smallHole: { thresholdDiameter: 6.0, strategy: 'center_pierce' },
                slit: { leadInType: 'on_geometry', overcutLength: 0 },
                corner: { leadType: 'linear', leadAngle: 0, degradeThreshold: 60 }
            }
        ];
    }

    // ════════════════════════════════════════════════════════════════
    // INIT / LADEN / SPEICHERN
    // ════════════════════════════════════════════════════════════════

    /**
     * V1.3: Migration/Validierung eines aus localStorage geladenen Custom-Profils.
     * Aeltere Profile (vor Einfuehrung von smallHole/slit/alt) bekommen fehlende
     * Sektionen vom Default-Profil ergaenzt, damit applyBatchRules() nicht auf
     * undefined-Properties zugreift.
     */
    function _migrateProfile(p, defaults) {
        p.ext = p.ext || { ...defaults.ext };
        p.int = p.int || { ...defaults.int };
        p.alt = p.alt || { ...defaults.alt };
        p.smallHole = p.smallHole || { ...defaults.smallHole };
        p.slit = p.slit || { ...defaults.slit };
        p.corner = p.corner || { ...defaults.corner };
        return p;
    }

    function init() {
        _profiles = _createBuiltinProfiles();
        const defaults = _profiles.find(p => p.id === DEFAULT_PROFILE_ID) || _profiles[0];

        // Custom-Profile aus localStorage laden
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                const custom = JSON.parse(stored);
                if (Array.isArray(custom)) {
                    custom.forEach(p => {
                        if (!p || typeof p !== 'object' || !p.id) {
                            console.warn(`${PREFIX} Ungueltiges Custom-Profil ignoriert:`, p);
                            return;
                        }
                        p.isBuiltin = false;
                        _migrateProfile(p, defaults);
                        _profiles.push(p);
                    });
                    console.debug(`${PREFIX} ${custom.length} Benutzerprofile geladen`);
                }
            }
        } catch (e) {
            console.warn(`${PREFIX} Fehler beim Laden der Benutzerprofile:`, e);
        }

        // Aktives Profil laden
        _activeProfileId = localStorage.getItem(_userKey(ACTIVE_KEY)) || DEFAULT_PROFILE_ID;
        console.debug(`${PREFIX} Initialisiert — ${_profiles.length} Profile, aktiv: ${_activeProfileId}`);
    }

    function _saveCustomToStorage() {
        const custom = _profiles.filter(p => !p.isBuiltin);
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(custom));
        } catch (e) {
            console.warn(`${PREFIX} Fehler beim Speichern:`, e);
        }
    }

    // ════════════════════════════════════════════════════════════════
    // PUBLIC API
    // ════════════════════════════════════════════════════════════════

    function getAll() {
        return _profiles;
    }

    function getById(id) {
        return _profiles.find(p => p.id === id) || null;
    }

    function getActive() {
        return getById(_activeProfileId) || _profiles[0];
    }

    function setActive(id) {
        _activeProfileId = id;
        try {
            localStorage.setItem(_userKey(ACTIVE_KEY), id);
        } catch (e) { /* silent */ }
        console.log(`${PREFIX} Aktives Profil: ${id}`);
    }

    function saveCustom(name, data) {
        const id = 'custom-' + Date.now();
        const profile = {
            id,
            name,
            isBuiltin: false,
            ext: { ...data.ext },
            int: { ...data.int },
            alt: { ...data.alt },
            smallHole: { ...data.smallHole },
            slit: { ...data.slit },
            // V6.44: corner-Sektion noch ohne UI (Backend-Refactor) — data.corner ist
            // bisher immer undefined, Default haelt das aktuelle Verhalten (60°/0°/linear)
            corner: data.corner ? { ...data.corner } : { leadType: 'linear', leadAngle: 0, degradeThreshold: 60 }
        };
        _profiles.push(profile);
        _saveCustomToStorage();
        console.log(`${PREFIX} Benutzerprofil gespeichert: "${name}" (${id})`);
        return profile;
    }

    function deleteCustom(id) {
        const idx = _profiles.findIndex(p => p.id === id);
        if (idx === -1) return false;
        if (_profiles[idx].isBuiltin) {
            console.warn(`${PREFIX} Built-in Profile können nicht gelöscht werden`);
            return false;
        }
        _profiles.splice(idx, 1);
        _saveCustomToStorage();
        if (_activeProfileId === id) {
            _activeProfileId = DEFAULT_PROFILE_ID;
            localStorage.setItem(_userKey(ACTIVE_KEY), _activeProfileId);
        }
        console.log(`${PREFIX} Benutzerprofil gelöscht: ${id}`);
        return true;
    }

    /**
     * Prüft ob aktuelle UI-Werte vom Profil abweichen
     */
    function isModified(profile, extVals, intVals, altVals) {
        if (!profile) return false;
        const extKeys = ['leadInType', 'leadInLength', 'leadInRadius', 'leadInAngle',
                         'leadOutLength', 'overcutLength', 'piercingType', 'preferCorners',
                         'leadInDynamic', 'piercingStationaryTime', 'piercingCircularRadius',
                         'piercingCircularTime', 'leadInLengthMin', 'leadInLengthMax'];
        const altKeys = ['altLeadEnabled', 'altLeadType', 'altLeadInLength', 'altLeadInAngle',
                         'altLeadOutLength', 'altOvercutLength'];

        for (const key of extKeys) {
            if (extVals[key] !== undefined && profile.ext[key] !== undefined) {
                if (String(extVals[key]) !== String(profile.ext[key])) return true;
            }
        }
        for (const key of extKeys) {
            if (intVals[key] !== undefined && profile.int[key] !== undefined) {
                if (String(intVals[key]) !== String(profile.int[key])) return true;
            }
        }
        if (altVals) {
            for (const key of altKeys) {
                if (altVals[key] !== undefined && profile.alt[key] !== undefined) {
                    if (String(altVals[key]) !== String(profile.alt[key])) return true;
                }
            }
        }
        return false;
    }

    // ════════════════════════════════════════════════════════════════
    // BATCH ENGINE
    // ════════════════════════════════════════════════════════════════

    /**
     * Wendet Profil-Regeln auf alle Konturen an.
     *
     * Logik pro Kontur:
     *   reference → skip
     *   leadManualOverride → skip
     *   slit → profile.slit (on_geometry, kein Overcut)
     *   hole + Ø < smallHole.thresholdDiameter → center_pierce, kurze Linear
     *   hole → profile.int
     *   disc → profile.ext
     *
     * @param {CamContour[]} contours
     * @param {object} profile
     * @returns {{ applied: number, skipped: number, details: string[] }}
     */
    function applyBatchRules(contours, profile) {
        if (!profile || !contours) return { applied: 0, skipped: 0, details: [] };

        const details = [];
        let applied = 0;
        let skipped = 0;

        contours.forEach(c => {
            // Skip: Referenz
            if (c.isReference) {
                skipped++;
                return;
            }

            // Skip: Manuell überschrieben
            if (c.leadManualOverride) {
                details.push(`${c.name}: übersprungen (manuell)`);
                skipped++;
                return;
            }

            // Skip: Flächenklasse hat bereits Auto-Lead gesetzt — Batch-Profil würde das
            // bewusst gesetzte Ergebnis stillschweigend überschreiben
            if (c.areaClassApplied) {
                details.push(`${c.name}: übersprungen (Flächenklasse aktiv)`);
                skipped++;
                return;
            }

            // Skip: nicht schneidbar
            if (!c.isClosed && c.cuttingMode !== 'slit') {
                skipped++;
                return;
            }

            // Slit-Konturen
            if (c.cuttingMode === 'slit') {
                const slitSection = profile.slit || {};
                c.leadInType = slitSection.leadInType || 'on_geometry';
                c.leadOutType = c.leadInType;
                c.overcutLength = slitSection.overcutLength ?? 0;
                c.leadOutLength = 0;
                c._cachedLeadInPath = null;
                c._cachedLeadOutPath = null;
                c._cachedOvercutPath = null;
                details.push(`${c.name}: Slit-Regel`);
                applied++;
                return;
            }

            // Small Hole Check — V1.3: smallHole.strategy ausgewertet (bisher totes Feld).
            // Aktuell einzige unterstützte Strategie: 'center_pierce'. Unbekannte/zukünftige
            // Strategien fallen NICHT auf die Small-Hole-Regel zurück (kein stilles Verhalten).
            const smallHoleStrategy = profile.smallHole?.strategy || 'center_pierce';
            if (c.cuttingMode === 'hole' && profile.smallHole?.thresholdDiameter !== undefined
                && smallHoleStrategy === 'center_pierce') {
                const diameter = _estimateDiameter(c);
                if (diameter > 0 && diameter < profile.smallHole.thresholdDiameter) {
                    // Center-Pierce: kurze Linear-Leads (Lead-Out spiegelt Lead-In, Parität mit _applyProfileSection)
                    c.leadInType = 'linear';
                    c.leadInLength = Math.min(diameter * 0.3, 2.0);
                    c.leadInRadius = 0;
                    c.leadInAngle = 45;
                    c.leadOutType = 'linear';
                    c.leadOutLength = Math.min(diameter * 0.2, 1.5);
                    c.leadOutRadius = 0;
                    c.leadOutAngle = 45;
                    c.overcutLength = 0.3;
                    c.piercingType = 'auto';
                    c.preferCorners = false;
                    c.leadInDynamic = false;
                    c._cachedLeadInPath = null;
                    c._cachedLeadOutPath = null;
                    c._cachedOvercutPath = null;
                    if (c.preferCorners && c._rotationCount === 0) {
                        c.autoPlaceStartPoint?.(contours);
                    }
                    details.push(`${c.name}: Small-Hole (Ø${diameter.toFixed(1)}mm < ${profile.smallHole.thresholdDiameter}mm)`);
                    applied++;
                    return;
                }
            }

            // Hole → int-Profil
            if (c.cuttingMode === 'hole') {
                _applyProfileSection(c, profile.int, profile.alt, profile.corner, contours);
                details.push(`${c.name}: Innen-Profil`);
                applied++;
                return;
            }

            // Disc → ext-Profil
            _applyProfileSection(c, profile.ext, profile.alt, profile.corner, contours);
            details.push(`${c.name}: Außen-Profil`);
            applied++;
        });

        console.log(`${PREFIX} Batch-Apply: ${applied} angewendet, ${skipped} übersprungen`);
        return { applied, skipped, details };
    }

    /**
     * Profil-Sektion auf eine Kontur anwenden
     */
    function _applyProfileSection(c, section, alt, corner, allContours) {
        if (!section) return;
        c.leadInType = section.leadInType;
        c.leadInLength = section.leadInLength;
        c.leadInRadius = section.leadInRadius;
        c.leadInAngle = section.leadInAngle;
        c.leadOutType = section.leadInType;
        c.leadOutLength = section.leadOutLength;
        c.leadOutRadius = section.leadInRadius;
        c.leadOutAngle = section.leadInAngle;
        c.overcutLength = section.overcutLength;
        c.piercingType = section.piercingType;
        c.preferCorners = section.preferCorners;
        c.leadInDynamic = section.leadInDynamic;
        c.leadInLengthMin = section.leadInLengthMin;
        c.leadInLengthMax = section.leadInLengthMax;
        if (section.piercingStationaryTime !== undefined) c.piercingStationaryTime = section.piercingStationaryTime;
        if (section.piercingCircularRadius !== undefined) c.piercingCircularRadius = section.piercingCircularRadius;
        if (section.piercingCircularTime !== undefined)   c.piercingCircularTime   = section.piercingCircularTime;

        // Corner-Lead (eigener Slot, siehe cam-contour.js Konstruktor)
        if (corner) {
            c.cornerLeadType = corner.leadType;
            c.cornerLeadAngle = corner.leadAngle;
            c.cornerDegradeThreshold = corner.degradeThreshold;
        }

        // Alt-Lead
        if (alt) {
            c.altLeadEnabled   = alt.altLeadEnabled;
            c.altLeadType      = alt.altLeadType;
            c.altLeadInLength  = alt.altLeadInLength;
            c.altLeadInAngle   = alt.altLeadInAngle;
            c.altLeadOutLength = alt.altLeadOutLength;
            c.altOvercutLength = alt.altOvercutLength;
        }

        // Cache invalidieren
        c._cachedLeadInPath = null;
        c._cachedLeadOutPath = null;
        c._cachedOvercutPath = null;
        if (c.preferCorners && c._rotationCount === 0) {
            c.autoPlaceStartPoint?.(allContours);
        }
    }

    /**
     * Durchmesser einer Kontur schätzen (für Small-Hole-Erkennung)
     */
    function _estimateDiameter(c) {
        if (!c.points || c.points.length < 3) return 0;
        // BBox-basiert: Durchschnitt aus Breite und Höhe
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        for (const p of c.points) {
            if (p.x < minX) minX = p.x;
            if (p.x > maxX) maxX = p.x;
            if (p.y < minY) minY = p.y;
            if (p.y > maxY) maxY = p.y;
        }
        return ((maxX - minX) + (maxY - minY)) / 2;
    }

    // ════════════════════════════════════════════════════════════════
    // PUBLIC INTERFACE
    // ════════════════════════════════════════════════════════════════

    return {
        VERSION,
        init,
        getAll,
        getById,
        getActive,
        setActive,
        saveCustom,
        deleteCustom,
        isModified,
        applyBatchRules
    };
})();
