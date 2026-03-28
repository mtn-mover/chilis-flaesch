// Admin API for all comments across all articles
// List, reply, and delete approved comments

const Redis = require('ioredis');
const { verifySession } = require('./auth');

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

  // Verify admin
  const sessionToken = req.headers.authorization?.replace('Bearer ', '');
  const user = verifySession(sessionToken);

  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: 'Keine Berechtigung' });
  }

  const { action } = req.query;

  try {
    if (req.method === 'GET' && action === 'admin-all') {
      return await listAllComments(req, res);
    } else if (req.method === 'POST' && action === 'admin-reply') {
      return await adminReply(req, res, user);
    } else if (req.method === 'POST' && action === 'admin-delete') {
      return await adminDelete(req, res);
    } else {
      return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Admin all comments API error:', error);
    return res.status(500).json({ error: 'Interner Serverfehler', details: error.message });
  }
};

// GET /api/comments?action=admin-all
async function listAllComments(req, res) {
  // Find all comment keys using pattern matching
  let commentKeys = [];

  if (redis.keys) {
    // ioredis or Vercel KV
    commentKeys = await redis.keys('comments:*');
  } else {
    // Fallback: scan
    let cursor = 0;
    do {
      const [newCursor, keys] = await redis.scan(cursor, 'MATCH', 'comments:*', 'COUNT', 100);
      cursor = parseInt(newCursor, 10);
      commentKeys.push(...keys);
    } while (cursor !== 0);
  }

  // Filter out rejected comments key
  commentKeys = commentKeys.filter(key => key !== 'comments:rejected');

  // Fetch all comments from all articles
  const allComments = [];

  for (const key of commentKeys) {
    const articleSlug = key.replace('comments:', '');
    const commentsJson = await redis.get(key);
    const comments = commentsJson ? JSON.parse(commentsJson) : [];

    for (const comment of comments) {
      allComments.push({
        ...comment,
        articleSlug
      });
    }
  }

  // Sort by timestamp (newest first)
  allComments.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  return res.status(200).json({
    success: true,
    comments: allComments,
    count: allComments.length
  });
}

// POST /api/comments?action=admin-reply
async function adminReply(req, res, user) {
  const { articleSlug, commentText, parentId } = req.body;

  if (!articleSlug || !commentText || !parentId) {
    return res.status(400).json({ error: 'articleSlug, commentText und parentId erforderlich' });
  }

  // Get existing comments for article
  const commentsJson = await redis.get(`comments:${articleSlug}`);
  const comments = commentsJson ? JSON.parse(commentsJson) : [];

  // Verify parent exists
  const parentExists = comments.some(c => c.id === parentId);
  if (!parentExists) {
    return res.status(404).json({ error: 'Parent-Kommentar nicht gefunden' });
  }

  // Create admin reply (no moderation needed for admin)
  const commentId = `comment-${Date.now()}`;
  const reply = {
    id: commentId,
    username: user.username,
    displayName: user.displayName,
    text: commentText,
    timestamp: new Date().toISOString(),
    parentId: parentId,
    approved: true
  };

  comments.push(reply);
  await redis.set(`comments:${articleSlug}`, JSON.stringify(comments));

  return res.status(200).json({
    success: true,
    message: 'Antwort erfolgreich veröffentlicht',
    comment: reply
  });
}

// POST /api/comments?action=admin-delete
async function adminDelete(req, res) {
  const { articleSlug, commentId } = req.body;

  if (!articleSlug || !commentId) {
    return res.status(400).json({ error: 'articleSlug und commentId erforderlich' });
  }

  const commentsJson = await redis.get(`comments:${articleSlug}`);
  const comments = commentsJson ? JSON.parse(commentsJson) : [];

  // Find comment
  const commentIndex = comments.findIndex(c => c.id === commentId);
  if (commentIndex === -1) {
    return res.status(404).json({ error: 'Kommentar nicht gefunden' });
  }

  // Also remove all replies to this comment (recursively)
  const idsToRemove = new Set([commentId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const c of comments) {
      if (c.parentId && idsToRemove.has(c.parentId) && !idsToRemove.has(c.id)) {
        idsToRemove.add(c.id);
        changed = true;
      }
    }
  }

  const filtered = comments.filter(c => !idsToRemove.has(c.id));
  await redis.set(`comments:${articleSlug}`, JSON.stringify(filtered));

  return res.status(200).json({
    success: true,
    message: `${idsToRemove.size} Kommentar(e) gelöscht`
  });
}
