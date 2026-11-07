/**
 * CeraCUT Plan Update V1.0
 * Teil-Update im Plan (FINest "Update"): nach dem Bearbeiten eines Teils entscheiden, welche Instanzen
 * die neue Revision bekommen. Instanzen referenzieren Teil + exakte Revision — andere Instanzen behalten
 * ihre alte Geometrie, ein Fork des Teils ist deshalb nicht nötig.
 *
 *   single         nur die gewählte Instanz
 *   sameTransform  alle Instanzen des Teils mit gleicher Drehung/Spiegelung wie die gewählte
 *   all            alle Instanzen des Teils im Plan
 *
 * Reine Logik (Browser + Node); der Server wendet sie in POST /api/plans/:id/update-parts an.
 *
 * Created: 2026-11-07
 * Build: 20261107-partedit
 *
 * (c) Cerasell GmbH
 */

const PlanUpdate = (() => {
    'use strict';

    const MODES = ['single', 'sameTransform', 'all'];
    const norm = a => ((Number(a) || 0) % 360 + 360) % 360;
    const sameTransform = (a, b) => norm(a.rot) === norm(b.rot) && !!a.mirror === !!b.mirror;

    /**
     * @param {object} plan
     * @param {{partId:string, newRevision:number, mode:string, instId?:string}} u
     * @returns {{plan:object, changed:string[]}}  plan ist eine Kopie, das Original bleibt unverändert
     */
    function apply(plan, u) {
        if (!MODES.includes(u.mode)) throw new Error(`Unbekannter Modus: ${u.mode}`);
        if (!Number.isInteger(u.newRevision) || u.newRevision < 1) throw new Error('Ungültige Revision');
        const out = structuredClone(plan);
        const ofPart = out.instances.filter(i => i.partId === u.partId);
        let ref = null;
        if (u.mode !== 'all') {
            ref = ofPart.find(i => i.instId === u.instId);
            if (!ref) throw new Error(`Instanz ${u.instId} gehört nicht zum Teil ${u.partId}`);
        }
        const targets = ofPart.filter(i => u.mode === 'all' || (u.mode === 'single' ? i === ref : sameTransform(i, ref)));
        const changed = [];
        for (const i of targets) {
            if (i.revision === u.newRevision) continue;
            i.derivedFrom = `${i.partId}@${i.revision}`;
            i.revision = u.newRevision;
            changed.push(i.instId);
        }
        return { plan: out, changed };
    }

    /** Gruppiert die Instanzen eines Teils für die Auswahl im Dialog: Anzahl je Drehung/Spiegelung und Revision. */
    function summarize(plan, partId) {
        const rows = new Map();
        for (const i of plan.instances.filter(x => x.partId === partId)) {
            const k = `${norm(i.rot)}|${!!i.mirror}|${i.revision}`;
            const r = rows.get(k) || { rot: norm(i.rot), mirror: !!i.mirror, revision: i.revision, count: 0, instIds: [] };
            r.count++; r.instIds.push(i.instId);
            rows.set(k, r);
        }
        return [...rows.values()];
    }

    return { apply, summarize, sameTransform, MODES };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = PlanUpdate;
}
