/**
 * CeraCUT Admin-Users V1.0
 * Minimale Admin-Seite zur Benutzerverwaltung (Anlegen, Löschen, Passwort
 * zurücksetzen). Bewusst eigenständige Seite statt Integration in app.js —
 * lädt nicht das komplette CAD/CAM-Script-Bundle.
 *
 * Rollen-Check doppelt: Server liefert 403 bei Nicht-Admin auf /api/admin/*,
 * diese Seite blendet sich zusätzlich clientseitig aus.
 *
 * Created: 2026-06-24 MEZ
 * Last Modified: 2026-06-24 MEZ
 * Build: 20260624-userlogin
 */

// XSS-Schutz — dupliziert aus app.js (kein Shared-Util-Modul für diese 9 Zeilen)
function sanitizeHTML(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

async function loadUsers() {
    const listMsg = document.getElementById('list-msg');
    listMsg.textContent = '';
    listMsg.className = 'admin-msg';
    try {
        const res = await fetch('/api/admin/users', { credentials: 'same-origin' });
        if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            listMsg.textContent = data.error || 'Fehler beim Laden';
            listMsg.className = 'admin-msg error';
            return;
        }
        const data = await res.json();
        renderUsers(data.users || []);
    } catch (err) {
        console.error('[AdminUsers V1.0] Fehler:', err);
        listMsg.textContent = 'Server nicht erreichbar';
        listMsg.className = 'admin-msg error';
    }
}

function renderUsers(users) {
    const tbody = document.getElementById('user-table-body');
    tbody.innerHTML = users.map(u => {
        const created = new Date(u.createdAt).toLocaleDateString('de-DE');
        return `<tr data-id="${sanitizeHTML(u.id)}">
            <td>${sanitizeHTML(u.username)}</td>
            <td>${sanitizeHTML(u.role)}</td>
            <td>${sanitizeHTML(created)}</td>
            <td>
                <button class="btn-reset" data-id="${sanitizeHTML(u.id)}" data-username="${sanitizeHTML(u.username)}">Passwort zurücksetzen</button>
                <button class="btn-delete danger" data-id="${sanitizeHTML(u.id)}" data-username="${sanitizeHTML(u.username)}">Löschen</button>
            </td>
        </tr>`;
    }).join('');

    tbody.querySelectorAll('.btn-delete').forEach(btn => {
        btn.addEventListener('click', () => deleteUser(btn.dataset.id, btn.dataset.username));
    });
    tbody.querySelectorAll('.btn-reset').forEach(btn => {
        btn.addEventListener('click', () => resetPassword(btn.dataset.id, btn.dataset.username));
    });
}

async function deleteUser(id, username) {
    if (!confirm(`Benutzer "${username}" wirklich löschen?`)) return;
    try {
        const res = await fetch('/api/admin/users/delete', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) { alert(data.error || 'Löschen fehlgeschlagen'); return; }
        loadUsers();
    } catch (err) {
        console.error('[AdminUsers V1.0] Fehler:', err);
        alert('Server nicht erreichbar');
    }
}

async function resetPassword(id, username) {
    const newPassword = prompt(`Neues Passwort für "${username}":`);
    if (!newPassword) return;
    try {
        const res = await fetch('/api/admin/users/reset-password', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, newPassword })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) { alert(data.error || 'Zurücksetzen fehlgeschlagen'); return; }
        alert(`Passwort für "${username}" zurückgesetzt`);
    } catch (err) {
        console.error('[AdminUsers V1.0] Fehler:', err);
        alert('Server nicht erreichbar');
    }
}

document.getElementById('create-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('new-username').value;
    const password = document.getElementById('new-password').value;
    const role = document.getElementById('new-role').value;
    const msg = document.getElementById('create-msg');
    msg.textContent = '';
    msg.className = 'admin-msg';

    try {
        const res = await fetch('/api/admin/users', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password, role })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            msg.textContent = data.error || 'Anlegen fehlgeschlagen';
            msg.className = 'admin-msg error';
            return;
        }
        msg.textContent = `Benutzer "${data.user.username}" angelegt`;
        msg.className = 'admin-msg success';
        document.getElementById('create-form').reset();
        loadUsers();
    } catch (err) {
        console.error('[AdminUsers V1.0] Fehler:', err);
        msg.textContent = 'Server nicht erreichbar';
        msg.className = 'admin-msg error';
    }
});

// ── Rollen-Gate (clientseitig, Server gated die eigentlichen API-Calls ohnehin) ──
(async function init() {
    try {
        const res = await fetch('/api/auth/me', { credentials: 'same-origin' });
        if (!res.ok) { window.location.href = '/login.html'; return; }
        const me = await res.json();
        if (me.role !== 'admin') {
            document.getElementById('admin-shell').style.display = 'none';
            document.getElementById('no-access').style.display = 'block';
            return;
        }
        loadUsers();
    } catch (err) {
        console.error('[AdminUsers V1.0] Init-Fehler:', err);
    }
})();
