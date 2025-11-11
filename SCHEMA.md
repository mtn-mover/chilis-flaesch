# Fläsch Info - Datenbank Schema

## Redis Datenstruktur

### 1. Users (Erweitert)
**Key:** `users`
**Type:** String (JSON Array)
```javascript
[
  {
    username: "maxmuster",
    passwordHash: "sha256...",
    displayName: "Max Muster",
    email: "max@example.com",
    role: "reader", // "reader" | "author" | "admin"
    authorRequested: false, // true wenn Autor-Berechtigung beantragt
    createdAt: "2025-11-10T20:00:00Z",
    approved: true // false bis Admin freischaltet
  }
]
```

### 2. Artikel-Likes
**Key:** `likes:article:{articleSlug}`
**Type:** String (JSON Object)
```javascript
{
  count: 42,
  likedBy: [
    "browser-fingerprint-1",
    "browser-fingerprint-2"
  ]
}
```

### 3. Kommentar-Likes
**Key:** `likes:comment:{commentId}`
**Type:** String (JSON Object)
```javascript
{
  count: 5,
  likedBy: ["browser-fingerprint-1"]
}
```

### 4. Kommentare (Approved)
**Key:** `comments:{articleSlug}`
**Type:** String (JSON Array)
```javascript
[
  {
    id: "comment-1699999999999",
    username: "maxmuster",
    displayName: "Max Muster",
    text: "Sehr lustiger Artikel! 😄",
    timestamp: "2025-11-10T20:00:00Z",
    parentId: null, // null = Top-Level, sonst Comment-ID für Antwort
    approved: true,
    likes: 5 // Wird beim Abrufen aus likes:comment:{id} geholt
  }
]
```

### 5. Abgelehnte Kommentare (Admin Review)
**Key:** `comments:rejected`
**Type:** String (JSON Array)
```javascript
[
  {
    id: "comment-1699999999999",
    articleSlug: "chilis-restaurant",
    articleTitle: "Chilis Restaurant eröffnet",
    username: "baduser",
    displayName: "Bad User",
    text: "Problematischer Kommentar...",
    timestamp: "2025-11-10T20:00:00Z",
    parentId: null,
    rejectionReason: "Beleidigender Inhalt erkannt",
    moderationDetails: "Claude AI hat rassistische Sprache erkannt.",
    reviewed: false, // Admin hat noch nicht geprüft
    adminDecision: null // "publish" | "delete" | null
  }
]
```

## Flow-Diagramme

### Registrierungs-Flow:
1. User füllt Registrierung aus (Username, Email, Passwort)
2. Checkbox: "Ich möchte auch Artikel veröffentlichen"
3. User wird mit `role: "reader"` und `approved: false` erstellt
4. Bei Checkbox: `authorRequested: true`
5. E-Mail an Admin (fluesterer@flaesch.info)
6. Admin schaltet User im Panel frei → `approved: true`
7. Wenn Autor beantragt: Admin kann `role: "author"` setzen

### Kommentar-Flow:

**Option A: Selbst schreiben**
1. User (eingeloggt) wählt "✍️ Kommentar selbst schreiben"
2. User tippt Kommentar und klickt "Absenden"
3. Frontend zeigt: "Kommentar wird geprüft..."
4. Backend sendet Kommentar an Claude Moderation API
5. **Falls OK:**
   - Kommentar wird in `comments:{slug}` gespeichert mit `approved: true`
   - Frontend zeigt Kommentar sofort an
6. **Falls ABGELEHNT:**
   - Kommentar wird in `comments:rejected` gespeichert
   - E-Mail an Admin
   - Frontend zeigt: "Ihr Kommentar kann aufgrund der geltenden Richtlinien nicht veröffentlicht werden. Unser Admin wurde benachrichtigt und wird dies prüfen."

**Option B: Mit Claude-Hilfe**
1. User (eingeloggt) wählt "🤖 Claude hilft mir einen lustigen Kommentar zu schreiben"
2. User gibt Stichworte/Thema ein (z.B. "Ich finde das Projekt super!")
3. Claude generiert lustigen, satirischen Kommentar passend zum Artikel
4. User sieht Vorschau und kann "Übernehmen" oder "Neu generieren"
5. User klickt "Kommentar absenden"
6. Claude Moderation prüft (sollte immer OK sein, da selbst generiert)
7. Kommentar wird veröffentlicht

### Like-Flow (Artikel & Kommentare):
1. User klickt Like-Button (KEIN Login erforderlich)
2. Browser-Fingerprint wird generiert (IP + UserAgent Hash)
3. Backend prüft ob Fingerprint bereits in `likedBy` Array
4. Falls nicht: `count++` und Fingerprint hinzufügen
5. Falls ja: `count--` und Fingerprint entfernen (Unlike)
6. Frontend aktualisiert Anzeige

## E-Mail-Benachrichtigungen

### Admin-Benachrichtigungen an fluesterer@flaesch.info:
1. **Neue Registrierung:**
   - Subject: "Neue Registrierung: {username}"
   - Body: Username, Email, Autor-Berechtigung beantragt?
2. **Abgelehnter Kommentar:**
   - Subject: "Kommentar abgelehnt - Review erforderlich"
   - Body: Username, Artikel, Kommentar-Text, Ablehnungsgrund
