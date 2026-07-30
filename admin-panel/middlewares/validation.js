// admin-panel/middlewares/validation.js

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Validates comma-separated email addresses list
export function validateEmailList(emails) {
  if (!emails || emails.trim() === '') return true;
  const list = emails.split(',').map(e => e.trim());
  return list.every(e => emailRegex.test(e));
}

export const apiValidators = {
  // Validate Send Email inputs
  validateSend(req, res, next) {
    const { to, cc, bcc } = req.body;

    if (!to || to.trim() === '') {
      return res.status(400).json({
        success: false,
        data: null,
        message: 'Validation Error: Recipient email address ("to") is required.',
        timestamp: new Date().toISOString(),
        requestId: 'VAL-ERR-' + Math.random().toString(36).substring(2, 7).toUpperCase()
      });
    }

    if (!validateEmailList(to)) {
      return res.status(400).json({
        success: false,
        data: null,
        message: 'Validation Error: "to" field contains invalid email addresses.',
        timestamp: new Date().toISOString(),
        requestId: 'VAL-ERR-' + Math.random().toString(36).substring(2, 7).toUpperCase()
      });
    }

    if (cc && !validateEmailList(cc)) {
      return res.status(400).json({
        success: false,
        data: null,
        message: 'Validation Error: "cc" field contains invalid email addresses.',
        timestamp: new Date().toISOString(),
        requestId: 'VAL-ERR-' + Math.random().toString(36).substring(2, 7).toUpperCase()
      });
    }

    if (bcc && !validateEmailList(bcc)) {
      return res.status(400).json({
        success: false,
        data: null,
        message: 'Validation Error: "bcc" field contains invalid email addresses.',
        timestamp: new Date().toISOString(),
        requestId: 'VAL-ERR-' + Math.random().toString(36).substring(2, 7).toUpperCase()
      });
    }

    next();
  },

  // Validate Bulk mail actions inputs
  validateBulk(req, res, next) {
    const { folder, uids, action } = req.body;
    const validActions = ['read', 'unread', 'delete', 'archive'];

    if (!folder || folder.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Validation Error: "folder" parameter is mandatory.'
      });
    }

    if (!uids || !Array.isArray(uids) || uids.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Validation Error: "uids" array is mandatory and must not be empty.'
      });
    }

    if (!action || !validActions.includes(action)) {
      return res.status(400).json({
        success: false,
        message: `Validation Error: "action" parameter is mandatory and must be one of: ${validActions.join(', ')}`
      });
    }

    next();
  },

  // Validate Contact Save inputs
  validateContactSave(req, res, next) {
    const { name, email } = req.body;

    if (!name || name.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Validation Error: Contact name is required.'
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email.trim())) {
      return res.status(400).json({
        success: false,
        message: 'Validation Error: Primary contact email is invalid or missing.'
      });
    }

    next();
  },

  // Validate Identity Save inputs
  validateIdentitySave(req, res, next) {
    const { name, display_name, email } = req.body;

    if (!name || name.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Validation Error: Identity name is required (e.g. "Work").'
      });
    }

    if (!display_name || display_name.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Validation Error: Display name is required.'
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email.trim())) {
      return res.status(400).json({
        success: false,
        message: 'Validation Error: Identity email address is invalid or missing.'
      });
    }

    next();
  }
};
