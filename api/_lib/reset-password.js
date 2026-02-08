// API for resetting password with token
const crypto = require('crypto');
const Redis = require('ioredis');

// Initialize Redis client
let redis;
if (process.env.REDIS_URL) {
  redis = new Redis(process.env.REDIS_URL);
} else {
  const { kv } = require('@vercel/kv');
  redis = kv;
}

// Hash password with SHA-256
function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

module.exports = async function handler(req, res) {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return res.status(200).json({});
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { token, newPassword } = req.body;

  // Validation
  if (!token) {
    return res.status(400).json({ error: 'Reset-Token fehlt' });
  }

  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ error: 'Passwort muss mindestens 6 Zeichen lang sein' });
  }

  try {
    // Get users from Redis
    const usersJson = await redis.get('users');
    let users = usersJson ? JSON.parse(usersJson) : [];

    // Find user with matching reset token
    const userIndex = users.findIndex(u => u.resetToken === token);

    if (userIndex === -1) {
      return res.status(404).json({
        error: 'Ungültiger oder abgelaufener Reset-Link',
        details: 'Der Link zum Zurücksetzen des Passworts ist nicht gültig.'
      });
    }

    const user = users[userIndex];

    // Check if token is expired (1 hour validity)
    if (!user.resetTokenExpiry || Date.now() > user.resetTokenExpiry) {
      return res.status(400).json({
        error: 'Reset-Link abgelaufen',
        details: 'Der Link ist abgelaufen. Bitte fordere einen neuen Link an.'
      });
    }

    // Update password and remove reset token
    users[userIndex].passwordHash = hashPassword(newPassword);
    users[userIndex].resetToken = null;
    users[userIndex].resetTokenExpiry = null;

    await redis.set('users', JSON.stringify(users));

    return res.status(200).json({
      success: true,
      message: 'Passwort erfolgreich zurückgesetzt. Du kannst dich jetzt mit deinem neuen Passwort einloggen.',
      username: user.username
    });

  } catch (error) {
    console.error('Reset password error:', error);
    return res.status(500).json({
      error: 'Fehler beim Zurücksetzen des Passworts',
      details: error.message
    });
  }
};
