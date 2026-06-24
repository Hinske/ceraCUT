/**
 * CeraCUT Auth-Helper V1.0
 * Cookie-Handling + JSON-Body-Parsing für server.js (kein Framework/Middleware-Stack).
 *
 * Created: 2026-06-24 MEZ
 * Last Modified: 2026-06-24 MEZ
 * Build: 20260624-userlogin
 */

const sessionStore = require('./session-store');

const SESSION_COOKIE = 'ceracut_session';

/** Manueller Cookie-Header-Parser (kein Dependency nötig). */
function parseCookies(req) {
    const header = req.headers.cookie;
    const cookies = {};
    if (!header) return cookies;
    for (const part of header.split(';')) {
        const idx = part.indexOf('=');
        if (idx === -1) continue;
        const name = part.slice(0, idx).trim();
        const value = part.slice(idx + 1).trim();
        if (name) cookies[name] = decodeURIComponent(value);
    }
    return cookies;
}

/**
 * Ermittelt den aktuell eingeloggten User aus dem Session-Cookie.
 * Verlängert die Session bei jedem Zugriff (sliding expiry).
 * Gibt {id, username, role} oder null zurück.
 */
function getCurrentUser(req) {
    const cookies = parseCookies(req);
    const token = cookies[SESSION_COOKIE];
    const session = sessionStore.getSession(token);
    if (!session) return null;
    sessionStore.touchSession(token);
    return { id: session.userId, username: session.username, role: session.role };
}

/**
 * Erzeugt eine neue Session für den User und gibt die fertige
 * Set-Cookie-Header-Zeile zurück.
 * @param {boolean} isSecure — true wenn die Verbindung über TLS läuft
 */
function createSessionCookie(user, isSecure) {
    const token = sessionStore.createSession(user);
    return _buildSetCookie(token, sessionStore.SESSION_TTL_MS / 1000, isSecure);
}

function _buildSetCookie(token, maxAgeSeconds, isSecure) {
    const parts = [
        `${SESSION_COOKIE}=${token}`,
        'HttpOnly',
        'Path=/',
        'SameSite=Lax',
        `Max-Age=${maxAgeSeconds}`
    ];
    if (isSecure) parts.push('Secure');
    return parts.join('; ');
}

/** Set-Cookie-Header zum Löschen der Session (Logout). */
function clearSessionCookieHeader(isSecure) {
    return _buildSetCookie('', 0, isSecure);
}

/** Entfernt die Server-seitige Session anhand des Request-Cookies. */
function destroyCurrentSession(req) {
    const cookies = parseCookies(req);
    const token = cookies[SESSION_COOKIE];
    if (token) sessionStore.destroySession(token);
}

/** Liest den Request-Body vollständig ein und parsed ihn als JSON. */
function readJSONBody(req, maxBytes = 1024 * 1024) {
    return new Promise((resolve, reject) => {
        let size = 0;
        const chunks = [];
        req.on('data', chunk => {
            size += chunk.length;
            if (size > maxBytes) {
                reject(new Error('Request-Body zu groß'));
                req.destroy();
                return;
            }
            chunks.push(chunk);
        });
        req.on('end', () => {
            try {
                const raw = Buffer.concat(chunks).toString('utf8');
                resolve(raw ? JSON.parse(raw) : {});
            } catch (err) {
                reject(new Error('Ungültiges JSON'));
            }
        });
        req.on('error', reject);
    });
}

module.exports = {
    SESSION_COOKIE,
    parseCookies,
    getCurrentUser,
    createSessionCookie,
    clearSessionCookieHeader,
    destroyCurrentSession,
    readJSONBody
};
