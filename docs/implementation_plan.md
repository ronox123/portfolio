# Production Implementation Plan: Integrated Portfolio Email Management System

This document outlines the detailed strategy and engineering standards to transform the Portfolio CMS into a self-hosted communication platform for the domain **ghufran.net**.

---

## Technical Architecture & Engineering Standards

### 1. Clean Modular Architecture
We partition the email system into distinct layers:
- **Routes:** Route declarations (`routes/email.js`) which handle HTTP endpoints and validation middlewares, with zero business logic.
- **Controllers:** Controller handlers (`controllers/emailController.js`) parsing requests, calling services, and returning JSON or rendering EJS views.
- **Services:** Service classes (`services/mailService.js`) encapsulating the core logic (SMTP, IMAP, drafts SQLite storage, attachment streaming).
- **Configuration:** Stored in environment variables (`.env`) loaded via `dotenv`.
- **Middleware:** Security validations (Helmet, Rate-Limiting, CSRF, Session protection, Multer upload filters).
- **Views & Components:** Modular EJS files in `views/` separating sections (sidebar, topbar, compose modal, message pane).

### 2. Email Storage Strategy
- **Mail Server as Source of Truth:** The self-hosted Stalwart Mail Server holds the actual emails. No emails are duplicated or synchronized into the SQLite database.
- **SQLite Database:** Used strictly for metadata of local draft emails (`draft_emails` table), local user interface preferences (`email_preferences` table), sender identity profiles (`email_identities` table), and contacts address book entries (`contacts` table).

---

## Complete Multi-Phase Implementation Strategy

### Phase 1: Backend Foundation & Event Emitters
- Refactor routes, controllers, and services in Express.
- Setup folder/service structure and decoupled Event driven notification layer.
- Verify Helmets, Rate Limit, and Authentication middlewares.

### Phase 2: Connection Pooling & TLS/STARTTLS
- Complete environment variable bindings for Stalwart servers.
- Setup SMTP connection pooling and automatic 15-second idle-disconnect IMAP socket caching.

### Phase 2.5: REST API Contract
- Mount secure, standard API JSON envelope controller endpoints under `/admin/api/`.

### Phase 4: Inbox UI & Split-Pane Viewer
- Implement three-pane premium inbox dashboard layout.
- Integrate sandboxed HTML readers with auto-height adjustment.

### Phase 5: Floating Compose Window
- Build compose modal supporting file attachment dropzone selectors.
- Implement SQLite-backed autosave and recovery background timers.

### Phase 6: Address Book & Contacts Integration
- Create SQLite `contacts` schema and ContactService queries.
- Build list cards panel, profile details inspector, and keyboard-navigable autocomplete suggestion dropdown overlay.

### Phase 7: Settings & Identity Management
- Create SQLite schemas for `email_preferences` and `email_identities` tables.
- Support custom autosave interval, preview length, page sizing, and keyboard shortcut settings.
- Build rich HTML signature inputs with automatic compose-pane injection.
- Support multiple identities storage, editing, and default toggling.

---

## Verification Plan

### Automated Checks
- Start server locally with `node server.js` to verify routes register correctly and database tables initialize without error.

### Manual Verification
- **SMTP/IMAP Connectivity:** Execute verification test to ensure Express successfully authenticates with `mail.ghufran.net`.
- **E2E Delivery:** Send emails to external accounts and inspect header passes (SPF, DKIM, DMARC).
- **Security Check:** Confirm sandboxed iframe blocks script execution on test emails.
