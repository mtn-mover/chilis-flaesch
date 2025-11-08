// Authentication API für Admin-Login
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

// JWT Secret (in production: use environment variable)
const JWT_SECRET = process.env.JWT_SECRET || 'flaesch-info-secret-2024-temp';
const JWT_EXPIRY = '2h'; // 2 hours

// Stored user credentials (hashed)
// In production: Diese würden in einer Datenbank gespeichert
const USERS = [
  {
    username: 'admin',
    // Password: demo123 (SHA-256 hash)
    passwordHash: 'd3ad9315b7be5dd53b31a273b3b3aba5defe700808305aa16a3062b76658a791',
    displayName: 'Administrator'
  }
];

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

  // Find user
  const user = USERS.find(u => u.username === username);
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
      displayName: user.displayName
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRY }
  );

  return res.status(200).json({
    success: true,
    sessionToken: token,
    username: user.username,
    displayName: user.displayName
  });
}

// Export verify function for use in other APIs
module.exports.verifySession = function verifySession(sessionToken) {
  if (!sessionToken) return null;

  try {
    // Verify and decode JWT
    const decoded = jwt.verify(sessionToken, JWT_SECRET);
    return {
      username: decoded.username,
      displayName: decoded.displayName
    };
  } catch (error) {
    // Token invalid or expired
    return null;
  }
};
