// API to delete a draft
const { verifySession } = require('./auth.js');
const { kv } = require('@vercel/kv');

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return res.status(200).json({});
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { sessionToken, draftId } = req.body;

    // Verify session
    const session = verifySession(sessionToken);
    if (!session) {
      return res.status(401).json({ error: 'Nicht autorisiert' });
    }

    if (!draftId) {
      return res.status(400).json({ error: 'Draft ID fehlt' });
    }

    // Read drafts from KV
    const drafts = await kv.get('drafts') || [];
    if (drafts.length === 0) {
      return res.status(404).json({ error: 'Keine Drafts gefunden' });
    }

    // Find draft
    const draftIndex = drafts.findIndex(d => d.id === draftId);
    if (draftIndex < 0) {
      return res.status(404).json({ error: 'Draft nicht gefunden' });
    }

    const draft = drafts[draftIndex];

    // Check permissions
    if (draft.author !== session.username && session.username !== 'admin') {
      return res.status(403).json({ error: 'Keine Berechtigung, diesen Draft zu löschen' });
    }

    // Remove draft
    drafts.splice(draftIndex, 1);

    // Save to KV
    await kv.set('drafts', drafts);

    return res.status(200).json({
      success: true,
      message: 'Draft gelöscht'
    });

  } catch (error) {
    console.error('Error deleting draft:', error);
    return res.status(500).json({
      error: 'Fehler beim Löschen des Drafts',
      details: error.message
    });
  }
};
