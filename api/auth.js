// Authentication API für Admin-Login
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const Redis = require('ioredis');

// Initialize Redis client
let redis;
if (process.env.REDIS_URL) {
  redis = new Redis(process.env.REDIS_URL);
} else {
  const { kv } = require('@vercel/kv');
  redis = kv;
}

// JWT Secret (in production: use environment variable)
const JWT_SECRET = process.env.JWT_SECRET || 'flaesch-info-secret-2024-temp';
const JWT_EXPIRY = '2h'; // 2 hours

// Hash password with SHA-256
function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

module.exports = async function handler(req, res) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).json({});
  }

  // Nur POST erlauben (außer OPTIONS)
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username und Passwort erforderlich' });
  }

  try {
    // Get users from Redis
    const usersJson = await redis.get('users');
    let users = usersJson ? JSON.parse(usersJson) : [];

    // If no users in Redis, initialize with default admin
    if (users.length === 0) {
      users = [
        {
          username: 'admin',
          passwordHash: 'd3ad9315b7be5dd53b31a273b3b3aba5defe700808305aa16a3062b76658a791', // demo123
          displayName: 'der Flüsterer',
          role: 'admin',
          createdAt: new Date().toISOString()
        }
      ];
      await redis.set('users', JSON.stringify(users));
    }

    // Find user
    const user = users.find(u => u.username === username);
    if (!user) {
      return res.status(401).json({ error: 'Ungültige Anmeldedaten' });
    }

    // Verify password
    const passwordHash = hashPassword(password);
    if (passwordHash !== user.passwordHash) {
      return res.status(401).json({ error: 'Ungültige Anmeldedaten' });
    }

    // Create JWT token
    const token = jwt.sign(
      {
        username: user.username,
        displayName: user.displayName,
        role: user.role || 'user'
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRY }
    );

    return res.status(200).json({
      success: true,
      sessionToken: token,
      username: user.username,
      displayName: user.displayName,
      role: user.role || 'user'
    });

  } catch (error) {
    console.error('Auth error:', error);
    return res.status(500).json({ error: 'Fehler bei der Authentifizierung' });
  }
}

// Export verify function for use in other APIs
module.exports.verifySession = function verifySession(sessionToken) {
  if (!sessionToken) return null;

  try {
    // Verify and decode JWT
    const decoded = jwt.verify(sessionToken, JWT_SECRET);
    return {
      username: decoded.username,
      displayName: decoded.displayName,
      role: decoded.role || 'user'
    };
  } catch (error) {
    // Token invalid or expired
    return null;
  }
};
