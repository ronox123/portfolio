# CMS Admin Panel - Portfolio Blog

This is a lightweight Node.js + Express backend to manage, edit, and publish blog posts to the SQLite database.

## Technical Setup

* **Server Port**: `3001`
* **Template Engine**: EJS (Server-rendered views)
* **Auth**: Session-based cookie auth with password hashing via `bcryptjs`.
* **Rich Text Editor**: TipTap editor loaded dynamically via ESM, supporting inline image uploads, link building, and formatting.
* **Uploads Folder**: Cover images and inline images are uploaded directly to `../public/uploads/` at the root, making them accessible to the Astro server.

## Getting Started

1. **Environment Variables**:
   Copy `.env.example` to `.env` (already initialized during setup):
   ```env
   ADMIN_USERNAME=ghufran
   ADMIN_PASSWORD_HASH=$2a$10$gFIRzClXvDQBPqCWEkiCU.8/d5wcXARorEYIVloBOZXkb4xCl8ZUu
   SESSION_SECRET=ghufran_secure_session_secret_2026
   ```

2. **Login Credentials**:
   * **Username**: `ghufran`
   * **Password**: `ghufran-systems-2026`

3. **Running the Server**:
   ```bash
   npm run dev
   ```
   Runs the server on `http://localhost:3001` with nodemon live-reloading.
