// admin-panel/services/email/DraftService.js
import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import { fileURLToPath } from 'url';
import { Logger } from './Logger.js';
import { EmailEvents, EmailEventTypes } from './EmailEvents.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..', '..', '..');
const dbPath = path.join(rootDir, 'data', 'blog.db');

let db;
try {
  db = new DatabaseSync(dbPath);
} catch (err) {
  Logger.error('Failed to connect DraftService to SQLite database', { message: err.message });
}

export const DraftService = {
  // Retrieve all local drafts
  list() {
    Logger.info('Retrieving local email drafts from SQLite');
    const stmt = db.prepare("SELECT * FROM draft_emails ORDER BY updated_at DESC");
    return stmt.all().map(d => ({
      uid: `draft_${d.id}`,
      subject: d.subject || '(No Subject)',
      to: d.recipient_to || '',
      date: d.updated_at,
      excerpt: d.body ? d.body.replace(/<[^>]*>/g, '').substring(0, 80) : '',
      isDraft: true
    }));
  },

  // Retrieve single draft details
  get(id) {
    Logger.info('Retrieving details for local draft', { id });
    const stmt = db.prepare("SELECT * FROM draft_emails WHERE id = ?");
    return stmt.get(id);
  },

  // Save or update draft details
  save({ id, to, cc, bcc, subject, body }) {
    let finalId = id;
    if (id) {
      Logger.info('Updating existing draft details', { id });
      const stmt = db.prepare(`
        UPDATE draft_emails
        SET recipient_to = ?, recipient_cc = ?, recipient_bcc = ?, subject = ?, body = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `);
      stmt.run(to, cc, bcc, subject, body, id);
    } else {
      Logger.info('Inserting new email draft entry');
      const stmt = db.prepare(`
        INSERT INTO draft_emails (recipient_to, recipient_cc, recipient_bcc, subject, body)
        VALUES (?, ?, ?, ?, ?)
      `);
      const result = stmt.run(to, cc, bcc, subject, body);
      finalId = result.lastInsertRowId;
    }
    EmailEvents.emit(EmailEventTypes.EMAIL_DRAFT_SAVED, { id: finalId, subject, to });
    return finalId;
  },

  // Delete a draft from the database
  delete(id) {
    Logger.info('Deleting draft from SQLite database', { id });
    const stmt = db.prepare("DELETE FROM draft_emails WHERE id = ?");
    stmt.run(id);
    EmailEvents.emit(EmailEventTypes.EMAIL_DELETED, { folder: 'DRAFTS', uids: [`draft_${id}`] });
    return true;
  }
};
