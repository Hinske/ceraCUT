/**
 * CeraCUT Server V1.6
 * V1.6: Fix — Slowloris-DoS im Dual-Protocol Gateway: socket.setTimeout(3000) +
 *       socket.on('timeout', destroy) schützt vor Angreifern die TCP-Verbindungen öffnen
 *       aber kein erstes Byte senden. Ohne Guard blieben Sockets unbegrenzt offen und
 *       erschöpften den File-Deskriptor-Pool des Node.js-Prozesses.
 * V1.5: Fix — XSS in _injectCurrentUser(): JSON.stringify-Output wird nun mit
 *       .replace(/</g, '\\u003c') bereinigt — verhindert vorzeitigen Script-Tag-
 *       Abbruch durch Benutzernamen mit </script> (CVE-Klasse: Stored XSS).
 * V1.4: Feat — Login + User-Management: /, /index.html und /api/dxf/* sind jetzt
 *       hinter einer Session (Cookie ceracut_session) gegated, neue Routen
 *       /api/auth/{login,logout,me} + /api/admin/users* (Rolle admin). Beim
 *       Ausliefern von index.html wird window.CeraCutCurrentUser per
 *       String-Injection gesetzt (vor allen Script-Tags), damit Theme/Profil-
 *       Auswahl beim ersten Render schon korrekt pro User aufgelöst werden kann.
 *       Siehe lib/user-store.js, lib/session-store.js, lib/auth.js.
 * V1.3: Fix — safePath() prüft Symlink-Ziel via fs.realpathSync gegen DXF_ROOT,
 *       Content-Disposition-Header filtert CR/LF (Header-Injection)
 * Last Modified: 2026-06-25
 * Build: 20260625-xssfix
 *
 * Statischer Dateiserver + DXF-Browse-API für Netzlaufwerk-Zugriff.
 * Ersetzt `npx serve .` und stellt zusätzlich /api/dxf/* Endpunkte bereit.
 *
 * HTTPS wird automatisch aktiviert wenn Zertifikate unter certs/ vorhanden sind.
 * Beim ersten Start ohne Zertifikate werden Self-Signed Certs automatisch generiert
 * (erfordert `openssl` im PATH).
 *
 * Umgebungsvariablen:
 *   PORT                 — Server-Port (default: 5000)
 *   DXF_ROOT             — Wurzelverzeichnis für DXF-Dateien (default: /mnt/dxf)
 *   TLS_CERT             — Pfad zum Zertifikat (default: certs/server.crt)
 *   TLS_KEY              — Pfad zum privaten Schlüssel (default: certs/server.key)
 *   NO_HTTPS             — auf "1" setzen um HTTPS zu deaktivieren
 *   ADMIN_BOOTSTRAP_USER — Username für den ersten Admin (nur wirksam wenn data/users.json leer ist)
 *   ADMIN_BOOTSTRAP_PASS — Passwort für den ersten Admin (siehe ADMIN_BOOTSTRAP_USER)
 *
 * Starten:
 *   node server.js                              # HTTPS (auto-generierte Certs)
 *   NO_HTTPS=1 node server.js                   # nur HTTP
 *   PORT=3000 DXF_ROOT=/pfad/zu/dxf node server.js
 *   ADMIN_BOOTSTRAP_USER=admin ADMIN_BOOTSTRAP_PASS=changeme node server.js   # erster Start
 */

const http = require('http');
const https = require('https');
const net = require('net');
const fs = require('fs');
const path = require('path');
const url = require('url');
const { execSync } = require('child_process');

const userStore = require('./lib/user-store');
const {
    getCurrentUser,
    createSessionCookie,
    clearSessionCookieHeader,
    destroyCurrentSession,
    readJSONBody
} = require('./lib/auth');

const PORT = parseInt(process.env.PORT, 10) || 5000;
const DXF_ROOT = path.resolve(process.env.DXF_ROOT || '/mnt/dxf');
const STATIC_ROOT = __dirname;
const NO_HTTPS = process.env.NO_HTTPS === '1';

