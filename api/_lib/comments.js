// Kommentar-System API
// Erstellen, Abrufen, Antworten auf Kommentare

const Redis = require('ioredis');
const { verifySession } = require('./auth');
const { moderateComment } = require('./moderate-comment');
const { sendEmail, rejectedCommentEmail } = require('./send-email');

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

  const { method } = req;
  const { action } = req.query; // 'get', 'create', 'reply'

  try {
    if (method === 'GET' && action === 'get') {
      return await getComments(req, res);
    } else if (method === 'POST' && action === 'create') {
      return await createComment(req, res);
    } else if (method === 'POST' && action === 'reply') {
      return await replyToComment(req, res);
    } else {
      return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Comments API error:', error);
    return res.status(500).json({ error: 'Interner Serverfehler', details: error.message });
  }
};

// GET /api/comments?action=get&articleSlug=...
async function getComments(req, res) {
  const { articleSlug } = req.query;

  if (!articleSlug) {
    return res.status(400).json({ error: 'articleSlug erforderlich' });
  }

  // Get comments from Redis
  const commentsJson = await redis.get(`comments:${articleSlug}`);
  const comments = commentsJson ? JSON.parse(commentsJson) : [];

  // Get likes for each comment
  const commentsWithLikes = await Promise.all(
    comments.map(async (comment) => {
      const likesJson = await redis.get(`likes:comment:${comment.id}`);
      const likes = likesJson ? JSON.parse(likesJson) : { count: 0, likedBy: [] };
      return { ...comment, likes: likes.count };
    })
  );

  // Sort by timestamp (newest first)
  commentsWithLikes.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  return res.status(200).json({
    success: true,
    comments: commentsWithLikes,
    count: commentsWithLikes.length
  });
}

// POST /api/comments?action=create
async function createComment(req, res) {
  const sessionToken = req.headers.authorization?.replace('Bearer ', '');
  const user = verifySession(sessionToken);

  if (!user) {
    return res.status(401).json({ error: 'Nicht angemeldet' });
  }

  // Check if user is approved for commenting (get user data from Redis)
  const usersJson = await redis.get('users');
  const users = usersJson ? JSON.parse(usersJson) : [];
  const userAccount = users.find(u => u.username === user.username);

  // Only allow comments from approved users (admin is always approved)
  if (userAccount && userAccount.role !== 'admin' && userAccount.approved === false) {
    return res.status(403).json({
      error: 'Dein Account muss zuerst freigegeben werden, bevor du kommentieren kannst.',
      requiresApproval: true
    });
  }

  const { articleSlug, articleTitle, commentText, parentId } = req.body;

  if (!articleSlug || !articleTitle || !commentText) {
    return res.status(400).json({ error: 'articleSlug, articleTitle und commentText erforderlich' });
  }

  // Moderate comment with Claude
  const moderation = await moderateComment(commentText, articleTitle);

  const commentId = `comment-${Date.now()}`;
  const timestamp = new Date().toISOString();

  const comment = {
    id: commentId,
    username: user.username,
    displayName: user.displayName,
    text: commentText,
    timestamp: timestamp,
    parentId: parentId || null,
    approved: moderation.approved
  };

  if (moderation.approved) {
    // Add to approved comments
    const commentsJson = await redis.get(`comments:${articleSlug}`);
    const comments = commentsJson ? JSON.parse(commentsJson) : [];
    comments.push(comment);
    await redis.set(`comments:${articleSlug}`, JSON.stringify(comments));

    return res.status(200).json({
      success: true,
      approved: true,
      comment: comment,
      message: 'Kommentar erfolgreich veröffentlicht'
    });
  } else {
    // Add to rejected comments for admin review
    const rejectedJson = await redis.get('comments:rejected');
    const rejected = rejectedJson ? JSON.parse(rejectedJson) : [];

    const rejectedComment = {
      ...comment,
      articleSlug: articleSlug,
      articleTitle: articleTitle,
      rejectionReason: moderation.reason,
      moderationDetails: moderation.details,
      severity: moderation.severity,
      reviewed: false,
      adminDecision: null
    };

    rejected.push(rejectedComment);
    await redis.set('comments:rejected', JSON.stringify(rejected));

    // Send email to admin
    const emailData = rejectedCommentEmail(rejectedComment, { title: articleTitle });
    await sendEmail(emailData);

    return res.status(200).json({
      success: true,
      approved: false,
      reason: moderation.reason,
      message: 'Ihr Kommentar kann aufgrund der geltenden Richtlinien nicht veröffentlicht werden. Unser Admin wurde benachrichtigt und wird dies prüfen.'
    });
  }
}

// POST /api/comments?action=reply
async function replyToComment(req, res) {
  const sessionToken = req.headers.authorization?.replace('Bearer ', '');
  const user = verifySession(sessionToken);

  if (!user) {
    return res.status(401).json({ error: 'Nicht angemeldet' });
  }

  const { articleSlug, articleTitle, commentText, parentId } = req.body;

  if (!articleSlug || !articleTitle || !commentText || !parentId) {
    return res.status(400).json({ error: 'articleSlug, articleTitle, commentText und parentId erforderlich' });
  }

  // Verify parent comment exists
  const commentsJson = await redis.get(`comments:${articleSlug}`);
  const comments = commentsJson ? JSON.parse(commentsJson) : [];
  const parentExists = comments.some(c => c.id === parentId);

  if (!parentExists) {
    return res.status(404).json({ error: 'Parent-Kommentar nicht gefunden' });
  }

  // Use same logic as createComment
  return await createComment(req, res);
}
