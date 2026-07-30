// admin-panel/services/email/index.js
import { StalwartProvider } from './providers/StalwartProvider.js';
import { DraftService } from './DraftService.js';
import { EmailConfig } from './EmailConfig.js';
import { Logger } from './Logger.js';
import { EmailEvents, EmailEventTypes } from './EmailEvents.js';
import { ContactService } from './ContactService.js';
import { SettingsService } from './SettingsService.js';

// Setup central debug listener for the event system in development
if (process.env.NODE_ENV !== 'production') {
  Object.values(EmailEventTypes).forEach(eventType => {
    EmailEvents.on(eventType, (data) => {
      Logger.info(`[Event Dispatch] Emitted event "${eventType}"`, data);
    });
  });
}

// Select and instantiate active email provider (Stalwart IMAP/SMTP)
const mailServiceProvider = new StalwartProvider();

export {
  mailServiceProvider as mailService,
  DraftService,
  EmailConfig,
  Logger,
  EmailEvents,
  EmailEventTypes,
  ContactService,
  SettingsService
};