const CERT_DIR = path.join(__dirname, 'certs');
const CERT_PATH = process.env.TLS_CERT || path.join(CERT_DIR, 'server.crt');
const KEY_PATH = process.env.TLS_KEY || path.join(CERT_DIR, 'server.key');

// MIME-Types für statische Dateien
const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css':  'text/css; charset=utf-8',
    '.js':   'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png':  'image/png',
    '.jpg':  'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif':  'image/gif',
    '.svg':  'image/svg+xml',
    '.ico':  'image/x-icon',
    '.woff': 'font/woff',
    '.woff2':'font/woff2',
    '.ttf':  'font/ttf',
    '.otf':  'font/otf',
    '.dxf':  'application/octet-stream',
    '.mpf':  'text/plain; charset=utf-8',
    '.txt':  'text/plain; charset=utf-8',
};

// ── TLS / Self-Signed Cert ──────────────────────────────────────────

/**
 * Ermittelt alle lokalen IPv4-Adressen (nicht-loopback).
 */
function getLocalIPs() {
    const os = require('os');
    const ips = [];
    const interfaces = os.networkInterfaces();
    for (const iface of Object.values(interfaces)) {
        for (const addr of iface) {
            if (addr.family === 'IPv4' && !addr.internal) {
                ips.push(addr.address);
            }
        }
    }
    return ips;
}

/**
 * Generiert ein Self-Signed Zertifikat via openssl.
 * Gültig für localhost + private IP-Bereiche (SAN).
 */
function generateSelfSignedCert() {
    if (!fs.existsSync(CERT_DIR)) {
        fs.mkdirSync(CERT_DIR, { recursive: true });
    }

    console.log('[CeraCUT Server] Generiere Self-Signed Zertifikat...');

    // Eigene IP-Adressen ermitteln für SAN
    const ipAddresses = getLocalIPs();
    let altNames = 'DNS.1 = localhost\nIP.1 = 127.0.0.1\n';
    ipAddresses.forEach((ip, i) => {
        altNames += `IP.${i + 2} = ${ip}\n`;
    });

    // OpenSSL-Config mit SAN für lokale Netzwerke
    const opensslConf = path.join(CERT_DIR, 'openssl.cnf');
    fs.writeFileSync(opensslConf, `[req]
default_bits = 2048
prompt = no
default_md = sha256
distinguished_name = dn
x509_extensions = v3_req

[dn]
C = DE
O = Cerasell GmbH
CN = CeraCUT Server

[v3_req]
subjectAltName = @alt_names
basicConstraints = CA:FALSE
keyUsage = digitalSignature, keyEncipherment
extendedKeyUsage = serverAuth

[alt_names]
${altNames}`);

    try {
        execSync(
            `openssl req -x509 -nodes -newkey rsa:2048 ` +
            `-keyout "${KEY_PATH}" -out "${CERT_PATH}" ` +
            `-days 3650 -config "${opensslConf}"`,
            { stdio: 'pipe' }
        );
        // Config aufräumen
        fs.unlinkSync(opensslConf);
        console.log('[CeraCUT Server] Zertifikat generiert: certs/server.crt + certs/server.key');
        console.log('[CeraCUT Server] Gültig für 10 Jahre.');
        console.log('[CeraCUT Server] HINWEIS: Browser wird beim ersten Zugriff eine Sicherheitswarnung zeigen.');
        console.log('[CeraCUT Server]          → "Erweitert" → "Weiter zu ... (unsicher)" klicken.');
        return true;
    } catch (err) {
        console.error('[CeraCUT Server] openssl nicht gefunden oder fehlgeschlagen:', err.message);
        console.error('[CeraCUT Server] Fallback auf HTTP.');
        return false;
    }
}

/**
 * Prüft ob TLS-Zertifikate vorhanden sind, generiert sie bei Bedarf.
 * @returns {{ cert, key } | null}
 */
