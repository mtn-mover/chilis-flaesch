// API for username reminder
const Redis = require('ioredis');
const { sendEmail, usernameReminderEmail } = require('./send-email');

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
    const user = users.find(u => u.email && u.email.toLowerCase() === email.toLowerCase());

    // Always return success (don't reveal if email exists or not for security)
    if (user) {
      // Send username reminder email
      try {
        const emailData = usernameReminderEmail(user);
        const emailResult = await sendEmail(emailData);
        if (!emailResult.success) {
          console.error('Failed to send username reminder email:', emailResult.error);
        }
      } catch (emailError) {
        console.error('Email sending error:', emailError);
      }
    }

    // Always return success message
    return res.status(200).json({
      success: true,
      message: 'Falls ein Account mit dieser E-Mail-Adresse existiert, wurde der Benutzername an diese Adresse gesendet.'
    });

  } catch (error) {
    console.error('Forgot username error:', error);
    return res.status(500).json({
      error: 'Fehler bei der Anfrage',
      details: error.message
    });
  }
};
