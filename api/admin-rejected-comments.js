// Admin API für abgelehnte Kommentare
// Admin kann abgelehnte Kommentare prüfen und veröffentlichen oder löschen

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
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return res.status(200).json({});
  }

  // Verify admin
  const sessionToken = req.headers.authorization?.replace('Bearer ', '');
  const user = verifySession(sessionToken);

  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: 'Keine Berechtigung' });
  }

  const { method } = req;
  const { action } = req.query; // 'list', 'approve', 'delete'

  try {
    if (method === 'GET' && action === 'list') {
      return await listRejectedComments(req, res);
    } else if (method === 'POST' && action === 'approve') {
      return await approveComment(req, res);
    } else if (method === 'POST' && action === 'delete') {
      return await deleteComment(req, res);
    } else {
      return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Admin rejected comments API error:', error);
    return res.status(500).json({ error: 'Interner Serverfehler', details: error.message });
  }
};

// GET /api/admin-rejected-comments?action=list
async function listRejectedComments(req, res) {
  const rejectedJson = await redis.get('comments:rejected');
  const rejected = rejectedJson ? JSON.parse(rejectedJson) : [];

  // Sort by timestamp (newest first)
  rejected.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  return res.status(200).json({
    success: true,
    comments: rejected,
    count: rejected.length
  });
}

// POST /api/admin-rejected-comments?action=approve
async function approveComment(req, res) {
  const { commentId } = req.body;

  if (!commentId) {
    return res.status(400).json({ error: 'commentId erforderlich' });
  }

  // Get rejected comments
  const rejectedJson = await redis.get('comments:rejected');
  const rejected = rejectedJson ? JSON.parse(rejectedJson) : [];

  // Find comment
  const commentIndex = rejected.findIndex(c => c.id === commentId);
  if (commentIndex === -1) {
    return res.status(404).json({ error: 'Kommentar nicht gefunden' });
  }

  const comment = rejected[commentIndex];

  // Move to approved comments
  const commentsJson = await redis.get(`comments:${comment.articleSlug}`);
  const comments = commentsJson ? JSON.parse(commentsJson) : [];

  // Add comment with approved flag
  const approvedComment = {
    id: comment.id,
    username: comment.username,
    displayName: comment.displayName,
    text: comment.text,
    timestamp: comment.timestamp,
    parentId: comment.parentId,
    approved: true
  };

  comments.push(approvedComment);
  await redis.set(`comments:${comment.articleSlug}`, JSON.stringify(comments));

  // Mark as reviewed and remove from rejected
  rejected.splice(commentIndex, 1);
  await redis.set('comments:rejected', JSON.stringify(rejected));

  return res.status(200).json({
    success: true,
    message: 'Kommentar wurde veröffentlicht',
    comment: approvedComment
  });
}

// POST /api/admin-rejected-comments?action=delete
async function deleteComment(req, res) {
  const { commentId } = req.body;

  if (!commentId) {
    return res.status(400).json({ error: 'commentId erforderlich' });
  }

  // Get rejected comments
  const rejectedJson = await redis.get('comments:rejected');
  const rejected = rejectedJson ? JSON.parse(rejectedJson) : [];

  // Find and remove comment
  const commentIndex = rejected.findIndex(c => c.id === commentId);
  if (commentIndex === -1) {
    return res.status(404).json({ error: 'Kommentar nicht gefunden' });
  }

  rejected.splice(commentIndex, 1);
  await redis.set('comments:rejected', JSON.stringify(rejected));

  return res.status(200).json({
    success: true,
    message: 'Kommentar wurde endgültig gelöscht'
  });
}
