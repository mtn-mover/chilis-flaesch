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

    // Verify session
    const session = verifySession(sessionToken);
    if (!session) {
      return res.status(401).json({ error: 'Nicht autorisiert. Bitte erneut einloggen.' });
    }

    // Validierung
    if (!title || !category || !style || !content || !author) {
      return res.status(400).json({
        error: 'Fehlende erforderliche Felder'
      });
    }

    // Content Policy Check (einfache Keywords)
    const bannedWords = ['fick', 'scheiss', 'arsch', 'idiot', 'dumm'];
    const contentLower = content.toLowerCase();
    const hasBannedWords = bannedWords.some(word => contentLower.includes(word));

    if (hasBannedWords) {
      return res.status(400).json({
        error: 'Inhalt verstösst gegen Content Policy (Beleidigungen)'
      });
    }

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
- Kleines Dorf in Graubünden, bekannt für Weinbau
- Gemeindepräsident: René P. (intern auch "CEO" genannt)
  * Hat Steuererhöhung 70%→75% vorgeschlagen (wurde abgelehnt 42:21)
  * Leitet gerne Arbeitsgruppen, setzt aber eigene Meinung durch
  * Nutzt oft das Wort "Vertrauen"
- Andere bekannte Figuren: El Diablo Müller (hat starke Meinungen), Tamara W. (Wirtschaftsprüferin), Michael L. (Gemeinderat)

**Bisherige Ereignisse:**
- September 2025: Steuer-Debakel (Erhöhung abgelehnt)
- Migros Marketing-Fail (Korkenzieher statt Chili)
- Chili's Restaurant kommt (Hooters & Twin Peaks abgelehnt)
- Fläsch steht auf "medium" - nicht zu mild, nicht zu scharf

**Wichtige Regeln:**
- KEINE vollen Namen - nur Vornamen oder Initialen (z.B. René P., Michael L.)
- KEINE Beleidigungen oder Diffamierungen
- Schweizer Hochdeutsch verwenden (keine ß, Guillemets «» statt "", etc.)
- Satirisch, aber nicht böswillig
- Nutze wiederkehrende Charaktere wenn es passt (besonders René P. bei Politik-Themen)
- Baue auf bisherigen Ereignissen auf wenn relevant

**Artikel-Informationen:**
Titel: ${title}
Kategorie: ${category}
Stil: ${style}
${fileAnalysis}

**Inhaltsbeschreibung vom Autor:**
${content}

Erstelle den Artikel-CONTENT (nur der Inhalt, KEIN vollständiges HTML-Dokument!).

Der Artikel soll:
1. Mit einer einleitenden Überschrift (h2) starten
2. 3-5 gut strukturierte Absätze haben
3. Satirische Zitate von fiktiven Dorfbewohnern (nur Vornamen!) enthalten
4. Zwischenüberschriften (h2, h3) für bessere Struktur nutzen
5. Optional: Aufzählungen oder Blockquotes für Zitate

WICHTIG:
- Gib NUR den Artikel-Inhalt zurück (h2, p, blockquote, ul, etc.)
- KEIN vollständiges HTML-Dokument (kein <!DOCTYPE>, <html>, <head>, <body>)
- KEINE Code-Blöcke (```html)
- KEIN Navigation oder Footer
- Der Inhalt wird automatisch in ein Template eingebettet

Beginne direkt mit dem Artikel-Content!`;

    // Claude API Call
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: [{
        role: 'user',
        content: prompt
      }]
    });

    let generatedHTML = message.content[0].text;

    // Bereinige den generierten Content (entferne Code-Blöcke falls vorhanden)
    generatedHTML = generatedHTML
      .replace(/```html\s*/g, '')  // Entferne ```html
      .replace(/```\s*/g, '')      // Entferne ```
      .trim();

    // Entferne vollständiges HTML-Dokument falls Claude es trotzdem generiert hat
    if (generatedHTML.includes('<!DOCTYPE')) {
      // Extrahiere nur den Body-Content
      const bodyMatch = generatedHTML.match(/<body[^>]*>([\s\S]*)<\/body>/i);
      if (bodyMatch) {
        generatedHTML = bodyMatch[1];
      }
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
      category: category,
      author: author,
      message: 'Artikel erfolgreich generiert!'
    });

  } catch (error) {
    console.error('Error:', error);
    console.error('Error stack:', error.stack);

    // Spezielle Fehlerbehandlung für API Key
    if (error.message && error.message.includes('API key')) {
      return res.status(500).json({
        error: 'API Key fehlt oder ist ungültig. Bitte Vercel Environment Variables prüfen.',
        details: error.message,
        stack: error.stack
      });
    }

    // Anthropic API Fehler
    if (error.status) {
      return res.status(500).json({
        error: 'Claude API Fehler',
        details: error.message,
        status: error.status,
        stack: error.stack
      });
    }

    return res.status(500).json({
      error: 'Fehler bei der Artikel-Generierung',
      details: error.message,
      stack: error.stack,
      errorType: error.constructor.name
    });
  }
}
