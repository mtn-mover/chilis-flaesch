// Temporary API endpoint to fix article authors
const Redis = require('ioredis');

let redis;
if (process.env.REDIS_URL) {
  redis = new Redis(process.env.REDIS_URL);
} else {
  const { kv } = require('@vercel/kv');
  redis = kv;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const draftsJson = await redis.get('drafts');
    const drafts = draftsJson ? JSON.parse(draftsJson) : [];

    // Find the two articles that need to be fixed
    const articleIds = ['1763484767950', '1763675276345'];
    const changes = [];

    for (const articleId of articleIds) {
      const index = drafts.findIndex(d => d.id === articleId);
      if (index >= 0) {
        const draft = drafts[index];
        const before = {
          title: draft.title,
          author: draft.author,
          authorDisplayName: draft.authorDisplayName
        };

        // Fix the author
        drafts[index].author = 'Steph';
        drafts[index].authorDisplayName = 'Steph';

        changes.push({
          id: articleId,
          title: draft.title,
          before: before,
          after: {
            author: 'Steph',
            authorDisplayName: 'Steph'
          }
        });
      }
    }

    if (changes.length > 0) {
      // Save back to Redis
      await redis.set('drafts', JSON.stringify(drafts));
    }

    return res.status(200).json({
      success: true,
      message: `Fixed ${changes.length} articles`,
      changes: changes
    });

  } catch (error) {
    console.error('Fix authors error:', error);
    return res.status(500).json({
      error: 'Error',
      details: error.message
    });
  }
};
