# 🌶️ Fläsch Info - Satirische Dorfnachrichten

Eine satirische News-Website über das Schweizer Dorf Fläsch, powered by Claude AI.

## 🎯 Projekt-Übersicht

**Fläsch Info** ist eine humorvolle Nachrichten-Website, die satirische Geschichten über das Dorf Fläsch generiert. Die Inhalte werden von Claude AI erstellt und durch ein Community-System mit Kommentaren und Likes ergänzt.

**Live-Website:** https://www.flaesch.info

---

## ✨ Features

### 📰 Artikel-System
- ✅ KI-generierte satirische Artikel über Fläsch
- ✅ Automatische Artikel-Erstellung mit Claude AI
- ✅ Draft-System für unveröffentlichte Artikel
- ✅ Multi-User-System für Autoren

### 👥 Benutzer-System
- ✅ **Selbstregistrierung** mit E-Mail-Benachrichtigung an Admin
- ✅ **Drei Benutzerrollen:**
  - **Leser** (reader): Kann kommentieren und liken
  - **Autor** (author): Kann zusätzlich Artikel veröffentlichen
  - **Admin**: Volle Verwaltungsrechte
- ✅ **Admin-Freischaltung** erforderlich für neue Benutzer
- ✅ **Autor-Berechtigung** kann beantragt werden

### 💬 Kommentar-System
- ✅ **Kommentare mit Claude-Moderation**
  - Automatische Prüfung auf problematische Inhalte
  - Beleidigungen, Rassismus, etc. werden blockiert
- ✅ **Zwei Kommentar-Modi:**
  - ✍️ **Selbst schreiben:** Normale Texteingabe
  - 🤖 **Mit Claude-Hilfe:** KI generiert lustigen Kommentar aus Stichw orten
- ✅ **Likes für Kommentare**
- ✅ Login erforderlich zum Kommentieren

### ❤️ Like-System
- ✅ **Likes für Artikel** (kein Login erforderlich)
- ✅ **Likes für Kommentare** (kein Login erforderlich)
- ✅ Browser-Fingerprint verhindert Mehrfach-Likes

### 🔐 Admin-Panel
- ✅ **Benutzerverwaltung:**
  - Benutzer freischalten/sperren
  - Rollen zuweisen (Leser → Autor → Admin)
  - Benutzer löschen
- ✅ **Artikel-Verwaltung:**
  - Entwürfe verwalten
  - Artikel veröffentlichen
  - Artikel löschen
- ⏳ **Kommentar-Moderation:** (noch nicht fertig)
  - Abgelehnte Kommentare prüfen
  - Kommentare nachträglich freigeben/löschen

### 📧 E-Mail-Benachrichtigungen
- ✅ Admin wird benachrichtigt bei:
  - Neuer Benutzerregistrierung
  - Abgelehnten Kommentaren (zur manuellen Prüfung)
  - Autor-Berechtigungs-Anfragen

---

## 🏗️ Technologie-Stack

### Frontend
- **HTML5, CSS3, JavaScript** (Vanilla JS, keine Frameworks)
- **Responsive Design** für Mobile und Desktop
- **sessionStorage** für Session-Management

### Backend
- **Vercel Serverless Functions** (Node.js)
- **Redis** (Vercel KV) für Datenspeicherung
- **Claude AI (Anthropic)** für Content-Generation und Moderation
- **Resend** für E-Mail-Versand
- **GitHub API** für automatisches Publishing

### APIs
- `/api/auth` - Login/Logout
- `/api/register` - Benutzerregistrierung
- `/api/verify` - Session-Verifikation
- `/api/manage-users` - Benutzerverwaltung (Admin)
- `/api/create-article` - Artikel mit Claude generieren
- `/api/publish-article` - Artikel veröffentlichen
- `/api/comments` - Kommentare erstellen/abrufen
- `/api/likes` - Likes für Artikel/Kommentare
- `/api/generate-comment` - Claude-Kommentar-Assistent
- `/api/moderate-comment` - Kommentar-Moderation
- `/api/admin-rejected-comments` - Abgelehnte Kommentare verwalten
- `/api/send-email` - E-Mail-Service

