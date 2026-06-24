/**
 * CeraCUT Session-Store V1.0
 * In-Memory Session-Verwaltung für Cookie-basiertes Login.
 *
 * Bewusster Tradeoff: Sessions leben nur im Prozess-Speicher — ein
 * Server-Neustart invalidiert alle aktiven Logins (Re-Login nötig).
 * Für eine interne Shop-Floor-Anwendung mit seltenen Neustarts akzeptabel,
 * keine Persistenz in v1 (siehe CLAUDE.md Login/User-Management Plan).
 *
 * Created: 2026-06-24 MEZ
 * Last Modified: 2026-06-24 MEZ
 * Build: 20260624-userlogin
 */

const crypto = require('crypto');

const SESSION_TTL_MS = 8 * 60 * 60 * 1000; // 8h, sliding (bei jedem Request verlängert)

/** @type {Map<string, {userId:string, username:string, role:string, expiresAt:number}>} */
const sessions = new Map();

function createSession(user) {
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
