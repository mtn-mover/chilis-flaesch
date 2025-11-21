// Temporary debug endpoint to check drafts
const Redis = require('ioredis');

let redis;
if (process.env.REDIS_URL) {
  redis = new Redis(process.env.REDIS_URL);
} else {
  const { kv } = require('@vercel/kv');
  redis = kv;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const draftsJson = await redis.get('drafts');
    const drafts = draftsJson ? JSON.parse(draftsJson) : [];

    // Find drafts related to "Steph"
    const stephDrafts = drafts.filter(d =>
      d.author?.toLowerCase().includes('steph') ||
      d.authorDisplayName?.toLowerCase().includes('steph') ||
      d.title?.includes('Föhnwind') ||
      d.title?.includes('Wakkerpreis')
    );

    return res.status(200).json({
      success: true,
      totalDrafts: drafts.length,
      stephDrafts: stephDrafts,
      allAuthors: [...new Set(drafts.map(d => d.author))],
      foundDrafts: stephDrafts.map(d => ({
        id: d.id,
        title: d.title,
        author: d.author,
        authorDisplayName: d.authorDisplayName,
        status: d.status,
        createdAt: d.createdAt,
        updatedAt: d.updatedAt
      }))
    });

  } catch (error) {
    console.error('Debug error:', error);
    return res.status(500).json({
      error: 'Error',
      details: error.message
    });
  }
};
