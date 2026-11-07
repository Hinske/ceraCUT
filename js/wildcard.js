/**
 * Wildcard — gemeinsamer Text-Filter für ALLE Such-/Filterfelder (Projektregel).
 *
 * Syntax: `*` = beliebig viele Zeichen, `?` = genau ein Zeichen. Ohne Wildcards: einfache
 * Teilstring-Suche (wie bisher). Groß/Kleinschreibung egal, Treffer dürfen irgendwo im Text
 * liegen (nicht verankert): "HEI*01" findet auch "XHEIDE6001.CNC". Leerzeichen trennen
 * mehrere Begriffe, die ALLE passen müssen ("heide 6000").
 *
 * Version: V1.0
 * Last Modified: 2026-11-07
 * Build: 20261107-wildcard
 */
(function () {
'use strict';
const VERSION = 'V1.0';

const _esc = s => s.replace(/[.+^${}()|[\]\\]/g, '\\$&');

/** Ein Begriff → RegExp (null bei leerem Begriff). */
function termToRegExp(term) {
    const t = String(term ?? '').toLowerCase();
    if (!t) return null;
    const src = [...t].map(ch => ch === '*' ? '.*' : ch === '?' ? '.' : _esc(ch)).join('');
    return new RegExp(src, 's');
}

/**
 * Kompiliert eine Eingabe zu einem Prüfer. `matcher(...felder)` ist true, wenn jeder
 * Begriff in mindestens einem Feld vorkommt. Leere Eingabe → alles passt.
 */
function compile(query) {
    const terms = String(query ?? '').trim().split(/\s+/).map(termToRegExp).filter(Boolean);
    if (!terms.length) return () => true;
    return (...fields) => {
        const hay = fields.map(f => String(f ?? '').toLowerCase());
        return terms.every(re => hay.some(h => re.test(h)));
    };
}

const Wildcard = { VERSION, compile, termToRegExp, test: (query, ...fields) => compile(query)(...fields) };
if (typeof module !== 'undefined' && module.exports) module.exports = Wildcard;
if (typeof window !== 'undefined') window.Wildcard = Wildcard;
})();
