// Authentication API für Admin-Login
import crypto from 'crypto';

// Stored user credentials (hashed)
// In production: Diese würden in einer Datenbank gespeichert
const USERS = [
  {
    username: 'admin',
    // Password: demo123 (SHA-256 hash)
    passwordHash: '6ca13d52ca70c883e0f0bb101e425a89e8624de51db2d2392593af6a84118090',
    displayName: 'Administrator'
  }
];

// Active sessions (In production: Redis oder Datenbank)
const sessions = new Map();

// Session Timeout: 2 Stunden
const SESSION_TIMEOUT = 2 * 60 * 60 * 1000;

// CORS Headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// Hash password with SHA-256
function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

// Generate secure session token
function generateSessionToken() {
  return crypto.randomBytes(32).toString('hex');
}

// Clean up expired sessions
function cleanupSessions() {
  const now = Date.now();
  for (const [token, session] of sessions.entries()) {
    if (now - session.createdAt > SESSION_TIMEOUT) {
      sessions.delete(token);
    }
  }
}

export default async function handler(req, res) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).json({});
  }

  // Login endpoint
  if (req.method === 'POST' && req.url === '/api/auth') {
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

    // Create session
    const sessionToken = generateSessionToken();
    sessions.set(sessionToken, {
      username: user.username,
      displayName: user.displayName,
      createdAt: Date.now()
    });

    // Cleanup old sessions
    cleanupSessions();

    return res.status(200).json({
      success: true,
      sessionToken: sessionToken,
      username: user.username,
      displayName: user.displayName
    });
  }

  // Verify session endpoint
  if (req.method === 'POST' && req.url === '/api/auth/verify') {
    const { sessionToken } = req.body;

    if (!sessionToken) {
      return res.status(401).json({ error: 'Kein Session Token' });
    }

    const session = sessions.get(sessionToken);
    if (!session) {
      return res.status(401).json({ error: 'Ungültige Session' });
    }

    // Check if session expired
    if (Date.now() - session.createdAt > SESSION_TIMEOUT) {
      sessions.delete(sessionToken);
      return res.status(401).json({ error: 'Session abgelaufen' });
    }

    return res.status(200).json({
      valid: true,
      username: session.username,
      displayName: session.displayName
    });
  }

  // Logout endpoint
  if (req.method === 'POST' && req.url === '/api/auth/logout') {
    const { sessionToken } = req.body;

    if (sessionToken) {
      sessions.delete(sessionToken);
    }

    return res.status(200).json({ success: true });
  }

  return res.status(404).json({ error: 'Endpoint nicht gefunden' });
}

// Export verify function for use in other APIs
export function verifySession(sessionToken) {
  if (!sessionToken) return null;

  const session = sessions.get(sessionToken);
  if (!session) return null;

  // Check if expired
  if (Date.now() - session.createdAt > SESSION_TIMEOUT) {
    sessions.delete(sessionToken);
    return null;
  }

  return session;
}