---

## 🚀 Setup & Installation

### 1. Repository klonen
```bash
git clone https://github.com/mtn-mover/chilis-flaesch.git
cd chilis-flaesch
```

### 2. Vercel CLI installieren
```bash
npm install -g vercel
```

### 3. Mit Vercel verbinden
```bash
vercel login
vercel link
```

### 4. Environment Variables konfigurieren

**Erforderliche Keys:**
```bash
# Anthropic API Key (für Claude AI)
vercel env add ANTHROPIC_API_KEY

# GitHub Token (für automatisches Publishing)
vercel env add GITHUB_TOKEN

# Resend API Key (für E-Mail-Versand)
vercel env add RESEND_API_KEY

# Redis URL (Vercel KV)
vercel env add REDIS_URL

# JWT Secret (für Sessions)
vercel env add JWT_SECRET
```

**Für alle Environments auswählen:** Production, Preview, Development

### 5. Deployen
```bash
vercel --prod
```

---

## 📖 Verwendung

### Als Admin:
1. Login: `https://www.flaesch.info/admin.html`
2. **Benutzer verwalten:** Neue Benutzer freischalten, Rollen zuweisen
3. **Artikel erstellen:** Mit Claude AI neue satirische Artikel generieren
4. **Artikel veröffentlichen:** Entwürfe prüfen und publizieren

### Als Autor:
1. Registrieren oder von Admin freischalten lassen
2. Login und Artikel erstellen
3. Entwürfe speichern oder direkt veröffentlichen

### Als Leser:
1. Registrieren (kostenlos)
2. Von Admin freischalten lassen
3. Artikel kommentieren und liken

### Als Besucher (ohne Login):
1. Artikel lesen
2. Artikel liken
3. Kommentare lesen

---

## 🎨 Kommentar-System in Artikel einbauen

Um das Kommentar-System in einen neuen Artikel einzubauen:

### 1. CSS und JavaScript einbinden
```html
<!-- Vor dem schließenden </body> Tag -->
<link rel="stylesheet" href="comments.css">
```

### 2. HTML-Struktur einfügen
```html
<!-- Like Section -->
<div class="like-section">
    <button id="likeButton" class="like-button">🤍 Gefällt mir</button>
    <span class="like-count">👍 <span id="likeCount">0</span> Likes</span>
</div>

<!-- Comments Section -->
<div class="comments-section">
    <!-- Siehe comments-template.html für vollständige Struktur -->
</div>
```

### 3. JavaScript konfigurieren
```html
<script>
    window.ARTICLE_SLUG = 'artikel-slug-hier';
    window.ARTICLE_TITLE = 'Artikel Titel hier';
</script>
<script src="comments.js"></script>
```

**Vollständige Vorlage:** Siehe [`comments-template.html`](comments-template.html)

---

## 🗂️ Datenbank-Schema

Siehe [`SCHEMA.md`](SCHEMA.md) für vollständige Dokumentation.

### Wichtigste Strukturen:

**Users:**
```javascript
{
  username: "maxmuster",
  passwordHash: "sha256...",
  displayName: "Max Muster",
  email: "max@example.com",
  role: "reader", // "reader" | "author" | "admin"
  approved: false, // true nach Admin-Freischaltung
  authorRequested: false, // true wenn Autor-Rechte beantragt
  createdAt: "2025-11-10T20:00:00Z"
}
```

**Comments:**
```javascript
{
  id: "comment-1699999999999",
  username: "maxmuster",
  displayName: "Max Muster",
  text: "Sehr lustiger Artikel! 😄",
  timestamp: "2025-11-10T20:00:00Z",
  parentId: null,
  approved: true
}
```

