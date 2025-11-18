// Account activation API
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
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return res.status(200).json({});
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { token } = req.body;

  // Validation
  if (!token) {
    return res.status(400).json({ error: 'Aktivierungstoken fehlt' });
  }

  try {
    // Get existing users
    const usersJson = await redis.get('users');
    let users = usersJson ? JSON.parse(usersJson) : [];

    // Find user with matching activation token
    const userIndex = users.findIndex(u => u.activationToken === token);

    if (userIndex === -1) {
      return res.status(404).json({
        error: 'Ungültiger oder abgelaufener Aktivierungslink',
        details: 'Der Aktivierungslink ist nicht gültig. Bitte kontaktiere den Support, falls du Hilfe benötigst.'
      });
    }

    const user = users[userIndex];

    // Check if already activated
    if (user.emailVerified) {
      return res.status(200).json({
        success: true,
        alreadyActivated: true,
        message: 'Dein Account wurde bereits aktiviert. Du kannst dich jetzt einloggen.',
        username: user.username
      });
    }

    // Activate account
    users[userIndex] = {
      ...user,
      emailVerified: true,
      approved: true, // Auto-approve for commenting after email verification
      activationToken: null, // Remove token after use
      activatedAt: new Date().toISOString()
    };

    // Save updated users
    await redis.set('users', JSON.stringify(users));

    return res.status(200).json({
      success: true,
      message: 'Dein Account wurde erfolgreich aktiviert! Du kannst dich jetzt einloggen.',
      username: users[userIndex].username,
      displayName: users[userIndex].displayName
    });

  } catch (error) {
    console.error('Activation error:', error);
    return res.status(500).json({
      error: 'Fehler bei der Account-Aktivierung',
      details: error.message
    });
  }
};
