/**
 * Email sender using nodemailer with Gmail SMTP
 */

import nodemailer from 'nodemailer';
import { CONFIG } from '../config.ts';

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false, // STARTTLS
  auth: {
    user: CONFIG.email.smtpUser,
    pass: CONFIG.email.smtpPass
  }
});

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export async function sendEmail(options: EmailOptions): Promise<void> {
  const info = await transporter.sendMail({
    from: `"Radiosonde" <${CONFIG.email.from}>`,
    to: options.to,
    subject: options.subject,
    html: options.html,
    text: options.text
  });

  console.log(`Email sent: ${info.messageId}`);
}

export function formatSubject(date: Date = new Date()): string {
  const dateStr = date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric'
  });
  return `Weather Briefing - ${dateStr}`;
}

// Allow running directly for testing
if (import.meta.main) {
  console.log('Testing email configuration...');
  console.log(`SMTP User: ${CONFIG.email.smtpUser || '(not set)'}`);
  console.log(`SMTP Pass: ${CONFIG.email.smtpPass ? '****' : '(not set)'}`);
  console.log(`To: ${CONFIG.email.to || '(not set)'}`);

  if (CONFIG.email.smtpUser && CONFIG.email.smtpPass && CONFIG.email.to) {
    console.log('\nSending test email...');
    try {
      await sendEmail({
        to: CONFIG.email.to,
        subject: formatSubject() + ' (Test)',
        html: '<h1>Test Email</h1><p>Radiosonde email is working!</p>',
        text: 'Test Email\n\nRadiosonde email is working!'
      });
      console.log('Test email sent successfully!');
    } catch (error) {
      console.error('Failed to send email:', error);
      process.exit(1);
    }
  } else {
    console.log('\nEmail credentials not configured. Set SMTP_USER, SMTP_PASS, and EMAIL_TO in .env');
  }
}
