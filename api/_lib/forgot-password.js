// API for password reset request
const crypto = require('crypto');
const Redis = require('ioredis');
const { sendEmail, passwordResetEmail } = require('./send-email');

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

  const { email } = req.body;

  // Validation
  if (!email) {
    return res.status(400).json({ error: 'E-Mail-Adresse erforderlich' });
  }

  try {
    // Get users from Redis
    const usersJson = await redis.get('users');
    let users = usersJson ? JSON.parse(usersJson) : [];

    // Find user by email
    const userIndex = users.findIndex(u => u.email && u.email.toLowerCase() === email.toLowerCase());

    // Always return success (don't reveal if email exists or not for security)
    if (userIndex >= 0) {
      // Generate password reset token
      const resetToken = crypto.randomBytes(32).toString('hex');
      const resetTokenExpiry = Date.now() + 3600000; // 1 hour from now

      // Update user with reset token
      users[userIndex].resetToken = resetToken;
      users[userIndex].resetTokenExpiry = resetTokenExpiry;

      await redis.set('users', JSON.stringify(users));

      // Send password reset email
      try {
        const emailData = passwordResetEmail(users[userIndex], resetToken);
        const emailResult = await sendEmail(emailData);
        if (!emailResult.success) {
          console.error('Failed to send password reset email:', emailResult.error);
        }
      } catch (emailError) {
        console.error('Email sending error:', emailError);
      }
    }

    // Always return success message
    return res.status(200).json({
      success: true,
      message: 'Falls ein Account mit dieser E-Mail-Adresse existiert, wurde ein Link zum Zurücksetzen des Passworts an diese Adresse gesendet.'
    });

  } catch (error) {
    console.error('Forgot password error:', error);
    return res.status(500).json({
      error: 'Fehler bei der Anfrage',
      details: error.message
    });
  }
};
