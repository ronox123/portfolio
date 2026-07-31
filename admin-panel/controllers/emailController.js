// admin-panel/controllers/emailController.js
import { mailService, DraftService, ContactService, SettingsService } from '../services/email/index.js';
import fs from 'fs';

// Helper to translate mail server exceptions into friendly messages
function getFriendlyErrorMessage(err) {
  const msg = err.message || '';
  const code = err.code || '';
  
  if (code === 'ECONNREFUSED') {
    return 'Connection refused: The mail server at ' + (process.env.IMAP_HOST || '127.0.0.1') + ' is offline or unreachable.';
  }
  if (code === 'ETIMEDOUT' || msg.includes('timeout') || msg.includes('TIMEOUT')) {
    return 'Connection timed out: The mail server did not respond. Check your network or firewall rules.';
  }
  if (code === 'ENOTFOUND') {
    return 'Host not found: The DNS lookup for host ' + (process.env.IMAP_HOST || '127.0.0.1') + ' failed.';
  }
  if (msg.includes('AUTHENTICATIONFAILED') || msg.toLowerCase().includes('auth') || msg.toLowerCase().includes('login') || msg.toLowerCase().includes('credential')) {
    return 'Authentication failed: Please verify your contact@ghufran.net password in .env.';
  }
  return 'Mail Server Error: ' + msg;
}

// Helper to format consistent API Response
function sendApiResponse(res, success, status, data, message) {
  const timestamp = new Date().toISOString();
  const requestId = 'REQ-' + Math.random().toString(36).substring(2, 11).toUpperCase();
  res.status(status).json({
    success,
    data,
    message,
    timestamp,
    requestId
  });
}

