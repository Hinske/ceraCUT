/**
 * CeraCUT Login V1.0
 * Minimale Login-Seite — postet Credentials an /api/auth/login, leitet bei
 * Erfolg auf die App-Shell (/) weiter.
 *
 * Created: 2026-06-24 MEZ
 * Last Modified: 2026-06-24 MEZ
 * Build: 20260624-userlogin
 */

document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('login-username').value;
    const password = document.getElementById('login-password').value;
    const errorEl = document.getElementById('login-error');
    errorEl.textContent = '';

    try {
        const res = await fetch('/api/auth/login', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        if (res.ok) {
            console.log('[Login V1.0] Anmeldung erfolgreich');
            window.location.href = '/';
            return;
        }
        const data = await res.json().catch(() => ({}));
        errorEl.textContent = data.error || 'Anmeldung fehlgeschlagen';
    } catch (err) {
        console.error('[Login V1.0] Fehler:', err);
        errorEl.textContent = 'Server nicht erreichbar';
    }
});
