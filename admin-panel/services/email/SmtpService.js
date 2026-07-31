// admin-panel/services/email/SmtpService.js
import MailComposer from 'nodemailer/lib/mail-composer/index.js';
import { ConnectionManager } from './ConnectionManager.js';
import { EmailConfig } from './EmailConfig.js';
import { Logger } from './Logger.js';
import { EmailEvents, EmailEventTypes } from './EmailEvents.js';

export const SmtpService = {
  // Transmit an outgoing message
  async send({ to, cc, bcc, subject, body, attachments = [] }) {
    Logger.info('Constructing SMTP message envelope for transmission', { to, subject });
    
    const transporter = ConnectionManager.getSmtpTransporter();
    
    const mailAttachments = attachments.map(att => ({
      filename: att.filename,
      path: att.path
    }));

    const mailOptions = {
      from: `"${EmailConfig.adminUser}" <${EmailConfig.smtp.auth.user}>`,
      to,
      cc,
      bcc,
      subject,
      html: body,
      attachments: mailAttachments
    };

    try {
      const info = await transporter.sendMail(mailOptions);
      Logger.info('SMTP message dispatched successfully', { messageId: info.messageId });
      
      // Append a copy of the sent email to the IMAP Sent Items folder
      try {
        const rawBuffer = await new Promise((resolve, reject) => {
          new MailComposer(mailOptions).compile().build((err, buffer) => {
            if (err) reject(err);
            else resolve(buffer);
          });
        });

        await ConnectionManager.withImapClient(async (client) => {
          const list = await client.list();
          // Find actual server-side sent folder path (e.g. Sent Items)
          const sentFolder = list.find(f => 
            f.name.toLowerCase() === 'sent' || 
            f.name.toLowerCase() === 'sent items' || 
            f.name.toLowerCase() === 'sent messages'
          )?.path || 'Sent';

          await ConnectionManager.ensureMailboxExists(client, sentFolder);
          await client.append(sentFolder, rawBuffer, ['\\Seen']);
          Logger.info('Appended copy of sent message to IMAP Sent mailbox', { sentFolder });
        });
      } catch (appendErr) {
        Logger.warn('Failed to append copy of sent message to IMAP Sent mailbox', { error: appendErr.message });
      }

      EmailEvents.emit(EmailEventTypes.EMAIL_SENT, { to, subject, messageId: info.messageId });
      return info;
    } catch (err) {
      Logger.error('SMTP message transmission failed', { error: err.message });
      throw err;
    }
  }
};
