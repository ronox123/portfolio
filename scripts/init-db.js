// scripts/init-db.js
import { DatabaseSync } from 'node:sqlite';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rootDir = path.resolve(__dirname, '..');
const dbDir = path.join(rootDir, 'data');
const dbPath = path.join(dbDir, 'blog.db');

console.log('Starting SQLite database initialization via node:sqlite...');

// Ensure data folder exists
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
  console.log(`Created directory: ${dbDir}`);
}

const db = new DatabaseSync(dbPath);
console.log(`Connected to database at: ${dbPath}`);

// Create posts table
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

console.log('Table "posts" initialized successfully.');

// Create contact requests table
db.exec(`
  CREATE TABLE IF NOT EXISTS contact_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    company TEXT,
    subject TEXT NOT NULL,
    message TEXT NOT NULL,
    status TEXT DEFAULT 'new', -- status values: 'new', 'read', 'replied', 'archived'
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
`);

console.log('Table "contact_requests" initialized successfully.');

// Seed a dummy test post
const seedTitle = 'Sample Post — Delete Me';
const seedSlug = 'sample-post-delete-me';

const checkStmt = db.prepare('SELECT id FROM posts WHERE slug = ?');
const existing = checkStmt.get(seedSlug);

if (!existing) {
  const insertStmt = db.prepare(`
    INSERT INTO posts (
      title, slug, excerpt, content, category, tags, status, published_at, read_time, meta_title, meta_description
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
    )
  `);

  const now = new Date().toISOString();
  insertStmt.run(
    seedTitle,
    seedSlug,
    'This is a sample test post created during setup. You can safely delete it from the admin dashboard.',
    '<h2>Welcome to your new Blog!</h2><p>This is test content. It is structured using native heading tags, paragraphs, and list items to show you exactly how formatting renders on the public site.</p><ul><li>n8n automation is key</li><li>Scalable channels are self-sustaining assets</li><li>Code and no-code tools speed up building</li></ul><p>Enjoy your brand new CMS!</p>',
    'Personal',
    'setup,test,systems',
    'published',
    now,
    1,
    'Sample Post for SEO Verification',
    'Verify that meta tags and search indexes map this description onto Open Graph headers.'
  );

  console.log('Successfully seeded database with a test post.');
} else {
  console.log('Seeded post already exists. Skipping seed step.');
}

console.log('Database initialization complete.');
// In node:sqlite, there is no close() in current DatabaseSync, it handles it on process exit or garbage collection
