# Testing Guide - Fläsch Info Kommentar-System

## ✅ Was ist fertig und kann getestet werden:

### 1. **Benutzerregistrierung**
- 🌐 Gehe zu: `https://www.flaesch.info/register.html`
- ✍️ Registriere einen neuen Benutzer
- ☑️ Optional: Checkbox "Ich möchte auch Artikel veröffentlichen" aktivieren
- 📧 Admin erhält E-Mail (wenn RESEND_API_KEY konfiguriert ist)

### 2. **Admin-Panel: Benutzerfreischaltung**
- 🔐 Login als Admin: `https://www.flaesch.info/admin.html`
- 👥 Gehe zu: Benutzerverwaltung
- ✓ Siehst du den neuen User mit Status "⏳ Warte auf Freischaltung"?
- 🔓 Klicke "Freischalten"
- 📝 Falls Autor beantragt: Klicke "Autor machen"

### 3. **Like-System testen**
- 📄 Gehe zu: `https://www.flaesch.info/traktandenliste-der-naechsten-generalversammlung.html`
- ❤️ Klicke auf "🤍 Gefällt mir" Button
- ✅ Button sollte zu "❤️ Gefällt mir" werden
- 🔢 Like-Counter sollte hochzählen
- 🔄 Erneut klicken = Unlike

### 4. **Kommentar-System testen**

**Als nicht-angemeldeter User:**
- 📄 Artikel öffnen
- 🔒 Sollte "Du musst angemeldet sein" sehen
- 🔗 Links zu Login und Registrierung

**Als angemeldeter User:**
- 🔑 Einloggen mit freigeschaltetem User
- 📝 Artikel öffnen
- ✍️ Kommentar-Formular sollte sichtbar sein
- Zwei Modi testen:

  **a) Selbst schreiben:**
  - ✍️ "Selbst schreiben" wählen
  - 💬 Text eingeben: "Das ist ein Test-Kommentar!"
  - 📨 "Kommentar absenden" klicken
  - ⏳ "Wird geprüft..." wird angezeigt
  - ✅ Kommentar erscheint in Liste (wenn approved)
  - ⚠️ Warnung erscheint (wenn rejected)

  **b) Mit Claude-Hilfe:**
  - 🤖 "Mit Claude-Hilfe" wählen
  - 💡 Stichworte eingeben: "Sehr lustig!"
  - 📨 "Kommentar absenden"
  - 🎭 Claude generiert lustigen Kommentar
  - ✅ Bestätigung → Kommentar wird gepostet

### 5. **Kommentar-Likes testen**
- ❤️ Klicke auf Like-Button bei einem Kommentar
- 🔢 Zähler sollte hochgehen
- 🔄 Erneut klicken = Unlike

---

## ⚠️ Was noch NICHT funktioniert (E-Mail-Konfiguration fehlt):

### 📧 E-Mail-Benachrichtigungen
Die E-Mail-Benachrichtigungen funktionieren erst, wenn du einen **Resend API Key** konfiguriert hast.

**So konfigurierst du Resend:**

1. **Registriere dich bei Resend:**
   - Gehe zu: https://resend.com
   - Erstelle einen kostenlosen Account
   - Verifiziere deine E-Mail-Adresse

2. **Erstelle einen API Key:**
   - Dashboard → API Keys
   - "Create API Key" klicken
   - Name: "Fläsch Info"
   - Permissions: "Full Access" oder "Sending Access"
   - Key kopieren (beginnt mit `re_...`)

3. **Füge den Key zu Vercel hinzu:**
   ```bash
   cd C:\Users\zwahl\Git_Repository\chilis-flaesch
   vercel env add RESEND_API_KEY
   ```
   - Wähle: Production, Preview, Development (alle drei)
   - Füge den API Key ein

4. **Domain verifizieren (optional aber empfohlen):**
   - Resend Dashboard → Domains
   - Füge `flaesch.info` hinzu
   - Setze die DNS-Records (SPF, DKIM)
   - Dadurch werden E-Mails nicht als Spam markiert

**Ohne Resend-Konfiguration:**
- ❌ Admin erhält KEINE E-Mail bei neuer Registrierung
- ❌ Admin erhält KEINE E-Mail bei abgelehnten Kommentaren
- ✅ Alles andere funktioniert trotzdem!

