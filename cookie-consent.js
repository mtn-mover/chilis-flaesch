// Cookie Consent Banner
class CookieConsent {
    constructor() {
        this.cookieName = 'flaesch_cookie_consent';
        this.init();
    }

    init() {
        // Check if user has already given consent
        if (!this.hasConsent()) {
            this.showBanner();
        }
    }

    hasConsent() {
        return localStorage.getItem(this.cookieName) === 'accepted';
    }

    showBanner() {
        // Create banner HTML
        const banner = document.createElement('div');
        banner.id = 'cookie-consent-banner';
        banner.innerHTML = `
            <div class="cookie-consent-content">
                <div class="cookie-text">
                    <p>
                        <strong>🍪 Cookies & Datenschutz</strong><br>
                        Wir verwenden Cookies, um deine Login-Session zu speichern und die Website-Funktionalität zu gewährleisten.
                        Durch die Nutzung dieser Website stimmst du der Verwendung von Cookies zu.
                    </p>
                </div>
                <div class="cookie-buttons">
                    <button id="cookie-accept" class="cookie-btn cookie-accept">Akzeptieren</button>
                    <button id="cookie-decline" class="cookie-btn cookie-decline">Ablehnen</button>
                </div>
            </div>
        `;

        document.body.appendChild(banner);

        // Add event listeners
        document.getElementById('cookie-accept').addEventListener('click', () => this.acceptCookies());
        document.getElementById('cookie-decline').addEventListener('click', () => this.declineCookies());
    }

    acceptCookies() {
        localStorage.setItem(this.cookieName, 'accepted');
        this.hideBanner();
    }

    declineCookies() {
        localStorage.setItem(this.cookieName, 'declined');
        // Clear any existing session data
        localStorage.removeItem('sessionToken');
        localStorage.removeItem('username');
        localStorage.removeItem('userDisplayName');
        localStorage.removeItem('userRole');
        this.hideBanner();
        // Redirect to home if on protected page
        if (window.location.pathname.includes('admin') ||
            window.location.pathname.includes('create-article') ||
            window.location.pathname.includes('my-articles')) {
            window.location.href = 'index.html';
        }
    }

    hideBanner() {
        const banner = document.getElementById('cookie-consent-banner');
        if (banner) {
            banner.style.animation = 'slideOut 0.3s ease-out';
            setTimeout(() => banner.remove(), 300);
        }
    }

    // Check if cookies are allowed before storing data
    canUseCookies() {
        return this.hasConsent();
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.cookieConsent = new CookieConsent();
});
