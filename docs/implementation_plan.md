# Implementation Plan: Premium Mailbox Redesign & Feature Completion

We will transform the existing basic mailbox template into a high-fidelity, premium mail client workspace. All modifications will preserve the existing underlying connection configuration.

---

## User Review Required

> [!IMPORTANT]
> **Keyboard Shortcuts:** We will register Vim/Gmail-like keyboard navigation:
> * `J` / `K` to navigate up/down the list
> * `C` to Compose
> * `R` to Reply, `A` to Reply All, `F` to Forward
> * `E` to Archive, `#` to Delete, `U` to toggle Read/Unread
> * `S` to toggle Star

---

## Open Questions

None. The technical specifications cover all requested items.

---

## Proposed Changes

### 1. Backend Service Extensions

#### [MODIFY] [ImapService.js](file:///c:/Users/Amjad%20Enterprises/OneDrive/Desktop/POT/admin-panel/services/email/ImapService.js)
* Support extracting `replyTo` from message envelope headers.
* Implement client-side body caching. Cached message bodies will be stored in an in-memory map to avoid repetitive network IMAP commands.
* Upgrade search query criteria parser to identify filter prefixes (`from:`, `to:`, `subject:`, `body:`) and translate them to IMAP AND/OR filters.

#### [MODIFY] [MailboxService.js](file:///c:/Users/Amjad%20Enterprises/OneDrive/Desktop/POT/admin-panel/services/email/MailboxService.js)
* Implement unread status counts for folder lists by querying `client.status(folder, { unseen: true })`.

---

### 2. Controller & Routing Adjustments

#### [MODIFY] [emailController.js](file:///c:/Users/Amjad%20Enterprises/OneDrive/Desktop/POT/admin-panel/controllers/emailController.js)
* Expose API endpoint `GET /admin/api/email/unread-counts` to supply unread counts for all folder nodes.
* Add endpoints to support Starring/Unstarring emails.
* Extend the reply and forward actions with header overrides.

#### [MODIFY] [email.js](file:///c:/Users/Amjad%20Enterprises/OneDrive/Desktop/POT/admin-panel/routes/email.js)
* Register `GET /api/email/unread-counts`.
* Register `PATCH /api/email/message/:uid/star` and `DELETE /api/email/message/:uid/star`.
* Register `POST /api/email/message/:uid/move`.

---

### 3. Frontend UI Redesign (`inbox.ejs`)

#### [MODIFY] [inbox.ejs](file:///c:/Users/Amjad%20Enterprises/OneDrive/Desktop/POT/admin-panel/views/inbox.ejs)
* **Visual Polish:**
  * Embed Inter/Outfit typography.
  * Modernize the three-panel layout with sleek borders, curated hover transformations, responsive drawer support, and styled scrollbars.
  * Introduce shimmer-effect loading skeletons when reading emails.
  * Add custom SVG empty state illustrations.
* **Email List Panel:**
  * Add color-coded initials avatars.
  * Display a visible star icon toggle on each list item.
  * Display paperclip attachment badges.
  * Implement unread indicators and unread sidebar counts.
  * Support instant in-place AJAX reloading of email rows instead of full page reloads.
* **Email Viewer Pane:**
  * Display complete headers (Subject, Date, Sender, Recipients, CC, BCC, Reply-To).
  * Render the action bar containing Reply, Reply All, Forward, Star, Move Folder, Archive, and Delete.
* **Compose modal:**
  * Fix modal loading and inject draft state recoveries.
  * Integrate drag & drop zones for attachments.
  * Embed progress loaders during attachment uploads.
* **Key Navigation:**
  * Add keyboard listener bindings to navigate through items list and trigger actions.
  * Add a helper shortcuts cheatsheet modal.
* **Toast Notification Panel:**
  * Implement a client-side Toast manager to alert users of errors, SMTP dispatch completions, or connection warnings.

---

## Verification Plan

### Manual Verification
1. Open the Admin Panel mailbox. Verify the list rendering, avatars, and folder unread badges.
2. Search using `from:` filter in the search box.
3. Select an email and confirm the detail view renders subject, recipient, date, body, attachments, and Reply-to details.
4. Click Reply / Reply All / Forward. Ensure the composer opens with pre-populated fields and quoted text.
5. Drag and drop a file into the compose window. Verify the progress indicator completes.
6. Verify keyboard shortcuts work (`j`/`k` select row, `c` opens composer).
