// admin-panel/services/email/EmailEvents.js
import { EventEmitter } from 'events';

// Define standardized event keys to prevent string typo errors
export const EmailEventTypes = {
  EMAIL_RECEIVED: 'email:received',
  EMAIL_SENT: 'email:sent',
  EMAIL_DELETED: 'email:deleted',
  EMAIL_MOVED: 'email:moved',
  EMAIL_DRAFT_SAVED: 'email:draft:saved',
  EMAIL_ATTACHMENT_UPLOADED: 'email:attachment:uploaded',
  CONNECTION_OPENED: 'connection:opened',
  CONNECTION_CLOSED: 'connection:closed',
  CONNECTION_ERROR: 'connection:error',
  MAILBOX_SYNCHRONIZED: 'mailbox:synchronized'
};

class EmailEventsEmitter extends EventEmitter {
  constructor() {
    super();
    // Increase limit if we register multiple hooks/extensions in the future
    this.setMaxListeners(20);
  }
}

export const EmailEvents = new EmailEventsEmitter();
