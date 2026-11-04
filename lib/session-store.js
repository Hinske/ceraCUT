/**
 * CeraCUT Session-Store V1.1
 * In-Memory Session-Verwaltung für Cookie-basiertes Login.
 *
 * Bewusster Tradeoff: Sessions leben nur im Prozess-Speicher — ein
 * Server-Neustart invalidiert alle aktiven Logins (Re-Login nötig).
 * Für eine interne Shop-Floor-Anwendung mit seltenen Neustarts akzeptabel,
 * keine Persistenz in v1 (siehe CLAUDE.md Login/User-Management Plan).
 *
 * Created: 2026-06-24 MEZ
 * Last Modified: 2026-11-04
 * Build: 20261104-reviewfix
 * V1.1: Fix — Code-Review 2026-11-04 (tasks/code-review-2026-11-04.md)
 */

const crypto = require('crypto');

const SESSION_TTL_MS = 8 * 60 * 60 * 1000; // 8h, sliding (bei jedem Request verlängert)

/** @type {Map<string, {userId:string, username:string, role:string, expiresAt:number}>} */
const sessions = new Map();

const MAX_SESSIONS = 1000;
const SWEEP_INTERVAL_MS = 10 * 60 * 1000;

function _sweep() {
    const now = Date.now();
    for (const [token, sess] of sessions) {
        if (sess.expiresAt < now) sessions.delete(token);
    }
}
setInterval(_sweep, SWEEP_INTERVAL_MS).unref();

function createSession(user) {
    if (sessions.size >= MAX_SESSIONS) {
        _sweep();
        // Weiterhin voll: älteste Sessions (Map-Einfügereihenfolge) verdrängen
        while (sessions.size >= MAX_SESSIONS) {
            sessions.delete(sessions.keys().next().value);
        }
    }
    const token = crypto.randomBytes(32).toString('hex');
    sessions.set(token, {
        userId: user.id,
        username: user.username,
        role: user.role,
        expiresAt: Date.now() + SESSION_TTL_MS
    });
    return token;
}

/** Liefert die Session oder null (auch bei Ablauf — löscht abgelaufene Einträge). */
function getSession(token) {
    if (!token) return null;
    const session = sessions.get(token);
    if (!session) return null;
    if (session.expiresAt < Date.now()) {
        sessions.delete(token);
        return null;
    }
    return session;
}

/** Verlängert die Session (sliding expiry) — bei jedem authentifizierten Request aufrufen. */
function touchSession(token) {
    const session = sessions.get(token);
    if (session) session.expiresAt = Date.now() + SESSION_TTL_MS;
}

function destroySession(token) {
    sessions.delete(token);
}

module.exports = {
    createSession,
    getSession,
    touchSession,
    destroySession,
    SESSION_TTL_MS
};
