# Email Management System: Technical Documentation

This document describes the complete architecture, directory structure, database schema, REST contract, and deployment configurations of the integrated Email Management System for **ghufran.net**.

---

## 1. Folder Structure

The Email module is implemented as a decoupled sub-module inside the Express Portfolio application:

```
admin-panel/
├── controllers/
│   └── emailController.js             # Parses REST requests, renders EJS
│
├── middlewares/
│   ├── csrf.js                        # Validates CSRF session-backed tokens
│   └── validation.js                  # Checks inputs (contacts, identities, bulk actions)
│
├── routes/
│   └── email.js                       # Mounts route endpoints to Express router
│
├── services/
│   └── email/
│       ├── providers/
│       │   ├── EmailProvider.js       # Abstract base provider class
│       │   └── StalwartProvider.js    # Concrete provider calling IMAP & SMTP services
│       │
│       ├── ConnectionManager.js       # Manages IMAP socket caches & Nodemailer pooling
│       ├── ImapService.js             # Message header fetches and detail lookups
│       ├── SmtpService.js             # Outgoing mail transmission
│       ├── MailboxService.js          # Folder listings and bulk folder relocations
│       ├── DraftService.js            # SQLite drafts read/write operations
│       ├── ContactService.js          # SQLite contact CRUD and autocompletes
│       ├── SettingsService.js         # SQLite configurations & identities CRUD
│       ├── EmailConfig.js             # Configuration binder reading from .env
│       ├── EmailEvents.js             # Event Emitter registry
│       ├── Logger.js                  # Centralized structured logger
│       └── index.js                   # Exports all active services
│
├── views/
│   ├── inbox.ejs                      # Standard three-pane split UI template
│   └── partials/
│       ├── sidebar.ejs                # Admin CMS sidebar
│       └── topbar.ejs                 # Admin CMS topbar
│
└── server.js                          # Initializes SQLite schemas and starts Express
```

---

## 2. Database Schema (SQLite)

All user preferences, contacts, identities, and email drafts are persisted locally in `data/blog.db`:

### `draft_emails`
Stores unsent drafts. Cleared upon successful SMTP transmission.
* `id` (INTEGER PRIMARY KEY AUTOINCREMENT)
* `recipient_to` (TEXT)
* `recipient_cc` (TEXT)
* `recipient_bcc` (TEXT)
* `subject` (TEXT)
* `body` (TEXT)
* `created_at` (TEXT)
* `updated_at` (TEXT)

### `contacts`
Stores address book items.
* `id` (INTEGER PRIMARY KEY AUTOINCREMENT)
* `name` (TEXT NOT NULL)
* `email` (TEXT NOT NULL UNIQUE)
* `additional_emails` (TEXT)
* `company` (TEXT)
* `job_title` (TEXT)
* `phone` (TEXT)
* `notes` (TEXT)
* `favorite` (INTEGER DEFAULT 0)
* `avatar_initials` (TEXT)
* `created_at` (TEXT)
* `updated_at` (TEXT)

### `email_identities`
Stores sender profiles and HTML signatures.
* `id` (INTEGER PRIMARY KEY AUTOINCREMENT)
* `name` (TEXT NOT NULL)
* `display_name` (TEXT NOT NULL)
* `email` (TEXT NOT NULL UNIQUE)
* `reply_to` (TEXT)
* `is_default` (INTEGER DEFAULT 0)
* `signature_enabled` (INTEGER DEFAULT 0)
* `signature_text` (TEXT)
* `signature_html` (TEXT)
* `created_at` (TEXT)
* `updated_at` (TEXT)

### `email_preferences`
Stores dashboard layout preferences.
* `id` (INTEGER PRIMARY KEY)
* `preview_length` (INTEGER DEFAULT 80)
* `page_size` (INTEGER DEFAULT 15)
* `reading_pane_visible` (INTEGER DEFAULT 1)
* `font_size` (TEXT DEFAULT '13px')
* `font_family` (TEXT DEFAULT 'sans-serif')
* `autosave_interval` (INTEGER DEFAULT 30)
* `default_reply_behavior` (TEXT DEFAULT 'reply')
* `theme` (TEXT DEFAULT 'dark')
* `notifications_enabled` (INTEGER DEFAULT 1)
* `shortcuts_enabled` (INTEGER DEFAULT 1)
* `updated_at` (TEXT)

---

## 3. Service Architecture

The services are completely decoupled, communicating via standard JavaScript models or the Node `EventEmitter` instance inside `EmailEvents.js`.

### Connection Manager & Socket Lifecycle Caching
To optimize performance, connections are cached:
* **SMTP:** Uses Nodemailer's built-in connection pool (`maxConnections: 5`, `idleTimeout: 30000ms`).
* **IMAP:** Implements active socket caching. When a client requests a command, `ConnectionManager.acquireImapClient()` checks for an active, usable connection. Once complete, `releaseImapClient()` schedules an idle timer. If no new commands arrive within 15 seconds, the connection closes cleanly, avoiding server overhead.

---

## 4. Deployment Prerequisites

Prior to launching the service in production on the VPS:
1. **Firewall (UFW):** Open mail-related ports:
   ```bash
   sudo ufw allow 25/tcp
   sudo ufw allow 465/tcp
   sudo ufw allow 587/tcp
   sudo ufw allow 993/tcp
   ```
2. **Reverse Proxy:** Mount `mail-admin.ghufran.net` in Nginx pointing to local port `8080` (Stalwart configuration console).
3. **SSL Certificates:** Run certbot to secure connections:
   ```bash
   sudo certbot --nginx -d mail-admin.ghufran.net
   ```
4. **DNS Registrar Mapping:** Ensure your DNS registrar maps the following records:
   - **MX:** `ghufran.net -> mail.ghufran.net` (Priority: 10)
   - **A (mail):** `mail.ghufran.net -> VPS_IP`
   - **A (mail-admin):** `mail-admin.ghufran.net -> VPS_IP`
   - **SPF:** `v=spf1 mx ip4:VPS_IP -all`
   - **DMARC:** `v=DMARC1; p=reject; rua=mailto:postmaster@ghufran.net`
   - **DKIM:** Copy the DKIM TXT record generated by the Stalwart admin panel.

---

## 5. Environment Variables

Define the following parameters in `admin-panel/.env` on the VPS:

```env
# Mailbox Credentials
EMAIL_USER=contact@ghufran.net
EMAIL_PASS=your_stalwart_mailbox_password

# IMAP Configuration
IMAP_HOST=mail.ghufran.net
IMAP_PORT=993
IMAP_SECURE=true

# SMTP Configuration
SMTP_HOST=mail.ghufran.net
SMTP_PORT=587
SMTP_SECURE=false # Set true for Port 465, false for STARTTLS Port 587
```
