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

// Template für Autoren-Freischaltung
function authorApprovedEmail(user) {
  return {
    to: user.email,
    subject: 'Gratulation! Du kannst jetzt Artikel veröffentlichen',
    html: `
      <h2>Herzlichen Glückwunsch, ${user.displayName}! 🎉</h2>
      <p>Der Administrator hat dir die Berechtigung erteilt, Artikel auf <strong>Fläsch Info</strong> zu veröffentlichen!</p>

      <div style="background: linear-gradient(135deg, #FF6B6B 0%, #FFA500 100%); color: white; padding: 2rem; border-radius: 12px; margin: 2rem 0; text-align: center;">
        <h3 style="margin: 0 0 0.5rem 0; color: white;">Du bist jetzt Autor!</h3>
        <p style="margin: 0; font-size: 1.1rem;">Logge dich ein und erstelle deinen ersten satirischen Artikel.</p>
      </div>

      <h3>📝 Wichtige Redaktionsrichtlinien:</h3>
      <div style="background: #fff3cd; border-left: 4px solid #FFA500; padding: 1rem; margin: 1rem 0;">
        <p style="margin: 0 0 0.5rem 0;"><strong>⚠️ Bitte beachte folgende Regeln:</strong></p>
        <ul style="margin: 0.5rem 0; padding-left: 1.5rem; line-height: 1.8;">
          <li><strong>KEINE echten Namen</strong> aus Protokollen oder offiziellen Dokumenten verwenden</li>
          <li><strong>KEINE Beleidigungen oder Diffamierungen</strong> - bleibe respektvoll</li>
          <li><strong>Satirisch, aber nicht böswillig</strong> - Humor ja, Hetze nein</li>
          <li><strong>Verwende Pseudonyme</strong> und lustige Funktionsbezeichnungen</li>
          <li><strong>Schweizer Hochdeutsch</strong> verwenden (keine ß, Guillemets «» statt "")</li>
        </ul>
      </div>

      <h3>🌶️ Etablierte Charaktere (kannst du verwenden):</h3>
      <ul style="line-height: 1.8;">
        <li><strong>Der CEO</strong> - Gemeindepräsident</li>
        <li><strong>Der Generalsekretär</strong> - Vorsitzender der GPK</li>
        <li><strong>Der Adjutant</strong> - Der Abwart</li>
        <li><strong>El Diablo Müller</strong> - Dorfbewohner mit starken Meinungen</li>
      </ul>

      <h3>🚀 So geht's weiter:</h3>
      <ol style="line-height: 1.8;">
        <li>Logge dich ein auf <a href="https://www.flaesch.info/admin.html">Fläsch Info</a></li>
        <li>Klicke auf "Neuer Artikel"</li>
        <li>Fülle das Formular aus und lass Claude den Artikel generieren</li>
        <li>Überprüfe und veröffentliche deinen Artikel</li>
      </ol>

      <p style="margin-top: 2rem;">Wir freuen uns auf deine satirischen Beiträge über Fläsch!</p>

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
      <div style="background: #f5f5f5; padding: 1rem; border-radius: 8px; margin: 2rem 0;">
        <p style="margin: 0; color: #333;"><strong>Deine Login-Daten:</strong></p>
        <p style="margin: 0.5rem 0 0 0; color: #666;">Benutzername: <strong>${user.username}</strong></p>
      </div>
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
  activationEmail,
  authorApprovedEmail
};