---

## 🎯 Test-Szenarien:

### Szenario 1: Normaler Kommentar
1. Registriere User "testuser"
2. Admin schaltet User frei
3. User loggt sich ein
4. User schreibt Kommentar: "Super Artikel!"
5. ✅ Kommentar wird sofort veröffentlicht

### Szenario 2: Problematischer Kommentar
1. User schreibt: "Diese Idioten!"
2. Claude erkennt Beleidigung
3. ⚠️ User sieht: "Kommentar kann nicht veröffentlicht werden"
4. 📧 Admin erhält E-Mail (wenn Resend konfiguriert)
5. Admin kann Kommentar im Admin-Panel prüfen (Panel noch nicht erstellt)

### Szenario 3: Claude-generierter Kommentar
1. User wählt "Mit Claude-Hilfe"
2. Gibt ein: "Finde ich cool"
3. Claude generiert: "Also wenn das nicht der Gipfel der Unterhaltung ist! Fläsch bleibt sich treu - immer für eine Überraschung gut. Sehr cool, gäll! 😄"
4. User bestätigt
5. ✅ Kommentar wird veröffentlicht

---

## 🐛 Bekannte Probleme / Noch zu tun:

### Noch nicht implementiert:
1. ❌ **Admin-Panel für abgelehnte Kommentare** fehlt noch
   - Admin kann abgelehnte Kommentare noch nicht sehen/prüfen
   - API existiert: `/api/admin-rejected-comments`
   - Frontend fehlt

2. ❌ **Antwort-Funktion (Threads)** ist vorbereitet aber nicht vollständig
   - "Antworten" Button ist da
   - Funktionalität noch nicht vollständig implementiert

3. ❌ **Andere Artikel haben noch keine Kommentare**
   - Nur `traktandenliste-der-naechsten-generalversammlung.html` hat das System
   - Template existiert in `comments-template.html`
   - Muss manuell in andere Artikel eingefügt werden

4. ❌ **Publish-Article Template** noch nicht aktualisiert
   - Neue Artikel haben noch keine Kommentar-Sektion
   - Muss in `api/publish-article.js` ergänzt werden

---

## 📋 Checkliste für vollständigen Test:

- [ ] Registrierung eines neuen Users
- [ ] Admin-Freischaltung testen
- [ ] Autor-Rolle erteilen testen
- [ ] Login mit freigeschaltetem User
- [ ] Artikel liken (als nicht-eingeloggt)
- [ ] Artikel liken (als eingeloggt)
- [ ] Kommentar selbst schreiben (normal)
- [ ] Kommentar selbst schreiben (mit Schimpfwort → sollte abgelehnt werden)
- [ ] Kommentar mit Claude-Hilfe generieren
- [ ] Kommentar liken
- [ ] Resend API Key konfigurieren
- [ ] E-Mail-Benachrichtigungen testen

---

## 🔧 Troubleshooting:

**Problem:** Likes funktionieren nicht
- Prüfe Browser-Console (F12) auf Fehler
- Stelle sicher, dass `/api/likes` erreichbar ist

**Problem:** Kommentare werden nicht geladen
- Prüfe Browser-Console auf Fehler
- Stelle sicher, dass `comments.js` und `comments.css` geladen werden

**Problem:** "Du musst angemeldet sein" obwohl eingeloggt
- Prüfe ob `sessionToken` in sessionStorage existiert
- Versuche erneut einzuloggen

**Problem:** Kommentar wird immer abgelehnt
- Prüfe ob ANTHROPIC_API_KEY in Vercel konfiguriert ist
- Schaue in Vercel Logs nach Fehlern

---

## 💡 Nächste Schritte:

1. **Testen:** Gehe die Checkliste durch und teste alles
2. **Resend konfigurieren:** Damit E-Mails funktionieren
3. **Feedback geben:** Was funktioniert? Was nicht?
4. **Admin-Panel für abgelehnte Kommentare:** Soll ich das noch erstellen?
5. **Andere Artikel:** Soll ich das Kommentar-System in alle Artikel einbauen?
