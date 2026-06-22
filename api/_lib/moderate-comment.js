// Claude Moderation API
// Prüft Kommentare auf problematische Inhalte

const Anthropic = require('@anthropic-ai/sdk');

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

async function moderateComment(commentText, articleTitle) {
  try {
    const prompt = `Du bist ein Moderations-Assistent für "Fläsch Info", eine satirische Nachrichten-Website über das Schweizer Dorf Fläsch.

**Deine Aufgabe:**
Prüfe den folgenden Kommentar auf problematische Inhalte.

**Artikel:** "${articleTitle}"

**Kommentar:**
"${commentText}"

**Prüfkriterien:**

✅ **ERLAUBT:**
- Humorvolle, satirische Kommentare
- Freundliche Diskussionen
- Konstruktive Kritik
- Leichter Sarkasmus
- Schweizer Deutsch
- Emojis

❌ **NICHT ERLAUBT:**
- Beleidigungen (direkt oder indirekt)
- Rassismus, Sexismus, Diskriminierung
- Hassrede, Gewaltverherrlichung
- Persönliche Angriffe auf echte Personen
- Diffamierung
- Spam oder Werbung
- Vulgäre oder obszöne Sprache
- Politische Hetze

**WICHTIG:** Die Website ist SATIRE über ein Dorf. Kommentare sollten humorvoll und respektvoll sein.

**Antworte NUR im folgenden JSON-Format:**
{
  "approved": true/false,
  "reason": "Kurze Begründung für Ablehnung (leer bei Approval)",
  "details": "Detaillierte Erklärung was problematisch ist (leer bei Approval)",
  "severity": "low/medium/high" (nur bei Ablehnung)
}

**Beispiele:**

Kommentar: "Haha, das ist ja typisch für Fläsch! Sehr lustig! 😄"
→ {"approved": true, "reason": "", "details": "", "severity": ""}

Kommentar: "Diese Idioten sollten sich schämen!"
→ {"approved": false, "reason": "Beleidigender Inhalt", "details": "Der Kommentar enthält direkte Beleidigungen ('Idioten').", "severity": "medium"}

Kommentar: "Alle [ethnische Gruppe] sind..."
→ {"approved": false, "reason": "Rassistischer Inhalt", "details": "Der Kommentar enthält rassistische Verallgemeinerungen.", "severity": "high"}

**Analysiere jetzt den obigen Kommentar:**`;

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 500,
      temperature: 0.2, // Niedrige Temperatur für konsistente Moderation
      messages: [{
        role: 'user',
        content: prompt
      }]
    });

    const responseText = message.content[0].text.trim();

    // Parse JSON response
    let result;
    try {
      // Extract JSON from response (in case Claude adds extra text)
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      console.error('JSON parse error:', parseError, 'Response:', responseText);
      // Fallback: approve if parsing fails (better than blocking valid comments)
      result = {
        approved: true,
        reason: '',
        details: '',
        severity: ''
      };
    }

    return {
      success: true,
      approved: result.approved,
      reason: result.reason || '',
      details: result.details || '',
      severity: result.severity || ''
    };

  } catch (error) {
    console.error('Moderation error:', error);
    // On error, approve (don't block users due to technical issues)
    return {
      success: false,
      approved: true,
      reason: '',
      details: 'Technischer Fehler bei der Moderation',
      severity: '',
      error: error.message
    };
  }
}

// API Endpoint für Moderation
module.exports = async function handler(req, res) {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return res.status(200).json({});
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { commentText, articleTitle } = req.body;

  if (!commentText || !articleTitle) {
    return res.status(400).json({ error: 'commentText und articleTitle erforderlich' });
  }

  const result = await moderateComment(commentText, articleTitle);
  return res.status(200).json(result);
};

// Export for use in other APIs
module.exports.moderateComment = moderateComment;
