// admin-panel/services/email/SettingsService.js
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
  Logger.error('Failed to connect SettingsService to SQLite database', { message: err.message });
}

export const SettingsService = {
  // ==========================================
  // PREFERENCES ACTIONS
  // ==========================================
  
  getPreferences() {
    Logger.info('Retrieving email user preferences');
    const stmt = db.prepare("SELECT * FROM email_preferences WHERE id = 1");
    return stmt.get();
  },

  updatePreferences({ preview_length, page_size, reading_pane_visible, font_size, font_family, autosave_interval, default_reply_behavior, shortcuts_enabled }) {
    Logger.info('Updating email user preferences');
    const stmt = db.prepare(`
      UPDATE email_preferences
      SET preview_length = ?, page_size = ?, reading_pane_visible = ?, font_size = ?, font_family = ?, autosave_interval = ?, default_reply_behavior = ?, shortcuts_enabled = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = 1
    `);
    stmt.run(
      parseInt(preview_length || '80', 10),
      parseInt(page_size || '15', 10),
      reading_pane_visible ? 1 : 0,
      font_size || '13px',
      font_family || 'sans-serif',
      parseInt(autosave_interval || '30', 10),
      default_reply_behavior || 'reply',
      shortcuts_enabled ? 1 : 0
    );
    return true;
  },

  // ==========================================
  // IDENTITIES & SIGNATURES ACTIONS
  // ==========================================

  getIdentities() {
    Logger.info('Retrieving email sender identities');
    const stmt = db.prepare("SELECT * FROM email_identities ORDER BY is_default DESC, name ASC");
    return stmt.all();
  },

  getIdentity(id) {
    Logger.info('Retrieving specific identity by id', { id });
    const stmt = db.prepare("SELECT * FROM email_identities WHERE id = ?");
    return stmt.get(id);
  },

  getDefaultIdentity() {
    Logger.info('Retrieving default sender identity');
    const stmt = db.prepare("SELECT * FROM email_identities WHERE is_default = 1 LIMIT 1");
    let identity = stmt.get();
    if (!identity) {
      // Fallback to the first identity if no default flag is found
      const firstStmt = db.prepare("SELECT * FROM email_identities LIMIT 1");
      identity = firstStmt.get();
    }
    return identity;
  },

  createIdentity({ name, display_name, email, reply_to, signature_enabled, signature_text, signature_html }) {
    Logger.info('Creating new sender identity', { email });
    
    // Check if there are other default identities; if this is the first, make it default
    const countStmt = db.prepare("SELECT COUNT(*) as count FROM email_identities");
    const countResult = countStmt.get();
    const isDefault = countResult.count === 0 ? 1 : 0;

    const stmt = db.prepare(`
      INSERT INTO email_identities (name, display_name, email, reply_to, is_default, signature_enabled, signature_text, signature_html)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    const result = stmt.run(
      name,
      display_name,
      email,
      reply_to || email,
      isDefault,
      signature_enabled ? 1 : 0,
      signature_text || '',
      signature_html || ''
    );
    return result.lastInsertRowId;
  },

  updateIdentity(id, { name, display_name, email, reply_to, signature_enabled, signature_text, signature_html }) {
    Logger.info('Updating sender identity record', { id });
    const stmt = db.prepare(`
      UPDATE email_identities
      SET name = ?, display_name = ?, email = ?, reply_to = ?, signature_enabled = ?, signature_text = ?, signature_html = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    stmt.run(
      name,
      display_name,
      email,
      reply_to || email,
      signature_enabled ? 1 : 0,
      signature_text || '',
      signature_html || '',
      id
    );
    return true;
  },

  deleteIdentity(id) {
    Logger.info('Deleting sender identity', { id });
    const target = this.getIdentity(id);
    if (!target) return false;
    
    if (target.is_default === 1) {
      throw new Error('Default identity cannot be deleted. Please set another default identity first.');
    }

    const stmt = db.prepare("DELETE FROM email_identities WHERE id = ?");
    stmt.run(id);
    return true;
  },

  setDefaultIdentity(id) {
    Logger.info('Setting primary default sender identity', { id });
    
    // Check if identity exists
    const checkStmt = db.prepare("SELECT id FROM email_identities WHERE id = ?");
    const exist = checkStmt.get(id);
    if (!exist) throw new Error('Identity not found');

    // Reset all default flags
    const resetStmt = db.prepare("UPDATE email_identities SET is_default = 0");
    resetStmt.run();

    // Set specific identity as default
    const setStmt = db.prepare("UPDATE email_identities SET is_default = 1 WHERE id = ?");
    setStmt.run(id);

    return true;
  }
};
