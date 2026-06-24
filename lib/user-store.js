/**
 * CeraCUT User-Store V1.0
 * Einfache Datei-basierte Benutzerverwaltung (kein Framework, keine Dependencies).
 *
 * Persistenz: data/users.json (gitignored — enthält Passwort-Hashes).
 * Hashing: crypto.scryptSync (Node-Bordmittel, kein bcrypt nötig).
 *
 * Bootstrap: Ist data/users.json leer/nicht vorhanden, kann per
 * ADMIN_BOOTSTRAP_USER + ADMIN_BOOTSTRAP_PASS (Umgebungsvariablen) der erste
 * Admin-Account angelegt werden — siehe bootstrapIfEmpty().
 *
 * Created: 2026-06-24 MEZ
 * Last Modified: 2026-06-24 MEZ
 * Build: 20260624-userlogin
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname, '..', 'data');
const USERS_PATH = path.join(DATA_DIR, 'users.json');

const SCRYPT_KEYLEN = 64;

function _ensureDataDir() {
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    }
}

function _loadUsersRaw() {
    try {
        const raw = fs.readFileSync(USERS_PATH, 'utf8');
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

function _saveUsersRaw(users) {
    _ensureDataDir();
    fs.writeFileSync(USERS_PATH, JSON.stringify(users, null, 2), 'utf8');
}

function _hashPassword(password) {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.scryptSync(password, salt, SCRYPT_KEYLEN).toString('hex');
    return { hash, salt };
}

function _verifyPassword(password, hash, salt) {
    const candidate = crypto.scryptSync(password, salt, SCRYPT_KEYLEN);
    const stored = Buffer.from(hash, 'hex');
    if (candidate.length !== stored.length) return false;
    return crypto.timingSafeEqual(candidate, stored);
}

function _nextId() {
    return 'u_' + crypto.randomBytes(6).toString('hex');
}

/** Öffentliche User-Sicht ohne Hash/Salt */
function _publicUser(u) {
    return { id: u.id, username: u.username, role: u.role, createdAt: u.createdAt };
}

/** Liste aller User (ohne Passwort-Hashes) */
function listUsers() {
    return _loadUsersRaw().map(_publicUser);
}

/** Internes Auffinden per Username (case-insensitive), inkl. Hash/Salt */
function findByUsername(username) {
    const needle = (username || '').trim().toLowerCase();
    return _loadUsersRaw().find(u => u.username.toLowerCase() === needle) || null;
}

function findById(id) {
    return _loadUsersRaw().find(u => u.id === id) || null;
}

/**
 * Prüft Login-Credentials. Gibt öffentliches User-Objekt zurück oder null
 * (gleiches Fehlerverhalten für "User nicht gefunden" und "falsches Passwort" —
 * kein User-Enumeration-Leak).
 */
function verifyCredentials(username, password) {
    const user = findByUsername(username);
    if (!user) return null;
    if (!_verifyPassword(password || '', user.passwordHash, user.passwordSalt)) return null;
    return _publicUser(user);
}

/** Legt neuen User an. role: 'admin' | 'user'. Wirft bei doppeltem Username. */
function createUser({ username, password, role }) {
    const name = (username || '').trim();
    if (!name) throw new Error('Username darf nicht leer sein');
    if (!password || password.length < 4) throw new Error('Passwort zu kurz (min. 4 Zeichen)');
    const r = role === 'admin' ? 'admin' : 'user';

    const users = _loadUsersRaw();
    if (users.some(u => u.username.toLowerCase() === name.toLowerCase())) {
        throw new Error(`Benutzername "${name}" existiert bereits`);
    }

    const { hash, salt } = _hashPassword(password);
    const user = {
        id: _nextId(),
        username: name,
        passwordHash: hash,
        passwordSalt: salt,
        role: r,
        createdAt: new Date().toISOString()
    };
    users.push(user);
    _saveUsersRaw(users);
    console.log(`[UserStore V1.0] User "${name}" (${r}) angelegt`);
    return _publicUser(user);
}

/** Verhindert das Löschen/Entwerten des letzten verbleibenden Admins */
function _isLastAdmin(users, id) {
    const target = users.find(u => u.id === id);
    if (!target || target.role !== 'admin') return false;
    return users.filter(u => u.role === 'admin').length <= 1;
}

function deleteUser(id) {
    const users = _loadUsersRaw();
    if (_isLastAdmin(users, id)) {
        throw new Error('Letzter Admin-Account kann nicht gelöscht werden');
    }
    const next = users.filter(u => u.id !== id);
    if (next.length === users.length) throw new Error('User nicht gefunden');
    _saveUsersRaw(next);
    console.log(`[UserStore V1.0] User ${id} gelöscht`);
    return true;
}

function resetPassword(id, newPassword) {
    if (!newPassword || newPassword.length < 4) throw new Error('Passwort zu kurz (min. 4 Zeichen)');
    const users = _loadUsersRaw();
    const user = users.find(u => u.id === id);
    if (!user) throw new Error('User nicht gefunden');
    const { hash, salt } = _hashPassword(newPassword);
    user.passwordHash = hash;
    user.passwordSalt = salt;
    _saveUsersRaw(users);
    console.log(`[UserStore V1.0] Passwort für ${user.username} zurückgesetzt`);
    return true;
}

/**
 * Legt beim ersten Start einen Admin an, falls noch keine User existieren
 * UND ADMIN_BOOTSTRAP_USER/ADMIN_BOOTSTRAP_PASS gesetzt sind.
 */
function bootstrapIfEmpty() {
    const users = _loadUsersRaw();
    if (users.length > 0) return;

    const bootUser = process.env.ADMIN_BOOTSTRAP_USER;
    const bootPass = process.env.ADMIN_BOOTSTRAP_PASS;
    if (!bootUser || !bootPass) {
        console.warn('[UserStore V1.0] Keine User vorhanden — ADMIN_BOOTSTRAP_USER/ADMIN_BOOTSTRAP_PASS setzen, um den ersten Admin anzulegen');
        return;
    }

    createUser({ username: bootUser, password: bootPass, role: 'admin' });
    console.log(`[UserStore V1.0] Bootstrap-Admin "${bootUser}" erstellt`);
}

module.exports = {
    listUsers,
    findByUsername,
    findById,
    verifyCredentials,
    createUser,
    deleteUser,
    resetPassword,
    bootstrapIfEmpty
};
