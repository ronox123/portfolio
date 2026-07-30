// admin-panel/routes/email.js
import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { emailController } from '../controllers/emailController.js';
import { apiValidators } from '../middlewares/validation.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');
const tempUploadsDir = path.join(rootDir, 'public', 'uploads', 'temp');

// Ensure temporary attachments folder exists
if (!fs.existsSync(tempUploadsDir)) {
  fs.mkdirSync(tempUploadsDir, { recursive: true });
}

// Configure Multer for processing mail attachments
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, tempUploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'attach-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit per attachment
});

const router = express.Router();

// Middleware to ensure user is authenticated in admin dashboard
const requireAuth = (req, res, next) => {
  if (req.session && req.session.authenticated) {
    return next();
  }
  res.redirect('/login');
};

// ==========================================
// LEGACY / EJS PAGE LOAD ROUTES
// ==========================================
router.get('/inbox', requireAuth, emailController.getInbox);
router.get('/email/view/:uid', requireAuth, emailController.getEmailView);
router.get('/email/attachment/:uid/:partId', requireAuth, emailController.downloadAttachment);
router.post('/email/send', requireAuth, upload.array('attachments', 10), emailController.sendEmail);
router.post('/email/draft/save', requireAuth, emailController.saveDraft);
router.post('/email/draft/delete/:id', requireAuth, emailController.deleteDraft);
router.post('/email/action', requireAuth, emailController.handleMailAction);

// ==========================================
// REST API CONTRACT LAYER ENDPOINTS
// ==========================================
router.get('/api/email/folders', requireAuth, emailController.apiGetFolders);
router.get('/api/email/messages', requireAuth, emailController.apiGetMessages);
router.get('/api/email/message/:uid', requireAuth, emailController.apiGetMessage);
router.get('/api/email/attachment/:uid/:partId', requireAuth, emailController.apiDownloadAttachment);
router.post('/api/email/send', requireAuth, upload.array('attachments', 10), apiValidators.validateSend, emailController.apiSendEmail);
router.post('/api/email/reply', requireAuth, upload.array('attachments', 10), apiValidators.validateSend, emailController.apiReplyEmail);
router.post('/api/email/forward', requireAuth, upload.array('attachments', 10), apiValidators.validateSend, emailController.apiForwardEmail);
router.post('/api/email/draft', requireAuth, emailController.apiSaveDraft);
router.delete('/api/email/draft/:id', requireAuth, emailController.apiDeleteDraft);
router.delete('/api/email/message/:uid', requireAuth, emailController.apiDeleteMessage);
router.patch('/api/email/message/:uid/read', requireAuth, emailController.apiMarkRead);
router.patch('/api/email/message/:uid/unread', requireAuth, emailController.apiMarkUnread);
router.patch('/api/email/message/:uid/archive', requireAuth, emailController.apiMoveArchive);
router.patch('/api/email/message/:uid/trash', requireAuth, emailController.apiMoveTrash);
router.post('/api/email/bulk', requireAuth, apiValidators.validateBulk, emailController.apiBulkAction);

// ==========================================
// CONTACTS REST API ENDPOINTS
// ==========================================
router.get('/api/contacts', requireAuth, emailController.apiGetContacts);
router.get('/api/contacts/autocomplete', requireAuth, emailController.apiAutocompleteContacts);
router.get('/api/contacts/:id', requireAuth, emailController.apiGetContact);
router.post('/api/contacts', requireAuth, apiValidators.validateContactSave, emailController.apiCreateContact);
router.put('/api/contacts/:id', requireAuth, apiValidators.validateContactSave, emailController.apiUpdateContact);
router.delete('/api/contacts/:id', requireAuth, emailController.apiDeleteContact);
router.patch('/api/contacts/:id/favorite', requireAuth, emailController.apiToggleFavoriteContact);

// ==========================================
// SETTINGS, PREFERENCES & IDENTITIES API
// ==========================================
router.get('/api/email/preferences', requireAuth, emailController.apiGetPreferences);
router.put('/api/email/preferences', requireAuth, emailController.apiUpdatePreferences);
router.get('/api/email/identities', requireAuth, emailController.apiGetIdentities);
router.get('/api/email/identities/:id', requireAuth, emailController.apiGetIdentity);
router.post('/api/email/identities', requireAuth, apiValidators.validateIdentitySave, emailController.apiCreateIdentity);
router.put('/api/email/identities/:id', requireAuth, apiValidators.validateIdentitySave, emailController.apiUpdateIdentity);
router.delete('/api/email/identities/:id', requireAuth, emailController.apiDeleteIdentity);
router.patch('/api/email/identities/:id/default', requireAuth, emailController.apiSetDefaultIdentity);

export default router;
