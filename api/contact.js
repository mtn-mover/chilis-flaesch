// Kontaktformular API
const { sendEmail } = require('./send-email');

module.exports = async function handler(req, res) {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return res.status(200).json({});
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { name, email, subject, message } = req.body;

  // Validation
  if (!name || !email || !subject || !message) {
    return res.status(400).json({ error: 'Alle Felder sind erforderlich' });
  }

  // Email validation
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Ungültige E-Mail-Adresse' });
  }

  try {
    // Send email to admin
    const emailResult = await sendEmail({
      to: 'send@flaesch.info',
      subject: `Kontaktformular: ${subject}`,
      html: `
        <h2>Neue Kontaktanfrage von Fläsch Info</h2>
        <p><strong>Von:</strong> ${name} (${email})</p>
        <p><strong>Betreff:</strong> ${subject}</p>
        <hr>
        <h3>Nachricht:</h3>
        <p style="white-space: pre-wrap;">${message}</p>
        <hr>
        <p style="color: #666; font-size: 0.9em;">Diese Nachricht wurde über das Kontaktformular auf www.flaesch.info gesendet.</p>
      `,
      from: `Fläsch Info Kontakt <send@flaesch.info>`
    });

    if (!emailResult.success) {
      console.error('Failed to send contact email:', emailResult.error);
      return res.status(500).json({
        error: 'Fehler beim Versenden der Nachricht. Bitte versuche es später erneut.'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Vielen Dank für deine Nachricht! Wir melden uns bald bei dir.'
    });

  } catch (error) {
    console.error('Contact form error:', error);
    return res.status(500).json({
      error: 'Fehler beim Versenden der Nachricht',
      details: error.message
    });
  }
};
