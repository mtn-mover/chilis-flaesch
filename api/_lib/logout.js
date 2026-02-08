// Logout API
// Note: This is a simple implementation. In production, you'd need access to the sessions Map.
// For now, we rely on client-side session cleanup.

module.exports = async function handler(req, res) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).json({});
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // In a real implementation, we'd delete the session from the sessions Map
  // For now, we just confirm success (client clears sessionStorage)

  return res.status(200).json({ success: true });
}
