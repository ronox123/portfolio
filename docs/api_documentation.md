# Email Management System: REST API Documentation

Every REST API endpoint resides under the `/admin/api` base path and returns a standardized JSON envelope.

---

## 1. Standard Response Format

### Success Envelope (HTTP 200/201)
```json
{
  "success": true,
  "data": { ... },
  "message": "Operation completed successfully.",
  "timestamp": "2026-07-30T17:00:00.000Z",
  "requestId": "XYZ123ABC"
}
```

### Error Envelope (HTTP 400/401/403/404/500)
```json
{
  "success": false,
  "data": null,
  "message": "Error description details.",
  "timestamp": "2026-07-30T17:00:00.000Z",
  "requestId": "XYZ123ABC"
}
```

---

## 2. API Endpoints Contract

### GET `/admin/api/email/folders`
* **Description:** Retrieves all folders in the user's mailbox.

### GET `/admin/api/email/messages`
* **Description:** Retrieves a paginated list of email headers.

### GET `/admin/api/email/message/:uid`
* **Description:** Retrieves complete metadata, HTML text, and attachment structure for a specific message.

### POST `/admin/api/email/send`
* **Description:** Sends an email. Supports multipart form data for uploading attachments.

### POST `/admin/api/email/draft`
* **Description:** Save or update local email drafts in SQLite.

### DELETE `/admin/api/email/draft/:id`
* **Description:** Discards an SQLite draft by ID.

### DELETE `/admin/api/email/message/:uid`
* **Description:** Deletes a message from the server (moves it to Trash or expunges).

### PATCH `/admin/api/email/message/:uid/read`
* **Description:** Mark a specific email as read.

### PATCH `/admin/api/email/message/:uid/unread`
* **Description:** Mark a specific email as unread.

### PATCH `/admin/api/email/message/:uid/archive`
* **Description:** Relocate email to the Archive folder.

### PATCH `/admin/api/email/message/:uid/trash`
* **Description:** Relocate email to the Trash folder.

### POST `/admin/api/email/bulk`
* **Description:** Execute bulk modifications (read, unread, delete, archive) across multiple emails.

---

## 3. Contacts REST API Endpoints (Phase 6)

### GET `/admin/api/contacts`
* **Description:** Retrieves all contacts. Supports query filtering.
* **Query Parameters:**
  - `q` (string, optional name/email filter)

### GET `/admin/api/contacts/autocomplete`
* **Description:** Compact recipient search recommendations.
* **Query Parameters:**
  - `q` (string, active typed prefix)

### GET `/admin/api/contacts/:id`
* **Description:** Retrieves profile detail card properties for a contact.

### POST `/admin/api/contacts`
* **Description:** Creates a new contact card.
* **Body Parameters:**
  - `name` (string, mandatory)
  - `email` (string, mandatory)
  - `company` (string, optional)
  - `job_title` (string, optional)
  - `phone` (string, optional)
  - `notes` (string, optional)
  - `favorite` (boolean, optional)

### PUT `/admin/api/contacts/:id`
* **Description:** Updates contact fields.

### DELETE `/admin/api/contacts/:id`
* **Description:** Permanently discards a contact record.

### PATCH `/admin/api/contacts/:id/favorite`
* **Description:** Toggles the favorite star state.

---

## 4. Settings & Identity API Endpoints (Phase 7)

### GET `/admin/api/email/preferences`
* **Description:** Retrieves global settings and user preferences (preview length, page sizing, auto-save interval, default reply behavior, and shortcuts enabled status).

### PUT `/admin/api/email/preferences`
* **Description:** Saves user preferences parameters.

### GET `/admin/api/email/identities`
* **Description:** Lists all active sender profiles.

### GET `/admin/api/email/identities/:id`
* **Description:** Retrieves detailed configuration for a specific identity profile (including signature parameters).

### POST `/admin/api/email/identities`
* **Description:** Creates a new identity profile.
* **Body Parameters:**
  - `name` (string, mandatory)
  - `display_name` (string, mandatory)
  - `email` (string, mandatory)
  - `reply_to` (string, optional)
  - `signature_enabled` (boolean, optional)
  - `signature_html` (string, HTML text editor signature, optional)

### PUT `/admin/api/email/identities/:id`
* **Description:** Updates identity settings fields.

### DELETE `/admin/api/email/identities/:id`
* **Description:** Discards an identity profile (prevents deleting defaults).

### PATCH `/admin/api/email/identities/:id/default`
* **Description:** Flags a specific identity profile as the default sender profile.
