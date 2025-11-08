// API to save article drafts
const { verifySession } = require('./auth.js');
const Redis = require('ioredis');

// Initialize Redis client using REDIS_URL
let redis;
if (process.env.REDIS_URL) {
  redis = new Redis(process.env.REDIS_URL);
} else {
  // Fallback to @vercel/kv if KV variables are available
  const { kv } = require('@vercel/kv');
  redis = kv;
}

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return res.status(200).json({});
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { sessionToken, draft } = req.body;

    // Verify session
    const session = verifySession(sessionToken);
    if (!session) {
      return res.status(401).json({ error: 'Nicht autorisiert' });
    }

    // Validate draft data
    if (!draft || !draft.title || !draft.content || !draft.html) {
      return res.status(400).json({ error: 'Unvollständige Draft-Daten' });
    }

    // Read existing drafts from Redis
    const draftsJson = await redis.get('drafts');
    const drafts = draftsJson ? JSON.parse(draftsJson) : [];

    // Create new draft object
    const newDraft = {
      id: draft.id || Date.now().toString(),
      title: draft.title,
      category: draft.category,
      style: draft.style,
      content: draft.content, // Original input description
      html: draft.html, // Generated HTML
      images: draft.images || [],
      author: session.username,
      authorDisplayName: session.displayName,
      createdAt: draft.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'draft',
      fileName: draft.fileName
    };

    // Check if updating existing draft
    const existingIndex = drafts.findIndex(d => d.id === newDraft.id);

    if (existingIndex >= 0) {
      // Check permissions: only author or admin can edit
      const existingDraft = drafts[existingIndex];
      if (existingDraft.author !== session.username && session.username !== 'admin') {
        return res.status(403).json({ error: 'Keine Berechtigung, diesen Draft zu bearbeiten' });
      }

      // Update existing draft
      drafts[existingIndex] = newDraft;
    } else {
      // Add new draft
      drafts.push(newDraft);
    }

    // Save drafts to Redis
    await redis.set('drafts', JSON.stringify(drafts));

    return res.status(200).json({
      success: true,
      draft: newDraft,
      message: 'Draft gespeichert'
    });

  } catch (error) {
    console.error('Error saving draft:', error);
    console.error('Error stack:', error.stack);
    return res.status(500).json({
      error: 'Fehler beim Speichern des Drafts',
      details: error.message,
      stack: error.stack
    });
  }
};
