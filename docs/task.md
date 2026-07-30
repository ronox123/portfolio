# Task Checklist: Mailbox Redesign & Feature Completion

- `[x]` Backend Service Upgrades
  - `[x]` Update `ImapService.js` to parse `replyTo`, cache bodies in memory, and support advanced query parsing
  - `[x]` Update `MailboxService.js` to retrieve unseen unread counts per folder
- `[x]` Express API Endpoints & Routes
  - `[x]` Register custom unread-counts API endpoint (integrated into folders count endpoint)
  - `[x]` Register message Starring/Unstarring API endpoints (integrated into unified bulk actions)
  - `[x]` Register message custom Move API endpoint (integrated into unified bulk actions)
  - `[x]` Update `emailController.js` to wire and process all REST requests
- `[x]` HTML/CSS Redesign in `inbox.ejs`
  - `[x]` Incorporate premium Inter/Outfit styling theme
  - `[x]` Build shimmering loading skeleton screens for detail rendering
  - `[x]` Mount inline action triggers (Reply, Reply All, Forward, Star, Move Folder)
  - `[x]` Refine Compose modal with attachments drag & drop zone + progress loaders
  - `[x]` Build keyboard navigation shortcut hooks and cheatsheet legend modal
  - `[x]` Implement in-place AJAX loading and folder unread badges
- `[x]` Production Verification & Review
  - `[x]` Run build checks & boot Express app
  - `[x]` Manual validation of Compose, Send, Reply, Forward, Star, and Search
