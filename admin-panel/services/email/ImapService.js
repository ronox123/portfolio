// admin-panel/services/email/ImapService.js
import { simpleParser } from 'mailparser';
import { ConnectionManager } from './ConnectionManager.js';
import { Logger } from './Logger.js';

// Helper to determine if body part structure represents an attachment
export function hasAttachments(structure) {
  if (!structure) return false;
  if (structure.disposition && structure.disposition.type && structure.disposition.type.toLowerCase() === 'attachment') {
    return true;
  }
  if (structure.childNodes && Array.isArray(structure.childNodes)) {
    for (const child of structure.childNodes) {
      if (hasAttachments(child)) return true;
    }
  }
  return false;
}

// Flat-map body structure to find all attachment parts
export function findAttachmentParts(structure, parentPartId = '') {
  let parts = [];
  if (!structure) return parts;

  const partId = structure.part || parentPartId;

  if (structure.disposition && structure.disposition.type && structure.disposition.type.toLowerCase() === 'attachment') {
    parts.push({
      partId: partId,
      filename: structure.disposition.params?.filename || structure.parameters?.name || `attachment-${partId}`,
      mimeType: structure.type,
      size: structure.size,
      encoding: structure.encoding
    });
  }

  if (structure.childNodes && Array.isArray(structure.childNodes)) {
    structure.childNodes.forEach((child, index) => {
      const childPartId = partId ? `${partId}.${index + 1}` : `${index + 1}`;
      parts = parts.concat(findAttachmentParts(child, childPartId));
    });
  }

  return parts;
}

export const ImapService = {
  // Fetch paginated message headers in a mailbox folder
  async fetchHeaders(folder = 'INBOX', page = 1, limit = 20, searchQuery = null) {
    Logger.info('Fetching headers from IMAP server', { folder, page, limit, search: searchQuery });
    
    return await ConnectionManager.withImapClient(async (client) => {
      const mailbox = await client.mailboxOpen(folder, { readOnly: true });
      const totalEmails = mailbox.exists;

      if (totalEmails === 0) {
        return { emails: [], total: 0, page, limit };
      }

      let seqs = [];
      let totalCount = totalEmails;

      // Handle search
      if (searchQuery && searchQuery.trim() !== '') {
        const query = searchQuery.trim();
        Logger.info('Executing IMAP server search query', { query });
        
        const searchResults = await client.search({
          or: [
            { subject: query },
            { body: query },
            { from: query },
            { to: query }
          ]
        });
        
        seqs = searchResults;
        totalCount = seqs.length;
      } else {
        // Generate sequence numbers for pagination (newest first)
        const start = Math.max(1, totalEmails - (page * limit) + 1);
        const end = totalEmails - ((page - 1) * limit);
        for (let i = start; i <= end; i++) {
          seqs.push(i);
        }
      }

      if (seqs.length === 0) {
        return { emails: [], total: 0, page, limit };
      }

      let pageSeqs = seqs;
      if (searchQuery) {
        const startIdx = Math.max(0, totalCount - (page * limit));
        const endIdx = totalCount - ((page - 1) * limit);
        pageSeqs = seqs.slice(startIdx, endIdx);
      }

      const range = pageSeqs.join(',');
      const messages = [];
      
      for await (const msg of client.fetch(range, {
        envelope: true,
        flags: true,
        internalDate: true,
        size: true,
        bodyStructure: true
      })) {
        messages.push({
          uid: msg.uid,
          seq: msg.seq,
          subject: msg.envelope.subject || '(No Subject)',
          from: msg.envelope.from ? msg.envelope.from.map(f => `${f.name || ''} <${f.address}>`).join(', ') : '',
          fromAddress: msg.envelope.from && msg.envelope.from[0] ? msg.envelope.from[0].address : '',
          fromName: msg.envelope.from && msg.envelope.from[0] ? msg.envelope.from[0].name : '',
          to: msg.envelope.to ? msg.envelope.to.map(t => t.address).join(', ') : '',
          date: msg.envelope.date || msg.internalDate,
          size: msg.size,
          seen: msg.flags.has('\\Seen'),
          flagged: msg.flags.has('\\Flagged'),
          answered: msg.flags.has('\\Answered'),
          hasAttachments: hasAttachments(msg.bodyStructure)
        });
      }

      // Sort newest first
      messages.sort((a, b) => new Date(b.date) - new Date(a.date));

      return {
        emails: messages,
        total: totalCount,
        page,
        limit
      };
    });
  },

  // Fetch full email content and mark it as seen
  async fetchMessage(folder, uid) {
    Logger.info('Fetching full email message', { folder, uid });
    
    return await ConnectionManager.withImapClient(async (client) => {
      await client.mailboxOpen(folder);
      
      const msg = await client.fetchOne(uid.toString(), { source: true }, { uid: true });
      if (!msg) {
        throw new Error('Email message not found.');
      }

      // Mark email as read in background
      await client.messageFlagsAdd(uid.toString(), ['\\Seen'], { uid: true }).catch((err) => {
        Logger.warn('Failed to mark email seen in background', { uid, error: err.message });
      });

      const parsed = await simpleParser(msg.source);
      const attachmentParts = findAttachmentParts(msg.bodyStructure);

      return {
        uid: uid,
        subject: parsed.subject || '(No Subject)',
        from: parsed.from ? parsed.from.text : '',
        fromAddress: parsed.from && parsed.from.value[0] ? parsed.from.value[0].address : '',
        fromName: parsed.from && parsed.from.value[0] ? parsed.from.value[0].name : '',
        to: parsed.to ? parsed.to.text : '',
        cc: parsed.cc ? parsed.cc.text : '',
        bcc: parsed.bcc ? parsed.bcc.text : '',
        date: parsed.date || new Date(),
        html: parsed.html || `<p>${parsed.textAsHtml || parsed.text || ''}</p>`,
        text: parsed.text || '',
        attachments: attachmentParts
      };
    });
  }
};
