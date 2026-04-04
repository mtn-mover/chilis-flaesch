// Handler: Compress old events using Claude AI
const { verifySession } = require('./auth.js');
const { getContext, saveContext } = require('./context-manager.js');
const { Anthropic } = require('@anthropic-ai/sdk');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { sessionToken, confirm } = req.body;
  const session = verifySession(sessionToken);
  if (!session || session.role !== 'admin') {
    return res.status(401).json({ error: 'Nicht autorisiert' });
  }

  try {
    const context = await getContext();
    if (!context || !context.events || !context.events.items) {
      return res.status(404).json({ error: 'Keine Events vorhanden' });
    }

    // Find events older than 3 months with low/medium importance
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    const cutoffDate = `${threeMonthsAgo.getFullYear()}-${String(threeMonthsAgo.getMonth() + 1).padStart(2, '0')}`;

    const oldEvents = context.events.items.filter(evt =>
      evt.date < cutoffDate && evt.importance !== 'high'
    );

    if (oldEvents.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'Keine alten Events zum Komprimieren gefunden',
        compressed: 0
      });
    }

    // Build text for Claude to summarize
    const eventsText = oldEvents.map(evt =>
      `- ${evt.title} (${evt.date}): ${evt.summary}`
    ).join('\n');

    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    const compressionPrompt = `Fasse die folgenden alten Ereignisse von "Fläsch Info" zusammen. Erstelle für JEDES Ereignis eine komprimierte Version (max 1 Satz pro Ereignis). Behalte wichtige Fakten (Zahlen, Namen, Ergebnisse).

Ereignisse:
${eventsText}

Gib die Zusammenfassungen als JSON-Array zurück, im Format:
[{"id": "original_id", "summary": "Komprimierte Zusammenfassung"}]

Nur das JSON-Array, kein anderer Text.`;

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [{ role: 'user', content: compressionPrompt }]
    });

    let compressed;
    try {
      const responseText = message.content[0].text.trim();
      // Extract JSON array from response
      const jsonMatch = responseText.match(/\[[\s\S]*\]/);
      compressed = JSON.parse(jsonMatch ? jsonMatch[0] : responseText);
    } catch (parseError) {
      return res.status(500).json({ error: 'Claude-Antwort konnte nicht geparsed werden' });
    }

    // Preview mode: show what would change
    if (!confirm) {
      const preview = oldEvents.map(evt => {
        const comp = compressed.find(c => c.id === evt.id);
        return {
          id: evt.id,
          title: evt.title,
          date: evt.date,
          oldSummary: evt.summary.substring(0, 200) + (evt.summary.length > 200 ? '...' : ''),
          newSummary: comp ? comp.summary : evt.summary
        };
      });

      return res.status(200).json({
        success: true,
        preview: true,
        changes: preview,
        count: oldEvents.length
      });
    }

    // Apply compression
    for (const comp of compressed) {
      const idx = context.events.items.findIndex(evt => evt.id === comp.id);
      if (idx !== -1) {
        context.events.items[idx].summary = comp.summary;
        context.events.items[idx].importance = 'low';
      }
    }

    await saveContext(context);

    return res.status(200).json({
      success: true,
      message: `${compressed.length} Events komprimiert`,
      compressed: compressed.length
    });
  } catch (error) {
    console.error('Error compressing context:', error);
    return res.status(500).json({ error: 'Fehler beim Komprimieren' });
  }
};
