import nodemailer from 'nodemailer';
import { db } from './db.js';

const smtpOn = Boolean(process.env.SMTP_HOST);
const transporter = smtpOn
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === 'true',
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
    })
  : null;

export const mailMode = smtpOn ? 'smtp' : 'dev-inbox';

/**
 * Sends an email. With no SMTP settings, the message is stored in the Dev Inbox
 * (visible in the app) so the demo works with zero setup.
 * Returns true on success, false on failure.
 */
export async function sendMail({ to, subject, text }) {
  try {
    if (process.env.SIMULATE_EMAIL_FAILURE === 'true') throw new Error('Simulated failure');
    if (smtpOn) {
      await transporter.sendMail({ from: process.env.MAIL_FROM || process.env.SMTP_USER, to, subject, text });
    }
    db.prepare('INSERT INTO outbox (to_email, subject, body, status) VALUES (?,?,?,?)').run(to, subject, text, smtpOn ? 'sent' : 'dev-inbox');
    if (!smtpOn) console.log(`\n[dev-inbox] To: ${to}\nSubject: ${subject}\n${text}\n`);
    return true;
  } catch (err) {
    console.error('Email failed:', err.message);
    db.prepare('INSERT INTO outbox (to_email, subject, body, status) VALUES (?,?,?,?)').run(to, subject, text, 'failed');
    return false;
  }
}