function loadTLSCredentials() {
    if (NO_HTTPS) return null;

    // Zertifikate vorhanden?
    if (!fs.existsSync(CERT_PATH) || !fs.existsSync(KEY_PATH)) {
        if (!generateSelfSignedCert()) return null;
    }

    try {
        return {
            cert: fs.readFileSync(CERT_PATH),
            key: fs.readFileSync(KEY_PATH),
        };
    } catch (err) {
        console.error('[CeraCUT Server] TLS-Zertifikate nicht lesbar:', err.message);
        return null;
    }
}

// ── Hilfsfunktionen ─────────────────────────────────────────────────

/**
 * Path-Traversal-Schutz: Prüft ob der aufgelöste Pfad innerhalb von root liegt.
 */
function safePath(root, userPath) {
    const resolved = path.resolve(root, userPath || '');
    if (!resolved.startsWith(root + path.sep) && resolved !== root) {
        return null;
    }
    // Symlink-Schutz: falls der Pfad existiert, finalen Ziel-Pfad ebenfalls gegen root prüfen
    try {
        const real = fs.realpathSync(resolved);
        if (!real.startsWith(root + path.sep) && real !== root) {
            return null;
        }
    } catch {
        // Pfad existiert (noch) nicht — lexikalischer Check oben reicht dann aus
    }
    return resolved;
}

/**
 * JSON-Antwort senden
 */
function sendJSON(res, statusCode, data) {
    const body = JSON.stringify(data);
    res.writeHead(statusCode, {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Length': Buffer.byteLength(body),
    });
    res.end(body);
}

// ── API-Handler ─────────────────────────────────────────────────────

/**
 * API: GET /api/dxf/list?path=
 * Listet Verzeichnisinhalt (nur .dxf-Dateien und Unterordner).
 */
function handleDXFList(res, queryPath) {
    const dirPath = safePath(DXF_ROOT, queryPath);
    if (!dirPath) {
        return sendJSON(res, 403, { error: 'Zugriff verweigert' });
    }

    fs.stat(dirPath, (err, stats) => {
        if (err || !stats.isDirectory()) {
            return sendJSON(res, 404, { error: 'Verzeichnis nicht gefunden' });
        }

        fs.readdir(dirPath, { withFileTypes: true }, (err2, entries) => {
            if (err2) {
                return sendJSON(res, 500, { error: 'Lesefehler' });
            }

            const items = [];
            for (const entry of entries) {
                // Versteckte Dateien überspringen
                if (entry.name.startsWith('.')) continue;

                if (entry.isDirectory()) {
                    items.push({ name: entry.name, type: 'directory' });
                } else if (entry.name.toLowerCase().endsWith('.dxf')) {
                    // Dateigröße ermitteln
                    try {
                        const stat = fs.statSync(path.join(dirPath, entry.name));
                        items.push({
                            name: entry.name,
                            type: 'file',
                            size: stat.size,
                        });
                    } catch {
                        items.push({ name: entry.name, type: 'file', size: 0 });
                    }
                }
            }

            // Ordner zuerst, dann Dateien, jeweils alphabetisch
            items.sort((a, b) => {
                if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
                return a.name.localeCompare(b.name, 'de');
            });

            sendJSON(res, 200, {
                path: queryPath || '',
                items: items,
            });
        });
    });
}

/**
 * API: GET /api/dxf/file?path=
 * Liefert DXF-Dateiinhalt (ISO-8859-1 raw bytes).
 */
function handleDXFFile(res, queryPath) {
    if (!queryPath) {
        return sendJSON(res, 400, { error: 'Pfad fehlt' });
    }

    const filePath = safePath(DXF_ROOT, queryPath);
    if (!filePath) {
        return sendJSON(res, 403, { error: 'Zugriff verweigert' });
    }

    if (!filePath.toLowerCase().endsWith('.dxf')) {
        return sendJSON(res, 403, { error: 'Nur DXF-Dateien erlaubt' });
    }

    fs.stat(filePath, (err, stats) => {
        if (err || !stats.isFile()) {
            return sendJSON(res, 404, { error: 'Datei nicht gefunden' });
        }

        // DXF als binary lesen (ISO-8859-1 kompatibel)
        fs.readFile(filePath, (err2, buffer) => {
            if (err2) {
                return sendJSON(res, 500, { error: 'Lesefehler' });
            }

            res.writeHead(200, {
                'Content-Type': 'application/octet-stream',
                'Content-Length': buffer.length,
                'Content-Disposition': `inline; filename="${path.basename(filePath).replace(/[\r\n"]/g, '')}"`,
            });
            res.end(buffer);
        });
    });
}

