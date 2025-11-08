// API to get all drafts (with permission filtering)
const { verifySession } = require('./auth.js');
const Redis = require('ioredis');

// Initialize Redis client
let redis;
if (process.env.REDIS_URL) {
  redis = new Redis(process.env.REDIS_URL);
} else {
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
    const { sessionToken } = req.body;

    // Verify session
    const session = verifySession(sessionToken);
    if (!session) {
      return res.status(401).json({ error: 'Nicht autorisiert' });
    }

    // Read drafts from Redis
    const draftsJson = await redis.get('drafts');
    const drafts = draftsJson ? JSON.parse(draftsJson) : [];

    // Filter drafts based on permissions
    let filteredDrafts = drafts;
    const isAdmin = session.role === 'admin';

    if (!isAdmin) {
      // Non-admin users only see their own drafts
      filteredDrafts = drafts.filter(d => d.author === session.username);
    }

    // Sort by updatedAt (newest first)
    filteredDrafts.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

    return res.status(200).json({
      success: true,
      drafts: filteredDrafts,
      isAdmin: isAdmin
    });

  } catch (error) {
    console.error('Error getting drafts:', error);
    return res.status(500).json({
      error: 'Fehler beim Laden der Drafts',
      details: error.message
    });
  }
};
