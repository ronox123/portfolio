// admin-panel/services/email/AttachmentService.js
import { ConnectionManager } from './ConnectionManager.js';
import { Logger } from './Logger.js';

export const AttachmentService = {
  // Retrieve a byte stream of a message part
  async getStream(folder, uid, partId) {
    Logger.info('Retrieving structural email attachment stream', { folder, uid, partId });
    
    return await ConnectionManager.withImapClient(async (client) => {
      await client.mailboxOpen(folder);
      
      const msg = await client.fetchOne(uid.toString(), { bodyParts: [partId] }, { uid: true });
      if (!msg || !msg.bodyParts || !msg.bodyParts.has(partId)) {
        Logger.error('IMAP attachment bodyPart not found', { folder, uid, partId });
        throw new Error('Attachment part not found or has expired.');
      }
      
      return msg.bodyParts.get(partId);
    });
  },

  // Validate uploaded attachment size (max 10MB)
  validateSize(file) {
    const MAX_SIZE = 10 * 1024 * 1024; // 10MB
    return file.size <= MAX_SIZE;
  }
};
