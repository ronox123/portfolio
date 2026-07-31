// src/pages/api/contact.js
export const prerender = false; // Disable static rendering for this API route

import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import nodemailer from 'nodemailer';

// Simple in-memory tracker to prevent duplicate submissions on retries
const recentSubmissions = new Map();

export async function POST({ request }) {
  try {
    const data = await request.json();
    const { name, email, company, subject, message, phone } = data;

    // Server-side validation
    if (!name || !name.trim()) {
      return new Response(JSON.stringify({ error: 'Full name is required.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (!email || !email.trim()) {
      return new Response(JSON.stringify({ error: 'Email address is required.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return new Response(JSON.stringify({ error: 'Please enter a valid email address.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (!subject || !subject.trim()) {
      return new Response(JSON.stringify({ error: 'Subject is required.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (!message || !message.trim()) {
      return new Response(JSON.stringify({ error: 'Message is required.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const cleanEmail = email.trim();
    const cleanMessage = message.trim();

    // 1. Prevent duplicate email notifications if request is retried (within 2 minutes)
    const nowMs = Date.now();
    for (const [key, time] of recentSubmissions.entries()) {
      if (nowMs - time > 120000) {
        recentSubmissions.delete(key);
      }
    }

    const submissionKey = `${cleanEmail}:${cleanMessage}`;
    if (recentSubmissions.has(submissionKey)) {
      console.warn('Duplicate request detected. Skipping database insert and SMTP forwarding.');
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'Thank you for contacting us! Your message has been successfully submitted.' 
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    recentSubmissions.set(submissionKey, nowMs);

    // 2. Connect to SQLite database & Save submission
    let dbSaved = false;
    try {
      const dbPath = path.join(process.cwd(), 'data', 'blog.db');
      const db = new DatabaseSync(dbPath);

      // Self-healing table creation
      db.exec(`
        CREATE TABLE IF NOT EXISTS contact_requests (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          email TEXT NOT NULL,
          company TEXT,
          subject TEXT NOT NULL,
          message TEXT NOT NULL,
          status TEXT DEFAULT 'new',
          created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );
      `);

      const stmt = db.prepare(`
        INSERT INTO contact_requests (name, email, company, subject, message, status, created_at)
        VALUES (?, ?, ?, ?, ?, 'new', ?)
      `);

      const now = new Date().toISOString();
      stmt.run(
        name.trim(),
        cleanEmail,
        company ? company.trim() : null,
        subject.trim(),
        cleanMessage,
        now
      );
      dbSaved = true;
      console.log('Successfully saved contact form request to SQLite database.');
    } catch (dbErr) {
      console.error('Database operation failed in /api/contact:', dbErr);
    }

    // 3. SMTP Forwarding
    // Extract metadata
    const clientIp = request.headers.get('x-real-ip') || request.headers.get('x-forwarded-for') || 'Unknown';
    const userAgent = request.headers.get('user-agent') || 'Unknown';
    const referer = request.headers.get('referer') || 'Unknown';
    const datetimeStr = new Date().toLocaleString('en-US', { timeZone: 'UTC' }) + ' UTC';

    const smtpConfig = {
      host: process.env.SMTP_HOST || 'mail.ghufran.net',
      port: parseInt(process.env.SMTP_PORT || '465', 10),
      secure: process.env.SMTP_SECURE === 'true' || process.env.SMTP_PORT === '465',
      auth: {
        user: process.env.EMAIL_USER || 'contact@ghufran.net',
        pass: process.env.EMAIL_PASS
      }
    };

    console.log('Initializing SMTP transporter for contact form forwarding...', {
      host: smtpConfig.host,
      port: smtpConfig.port,
      user: smtpConfig.auth.user
    });

    const transporter = nodemailer.createTransport(smtpConfig);

    // Clean, professional HTML template
    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #1E293B; line-height: 1.6; margin: 0; padding: 0; background-color: #F8FAFC; }
          .container { max-width: 600px; margin: 20px auto; background: #FFFFFF; border-radius: 8px; overflow: hidden; border: 1px solid #E2E8F0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); }
          .header { background-color: #1E293B; padding: 24px; text-align: center; color: #FFFFFF; }
          .header h2 { margin: 0; font-size: 20px; font-weight: 600; letter-spacing: 0.5px; }
          .content { padding: 32px 24px; }
          .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; background-color: #F1F5F9; padding: 16px; border-radius: 6px; margin-bottom: 24px; font-size: 13px; }
          .meta-item { margin-bottom: 8px; }
          .meta-label { font-weight: 600; color: #475569; }
          .message-box { background: #FAF5FF; border-left: 4px solid #7C3AED; padding: 16px; border-radius: 4px; font-size: 14px; margin-top: 24px; }
          .message-title { font-weight: bold; color: #6B21A8; margin-bottom: 8px; }
          .message-text { white-space: pre-wrap; color: #334155; }
          .footer { background: #F8FAFC; text-align: center; padding: 16px; font-size: 11px; color: #94A3B8; border-top: 1px solid #E2E8F0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>New Website Inquiry</h2>
          </div>
          <div class="content">
            <div class="meta-grid">
              <div class="meta-item"><span class="meta-label">Full Name:</span><br>${name}</div>
              <div class="meta-item"><span class="meta-label">Email Address:</span><br>${cleanEmail}</div>
              <div class="meta-item"><span class="meta-label">Subject:</span><br>${subject}</div>
              <div class="meta-item"><span class="meta-label">Company Name:</span><br>${company ? company.trim() : 'N/A'}</div>
              <div class="meta-item"><span class="meta-label">Phone Number:</span><br>${phone ? phone.trim() : 'N/A'}</div>
              <div class="meta-item"><span class="meta-label">Date & Time:</span><br>${datetimeStr}</div>
              <div class="meta-item"><span class="meta-label">Client IP:</span><br>${clientIp}</div>
              <div class="meta-item"><span class="meta-label">Referrer:</span><br>${referer}</div>
            </div>
            <div style="font-size: 12px; color: #64748B; margin-bottom: 12px;"><strong>User Agent:</strong> ${userAgent}</div>
            <div class="message-box">
              <div class="message-title">Submitted Inquiry Message:</div>
              <div class="message-text">${message.trim()}</div>
            </div>
          </div>
          <div class="footer">
            Sent automatically from ghufran.net portfolio system builder contact endpoint.
          </div>
        </div>
      </body>
      </html>
    `;

    // Deliver to Primary (contact@ghufran.net)
    let primarySent = false;
    try {
      await transporter.sendMail({
        from: `"Website Contact Form" <${smtpConfig.auth.user}>`,
        to: 'contact@ghufran.net',
        subject: `[Website Contact] ${subject}`,
        html: emailHtml,
        replyTo: cleanEmail
      });
      primarySent = true;
      console.log('Successfully sent primary contact email to contact@ghufran.net');
    } catch (primaryErr) {
      console.error('SMTP ERROR: Failed to deliver primary notification to contact@ghufran.net', {
        error: primaryErr.message,
        stack: primaryErr.stack
      });
    }

    // Deliver to Forward Destination (mghufran1057@gmail.com)
    try {
      await transporter.sendMail({
        from: `"Website Contact (Forward)" <${smtpConfig.auth.user}>`,
        to: 'mghufran1057@gmail.com',
        subject: `Fwd: [Website Contact] ${subject}`,
        html: `
          <div style="background-color: #EFF6FF; border-left: 4px solid #2563EB; padding: 12px; margin-bottom: 20px; font-family: sans-serif; font-size: 13px; color: #1E3A8A;">
            <strong>Auto-Forward Status Report:</strong><br>
            Primary inbox delivery (contact@ghufran.net): ${primarySent ? 'SUCCESS' : 'FAILED'}<br>
            Saved in website database: ${dbSaved ? 'YES' : 'NO'}
          </div>
          ${emailHtml}
        `,
        replyTo: cleanEmail
      });
      console.log('Successfully forwarded contact email copy to mghufran1057@gmail.com');
    } catch (fwdErr) {
      console.error('SMTP ERROR: Failed to forward copy to mghufran1057@gmail.com', {
        error: fwdErr.message,
        stack: fwdErr.stack
      });
    }

    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Thank you for contacting us! Your message has been successfully submitted.' 
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (err) {
    console.error('Astro contact API general error:', err);
    return new Response(JSON.stringify({ 
      error: 'An internal server error occurred. Please try again later.',
      details: err.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
