// admin-panel/server.js
import express from 'express';
import session from 'express-session';
import multer from 'multer';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { DatabaseSync } from 'node:sqlite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '.env') });

const app = express();
const PORT = process.env.PORT || 3001;

// Path Config
const rootDir = path.resolve(__dirname, '..');
const dbPath = path.join(rootDir, 'data', 'blog.db');
const uploadsDir = path.join(rootDir, 'public', 'uploads');

// Ensure uploads folder exists
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Database Setup
const db = new DatabaseSync(dbPath);

// Self-healing database table initialization
db.exec(`
  CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    excerpt TEXT,
    content TEXT,
    cover_image TEXT,
    category TEXT,
    tags TEXT,
    status TEXT DEFAULT 'draft',
    published_at TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    meta_title TEXT,
    meta_description TEXT,
    read_time INTEGER DEFAULT 1
  );
`);

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

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Session setup
app.use(session({
  secret: process.env.SESSION_SECRET || 'ghufran-secret-default-key-2026',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 24 } // 24 hours
}));

// Global EJS Variables Middleware
app.use((req, res, next) => {
  if (req.session && req.session.authenticated) {
    try {
      const stmt = db.prepare("SELECT COUNT(*) as count FROM contact_requests WHERE status = 'new'");
      res.locals.unreadContactsCount = stmt.get().count;
    } catch (err) {
      res.locals.unreadContactsCount = 0;
    }
  } else {
    res.locals.unreadContactsCount = 0;
  }
  next();
});

// Set EJS Views engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Serve uploads statically so the admin panel can preview them
app.use('/uploads', express.static(uploadsDir));

// Serve global stylesheet statically for live preview mapping
app.use('/css', express.static(path.join(rootDir, 'src', 'styles')));

// Serve static assets for TipTap and styles
app.use(express.static(path.join(__dirname, 'public')));

// Serve typo-js library and Hunspell dictionaries locally for offline spell checking
app.use('/js/typo.js', express.static(path.join(__dirname, 'node_modules/typo-js/typo.js')));
app.use('/dictionaries', express.static(path.join(__dirname, 'node_modules/typo-js/dictionaries')));

// Multer Storage Configuration for Uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, 'upload-' + uniqueSuffix + ext);
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

// Authentication middleware
const requireAuth = (req, res, next) => {
  if (req.session && req.session.authenticated) {
    return next();
  }
  res.redirect('/login');
};

// --- ROUTES ---

// Login Routes
app.get('/login', (req, res) => {
  if (req.session.authenticated) {
    return res.redirect('/dashboard');
  }
  res.render('login', { error: null });
});

app.post('/login', (req, res) => {
  const { username, password } = req.body;
  const envUsername = process.env.ADMIN_USERNAME || 'ghufran';
  const envHash = process.env.ADMIN_PASSWORD_HASH;

  if (username === envUsername && envHash && bcrypt.compareSync(password, envHash)) {
    req.session.authenticated = true;
    req.session.username = username;
    return res.redirect('/dashboard');
  }

  res.render('login', { error: 'Invalid username or password.' });
});

app.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/login');
  });
});

// Dashboard Route
app.get('/dashboard', requireAuth, (req, res) => {
  const stmt = db.prepare(`
    SELECT id, title, slug, category, status, published_at, updated_at 
    FROM posts 
    ORDER BY created_at DESC
  `);
  const posts = stmt.all();

  // Calculate quick stats
  const total = posts.length;
  const published = posts.filter(p => p.status === 'published').length;
  const drafts = total - published;

  // Query contact request statistics
  let unreadContacts = 0;
  let totalContacts = 0;
  try {
    const unreadStmt = db.prepare("SELECT COUNT(*) as count FROM contact_requests WHERE status = 'new'");
    unreadContacts = unreadStmt.get().count;

    const totalStmt = db.prepare("SELECT COUNT(*) as count FROM contact_requests");
    totalContacts = totalStmt.get().count;
  } catch (err) {
    console.error('Error fetching contact stats for dashboard:', err);
  }

  res.render('dashboard', { 
    posts, 
    stats: { total, published, drafts },
    contactStats: { unread: unreadContacts, total: totalContacts }
  });
});

// New Post Route
app.get('/posts/new', requireAuth, (req, res) => {
  res.render('editor', { post: null });
});

// Edit Post Route
app.get('/posts/edit/:id', requireAuth, (req, res) => {
  const stmt = db.prepare('SELECT * FROM posts WHERE id = ?');
  const post = stmt.get(req.params.id);
  
  if (!post) {
    return res.status(404).send('Post not found');
  }
  res.render('editor', { post });
});