const INDEX_HTML_PATH = path.join(STATIC_ROOT, 'index.html');

/**
 * Injiziert window.CeraCutCurrentUser/-Role in index.html, direkt nach <head> —
 * vor allen anderen Script-Tags. machine-profiles.js/lead-profiles.js initialisieren
 * sich per IIFE beim Script-Parse (lange vor app.js); ein rein client-seitiger
 * fetch('/api/auth/me') aus app.js wäre für deren Auswahl-Restore zu spät
 * (Race Condition / Flash-of-wrong-theme). Der Server kennt den User bereits
 * (Session-Cookie-Check), daher direkte String-Injection statt Async-Fetch.
 */
function _injectCurrentUser(resolvedPath, data, currentUser) {
    if (resolvedPath !== INDEX_HTML_PATH) return data;
    const html = data.toString('utf8');
    const safeJSON = (val) => JSON.stringify(val).replace(/</g, '\\u003c');
    const script = `<script>window.CeraCutCurrentUser = ${safeJSON(currentUser ? currentUser.username : null)};window.CeraCutCurrentRole = ${safeJSON(currentUser ? currentUser.role : null)};</script>`;
    const injected = html.replace('<head>', '<head>\n' + script);
    return Buffer.from(injected, 'utf8');
}

/**
 * Statische Dateien aus dem Projektverzeichnis ausliefern.
 */
function handleStatic(req, res, pathname, currentUser) {
    // Default: index.html
    let filePath = path.join(STATIC_ROOT, pathname === '/' ? 'index.html' : pathname);

    // Path-Traversal-Schutz für statische Dateien
    const resolved = path.resolve(filePath);
    if (!resolved.startsWith(STATIC_ROOT + path.sep) && resolved !== STATIC_ROOT) {
        res.writeHead(403);
        return res.end('Forbidden');
    }

    fs.stat(resolved, (err, stats) => {
        if (err || !stats.isFile()) {
            // Versuche index.html im Verzeichnis
            if (!err && stats && stats.isDirectory()) {
                const indexPath = path.join(resolved, 'index.html');
                return fs.readFile(indexPath, (err2, data) => {
                    if (err2) {
                        res.writeHead(404);
                        return res.end('Not Found');
                    }
                    const body = _injectCurrentUser(indexPath, data, currentUser);
                    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Content-Length': body.length });
                    res.end(body);
                });
            }
            res.writeHead(404);
            return res.end('Not Found');
        }

        const ext = path.extname(resolved).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';

        fs.readFile(resolved, (err2, data) => {
            if (err2) {
                res.writeHead(500);
                return res.end('Internal Server Error');
            }
            const body = _injectCurrentUser(resolved, data, currentUser);
            res.writeHead(200, {
                'Content-Type': contentType,
                'Content-Length': body.length,
                'Cache-Control': 'no-cache',
            });
            res.end(body);
        });
    });
}

// ── Auth-Handler ─────────────────────────────────────────────────────

/**
 * API: POST /api/auth/login {username, password}
 * Generischer Fehlertext bei "User nicht gefunden" UND "falsches Passwort" —
 * kein User-Enumeration-Leak.
 */
async function handleLogin(req, res, isSecure) {
    let body;
    try {
        body = await readJSONBody(req);
    } catch {
        return sendJSON(res, 400, { error: 'Ungültige Anfrage' });
    }
    const user = userStore.verifyCredentials(body.username, body.password);
    if (!user) {
        return sendJSON(res, 401, { error: 'Benutzername oder Passwort falsch' });
    }
    res.setHeader('Set-Cookie', createSessionCookie(user, isSecure));
    sendJSON(res, 200, { username: user.username, role: user.role });
}

