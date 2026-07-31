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
      
      // Query unseen counts in parallel for performance
      const folderList = await Promise.all(folders.map(async (f) => {
        let unseen = 0;
        try {
          const status = await client.status(f.path, { unseen: true });
          unseen = status.unseen || 0;
        } catch (err) {
          Logger.warn('Failed to retrieve unseen status for folder', { path: f.path, error: err.message });
        }
        return {
          path: f.path,
          name: f.name,
          delimiter: f.delimiter,
          unseen: unseen
        };
      }));

      return folderList;
    });
  },

  // Perform bulk status changes or relocations (Read, Unread, Archive, Delete, Star, Unstar, Move)
  async executeBulkAction(folder, uids, action, destination = null) {
    Logger.info('Executing bulk action on IMAP messages', { folder, uidsCount: uids.length, action, destination });
    
    return await ConnectionManager.withImapClient(async (client) => {
      const list = await client.list();
      const realFolder = ConnectionManager.mapSystemFolderToImap(folder, list);
      await ConnectionManager.openMailboxSafely(client, realFolder);
      
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
          await ConnectionManager.ensureMailboxExists(client, trashFolder);
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
        await ConnectionManager.ensureMailboxExists(client, archiveFolder);
        await client.messageMove(range, archiveFolder, { uid: true });
        EmailEvents.emit(EmailEventTypes.EMAIL_MOVED, { folder, uids, destination: archiveFolder });
      } else if (action === 'star') {
        Logger.info('Marking emails as starred (\\Flagged)', { range });
        await client.messageFlagsAdd(range, ['\\Flagged'], { uid: true });
      } else if (action === 'unstar') {
        Logger.info('Marking emails as unstarred (removing \\Flagged)', { range });
        await client.messageFlagsRemove(range, ['\\Flagged'], { uid: true });
      } else if (action === 'move') {
        if (!destination) {
          throw new Error('Destination folder must be specified for move action.');
        }
        Logger.info('Relocating emails to custom folder', { range, destination });
        await ConnectionManager.ensureMailboxExists(client, destination);
        await client.messageMove(range, destination, { uid: true });
        EmailEvents.emit(EmailEventTypes.EMAIL_MOVED, { folder, uids, destination });
      }
      
      return true;
    });
  }
};
