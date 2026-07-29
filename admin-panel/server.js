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

  res.render('dashboard', { posts, stats: { total, published, drafts } });
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
