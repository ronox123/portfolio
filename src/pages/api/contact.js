// src/pages/api/contact.js
export const prerender = false; // Disable static rendering for this API route

import { DatabaseSync } from 'node:sqlite';
import path from 'path';

export async function POST({ request }) {
  try {
    const data = await request.json();
    const { name, email, company, subject, message } = data;

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

    // Connect to SQLite database
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
      email.trim(),
      company ? company.trim() : null,
      subject.trim(),
      message.trim(),
      now
    );

    return new Response(JSON.stringify({ success: true, message: 'Thank you for contacting us! Your message has been successfully submitted.' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (err) {
    console.error('Error occurred in Astro /api/contact route:', err);
    return new Response(JSON.stringify({ 
      error: 'An internal server error occurred. Please try again later.',
      details: err.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
