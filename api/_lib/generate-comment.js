// Claude Kommentar-Assistent API
// Hilft Benutzern lustige, satirische Kommentare zu erstellen

const Anthropic = require('@anthropic-ai/sdk');
const { verifySession } = require('./auth');

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

module.exports = async function handler(req, res) {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return res.status(200).json({});
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verify user is logged in
  const sessionToken = req.headers.authorization?.replace('Bearer ', '');
  const user = verifySession(sessionToken);

  if (!user) {
    return res.status(401).json({ error: 'Nicht angemeldet' });
  }

  const { articleTitle, articleContent, userInput, commentContext } = req.body;

  if (!articleTitle || !userInput) {
    return res.status(400).json({ error: 'Artikel-Titel und Benutzer-Input erforderlich' });
  }

  try {
    const prompt = `Du bist ein humorvoller Kommentar-Assistent für "Fläsch Info", eine satirische Nachrichten-Website über das Schweizer Dorf Fläsch.

**Deine Aufgabe:**
Generiere einen **lustigen, satirischen Kommentar** basierend auf dem Benutzer-Input.

**Artikel-Kontext:**
Titel: "${articleTitle}"
${articleContent ? `Inhalt (Auszug): ${articleContent.substring(0, 500)}...` : ''}

**Benutzer möchte sagen:**
"${userInput}"

${commentContext ? `**Antwort auf Kommentar:** ${commentContext}` : '**Dies ist ein Top-Level-Kommentar.**'}

**Richtlinien:**
✅ Humorvoll, satirisch, im Stil der Fläsch Info
✅ Passend zum Kontext des Artikels
✅ Nimmt das Thema auf die Schippe
✅ Freundlich und respektvoll
✅ Schweizer Deutsch Einflüsse sind willkommen (z.B. "gäll", "oder")
✅ Emojis sind erlaubt (aber sparsam einsetzen)
✅ **SCHWEIZER RECHTSCHREIBUNG:** KEIN scharfes ß - immer "ss" verwenden (z.B. "muss", "Grüsse", "weiss")

❌ KEINE Beleidigungen
❌ KEIN Rassismus, Sexismus, Hassrede
❌ KEINE persönlichen Angriffe
❌ NICHT zu lang (max. 2-3 Sätze)

**Generiere jetzt einen passenden Kommentar:**`;

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 300,
      temperature: 0.9, // Höhere Kreativität für humorvolle Kommentare
      messages: [{
        role: 'user',
        content: prompt
      }]
    });

    const generatedComment = message.content[0].text.trim();

    return res.status(200).json({
      success: true,
      comment: generatedComment,
      username: user.username
    });

  } catch (error) {
    console.error('Generate comment error:', error);
    return res.status(500).json({
      error: 'Fehler beim Generieren des Kommentars',
      details: error.message
    });
  }
};
