// admin-panel/services/email/providers/StalwartProvider.js
import { EmailProvider } from './EmailProvider.js';
import { ConnectionManager } from '../ConnectionManager.js';
import { ImapService } from '../ImapService.js';
import { SmtpService } from '../SmtpService.js';
import { MailboxService } from '../MailboxService.js';
import { AttachmentService } from '../AttachmentService.js';
import { SearchService } from '../SearchService.js';
import { Logger } from '../Logger.js';

export class StalwartProvider extends EmailProvider {
  // Verify connections to both SMTP and IMAP servers
  async testConnections() {
    Logger.info('StalwartProvider: testing connection setups');
    
    // 1. Verify IMAP
    await ConnectionManager.withImapClient(async (client) => {
      await client.noop();
    });

    // 2. Verify SMTP
    const transporter = ConnectionManager.getSmtpTransporter();
    await transporter.verify();
    
    return true;
  }

  // Retrieve folders list
  async getFolders() {
    Logger.info('StalwartProvider: loading folders list');
    return await MailboxService.listFolders();
  }

  // Fetch paginated messages in a folder
  async listEmails(folder = 'INBOX', page = 1, limit = 20, search = null) {
    Logger.info('StalwartProvider: listEmails called', { folder, page, limit, search });
    const cleanQuery = SearchService.sanitizeQuery(search);
    return await ImapService.fetchHeaders(folder, page, limit, cleanQuery);
  }

  // Fetch detailed email metadata and mark it as seen
  async getEmail(folder, uid) {
    Logger.info('StalwartProvider: getEmail called', { folder, uid });
    return await ImapService.fetchMessage(folder, uid);
  }

  // Stream an attachment component
  async getAttachmentStream(folder, uid, partId) {
    Logger.info('StalwartProvider: getAttachmentStream called', { folder, uid, partId });
    return await AttachmentService.getStream(folder, uid, partId);
  }

  // Dispatch outgoing email message
  async sendEmail({ to, cc, bcc, subject, body, attachments = [] }) {
    Logger.info('StalwartProvider: sendEmail called', { to, subject });
    return await SmtpService.send({ to, cc, bcc, subject, body, attachments });
  }

  // Perform bulk mailbox status actions (Read, Unread, Archive, Delete)
  async bulkAction(folder, uids, action) {
    Logger.info('StalwartProvider: bulkAction called', { folder, uidsCount: uids.length, action });
    return await MailboxService.executeBulkAction(folder, uids, action);
  }
}