**Likes:**
```javascript
{
  count: 42,
  likedBy: ["fingerprint-1", "fingerprint-2", ...]
}
```

---

## 🧪 Testing

Siehe [`TESTING.md`](TESTING.md) für vollständige Test-Anleitung.

**Wichtigste Test-Szenarien:**
1. ✅ Registrierung und Freischaltung
2. ✅ Artikel liken
3. ✅ Kommentar selbst schreiben
4. ✅ Kommentar mit Claude-Hilfe
5. ✅ Kommentar-Moderation
6. ✅ Kommentar-Likes

---

## 🔧 Konfiguration

### Resend (E-Mail)
1. Account erstellen: https://resend.com
2. API Key generieren
3. In Vercel konfigurieren: `vercel env add RESEND_API_KEY`
4. Optional: Domain verifizieren für bessere Zustellbarkeit

### Redis (Vercel KV)
- Automatisch konfiguriert wenn Vercel KV aktiviert ist
- Keine manuelle Konfiguration nötig

### Claude AI
- API Key von Anthropic: https://console.anthropic.com
- Modell: `claude-3-5-sonnet-20241022`

---

## 📁 Projekt-Struktur

```
chilis-flaesch/
├── api/                          # Serverless Functions
│   ├── auth.js                   # Login/Logout
│   ├── register.js               # Benutzerregistrierung
│   ├── manage-users.js           # Benutzerverwaltung
│   ├── create-article.js         # Artikel-Generierung
│   ├── publish-article.js        # Artikel veröffentlichen
│   ├── comments.js               # Kommentar-System
│   ├── likes.js                  # Like-System
│   ├── generate-comment.js       # Claude-Kommentar-Assistent
│   ├── moderate-comment.js       # Kommentar-Moderation
│   ├── admin-rejected-comments.js # Abgelehnte Kommentare
│   └── send-email.js             # E-Mail-Service
├── context/                      # Kontext-Informationen für Claude
│   └── flaesch-kontext.md
├── *.html                        # Frontend-Seiten
├── comments.js                   # Kommentar-Frontend-Logik
├── comments.css                  # Kommentar-Styles
├── comments-template.html        # Vorlage zum Einbinden
├── SCHEMA.md                     # Datenbank-Dokumentation
├── TESTING.md                    # Test-Anleitung
└── README.md                     # Diese Datei
```

---

## 🐛 Bekannte Probleme

1. **Admin-Panel für abgelehnte Kommentare fehlt**
   - API existiert, Frontend noch nicht implementiert
2. **Antwort-Funktion (Threads) nicht vollständig**
   - Button ist da, Funktionalität teilweise implementiert
3. **Nur ein Artikel hat Kommentar-System**
   - Muss manuell in andere Artikel eingefügt werden

---

## 🚧 Roadmap / ToDo

- [ ] Admin-Panel für abgelehnte Kommentare erstellen
- [ ] Thread-Antworten vollständig implementieren
- [ ] Kommentar-System in alle Artikel einbauen
- [ ] Publish-Template mit Kommentar-System aktualisieren
- [ ] Benachrichtigungssystem für Kommentar-Antworten
- [ ] User-Profile mit Kommentar-Historie
- [ ] Markdown-Support für Kommentare
- [ ] Bild-Upload für Artikel

---

## 📞 Kontakt & Support

- **Issues:** https://github.com/mtn-mover/chilis-flaesch/issues
- **Website:** https://www.flaesch.info
- **Admin-E-Mail:** fluesterer@flaesch.info

---

## 📜 Lizenz

Dieses Projekt ist für private/satirische Zwecke erstellt.

---

## 🙏 Credits

- **Claude AI (Anthropic):** Content-Generierung und Moderation
- **Vercel:** Hosting und Serverless Functions
- **Resend:** E-Mail-Service
- **GitHub:** Code-Repository und automatisches Publishing

---

**🌶️ Fläsch steht auf MEDIUM - nicht zu mild, nicht zu scharf!**
