// API for user management (admin only)
const { verifySession } = require('./auth.js');
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
  if (req.method === 'OPTIONS') {
    return res.status(200).json({});
  }

  try {
    const { sessionToken, action, userData } = req.body;

    // Verify session
    const session = verifySession(sessionToken);
    if (!session) {
      return res.status(401).json({ error: 'Nicht autorisiert' });
    }

    // Only admin can manage users
    if (session.username !== 'admin') {
      return res.status(403).json({ error: 'Keine Berechtigung. Nur Admins können Benutzer verwalten.' });
    }

    // Get users from Redis
    const usersJson = await redis.get('users');
    let users = usersJson ? JSON.parse(usersJson) : [];

    // If users array is empty, initialize with admin user
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

    switch (action) {
      case 'list':
        // Return all users (without password hashes)
        const sanitizedUsers = users.map(u => ({
          username: u.username,
          displayName: u.displayName,
          role: u.role,
          createdAt: u.createdAt
        }));
        return res.status(200).json({ success: true, users: sanitizedUsers });

      case 'create':
        // Create new user
        if (!userData || !userData.username || !userData.password || !userData.displayName) {
          return res.status(400).json({ error: 'Fehlende Felder: username, password, displayName' });
        }

        // Check if username already exists
        if (users.find(u => u.username === userData.username)) {
          return res.status(400).json({ error: 'Benutzername bereits vergeben' });
        }

        const newUser = {
          username: userData.username,
          passwordHash: hashPassword(userData.password),
          displayName: userData.displayName,
          role: userData.role || 'user',
          createdAt: new Date().toISOString()
        };

        users.push(newUser);
        await redis.set('users', JSON.stringify(users));

        return res.status(200).json({
          success: true,
          message: 'Benutzer erstellt',
          user: {
            username: newUser.username,
            displayName: newUser.displayName,
            role: newUser.role,
            createdAt: newUser.createdAt
          }
        });

      case 'edit':
        // Edit existing user
        if (!userData || !userData.username) {
          return res.status(400).json({ error: 'Username fehlt' });
        }

        const userIndex = users.findIndex(u => u.username === userData.username);
        if (userIndex < 0) {
          return res.status(404).json({ error: 'Benutzer nicht gefunden' });
        }

        // Prevent admin from deleting themselves or changing their role
        if (userData.username === 'admin' && userData.role && userData.role !== 'admin') {
          return res.status(400).json({ error: 'Admin-Rolle kann nicht geändert werden' });
        }

        // Update user fields
        if (userData.displayName) {
          users[userIndex].displayName = userData.displayName;
        }
        if (userData.password) {
          users[userIndex].passwordHash = hashPassword(userData.password);
        }
        if (userData.role && userData.username !== 'admin') {
          users[userIndex].role = userData.role;
        }

        await redis.set('users', JSON.stringify(users));

        return res.status(200).json({
          success: true,
          message: 'Benutzer aktualisiert',
          user: {
            username: users[userIndex].username,
            displayName: users[userIndex].displayName,
            role: users[userIndex].role
          }
        });

      case 'delete':
        // Delete user
        if (!userData || !userData.username) {
          return res.status(400).json({ error: 'Username fehlt' });
        }

        // Prevent admin from deleting themselves
        if (userData.username === 'admin') {
          return res.status(400).json({ error: 'Admin-Benutzer kann nicht gelöscht werden' });
        }

        const deleteIndex = users.findIndex(u => u.username === userData.username);
        if (deleteIndex < 0) {
          return res.status(404).json({ error: 'Benutzer nicht gefunden' });
        }

        users.splice(deleteIndex, 1);
        await redis.set('users', JSON.stringify(users));

        return res.status(200).json({
          success: true,
          message: 'Benutzer gelöscht'
        });

      default:
        return res.status(400).json({ error: 'Ungültige Aktion' });
    }

  } catch (error) {
    console.error('Error in manage-users:', error);
    return res.status(500).json({
      error: 'Fehler bei der Benutzerverwaltung',
      details: error.message
    });
  }
};