// Save Post (Insert/Update)
app.post('/posts/save', requireAuth, upload.single('cover_image'), (req, res) => {
  const { id, title, slug, excerpt, content, category, tags, status, meta_title, meta_description } = req.body;

  // Generate unique slug if not provided
  let finalSlug = slug ? slug.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-') : '';
  if (!finalSlug && title) {
    finalSlug = title.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');
  }
  
  // Calculate read time (approx 200 words per minute)
  const plainText = content ? content.replace(/<[^>]*>/g, '') : '';
  const wordCount = plainText.trim().split(/\s+/).filter(Boolean).length;
  const readTime = Math.max(1, Math.ceil(wordCount / 200));

  // Determine cover image path
  let coverImagePath = req.body.existing_cover_image || '';
  if (req.file) {
    coverImagePath = '/uploads/' + req.file.filename;
  }

  const now = new Date().toISOString();

  if (id) {
    // Update existing post
    let updateQuery = `
      UPDATE posts 
      SET title = ?, slug = ?, excerpt = ?, content = ?, cover_image = ?, 
          category = ?, tags = ?, status = ?, updated_at = ?, 
          meta_title = ?, meta_description = ?, read_time = ?
    `;
    const params = [
      title, finalSlug, excerpt, content, coverImagePath, 
      category, tags, status, now, 
      meta_title, meta_description, readTime
    ];

    // If publishing, set published_at if not already set
    if (status === 'published') {
      updateQuery += `, published_at = COALESCE(published_at, ?)`;
      params.push(now);
    } else {
      updateQuery += `, published_at = NULL`;
    }

    updateQuery += ` WHERE id = ?`;
    params.push(id);

    const stmt = db.prepare(updateQuery);
    stmt.run(...params);
  } else {
    // Insert new post
    const publishedAt = status === 'published' ? now : null;
    const stmt = db.prepare(`
      INSERT INTO posts (
        title, slug, excerpt, content, cover_image, category, tags, status, 
        published_at, created_at, updated_at, meta_title, meta_description, read_time
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      title, finalSlug, excerpt, content, coverImagePath, category, tags, status,
      publishedAt, now, now, meta_title, meta_description, readTime
    );
  }

  res.redirect('/dashboard');
});

// Toggle Publish State
app.post('/posts/toggle-publish/:id', requireAuth, (req, res) => {
  const getPost = db.prepare('SELECT status, published_at FROM posts WHERE id = ?');
  const post = getPost.get(req.params.id);

  if (!post) {
    return res.status(404).send('Post not found');
  }

  const newStatus = post.status === 'published' ? 'draft' : 'published';
  const now = new Date().toISOString();
  
  const updateQuery = newStatus === 'published'
    ? 'UPDATE posts SET status = ?, published_at = COALESCE(published_at, ?), updated_at = ? WHERE id = ?'
    : 'UPDATE posts SET status = ?, published_at = NULL, updated_at = ? WHERE id = ?';

  const params = newStatus === 'published'
    ? [newStatus, now, now, req.params.id]
    : [newStatus, now, req.params.id];

  const stmt = db.prepare(updateQuery);
  stmt.run(...params);
  res.redirect('/dashboard');
});

// Delete Post
app.post('/posts/delete/:id', requireAuth, (req, res) => {
  const stmt = db.prepare('DELETE FROM posts WHERE id = ?');
  stmt.run(req.params.id);
  res.redirect('/dashboard');
});

// Inline Editor Image Upload Handler
app.post('/upload-image', requireAuth, upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No image uploaded.' });
  }
  const fileUrl = '/uploads/' + req.file.filename;
  res.json({ url: fileUrl });
});

// Preview Route
app.get('/posts/preview/:id', requireAuth, (req, res) => {
  const stmt = db.prepare('SELECT * FROM posts WHERE id = ?');
  const post = stmt.get(req.params.id);

  if (!post) {
    return res.status(404).send('Post not found');
  }

  res.render('preview', { post });
});

// --- CONTACT REQUESTS MANAGEMENT ROUTES ---

// Listing contacts with sorting, searching, filtering, pagination
app.get('/admin/contacts', requireAuth, (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const offset = (page - 1) * limit;
  
  const status = req.query.status || 'all';
  const search = req.query.search || '';
  const sort = req.query.sort || 'created_at';
  const order = req.query.order || 'DESC';

  // Allowed columns to sort to protect against SQL Injection
  const allowedSortFields = ['created_at', 'name', 'email', 'company', 'subject', 'status'];
  const finalSort = allowedSortFields.includes(sort) ? sort : 'created_at';
  const finalOrder = order === 'ASC' ? 'ASC' : 'DESC';

  let query = 'SELECT * FROM contact_requests';
  let countQuery = 'SELECT COUNT(*) as count FROM contact_requests';
  const params = [];
  const countParams = [];
  const conditions = [];

  if (status !== 'all') {
    conditions.push('status = ?');
    params.push(status);
    countParams.push(status);
  }

  if (search) {
    conditions.push('(name LIKE ? OR email LIKE ? OR company LIKE ? OR subject LIKE ? OR message LIKE ?)');
    const searchWild = `%${search}%`;
    params.push(searchWild, searchWild, searchWild, searchWild, searchWild);
    countParams.push(searchWild, searchWild, searchWild, searchWild, searchWild);
  }

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
    countQuery += ' WHERE ' + conditions.join(' AND ');
  }

  query += ` ORDER BY ${finalSort} ${finalOrder} LIMIT ? OFFSET ?`;
  params.push(limit, offset);

  try {
    const listStmt = db.prepare(query);
    const contacts = listStmt.all(...params);

    const countStmt = db.prepare(countQuery);
    const totalCount = countStmt.get(...countParams).count;
    const totalPages = Math.ceil(totalCount / limit);

    // Dynamic stats query
    const statsStmt = db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'new' THEN 1 ELSE 0 END) as new_count,
        SUM(CASE WHEN status = 'read' THEN 1 ELSE 0 END) as read_count,
        SUM(CASE WHEN status = 'replied' THEN 1 ELSE 0 END) as replied_count,
        SUM(CASE WHEN status = 'archived' THEN 1 ELSE 0 END) as archived_count
      FROM contact_requests
    `);
    const contactStats = statsStmt.get() || { total: 0, new_count: 0, read_count: 0, replied_count: 0, archived_count: 0 };

    res.render('contacts', {
      contacts,
      activeTab: 'contacts',
      filters: { status, search, sort, order, page, limit },
      pagination: {
        page,
        limit,
        totalCount,
        totalPages
      },
      stats: {
        total: contactStats.total || 0,
        unread: contactStats.new_count || 0,
        read: contactStats.read_count || 0,
        replied: contactStats.replied_count || 0,
        archived: contactStats.archived_count || 0
      }
    });
  } catch (err) {
    console.error('Error fetching contact list:', err);
    res.status(500).send('Error loading contact requests');
  }
});

