// Benutzerregistrierung API

const crypto = require('crypto');
const Redis = require('ioredis');
const { sendEmail, newRegistrationEmail } = require('./send-email');

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

  const { username, displayName, email, password, requestAuthor } = req.body;

  // Validation
  if (!username || !displayName || !email || !password) {
    return res.status(400).json({ error: 'Alle Felder sind erforderlich' });
  }

  // Username validation (alphanumeric, 3-20 chars)
  if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
    return res.status(400).json({
      error: 'Benutzername muss 3-20 Zeichen lang sein und darf nur Buchstaben, Zahlen und Unterstriche enthalten'
    });
  }

  // Email validation
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Ungültige E-Mail-Adresse' });
  }

  // Password validation (min 6 chars)
  if (password.length < 6) {
    return res.status(400).json({ error: 'Passwort muss mindestens 6 Zeichen lang sein' });
  }

  try {
    // Get existing users
    const usersJson = await redis.get('users');
    let users = usersJson ? JSON.parse(usersJson) : [];

    // Check if username already exists
    if (users.some(u => u.username && u.username.toLowerCase() === username.toLowerCase())) {
      return res.status(409).json({ error: 'Benutzername bereits vergeben' });
    }

    // Check if email already exists
    if (users.some(u => u.email && u.email.toLowerCase() === email.toLowerCase())) {
      return res.status(409).json({ error: 'E-Mail-Adresse bereits registriert' });
    }

    // Create new user
    const newUser = {
      username: username,
      passwordHash: hashPassword(password),
      displayName: displayName,
      email: email,
      role: 'reader', // Startet immer als reader
      authorRequested: requestAuthor || false, // User möchte Autor werden
      createdAt: new Date().toISOString(),
      approved: false // Muss vom Admin freigeschaltet werden
    };

    users.push(newUser);
    await redis.set('users', JSON.stringify(users));

    // Send email to admin (don't fail registration if email fails)
    try {
      const emailData = newRegistrationEmail(newUser);
      const emailResult = await sendEmail(emailData);
      if (!emailResult.success) {
        console.error('Failed to send registration email:', emailResult.error);
      }
    } catch (emailError) {
      console.error('Email sending error:', emailError);
      // Continue with registration even if email fails
    }

    return res.status(201).json({
      success: true,
      message: 'Registrierung erfolgreich! Sie erhalten eine Bestätigung, sobald Ihr Account freigeschaltet wurde.',
      username: newUser.username,
      displayName: newUser.displayName,
      authorRequested: newUser.authorRequested
    });

  } catch (error) {
    console.error('Register error:', error);
    return res.status(500).json({
      error: 'Fehler bei der Registrierung',
      details: error.message
    });
  }
};