export const emailController = {
  // ==========================================
  // EJS TEMPLATE RENDERERS (Web UI)
  // ==========================================
  
  async getInbox(req, res) {
    try {
      const folder = req.query.folder || 'INBOX';
      const page = parseInt(req.query.page || '1', 10);
      const limit = parseInt(req.query.limit || '15', 10);
      const search = req.query.search || null;

      let emails = [];
      let total = 0;

      if (folder.toUpperCase() === 'DRAFTS') {
        emails = DraftService.list();
        total = emails.length;
      } else if (folder.toLowerCase() === 'contacts') {
        emails = ContactService.list(search);
        total = emails.length;
      } else if (folder.toLowerCase() === 'settings') {
        emails = [];
        total = 0;
      } else {
        const result = await mailService.listEmails(folder, page, limit, search);
        emails = result.emails;
        total = result.total;
      }
      
      const preferences = SettingsService.getPreferences();
      const defaultIdentity = SettingsService.getDefaultIdentity();
      const identities = SettingsService.getIdentities();
      
      res.render('inbox', {
        activeTab: 'inbox',
        folder,
        emails,
        total,
        page,
        limit,
        search,
        error: null,
        preferences,
        defaultIdentity,
        identities
      });
    } catch (err) {
      console.error('Error rendering inbox template:', err);
      let preferences = null;
      let defaultIdentity = null;
      let identities = [];
      try {
        preferences = SettingsService.getPreferences();
        defaultIdentity = SettingsService.getDefaultIdentity();
        identities = SettingsService.getIdentities();
      } catch (e) {}

      res.render('inbox', {
        activeTab: 'inbox',
        folder: req.query.folder || 'INBOX',
        emails: [],
        total: 0,
        page: 1,
        limit: 15,
        search: req.query.search || null,
        error: getFriendlyErrorMessage(err),
        preferences,
        defaultIdentity,
        identities
      });
    }
  },

  // Legacy AJAX endpoints preserved for EJS retro-compatibility
  async getEmailView(req, res) {
    try {
      const { uid } = req.params;
      const folder = req.query.folder || 'INBOX';

      if (uid.startsWith('draft_')) {
        const draftId = parseInt(uid.replace('draft_', ''), 10);
        const draft = DraftService.get(draftId);
        if (!draft) return res.status(404).json({ success: false, error: 'Draft not found' });
        return res.json({
          success: true,
          email: {
            uid, subject: draft.subject || '', to: draft.recipient_to || '', cc: draft.recipient_cc || '', bcc: draft.recipient_bcc || '', html: draft.body || '', attachments: [], isDraft: true
          }
        });
      }

      const email = await mailService.getEmail(folder, parseInt(uid, 10));
      res.json({ success: true, email });
    } catch (err) {
      res.status(500).json({ success: false, error: getFriendlyErrorMessage(err) });
    }
  },

  async downloadAttachment(req, res) {
    try {
      const { uid, partId } = req.params;
      const folder = req.query.folder || 'INBOX';

      const attachment = await mailService.getAttachmentStream(folder, parseInt(uid, 10), partId);
      res.setHeader('Content-Type', attachment.mimeType || 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(attachment.filename)}"`);
      res.send(attachment.content);
    } catch (err) {
      res.status(500).send(getFriendlyErrorMessage(err));
    }
  },

  async sendEmail(req, res) {
    try {
      const { to, cc, bcc, subject, body, draftId } = req.body;
      const files = req.files || [];
      const attachments = files.map(file => ({ filename: file.originalname, path: file.path }));

      await mailService.sendEmail({ to, cc, bcc, subject, body, attachments });
      
      files.forEach(file => {
        fs.unlink(file.path, () => {});
      });

      if (draftId && draftId !== '') {
        DraftService.delete(parseInt(draftId, 10));
      }

      res.json({ success: true, message: 'Email sent successfully!' });
    } catch (err) {
      res.status(500).json({ success: false, error: getFriendlyErrorMessage(err) });
    }
  },

  async saveDraft(req, res) {
    try {
      const { id, to, cc, bcc, subject, body } = req.body;
      const draftId = DraftService.save({ id: id ? parseInt(id, 10) : null, to, cc, bcc, subject, body });
      res.json({ success: true, draftId });
    } catch (err) {
      res.status(500).json({ success: false, error: 'Failed to save draft locally.' });
    }
  },

  async deleteDraft(req, res) {
    try {
      DraftService.delete(parseInt(req.params.id, 10));
      res.json({ success: true, message: 'Draft deleted' });
    } catch (err) {
      res.status(500).json({ success: false, error: 'Failed to delete draft.' });
    }
  },

  async handleMailAction(req, res) {
    try {
      const { folder, uids, action } = req.body;
      const draftUids = uids.filter(uid => typeof uid === 'string' && uid.startsWith('draft_'));
      const imapUids = uids.filter(uid => !isNaN(parseInt(uid, 10))).map(uid => parseInt(uid, 10));

      if (draftUids.length > 0 && action === 'delete') {
        draftUids.forEach(uid => {
          DraftService.delete(parseInt(uid.replace('draft_', ''), 10));
        });
      }

      if (imapUids.length > 0) {
        await mailService.bulkAction(folder, imapUids, action);
      }

      res.json({ success: true, message: `Action "${action}" completed successfully.` });
    } catch (err) {
      res.status(500).json({ success: false, error: getFriendlyErrorMessage(err) });
    }
  },

  // ==========================================
  // REST API ENDPOINTS CONTRACT LAYER
  // ==========================================

  // GET /admin/api/email/folders
  async apiGetFolders(req, res) {
    try {
      const folders = await mailService.getFolders();
      sendApiResponse(res, true, 200, folders, 'Mailbox folders loaded.');
    } catch (err) {
      sendApiResponse(res, false, 500, null, getFriendlyErrorMessage(err));
    }
  },

  // GET /admin/api/email/messages
  async apiGetMessages(req, res) {
    try {
      const folder = req.query.folder || 'INBOX';
      const page = parseInt(req.query.page || '1', 10);
      const limit = parseInt(req.query.limit || '15', 10);
      const search = req.query.search || null;

      let result;
      if (folder.toUpperCase() === 'DRAFTS') {
        const drafts = DraftService.list();
        result = { emails: drafts, total: drafts.length, page: 1, limit: 100 };
      } else {
        result = await mailService.listEmails(folder, page, limit, search);
      }

      sendApiResponse(res, true, 200, result, 'Message headers list loaded.');
    } catch (err) {
      sendApiResponse(res, false, 500, null, getFriendlyErrorMessage(err));
    }
  },

  // GET /admin/api/email/message/:uid
  async apiGetMessage(req, res) {
    try {
      const { uid } = req.params;
      const folder = req.query.folder || 'INBOX';

      if (uid.startsWith('draft_')) {
        const draftId = parseInt(uid.replace('draft_', ''), 10);
        const draft = DraftService.get(draftId);
        
        if (!draft) {
          return sendApiResponse(res, false, 404, null, 'Draft not found.');
        }

        return sendApiResponse(res, true, 200, {
          uid,
          subject: draft.subject || '',
          to: draft.recipient_to || '',
          cc: draft.recipient_cc || '',
          bcc: draft.recipient_bcc || '',
          html: draft.body || '',
          attachments: [],
          isDraft: true
        }, 'Local draft email details loaded.');
      }

      const email = await mailService.getEmail(folder, parseInt(uid, 10));
      sendApiResponse(res, true, 200, email, 'Message details loaded.');
    } catch (err) {
      sendApiResponse(res, false, 500, null, getFriendlyErrorMessage(err));
    }
  },

  // GET /admin/api/email/attachment/:uid/:partId
  async apiDownloadAttachment(req, res) {
    try {
      const { uid, partId } = req.params;
      const folder = req.query.folder || 'INBOX';

      const attachment = await mailService.getAttachmentStream(folder, parseInt(uid, 10), partId);
      res.setHeader('Content-Type', attachment.mimeType || 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(attachment.filename)}"`);
      res.send(attachment.content);
    } catch (err) {
      sendApiResponse(res, false, 500, null, getFriendlyErrorMessage(err));
    }
  },

  // POST /admin/api/email/send
  async apiSendEmail(req, res) {
    const files = req.files || [];
    try {
      const { to, cc, bcc, subject, body, draftId } = req.body;
      const attachments = files.map(file => ({ filename: file.originalname, path: file.path }));

      const info = await mailService.sendEmail({ to, cc, bcc, subject, body, attachments });

      if (draftId && draftId !== '') {
        DraftService.delete(parseInt(draftId, 10));
      }

      sendApiResponse(res, true, 200, { messageId: info.messageId }, 'Email sent successfully.');
    } catch (err) {
      sendApiResponse(res, false, 500, null, getFriendlyErrorMessage(err));
    } finally {
      files.forEach(file => {
        fs.unlink(file.path, () => {});
      });
    }
  },

  // POST /admin/api/email/reply
  async apiReplyEmail(req, res) {
    // Reply logic mirrors sending logic. Formatted headers are constructed by the client.
    return this.apiSendEmail(req, res);
  },

  // POST /admin/api/email/forward
  async apiForwardEmail(req, res) {
    // Forward logic mirrors sending logic. Formatted headers are constructed by the client.
    return this.apiSendEmail(req, res);
  },

  // POST /admin/api/email/draft
  async apiSaveDraft(req, res) {
    try {
      const { id, to, cc, bcc, subject, body } = req.body;
      const draftId = DraftService.save({ id: id ? parseInt(id, 10) : null, to, cc, bcc, subject, body });
      sendApiResponse(res, true, 201, { draftId }, 'Draft saved successfully.');
    } catch (err) {
      sendApiResponse(res, false, 500, null, 'Failed to save draft locally.');
    }
  },

  // DELETE /admin/api/email/draft/:id
  async apiDeleteDraft(req, res) {
    try {
      const { id } = req.params;
      DraftService.delete(parseInt(id, 10));
      sendApiResponse(res, true, 200, null, 'Draft discarded successfully.');
    } catch (err) {
      sendApiResponse(res, false, 500, null, 'Failed to delete draft.');
    }
  },

  // DELETE /admin/api/email/message/:uid
  async apiDeleteMessage(req, res) {
    try {
      const { uid } = req.params;
      const folder = req.query.folder || 'INBOX';
      
      await mailService.bulkAction(folder, [parseInt(uid, 10)], 'delete');
      sendApiResponse(res, true, 200, null, 'Message relocated to Trash or deleted permanently.');
    } catch (err) {
      sendApiResponse(res, false, 500, null, getFriendlyErrorMessage(err));
    }
  },

  // PATCH /admin/api/email/message/:uid/read
  async apiMarkRead(req, res) {
    try {
      const { uid } = req.params;
      const folder = req.query.folder || 'INBOX';
      await mailService.bulkAction(folder, [parseInt(uid, 10)], 'read');
      sendApiResponse(res, true, 200, null, 'Message marked as read.');
    } catch (err) {
      sendApiResponse(res, false, 500, null, getFriendlyErrorMessage(err));
    }
  },

  // PATCH /admin/api/email/message/:uid/unread
  async apiMarkUnread(req, res) {
    try {
      const { uid } = req.params;
      const folder = req.query.folder || 'INBOX';
      await mailService.bulkAction(folder, [parseInt(uid, 10)], 'unread');
      sendApiResponse(res, true, 200, null, 'Message marked as unread.');
    } catch (err) {
      sendApiResponse(res, false, 500, null, getFriendlyErrorMessage(err));
    }
  },

  // PATCH /admin/api/email/message/:uid/archive
  async apiMoveArchive(req, res) {
    try {
      const { uid } = req.params;
      const folder = req.query.folder || 'INBOX';
      await mailService.bulkAction(folder, [parseInt(uid, 10)], 'archive');
      sendApiResponse(res, true, 200, null, 'Message relocated to Archive.');
    } catch (err) {
      sendApiResponse(res, false, 500, null, getFriendlyErrorMessage(err));
    }
  },

  // PATCH /admin/api/email/message/:uid/trash
  async apiMoveTrash(req, res) {
    return this.apiDeleteMessage(req, res); // Redirect to DELETE message route logic
  },

  // POST /admin/api/email/bulk
  async apiBulkAction(req, res) {
    try {
      const { folder, uids, action, destination } = req.body;
      const draftUids = uids.filter(uid => typeof uid === 'string' && uid.startsWith('draft_'));
      const imapUids = uids.filter(uid => !isNaN(parseInt(uid, 10))).map(uid => parseInt(uid, 10));
 
      if (draftUids.length > 0 && action === 'delete') {
        draftUids.forEach(uid => {
          DraftService.delete(parseInt(uid.replace('draft_', ''), 10));
        });
      }
 
      if (imapUids.length > 0) {
        await mailService.bulkAction(folder, imapUids, action, destination);
      }
 
      sendApiResponse(res, true, 200, null, `Bulk action "${action}" completed successfully.`);
    } catch (err) {
      sendApiResponse(res, false, 500, null, getFriendlyErrorMessage(err));
    }
  },

  // ==========================================
  // CONTACTS REST API ENDPOINTS
  // ==========================================

  // GET /admin/api/contacts
  async apiGetContacts(req, res) {
    try {
      const search = req.query.search || '';
      const favoriteOnly = req.query.favorite === 'true';
      const contacts = ContactService.list(search, favoriteOnly);
      sendApiResponse(res, true, 200, contacts, 'Contacts list loaded.');
    } catch (err) {
      sendApiResponse(res, false, 500, null, err.message);
    }
  },

  // GET /admin/api/contacts/autocomplete
  async apiAutocompleteContacts(req, res) {
    try {
      const query = req.query.q || '';
      const suggestions = ContactService.autocomplete(query);
      sendApiResponse(res, true, 200, suggestions, 'Autocomplete suggestions loaded.');
    } catch (err) {
      sendApiResponse(res, false, 500, null, err.message);
    }
  },

  // GET /admin/api/contacts/:id
  async apiGetContact(req, res) {
    try {
      const { id } = req.params;
      const contact = ContactService.get(parseInt(id, 10));
      if (!contact) {
        return sendApiResponse(res, false, 404, null, 'Contact not found.');
      }
      sendApiResponse(res, true, 200, contact, 'Contact details loaded.');
    } catch (err) {
      sendApiResponse(res, false, 500, null, err.message);
    }
  },

  // POST /admin/api/contacts
  async apiCreateContact(req, res) {
    try {
      const { name, email, additional_emails, company, job_title, phone, notes, favorite } = req.body;
      const contactId = ContactService.create({
        name,
        email,
        additional_emails,
        company,
        job_title,
        phone,
        notes,
        favorite: favorite ? 1 : 0
      });
      sendApiResponse(res, true, 201, { contactId }, 'Contact created successfully.');
    } catch (err) {
      if (err.message && err.message.includes('UNIQUE')) {
        return sendApiResponse(res, false, 400, null, 'A contact with this email address already exists.');
      }
      sendApiResponse(res, false, 500, null, err.message);
    }
  },

  // PUT /admin/api/contacts/:id
  async apiUpdateContact(req, res) {
    try {
      const { id } = req.params;
      const { name, email, additional_emails, company, job_title, phone, notes, favorite } = req.body;
      
      ContactService.update(parseInt(id, 10), {
        name,
        email,
        additional_emails,
        company,
        job_title,
        phone,
        notes,
        favorite: favorite ? 1 : 0
      });
      sendApiResponse(res, true, 200, null, 'Contact updated successfully.');
    } catch (err) {
      if (err.message && err.message.includes('UNIQUE')) {
        return sendApiResponse(res, false, 400, null, 'Another contact with this email address already exists.');
      }
      sendApiResponse(res, false, 500, null, err.message);
    }
  },

  // DELETE /admin/api/contacts/:id
  async apiDeleteContact(req, res) {
    try {
      const { id } = req.params;
      ContactService.delete(parseInt(id, 10));
      sendApiResponse(res, true, 200, null, 'Contact deleted successfully.');
    } catch (err) {
      sendApiResponse(res, false, 500, null, err.message);
    }
  },

  // PATCH /admin/api/contacts/:id/favorite
  async apiToggleFavoriteContact(req, res) {
    try {
      const { id } = req.params;
      const favoriteState = ContactService.toggleFavorite(parseInt(id, 10));
      sendApiResponse(res, true, 200, { favorite: favoriteState }, 'Contact favorite status updated.');
    } catch (err) {
      sendApiResponse(res, false, 500, null, err.message);
    }
  },

  // ==========================================
  // SETTINGS, PREFERENCES & IDENTITIES API
  // ==========================================

  // GET /admin/api/email/preferences
  async apiGetPreferences(req, res) {
    try {
      const preferences = SettingsService.getPreferences();
      sendApiResponse(res, true, 200, preferences, 'User preferences loaded.');
    } catch (err) {
      sendApiResponse(res, false, 500, null, err.message);
    }
  },

  // PUT /admin/api/email/preferences
  async apiUpdatePreferences(req, res) {
    try {
      SettingsService.updatePreferences(req.body);
      sendApiResponse(res, true, 200, null, 'User preferences updated successfully.');
    } catch (err) {
      sendApiResponse(res, false, 500, null, err.message);
    }
  },

  // GET /admin/api/email/identities
  async apiGetIdentities(req, res) {
    try {
      const identities = SettingsService.getIdentities();
      sendApiResponse(res, true, 200, identities, 'Sender identities list loaded.');
    } catch (err) {
      sendApiResponse(res, false, 500, null, err.message);
    }
  },

  // GET /admin/api/email/identities/:id
  async apiGetIdentity(req, res) {
    try {
      const { id } = req.params;
      const identity = SettingsService.getIdentity(parseInt(id, 10));
      if (!identity) return sendApiResponse(res, false, 404, null, 'Identity not found.');
      sendApiResponse(res, true, 200, identity, 'Identity details loaded.');
    } catch (err) {
      sendApiResponse(res, false, 500, null, err.message);
    }
  },

  // POST /admin/api/email/identities
  async apiCreateIdentity(req, res) {
    try {
      const { name, display_name, email, reply_to, signature_enabled, signature_text, signature_html } = req.body;
      const identityId = SettingsService.createIdentity({
        name, display_name, email, reply_to, signature_enabled, signature_text, signature_html
      });
      sendApiResponse(res, true, 201, { identityId }, 'Sender identity created successfully.');
    } catch (err) {
      if (err.message && err.message.includes('UNIQUE')) {
        return sendApiResponse(res, false, 400, null, 'An identity with this email address already exists.');
      }
      sendApiResponse(res, false, 500, null, err.message);
    }
  },

  // PUT /admin/api/email/identities/:id
  async apiUpdateIdentity(req, res) {
    try {
      const { id } = req.params;
      const { name, display_name, email, reply_to, signature_enabled, signature_text, signature_html } = req.body;
      
      SettingsService.updateIdentity(parseInt(id, 10), {
        name, display_name, email, reply_to, signature_enabled, signature_text, signature_html
      });
      sendApiResponse(res, true, 200, null, 'Sender identity updated successfully.');
    } catch (err) {
      if (err.message && err.message.includes('UNIQUE')) {
        return sendApiResponse(res, false, 400, null, 'Another identity with this email address already exists.');
      }
      sendApiResponse(res, false, 500, null, err.message);
    }
  },

  // DELETE /admin/api/email/identities/:id
  async apiDeleteIdentity(req, res) {
    try {
      const { id } = req.params;
      SettingsService.deleteIdentity(parseInt(id, 10));
      sendApiResponse(res, true, 200, null, 'Sender identity deleted successfully.');
    } catch (err) {
      sendApiResponse(res, false, 500, null, err.message);
    }
  },

  // PATCH /admin/api/email/identities/:id/default
  async apiSetDefaultIdentity(req, res) {
    try {
      const { id } = req.params;
      SettingsService.setDefaultIdentity(parseInt(id, 10));
      sendApiResponse(res, true, 200, null, 'Default primary sender identity updated.');
    } catch (err) {
      sendApiResponse(res, false, 500, null, err.message);
    }
  }
};
