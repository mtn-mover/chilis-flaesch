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

**Wichtige Regeln:**
- KEINE vollen Namen verwenden, nur Vornamen oder Pseudonyme
- KEINE Beleidigungen oder Diffamierungen
- Schweizer Hochdeutsch verwenden (keine ß, Guillemets «» statt "", etc.)
- Satirisch, aber nicht böswillig
- Dorf-typische Themen und Charaktere

**Artikel-Informationen:**
Titel: ${title}
Kategorie: ${category}
Stil: ${style}
${fileAnalysis}

**Inhaltsbeschreibung vom Autor:**
${content}

Erstelle einen vollständigen HTML-Artikel im Format der bestehenden Artikel auf der Website. Nutze die gleiche Struktur wie andere Artikel-Seiten.

Der Artikel soll:
1. Eine passende Überschrift haben
2. 3-5 Absätze Inhalt
3. Satirische Zitate von fiktiven Dorfbewohnern (nur Vornamen!)
4. Am Ende: Ersteller-Hinweis mit dem Autor: "${author}"

Gib NUR den HTML-Code zurück, ohne Erklärungen. Der Code soll ready-to-use sein.`;

    // Claude API Call
    const message = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 4096,
      messages: [{
        role: 'user',
        content: prompt
      }]
    });

    const generatedHTML = message.content[0].text;

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

    // Spezielle Fehlerbehandlung für API Key
    if (error.message && error.message.includes('API key')) {
      return res.status(500).json({
        error: 'API Key fehlt oder ist ungültig. Bitte Vercel Environment Variables prüfen.'
      });
    }

    return res.status(500).json({
      error: 'Fehler bei der Artikel-Generierung',
      details: error.message
    });
  }
}
