// Vercel Serverless Function für Artikel-Erstellung mit Claude API
const { Anthropic } = require('@anthropic-ai/sdk');
const { verifySession } = require('./auth.js');

// CORS Headers für Frontend-Zugriff
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

module.exports = async function handler(req, res) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).json({});
  }

  // Nur POST erlauben
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('=== create-article.js START ===');
    console.log('Request method:', req.method);
    console.log('Request body keys:', Object.keys(req.body || {}));

    const {
      sessionToken,
      title,
      category,
      style,
      content,
      author,
      fileContent, // Base64 encoded file content
      fileName: uploadedFileName,
      fileType: uploadedFileType
    } = req.body;

    console.log('Parsed request data:', { title, category, style, author });

    // Verify session
    console.log('Verifying session...');
    const session = verifySession(sessionToken);
    if (!session) {
      console.log('Session verification failed');
      return res.status(401).json({ error: 'Nicht autorisiert. Bitte erneut einloggen.' });
    }
    console.log('Session OK:', session.username);

    // Get user from Redis to check current role (role might have changed since JWT was issued)
    const Redis = require('ioredis');
    let redis;
    if (process.env.REDIS_URL) {
      redis = new Redis(process.env.REDIS_URL);
    } else {
      const { kv } = require('@vercel/kv');
      redis = kv;
    }
    const usersJson = await redis.get('users');
    const users = usersJson ? JSON.parse(usersJson) : [];
    const userAccount = users.find(u => u.username === session.username);

    // Check if user has author or admin role
    if (!userAccount || (userAccount.role !== 'author' && userAccount.role !== 'admin')) {
      console.log('User does not have author permission:', userAccount?.role);
      return res.status(403).json({
        error: 'Du hast keine Berechtigung, Artikel zu erstellen. Bitte kontaktiere einen Administrator.'
      });
    }
    console.log('Author permission verified');

    // Validierung
    if (!title || !category || !style || !content || !author) {
      console.log('Validation failed - missing fields');
      return res.status(400).json({
        error: 'Fehlende erforderliche Felder'
      });
    }
    console.log('Validation OK');

    // KEINE Content-Prüfung für Artikel-Input nötig!
    // Claude wird den Input ohnehin professionell umschreiben
    // und die Content Policy von Anthropic greift automatisch

    // Initialize Claude API
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    // Prompt für Claude basierend auf Stil
    let styleInstruction = '';
    switch(style) {
      case 'satirisch':
        styleInstruction = 'Schreibe einen satirischen Artikel im Stil von «Der Postillon». Übertreibe leicht, bleibe aber glaubwürdig genug, dass es als Satire erkennbar ist.';
        break;
      case 'absurd':
        styleInstruction = 'Schreibe einen absurden, übertriebenen Artikel. Nutze Ironie und surreale Elemente.';
        break;
      case 'ironisch':
        styleInstruction = 'Schreibe einen ironischen Artikel mit subtiler Kritik und Doppeldeutigkeiten.';
        break;
      case 'ernst-satirisch':
        styleInstruction = 'Schreibe einen Artikel, der ernst beginnt, aber satirische Elemente einwebt.';
        break;
      default:
        styleInstruction = 'Schreibe einen satirischen Artikel.';
    }

    // Datei-Analyse falls vorhanden
    let fileAnalysis = '';
    if (fileContent && uploadedFileName) {
      fileAnalysis = `\n\nDer Nutzer hat eine Datei hochgeladen: "${uploadedFileName}" (${uploadedFileType}). Nutze diese Informationen für den Artikel falls relevant.`;
    }

    const prompt = `Du bist Redakteur für "Fläsch Info", eine satirische Nachrichten-Website über das kleine Schweizer Dorf Fläsch.

${styleInstruction}

**Kontext über Fläsch:**
- Kleines Dorf in Graubünden, bekannt für Weinbau und als "Chili-Dorf"
- Motto: "Fläsch steht auf MEDIUM" (nicht zu mild, nicht zu scharf)
- Im Dorf gibt es einen **Volg** (Dorfladen/Supermarkt) - verwende diesen wenn ein Laden erwähnt werden soll

**WICHTIG - Namensschutz:**
⚠️ **VERWENDE NIEMALS ECHTE NAMEN AUS PROTOKOLLEN ODER DOKUMENTEN!**

**Offizielle Funktionsbezeichnungen (verwende IMMER diese):**
- **Gemeindepräsident** = "Der CEO" oder "CEO" (niemals echter Name!)
- **Vorsitzender der GPK (Geschäftsprüfungskommission)** = "Der Generalsekretär" oder "Generalsekretär"
- **Abwart** = "Der Adjutant" oder "Adjutant"

**Für alle anderen Personen und Funktionen:**
- Erfinde lustige, satirische Pseudonyme (z.B. "El Diablo Müller", "Chili-Chefin Bernadette", "Gemeinderat Pfefferschmid")
- Verwende kreative Funktionsbezeichnungen (z.B. "Schatzmeister", "Oberchili-Kommissar", "Weinrat")
- NIEMALS echte Namen aus Protokollen oder Dokumenten verwenden!

**Wiederkehrende Charaktere (bereits etabliert):**
- **Der CEO (Gemeindepräsident):**
  * Leitet gerne Arbeitsgruppen, setzt aber eigene Meinung durch
  * Nutzt oft "Vertrauen" in Reden
  * Hat Steuererhöhung 70%→75% vorgeschlagen (42:21 abgelehnt)
- **El Diablo Müller:** Dorfbewohner mit starken Meinungen, meldet sich regelmässig
- **Der Generalsekretär:** Vorsitzender der GPK, behält den Überblick
- **Der Adjutant:** Der Abwart, sorgt für Ordnung

**Bisherige Ereignisse (Storylines zum Anknüpfen):**

*Steuer-Debakel (Sept 2025):* Der CEO wollte Steuerfuss 70%→75%. Arbeitsgruppe (20 Leute) empfahl weniger, er brachte volle Erhöhung. 3 verschiedene Finanzpläne kursierten. Abgelehnt 42:21. Vergleich: "Zu scharf wie Twin Peaks"

*Migros Marketing-Fail:* Migros verwendete Korkenzieher statt Chili-Symbol in Fläsch-Kampagne. Peinlich!

*Chili's Restaurant:* Chili's gewann gegen Hooters (zu scharf) und Twin Peaks (viel zu scharf). Schärfe-Skala etabliert.

*El Diablo Müller:* Meldete sich zur "Chili-Steuer" zu Wort, war unzufrieden

*Pumptrack-Projekt:* Neue Pumptrack-Anlage geplant für Biker

**Nutzung:** Erwähne diese Charaktere/Ereignisse wenn es thematisch passt! Bei Politik-Artikeln kann der CEO auftauchen, El Diablo kommentiert kontroverse Themen, die Schärfe-Skala kann für Vergleiche genutzt werden.

**Wichtige Regeln:**
- ⚠️ **KEINE ECHTEN NAMEN aus Protokollen, Dokumenten oder offiziellen Quellen!**
- Verwende IMMER die Funktionsbezeichnungen: CEO, Generalsekretär, Adjutant
- Erfinde lustige Pseudonyme für alle anderen Personen
- KEINE Beleidigungen oder Diffamierungen
- **SCHWEIZER HOCHDEUTSCH verwenden:**
  * **KEIN scharfes ß (ß) - immer "ss" verwenden!** (z.B. "Strasse" statt "Straße", "muss" statt "muß", "grösser" statt "größer")
  * Guillemets «» statt "" für Anführungszeichen
  * Schweizer Begriffe bevorzugen (z.B. "Velo" statt "Fahrrad", "parkieren" statt "parken")
- Satirisch, aber nicht böswillig
- Nutze wiederkehrende Charaktere wenn es passt (besonders der CEO bei Politik-Themen)
- Baue auf bisherigen Ereignissen auf wenn relevant

**Artikel-Informationen:**
Titel: ${title}
Kategorie: ${category}
Stil: ${style}
${fileAnalysis}

**Inhaltsbeschreibung vom Autor:**
${content}

Erstelle ZWEI Dinge:

1. **UNTERTITEL/SCHLAGZEILE:** Eine kurze, knackige Schlagzeile (1 Satz, max. 100 Zeichen), die den Artikel zusammenfasst und Leser neugierig macht
2. **ARTIKEL-CONTENT:** Der Artikel-Inhalt als HTML

Der Artikel soll:
1. Mit einer einleitenden Überschrift (h2) starten
2. 3-5 gut strukturierte Absätze haben
3. Satirische Zitate von fiktiven Dorfbewohnern (nur Vornamen!) enthalten
4. Zwischenüberschriften (h2, h3) für bessere Struktur nutzen
5. Optional: Aufzählungen oder Blockquotes für Zitate

WICHTIG - AUSGABE-FORMAT:
Gib deine Antwort in diesem EXAKTEN Format zurück:

SUBTITLE: [Deine Schlagzeile hier]
---CONTENT---
<h2>Hauptüberschrift</h2>
<p>Absatz mit Text...</p>
<h3>Unterüberschrift</h3>
<blockquote>Zitat von Person</blockquote>

REGELN:
- Beginne mit "SUBTITLE: " gefolgt von der Schlagzeile
- Dann die Zeile "---CONTENT---"
- Dann der HTML-Artikel-Content
- KEINE Markdown-Syntax (kein ##, ###, **, etc.) - nur HTML-Tags!
- KEIN vollständiges HTML-Dokument (kein <!DOCTYPE>, <html>, <head>, <body>)
- KEINE Code-Blöcke mit drei Backticks
- KEIN Navigation oder Footer

Beginne jetzt mit "SUBTITLE: " !`;

    // Claude API Call
    console.log('Calling Claude API...');
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048, // Reduced from 4096 to speed up and reduce memory
      messages: [{
        role: 'user',
        content: prompt
      }]
    });
    console.log('Claude API call successful');

    let fullResponse = message.content[0].text;
    let subtitle = '';
    let generatedHTML = '';

    try {
      // Extract subtitle and content
      const subtitleMatch = fullResponse.match(/SUBTITLE:\s*(.+?)(?:\n|---)/i);
      if (subtitleMatch) {
        subtitle = subtitleMatch[1].trim();
      }

      // Extract content after ---CONTENT---
      const contentMatch = fullResponse.match(/---CONTENT---\s*([\s\S]+)/i);
      if (contentMatch) {
        generatedHTML = contentMatch[1].trim();
      } else {
        // Fallback: if no ---CONTENT--- marker, use everything after SUBTITLE line
        const lines = fullResponse.split('\n');
        const subtitleLineIndex = lines.findIndex(line => line.toUpperCase().startsWith('SUBTITLE:'));
        if (subtitleLineIndex >= 0) {
          generatedHTML = lines.slice(subtitleLineIndex + 1).join('\n').trim();
        } else {
          // No subtitle found, use full response as HTML
          generatedHTML = fullResponse;
        }
      }

      // Bereinige den generierten Content (entferne Code-Blöcke falls vorhanden)
      generatedHTML = generatedHTML
        .replace(/```html\s*/g, '')  // Entferne ```html
        .replace(/```\s*/g, '')      // Entferne ```
        .trim();

      // Convert Markdown to HTML if Claude used Markdown syntax
      // Headings
      generatedHTML = generatedHTML
        .replace(/^### (.+)$/gm, '<h3>$1</h3>')  // ### to <h3>
        .replace(/^## (.+)$/gm, '<h2>$1</h2>')   // ## to <h2>
        .replace(/^# (.+)$/gm, '<h2>$1</h2>');   // # to <h2>

      // Bold and italic
      generatedHTML = generatedHTML
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')  // **text** to <strong>
        .replace(/\*(.+?)\*/g, '<em>$1</em>');             // *text* to <em>

      // Wrap standalone text in paragraphs (simple approach)
      const lines = generatedHTML.split('\n');
      const processedLines = lines.map(line => {
        line = line.trim();
        if (!line) return '';
        // If line doesn't start with HTML tag, wrap in <p>
        if (!line.startsWith('<') && line.length > 0) {
          return `<p>${line}</p>`;
        }
        return line;
      });
      generatedHTML = processedLines.join('\n');

      // Entferne vollständiges HTML-Dokument falls Claude es trotzdem generiert hat
      if (generatedHTML.includes('<!DOCTYPE')) {
        // Extrahiere nur den Body-Content
        const bodyMatch = generatedHTML.match(/<body[^>]*>([\s\S]*)<\/body>/i);
        if (bodyMatch) {
          generatedHTML = bodyMatch[1];
        }
      }

      // Entferne Header/Navigation/Footer falls vorhanden
      generatedHTML = generatedHTML
        .replace(/<header[\s\S]*?<\/header>/gi, '')
        .replace(/<nav[\s\S]*?<\/nav>/gi, '')
        .replace(/<footer[\s\S]*?<\/footer>/gi, '');

      // Entferne "Fläsch Info" Überschriften am Anfang
      generatedHTML = generatedHTML
        .replace(/^[\s\S]*?<h1[^>]*>.*?Fläsch Info.*?<\/h1>/i, '')
        .replace(/^[\s\S]*?Die satirischen Nachrichten aus dem Dorf/i, '')
        .trim();

      // Falls es mit <main> oder <article> anfängt, extrahiere den Inhalt
      const mainMatch = generatedHTML.match(/<main[^>]*>([\s\S]*)<\/main>/i);
      if (mainMatch) {
        generatedHTML = mainMatch[1].trim();
      }
      const articleMatch = generatedHTML.match(/<article[^>]*>([\s\S]*)<\/article>/i);
      if (articleMatch) {
        generatedHTML = articleMatch[1].trim();
      }
    } catch (cleanupError) {
      console.error('Cleanup error (non-critical):', cleanupError);
      // If cleanup fails, use original content
    }

    // Dateiname für neuen Artikel generieren (aus Titel)
    const fileName = title
      .toLowerCase()
      .replace(/ä/g, 'ae')
      .replace(/ö/g, 'oe')
      .replace(/ü/g, 'ue')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      + '.html';

    // Rückgabe
    return res.status(200).json({
      success: true,
      fileName: fileName,
      html: generatedHTML,
      subtitle: subtitle,
      category: category,
      author: author,
      message: 'Artikel erfolgreich generiert!'
    });

  } catch (error) {
    console.error('Error in create-article:', error);
    console.error('Error stack:', error.stack);
    console.error('Error type:', error.constructor.name);

    // Spezielle Fehlerbehandlung für API Key
    if (error.message && error.message.includes('API key')) {
      return res.status(500).json({
        error: 'API Key fehlt oder ist ungültig',
        details: error.message
      });
    }

    // Anthropic API Fehler
    if (error.status) {
      return res.status(500).json({
        error: 'Claude API Fehler',
        details: error.message,
        status: error.status
      });
    }

    // Timeout errors
    if (error.code === 'ETIMEDOUT' || error.message.includes('timeout')) {
      return res.status(500).json({
        error: 'Timeout: Claude brauchte zu lange',
        details: 'Versuche es mit kürzerem Inhalt oder warte einen Moment'
      });
    }

    return res.status(500).json({
      error: 'Fehler bei der Artikel-Generierung',
      details: error.message || 'Unbekannter Fehler',
      errorType: error.constructor.name
    });
  }
}
