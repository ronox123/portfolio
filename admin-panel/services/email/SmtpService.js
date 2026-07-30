// admin-panel/services/email/SmtpService.js
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
      EmailEvents.emit(EmailEventTypes.EMAIL_SENT, { to, subject, messageId: info.messageId });
      return info;
    } catch (err) {
      Logger.error('SMTP message transmission failed', { error: err.message });
      throw err;
    }
  }
};
