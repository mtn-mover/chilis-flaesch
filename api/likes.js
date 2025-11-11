// Like-System API
// Likes für Artikel und Kommentare (kein Login erforderlich)

const Redis = require('ioredis');
const crypto = require('crypto');

// Initialize Redis client
let redis;
if (process.env.REDIS_URL) {
  redis = new Redis(process.env.REDIS_URL);
} else {
  const { kv } = require('@vercel/kv');
  redis = kv;
}

// Generate browser fingerprint from IP + User Agent
function generateFingerprint(req) {
  const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress || 'unknown';
  const userAgent = req.headers['user-agent'] || 'unknown';
  const combined = `${ip}-${userAgent}`;
  return crypto.createHash('sha256').update(combined).digest('hex');
}

module.exports = async function handler(req, res) {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return res.status(200).json({});
  }

  const { method } = req;
  const { action, type, id } = req.query; // action: 'get' | 'toggle', type: 'article' | 'comment', id: articleSlug | commentId

  try {
    if (method === 'GET' && action === 'get') {
      return await getLikes(req, res, type, id);
    } else if (method === 'POST' && action === 'toggle') {
      return await toggleLike(req, res, type, id);
    } else {
      return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Likes API error:', error);
    return res.status(500).json({ error: 'Interner Serverfehler', details: error.message });
  }
};

// GET /api/likes?action=get&type=article&id=chilis-restaurant
// GET /api/likes?action=get&type=comment&id=comment-123
async function getLikes(req, res, type, id) {
  if (!type || !id) {
    return res.status(400).json({ error: 'type und id erforderlich' });
  }

  if (type !== 'article' && type !== 'comment') {
    return res.status(400).json({ error: 'type muss "article" oder "comment" sein' });
  }

  const key = `likes:${type}:${id}`;
  const likesJson = await redis.get(key);
  const likes = likesJson ? JSON.parse(likesJson) : { count: 0, likedBy: [] };

  const fingerprint = generateFingerprint(req);
  const userLiked = likes.likedBy.includes(fingerprint);

  return res.status(200).json({
    success: true,
    count: likes.count,
    userLiked: userLiked
  });
}

// POST /api/likes?action=toggle&type=article&id=chilis-restaurant
// POST /api/likes?action=toggle&type=comment&id=comment-123
async function toggleLike(req, res, type, id) {
  if (!type || !id) {
    return res.status(400).json({ error: 'type und id erforderlich' });
  }

  if (type !== 'article' && type !== 'comment') {
    return res.status(400).json({ error: 'type muss "article" oder "comment" sein' });
  }

  const key = `likes:${type}:${id}`;
  const fingerprint = generateFingerprint(req);

  // Get current likes
  const likesJson = await redis.get(key);
  let likes = likesJson ? JSON.parse(likesJson) : { count: 0, likedBy: [] };

  let action;
  if (likes.likedBy.includes(fingerprint)) {
    // Unlike
    likes.count = Math.max(0, likes.count - 1);
    likes.likedBy = likes.likedBy.filter(f => f !== fingerprint);
    action = 'unliked';
  } else {
    // Like
    likes.count += 1;
    likes.likedBy.push(fingerprint);
    action = 'liked';
  }

  // Save back to Redis
  await redis.set(key, JSON.stringify(likes));

  return res.status(200).json({
    success: true,
    action: action,
    count: likes.count,
    userLiked: action === 'liked'
  });
}
