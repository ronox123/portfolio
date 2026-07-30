// admin-panel/services/email/MailboxService.js
import { ConnectionManager } from './ConnectionManager.js';
import { Logger } from './Logger.js';
import { EmailEvents, EmailEventTypes } from './EmailEvents.js';

export const MailboxService = {
  // Fetch lists of folders
  async listFolders() {
    Logger.info('Retrieving mailbox folder structures');
    return await ConnectionManager.withImapClient(async (client) => {
      const folders = await client.list();
      EmailEvents.emit(EmailEventTypes.MAILBOX_SYNCHRONIZED, { count: folders.length });
      return folders.map(f => ({
        path: f.path,
        name: f.name,
        delimiter: f.delimiter
      }));
    });
  },

  // Perform bulk status changes or relocations (Read, Unread, Archive, Delete)
  async executeBulkAction(folder, uids, action) {
    Logger.info('Executing bulk action on IMAP messages', { folder, uidsCount: uids.length, action });
    
    return await ConnectionManager.withImapClient(async (client) => {
      await client.mailboxOpen(folder);
      
      const range = uids.join(',');
      const folders = await client.list();

      if (action === 'delete') {
        const trashFolder = folders.find(f => 
          f.name.toLowerCase().includes('trash') || 
          f.name.toLowerCase().includes('bin')
        )?.path || 'Trash';
        
        if (folder === trashFolder) {
          Logger.info('Emails already in Trash. Executing permanent deletion.', { range });
          await client.messageDelete(range, { uid: true });
          await client.mailboxExpunge();
        } else {
          Logger.info('Moving emails to Trash folder', { range, trashFolder });
          await client.messageMove(range, trashFolder, { uid: true });
        }
        EmailEvents.emit(EmailEventTypes.EMAIL_DELETED, { folder, uids });
      } else if (action === 'read') {
        Logger.info('Marking emails as read (\\Seen)', { range });
        await client.messageFlagsAdd(range, ['\\Seen'], { uid: true });
        EmailEvents.emit(EmailEventTypes.EMAIL_MOVED, { folder, uids, state: 'read' });
      } else if (action === 'unread') {
        Logger.info('Marking emails as unread (removing \\Seen)', { range });
        await client.messageFlagsRemove(range, ['\\Seen'], { uid: true });
        EmailEvents.emit(EmailEventTypes.EMAIL_MOVED, { folder, uids, state: 'unread' });
      } else if (action === 'archive') {
        const archiveFolder = folders.find(f => 
          f.name.toLowerCase().includes('archive')
        )?.path || 'Archive';
        Logger.info('Relocating emails to Archive folder', { range, archiveFolder });
        await client.messageMove(range, archiveFolder, { uid: true });
        EmailEvents.emit(EmailEventTypes.EMAIL_MOVED, { folder, uids, destination: archiveFolder });
      }
      
      return true;
    });
  }
};
