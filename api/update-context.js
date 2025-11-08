// API to update context with new article information
const { Anthropic } = require('@anthropic-ai/sdk');
const fs = require('fs');
const path = require('path');

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return res.status(200).json({});
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { articleTitle, articleContent, category } = req.body;

    if (!articleTitle || !articleContent) {
      return res.status(400).json({ error: 'Titel und Inhalt erforderlich' });
    }

    // Initialize Claude API
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    // Ask Claude to extract context from the article
    const extractionPrompt = `Analysiere diesen satirischen Artikel von "Fläsch Info" und extrahiere wichtige Informationen:

**Artikel-Titel:** ${articleTitle}
**Kategorie:** ${category}
**Inhalt:** ${articleContent}

Extrahiere und formatiere als kurze Zusammenfassung:
1. **Neue Charaktere:** Namen und ihre Rollen/Eigenschaften (falls erwähnt)
2. **Hauptereignis:** Was ist passiert? (1-2 Sätze)
3. **Wichtige Details:** Zahlen, Abstimmungen, Zitate (falls relevant)
4. **Storyline-Kontext:** Was sollten zukünftige Artikel darüber wissen?

Format: Kurz und prägnant, wie ein Lexikon-Eintrag. Nutze Bulletpoints.`;

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: extractionPrompt
      }]
    });

    const extractedContext = message.content[0].text;

    // Create context entry
    const contextEntry = `
### ${articleTitle} (${new Date().toLocaleDateString('de-CH', { year: 'numeric', month: 'long' })})
**Kategorie:** ${category}
${extractedContext}
`;

    // In Vercel environment, we can't write to filesystem
    // Instead, return the context to be added via GitHub API
    return res.status(200).json({
      success: true,
      contextEntry: contextEntry,
      message: 'Kontext extrahiert'
    });

  } catch (error) {
    console.error('Error updating context:', error);
    return res.status(500).json({
      error: 'Fehler beim Kontext-Update',
      details: error.message
    });
  }
};
