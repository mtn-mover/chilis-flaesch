import { kv } from '@vercel/kv';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'flaesch-info-secret-2024-temp';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Parse body
    let body = req.body;
    if (typeof body === 'string') {
      body = JSON.parse(body);
    }

    // Verify authentication
    const token = body.sessionToken;
    if (!token) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    // Only admin can debug
    if (decoded.role !== 'admin' && decoded.username !== 'admin') {
      return res.status(403).json({ error: 'Not authorized - admin only' });
    }

    // Get users from KV
    const usersData = await kv.get('users');
    console.log('Raw KV data:', usersData);
    console.log('Type of KV data:', typeof usersData);

    let users;
    try {
      users = JSON.parse(usersData || '[]');
    } catch (parseError) {
      return res.status(200).json({
        success: false,
        error: 'Failed to parse users data',
        rawData: usersData,
        parseError: parseError.message
      });
    }

    // Find the current user
    const currentUser = users.find(u => u.username === decoded.username);

    return res.status(200).json({
      success: true,
      decodedToken: {
        username: decoded.username,
        role: decoded.role
      },
      totalUsers: users.length,
      currentUser: currentUser ? {
        username: currentUser.username,
        role: currentUser.role,
        canCreateNewspaper: currentUser.canCreateNewspaper,
        hasCanCreateNewspaperField: 'canCreateNewspaper' in currentUser
      } : null,
      allUsers: users.map(u => ({
        username: u.username,
        role: u.role,
        canCreateNewspaper: u.canCreateNewspaper,
        hasCanCreateNewspaperField: 'canCreateNewspaper' in u
      }))
    });

  } catch (error) {
    console.error('Error in debug-users:', error);
    return res.status(500).json({
      error: 'Internal error',
      details: error.message,
      stack: error.stack
    });
  }
}