// Update single contact status
app.post('/admin/contacts/update-status', requireAuth, (req, res) => {
  const { id, status } = req.body;
  if (!id || !status) {
    return res.status(400).json({ error: 'Missing parameters' });
  }

  try {
    const stmt = db.prepare('UPDATE contact_requests SET status = ? WHERE id = ?');
    stmt.run(status, id);
    res.json({ success: true });
  } catch (err) {
    console.error('Error updating status:', err);
    res.status(500).json({ error: 'Database update failed' });
  }
});

// Delete single contact request
app.post('/admin/contacts/delete/:id', requireAuth, (req, res) => {
  try {
    const stmt = db.prepare('DELETE FROM contact_requests WHERE id = ?');
    stmt.run(req.params.id);
    res.redirect('/admin/contacts');
  } catch (err) {
    console.error('Error deleting contact request:', err);
    res.status(500).send('Database delete failed');
  }
});

// Bulk actions on contact requests
app.post('/admin/contacts/bulk', requireAuth, (req, res) => {
  const { ids, action } = req.body;
  if (!ids || !Array.isArray(ids) || ids.length === 0 || !action) {
    return res.status(400).json({ error: 'Invalid parameters' });
  }

  try {
    const placeholders = ids.map(() => '?').join(',');
    
    if (action === 'delete') {
      const stmt = db.prepare(`DELETE FROM contact_requests WHERE id IN (${placeholders})`);
      stmt.run(...ids);
    } else {
      let statusValue = 'read';
      if (action === 'unread') statusValue = 'new';
      else if (action === 'replied') statusValue = 'replied';
      else if (action === 'archive') statusValue = 'archived';

      const stmt = db.prepare(`UPDATE contact_requests SET status = ? WHERE id IN (${placeholders})`);
      stmt.run(statusValue, ...ids);
    }
    res.json({ success: true });
  } catch (err) {
    console.error('Error executing bulk action:', err);
    res.status(500).json({ error: 'Bulk action failed' });
  }
});

// Root Redirect to Dashboard
app.get('/', (req, res) => {
  res.redirect('/dashboard');
});

// Catch-all
app.use((req, res) => {
  res.status(404).send('Page not found');
});

app.listen(PORT, () => {
  console.log(`CMS Admin Panel running on: http://localhost:${PORT}`);
});
