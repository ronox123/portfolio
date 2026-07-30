// admin-panel/services/email/ContactService.js
import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import { fileURLToPath } from 'url';
import { Logger } from './Logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..', '..', '..');
const dbPath = path.join(rootDir, 'data', 'blog.db');

let db;
try {
  db = new DatabaseSync(dbPath);
} catch (err) {
  Logger.error('Failed to connect ContactService to SQLite database', { message: err.message });
}

// Generate avatar initials from name
function getInitials(name) {
  if (!name) return '??';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return parts[0].substring(0, 2).toUpperCase();
}

export const ContactService = {
  // Retrieve list of contacts (supports search and favorite filters)
  list(search = '', favoriteOnly = false) {
    Logger.info('Retrieving contacts list from SQLite', { search, favoriteOnly });
    
    let query = "SELECT * FROM contacts WHERE 1=1";
    const params = [];

    if (favoriteOnly) {
      query += " AND favorite = 1";
    }

    if (search && search.trim() !== '') {
      const kw = `%${search.trim()}%`;
      query += " AND (name LIKE ? OR email LIKE ? OR company LIKE ?)";
      params.push(kw, kw, kw);
    }

    query += " ORDER BY name ASC";
    const stmt = db.prepare(query);
    return stmt.all(...params);
  },

  // Retrieve single contact detail
  get(id) {
    Logger.info('Retrieving contact details by id', { id });
    const stmt = db.prepare("SELECT * FROM contacts WHERE id = ?");
    return stmt.get(id);
  },

  // Save new contact
  create({ name, email, additional_emails = '', company = '', job_title = '', phone = '', notes = '', favorite = 0 }) {
    Logger.info('Creating new address book contact record', { email });
    const initials = getInitials(name);
    
    const stmt = db.prepare(`
      INSERT INTO contacts (name, email, additional_emails, company, job_title, phone, notes, favorite, avatar_initials)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    const result = stmt.run(name, email, additional_emails, company, job_title, phone, notes, favorite, initials);
    return result.lastInsertRowId;
  },

  // Update existing contact
  update(id, { name, email, additional_emails = '', company = '', job_title = '', phone = '', notes = '', favorite = 0 }) {
    Logger.info('Updating contact record', { id });
    const initials = getInitials(name);

    const stmt = db.prepare(`
      UPDATE contacts
      SET name = ?, email = ?, additional_emails = ?, company = ?, job_title = ?, phone = ?, notes = ?, favorite = ?, avatar_initials = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);

    stmt.run(name, email, additional_emails, company, job_title, phone, notes, favorite, initials, id);
    return true;
  },

  // Discard contact
  delete(id) {
    Logger.info('Deleting contact record from address book', { id });
    const stmt = db.prepare("DELETE FROM contacts WHERE id = ?");
    stmt.run(id);
    return true;
  },

  // Toggle favorite flag
  toggleFavorite(id) {
    Logger.info('Toggling contact favorite status', { id });
    
    const selectStmt = db.prepare("SELECT favorite FROM contacts WHERE id = ?");
    const contact = selectStmt.get(id);
    if (!contact) throw new Error('Contact not found');

    const newFav = contact.favorite === 1 ? 0 : 1;
    
    const updateStmt = db.prepare("UPDATE contacts SET favorite = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?");
    updateStmt.run(newFav, id);
    
    return newFav;
  },

  // Fetch suggestions for autocomplete search
  autocomplete(query) {
    if (!query || query.trim() === '') return [];
    const kw = `%${query.trim()}%`;
    Logger.info('Running autocomplete contact suggestions lookup', { query });

    const stmt = db.prepare(`
      SELECT id, name, email, avatar_initials 
      FROM contacts 
      WHERE name LIKE ? OR email LIKE ? 
      ORDER BY favorite DESC, name ASC 
      LIMIT 6
    `);
    return stmt.all(kw, kw);
  }
};
