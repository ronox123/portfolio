// admin-panel/middlewares/csrf.js
import crypto from 'crypto';

// Initialize CSRF Token in Session
export const csrfInit = (req, res, next) => {
  if (req.session) {
    if (!req.session.csrfToken) {
      req.session.csrfToken = crypto.randomBytes(32).toString('hex');
    }
    res.locals.csrfToken = req.session.csrfToken;
  }
  next();
};

// Verify CSRF Token on State-Changing Requests
export const csrfVerify = (req, res, next) => {
  const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
  if (safeMethods.includes(req.method)) {
    return next();
  }

  const token = req.body?._csrf || req.headers['x-csrf-token'] || req.headers['x-xsrf-token'];

  if (!token || token !== req.session?.csrfToken) {
    console.warn(`[CSRF Alert] Invalid token attempt from IP: ${req.ip}. Method: ${req.method}, Path: ${req.path}`);
    return res.status(403).render('error', {
      message: 'Security validation failed (Invalid CSRF Token). Please refresh the page and try again.',
      error: null
    });
  }

  next();
};
