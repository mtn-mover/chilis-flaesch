// Zentrale Auth Utilities für alle Seiten
// Verwendet localStorage für persistente Sessions

class AuthUtils {
    constructor() {
        this.SESSION_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 Tage
    }

    // Session Token speichern
    saveSession(sessionData) {
        if (!window.cookieConsent || !window.cookieConsent.canUseCookies()) {
            throw new Error('Cookies müssen akzeptiert werden');
        }

        localStorage.setItem('sessionToken', sessionData.sessionToken);
        localStorage.setItem('username', sessionData.username);
        localStorage.setItem('userDisplayName', sessionData.displayName);
        localStorage.setItem('userRole', sessionData.role);
        localStorage.setItem('loginTimestamp', Date.now().toString());
    }

    // Session Token abrufen
    getSessionToken() {
        if (this.isSessionExpired()) {
            this.clearSession();
            return null;
        }
        return localStorage.getItem('sessionToken');
    }

    // Session-Daten abrufen
    getSessionData() {
        if (this.isSessionExpired()) {
            this.clearSession();
            return null;
        }

        const sessionToken = localStorage.getItem('sessionToken');
        if (!sessionToken) return null;

        return {
            sessionToken: sessionToken,
            username: localStorage.getItem('username'),
            displayName: localStorage.getItem('userDisplayName'),
            role: localStorage.getItem('userRole')
        };
    }

    // Prüfen ob Session abgelaufen ist
    isSessionExpired() {
        const loginTimestamp = localStorage.getItem('loginTimestamp');
        if (!loginTimestamp) return true;

        const elapsed = Date.now() - parseInt(loginTimestamp);
        return elapsed > this.SESSION_DURATION;
    }

    // Session löschen
    clearSession() {
        localStorage.removeItem('sessionToken');
        localStorage.removeItem('username');
        localStorage.removeItem('userDisplayName');
        localStorage.removeItem('userRole');
        localStorage.removeItem('loginTimestamp');
    }

    // Logout durchführen
    async logout() {
        const sessionToken = this.getSessionToken();

        if (sessionToken) {
            try {
                await fetch('/api/logout', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ sessionToken })
                });
            } catch (error) {
                console.error('Logout error:', error);
            }
        }

        this.clearSession();
        window.location.href = 'admin.html';
    }

    // Session verifizieren
    async verifySession() {
        const sessionToken = this.getSessionToken();
        if (!sessionToken) return null;

        try {
            const response = await fetch('/api/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionToken })
            });

            const result = await response.json();

            if (result.valid) {
                return {
                    username: result.username,
                    displayName: result.displayName,
                    role: result.role
                };
            } else {
                this.clearSession();
                return null;
            }
        } catch (error) {
            console.error('Verify session error:', error);
            this.clearSession();
            return null;
        }
    }

    // Geschützte Seite prüfen (Redirect wenn nicht eingeloggt)
    async requireAuth(redirectUrl = 'admin.html') {
        const session = await this.verifySession();
        if (!session) {
            window.location.href = redirectUrl;
            return null;
        }
        return session;
    }

    // Admin-Berechtigung prüfen
    async requireAdmin(redirectUrl = 'my-articles.html') {
        const session = await this.requireAuth('admin.html');
        if (!session) return null;

        if (session.role !== 'admin') {
            window.location.href = redirectUrl;
            return null;
        }

        return session;
    }

    // Autor-Berechtigung prüfen
    async requireAuthor(redirectUrl = 'index.html') {
        const session = await this.requireAuth('admin.html');
        if (!session) return null;

        if (session.role !== 'admin' && session.role !== 'author') {
            alert('Du benötigst Autor-Rechte, um Artikel zu erstellen');
            window.location.href = redirectUrl;
            return null;
        }

        return session;
    }

    // Ist User eingeloggt? (ohne Redirect)
    async isLoggedIn() {
        const session = await this.verifySession();
        return session !== null;
    }

    // Session-Dauer verlängern (bei Aktivität)
    refreshSession() {
        const sessionToken = localStorage.getItem('sessionToken');
        if (sessionToken && !this.isSessionExpired()) {
            localStorage.setItem('loginTimestamp', Date.now().toString());
        }
    }
}

// Globale Instanz erstellen
window.authUtils = new AuthUtils();

// Session bei Aktivität verlängern (alle 5 Minuten)
setInterval(() => {
    if (window.authUtils.getSessionToken()) {
        window.authUtils.refreshSession();
    }
}, 5 * 60 * 1000);