/** API: POST /api/auth/logout */
function handleLogout(req, res, isSecure) {
    destroyCurrentSession(req);
    res.setHeader('Set-Cookie', clearSessionCookieHeader(isSecure));
    sendJSON(res, 200, { ok: true });
}

/** API: /api/admin/users* — nur für Rolle 'admin' (Gate erfolgt im Aufrufer) */
async function handleAdminUsers(req, res, pathname) {
    if (pathname === '/api/admin/users' && req.method === 'GET') {
        return sendJSON(res, 200, { users: userStore.listUsers() });
    }

    if (pathname === '/api/admin/users' && req.method === 'POST') {
        let body;
        try { body = await readJSONBody(req); } catch { return sendJSON(res, 400, { error: 'Ungültige Anfrage' }); }
        try {
            return sendJSON(res, 200, { user: userStore.createUser(body) });
        } catch (err) {
            return sendJSON(res, 400, { error: err.message });
        }
    }

    if (pathname === '/api/admin/users/delete' && req.method === 'POST') {
        let body;
        try { body = await readJSONBody(req); } catch { return sendJSON(res, 400, { error: 'Ungültige Anfrage' }); }
        try {
            userStore.deleteUser(body.id);
            return sendJSON(res, 200, { ok: true });
        } catch (err) {
            return sendJSON(res, 400, { error: err.message });
        }
    }

    if (pathname === '/api/admin/users/reset-password' && req.method === 'POST') {
        let body;
        try { body = await readJSONBody(req); } catch { return sendJSON(res, 400, { error: 'Ungültige Anfrage' }); }
        try {
            userStore.resetPassword(body.id, body.newPassword);
            return sendJSON(res, 200, { ok: true });
        } catch (err) {
            return sendJSON(res, 400, { error: err.message });
        }
    }

    return sendJSON(res, 404, { error: 'Unbekannte Admin-Route' });
}

// ── Request-Handler ─────────────────────────────────────────────────

function requestHandler(req, res) {
    const parsed = url.parse(req.url, true);
    let pathname;
    try {
        pathname = decodeURIComponent(parsed.pathname);
    } catch (e) {
        res.writeHead(400, { 'Content-Type': 'text/plain' });
        res.end('400 Bad Request: Ungültige URL-Kodierung');
        return;
    }

    const isSecure = !!(req.socket && req.socket.encrypted);
    const currentUser = getCurrentUser(req); // null wenn nicht eingeloggt/Session abgelaufen

    // ── Auth-Routen (immer erreichbar, auch ohne Login) ──
    if (pathname === '/api/auth/login' && req.method === 'POST') {
        return handleLogin(req, res, isSecure);
    }
    if (pathname === '/api/auth/me' && req.method === 'GET') {
        return sendJSON(res, currentUser ? 200 : 401, currentUser || { error: 'Nicht angemeldet' });
    }
    if (pathname === '/api/auth/logout' && req.method === 'POST') {
        return handleLogout(req, res, isSecure);
    }

    // Health-Check (ungated)
    if (pathname === '/api/health') {
        return sendJSON(res, 200, { status: 'ok', dxfRoot: DXF_ROOT, https: !!tlsCreds });
    }

    // ── Admin-Routen: Login + Rolle 'admin' nötig ──
    if (pathname.startsWith('/api/admin/')) {
        if (!currentUser) return sendJSON(res, 401, { error: 'Nicht angemeldet' });
        if (currentUser.role !== 'admin') return sendJSON(res, 403, { error: 'Nur für Admins' });
        return handleAdminUsers(req, res, pathname);
    }

    // ── DXF-API: Login nötig (echte Kundendaten) ──
    if (pathname === '/api/dxf/list' && req.method === 'GET') {
        if (!currentUser) return sendJSON(res, 401, { error: 'Nicht angemeldet' });
        return handleDXFList(res, parsed.query.path || '');
    }
    if (pathname === '/api/dxf/file' && req.method === 'GET') {
        if (!currentUser) return sendJSON(res, 401, { error: 'Nicht angemeldet' });
        return handleDXFFile(res, parsed.query.path || '');
    }

    // ── App-Shell: Login nötig — alle anderen statischen Assets (js/*.js, *.css,
    //    Fonts) bleiben bewusst ungated (Anwendungscode, kein Geheimnis) ──
    if (pathname === '/' || pathname === '/index.html') {
        if (!currentUser) {
            res.writeHead(302, { Location: '/login.html' });
            return res.end();
        }
    }

    // Statische Dateien
    handleStatic(req, res, pathname, currentUser);
}

