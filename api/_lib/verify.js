// Session Verification API
const { verifySession } = require('./auth.js');

module.exports = async function handler(req, res) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).json({});
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { sessionToken } = req.body;

  const session = verifySession(sessionToken);

  if (!session) {
    return res.status(401).json({ error: 'Ungültige oder abgelaufene Session' });
  }

  return res.status(200).json({
    valid: true,
    username: session.username,
    displayName: session.displayName,
    role: session.role || 'user'
  });
}
