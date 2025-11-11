// E-Mail Service für Admin-Benachrichtigungen
// Verwendet Vercel's integrierten E-Mail-Service oder SMTP

async function sendEmail({ to, subject, html }) {
  // Für Production: Verwende einen E-Mail-Service wie SendGrid, Resend, oder AWS SES
  // Hier verwende ich Resend (einfach und günstig)

  const RESEND_API_KEY = process.env.RESEND_API_KEY;

  if (!RESEND_API_KEY) {
    console.error('RESEND_API_KEY not configured');
    return { success: false, error: 'E-Mail service not configured' };
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'Fläsch Info <noreply@flaesch.info>',
        to: [to],
        subject: subject,
        html: html
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Resend API error:', data);
      return { success: false, error: data.message };
    }

    return { success: true, id: data.id };
  } catch (error) {
    console.error('Send email error:', error);
    return { success: false, error: error.message };
  }
}

// Template für neue Registrierung
function newRegistrationEmail(user) {
  return {
    to: 'fluesterer@flaesch.info',
    subject: `🆕 Neue Registrierung: ${user.username}`,
    html: `
      <h2>Neue Benutzerregistrierung</h2>
      <p>Ein neuer Benutzer hat sich bei Fläsch Info registriert:</p>
      <ul>
        <li><strong>Benutzername:</strong> ${user.username}</li>
        <li><strong>Anzeigename:</strong> ${user.displayName}</li>
        <li><strong>E-Mail:</strong> ${user.email}</li>
        <li><strong>Autor-Berechtigung beantragt:</strong> ${user.authorRequested ? '✅ JA' : '❌ Nein'}</li>
        <li><strong>Registriert am:</strong> ${new Date(user.createdAt).toLocaleString('de-CH')}</li>
      </ul>
      ${user.authorRequested ? '<p><strong>⚠️ Dieser Benutzer möchte Artikel veröffentlichen!</strong></p>' : ''}
      <p>Bitte loggen Sie sich im <a href="https://www.flaesch.info/admin.html">Admin-Panel</a> ein, um den Benutzer freizuschalten.</p>
      <hr>
      <p style="color: #666; font-size: 0.9em;">Diese E-Mail wurde automatisch von Fläsch Info generiert.</p>
    `
  };
}

// Template für abgelehnten Kommentar
function rejectedCommentEmail(comment, article) {
  return {
    to: 'fluesterer@flaesch.info',
    subject: `⚠️ Kommentar abgelehnt - Review erforderlich`,
    html: `
      <h2>Kommentar wurde von der KI abgelehnt</h2>
      <p>Ein Kommentar wurde von Claude aufgrund problematischer Inhalte abgelehnt:</p>
      <h3>Kommentar-Details:</h3>
      <ul>
        <li><strong>Benutzer:</strong> ${comment.displayName} (@${comment.username})</li>
        <li><strong>Artikel:</strong> ${article.title}</li>
        <li><strong>Zeitpunkt:</strong> ${new Date(comment.timestamp).toLocaleString('de-CH')}</li>
      </ul>
      <h3>Kommentar-Text:</h3>
      <blockquote style="background: #f5f5f5; padding: 1rem; border-left: 4px solid #ff6b6b;">
        ${comment.text}
      </blockquote>
      <h3>Ablehnungsgrund:</h3>
      <p><strong>${comment.rejectionReason}</strong></p>
      <p>${comment.moderationDetails}</p>
      <p>Bitte loggen Sie sich im <a href="https://www.flaesch.info/admin.html">Admin-Panel</a> ein, um den Kommentar zu überprüfen.</p>
      <hr>
      <p style="color: #666; font-size: 0.9em;">Diese E-Mail wurde automatisch von Fläsch Info generiert.</p>
    `
  };
}

module.exports = {
  sendEmail,
  newRegistrationEmail,
  rejectedCommentEmail
};
