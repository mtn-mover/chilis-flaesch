// E-Mail Service für Admin-Benachrichtigungen
// Verwendet eigenen SMTP-Server (Metanet)

const nodemailer = require('nodemailer');

// SMTP Configuration
const SMTP_CONFIG = {
  host: process.env.SMTP_HOST || 'smtp.flaesch.info',
  port: process.env.SMTP_PORT || 587,
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER || 'send@flaesch.info',
    pass: process.env.SMTP_PASS || 'emailinfo7306'
  },
  tls: {
    rejectUnauthorized: false // Allow self-signed certificates
  }
};

// Create reusable transporter
let transporter;

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport(SMTP_CONFIG);
  }
  return transporter;
}

async function sendEmail({ to, subject, html, from }) {
  try {
    const transport = getTransporter();

    const mailOptions = {
      from: from || `Fläsch Info <send@flaesch.info>`,
      to: to,
      subject: subject,
      html: html
    };

    const info = await transport.sendMail(mailOptions);
    console.log('Email sent successfully:', info.messageId);

    return { success: true, messageId: info.messageId };
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

// Template für Account-Aktivierung
function activationEmail(user, activationToken) {
  const activationUrl = `https://www.flaesch.info/activate.html?token=${activationToken}`;

  return {
    to: user.email,
    subject: 'Aktiviere deinen Fläsch Info Account',
    html: `
      <h2>Willkommen bei Fläsch Info, ${user.displayName}!</h2>
      <p>Vielen Dank für deine Registrierung. Um deinen Account zu aktivieren und dich einloggen zu können, klicke bitte auf den folgenden Link:</p>
      <p style="margin: 2rem 0;">
        <a href="${activationUrl}" style="background-color: #e63946; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
          Account aktivieren
        </a>
      </p>
      <p>Oder kopiere diesen Link in deinen Browser:</p>
      <p style="word-break: break-all; color: #666;">${activationUrl}</p>
      <p style="margin-top: 2rem;">Sobald dein Account aktiviert ist, kannst du:</p>
      <ul>
        <li>Dich einloggen</li>
        <li>Artikel kommentieren</li>
        <li>Artikel liken</li>
        ${user.authorRequested ? '<li><strong>Artikel verfassen</strong> (nach Admin-Freigabe)</li>' : ''}
      </ul>
      <hr>
      <p style="color: #666; font-size: 0.9em;">Falls du dich nicht registriert hast, kannst du diese E-Mail einfach ignorieren.</p>
    `
  };
}

module.exports = {
  sendEmail,
  newRegistrationEmail,
  rejectedCommentEmail,
  activationEmail
};