// ── Server erstellen ────────────────────────────────────────────────

const tlsCreds = loadTLSCredentials();

let protocol;

function startServer() {
    const dxfWarning = () => {
        if (!fs.existsSync(DXF_ROOT)) {
            console.warn(`[CeraCUT Server] WARNUNG: DXF-Root "${DXF_ROOT}" existiert nicht!`);
        }
    };

    if (tlsCreds) {
        // Dual-Protocol auf einem Port (net.Server sniffing).
        // Byte 0x16 = TLS ClientHello → HTTPS, sonst HTTP → Redirect.
        const httpsServer = https.createServer(tlsCreds, requestHandler);
        const httpRedirect = http.createServer((req, res) => {
            const host = (req.headers.host || '').replace(/:\d+$/, '');
            res.writeHead(301, { Location: `https://${host}:${PORT}${req.url}` });
            res.end();
        });

        // Interne Server ohne Port starten (erhalten Sockets vom net.Server)
        httpsServer.listen(0, '127.0.0.1');
        httpRedirect.listen(0, '127.0.0.1');

        const gateway = net.createServer({ pauseOnConnect: true }, socket => {
            // Slowloris-Guard: Socket der kein erstes Byte sendet wird nach 3 s getrennt.
            socket.setTimeout(3000);
            socket.on('timeout', () => socket.destroy());
            // Erstes Byte lesen um Protokoll zu erkennen
            socket.once('readable', () => {
                socket.setTimeout(0); // Sniffing erfolgreich — Timeout deaktivieren
                const chunk = socket.read(1);
                if (!chunk || chunk.length === 0) { socket.destroy(); return; }
                // Byte zurückschieben
                socket.unshift(chunk);
                // TLS ClientHello beginnt mit 0x16 (22)
                const target = (chunk[0] === 0x16) ? httpsServer : httpRedirect;
                target.emit('connection', socket);
                socket.resume();
            });
            socket.on('error', () => {});
        });

        gateway.listen(PORT, () => {
            console.log(`[CeraCUT Server] Gestartet auf Port ${PORT} (HTTP+HTTPS dual-protocol)`);
            console.log(`[CeraCUT Server]   https://localhost:${PORT}  → App (FSAPI verfügbar)`);
            console.log(`[CeraCUT Server]   http://localhost:${PORT}   → Redirect → HTTPS`);
            console.log(`[CeraCUT Server] Statische Dateien: ${STATIC_ROOT}`);
            console.log(`[CeraCUT Server] DXF-Root: ${DXF_ROOT}`);
            dxfWarning();
        });
        protocol = 'https';

    } else {
        // HTTP-only Fallback
        const server = http.createServer(requestHandler);
        server.listen(PORT, () => {
            console.log(`[CeraCUT Server] Gestartet: http://localhost:${PORT}`);
            console.log(`[CeraCUT Server] Statische Dateien: ${STATIC_ROOT}`);
            console.log(`[CeraCUT Server] DXF-Root: ${DXF_ROOT}`);
            console.warn(`[CeraCUT Server] WARNUNG: Nur HTTP — FSAPI funktioniert NICHT im Browser!`);
            dxfWarning();
        });
        protocol = 'http';
    }
}

userStore.bootstrapIfEmpty();
startServer();
