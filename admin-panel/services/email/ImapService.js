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

// Clean raw boundary characters and MIME headers from body excerpt previews
function cleanExcerpt(rawText) {
  if (!rawText) return '';
  let clean = rawText;
  
  // 1. Strip MIME boundaries (e.g., --00000000000029c9840657dceafa)
  clean = clean.replace(/--[a-zA-Z0-9_=\-\.\/\"\'\:\+\?]+/g, '');
  
  // 2. Strip common MIME headers inside raw text body parts
  clean = clean.replace(/(Content-Type|Content-Transfer-Encoding|Content-Disposition|charset|boundary|format|Content-ID|Content-Description|spiders|dmarc|spf)[^\r\n]*/gi, '');
  
  // 3. Strip HTML tags
  clean = clean.replace(/<[^>]*>/g, ' ');
  
  // 4. Clean up whitespaces & newlines
  clean = clean.replace(/[\r\n\t]+/g, ' ');
  clean = clean.replace(/\s+/g, ' ');
  
  return clean.trim().substring(0, 120);
}

// In-memory cache for parsed email message details
const messageDetailsCache = new Map();

export const ImapService = {
  // Clear cached details (e.g. on mailbox sync or delete)
  clearCache() {
    messageDetailsCache.clear();
  },

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
        let searchCriteria = {};
        
        // Split by terms (handling quotes)
        const terms = query.match(/(?:[^\s"]+|"[^"]*")+/g) || [query];
        let andCriteria = [];
        
        for (const term of terms) {
          if (term.includes(':')) {
            const [key, val] = term.split(':');
            const cleanVal = val.replace(/"/g, '').trim();
            if (key === 'from') {
              andCriteria.push({ from: cleanVal });
            } else if (key === 'to') {
              andCriteria.push({ to: cleanVal });
            } else if (key === 'subject') {
              andCriteria.push({ subject: cleanVal });
            } else if (key === 'body') {
              andCriteria.push({ body: cleanVal });
            }
          } else {
            const cleanTerm = term.replace(/"/g, '').trim();
            if (cleanTerm !== '') {
              andCriteria.push({
                or: [
                  { subject: cleanTerm },
                  { body: cleanTerm },
                  { from: cleanTerm },
                  { to: cleanTerm }
                ]
              });
            }
          }
        }
        
        if (andCriteria.length > 0) {
          if (andCriteria.length === 1) {
            searchCriteria = andCriteria[0];
          } else {
            searchCriteria = { and: andCriteria };
          }
        } else {
          searchCriteria = {
            or: [
              { subject: query },
              { body: query },
              { from: query },
              { to: query }
            ]
          };
        }
        
        Logger.info('Executing IMAP server search query', { searchCriteria });
        const searchResults = await client.search(searchCriteria);
        
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
        bodyStructure: true,
        bodyParts: ['text', '1']
      })) {
        let excerpt = '';
        if (msg.bodyParts) {
          const bodyBuffer = msg.bodyParts.get('text') || msg.bodyParts.get('1');
          if (bodyBuffer) {
            excerpt = cleanExcerpt(bodyBuffer.toString('utf-8'));
          }
        }

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
          hasAttachments: hasAttachments(msg.bodyStructure),
          excerpt: excerpt
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
    const cacheKey = `${folder}_${uid}`;
    if (messageDetailsCache.has(cacheKey)) {
      Logger.info('Retrieving message details from memory cache', { cacheKey });
      return messageDetailsCache.get(cacheKey);
    }

    Logger.info('Fetching full email message', { folder, uid });
    
    const messageData = await ConnectionManager.withImapClient(async (client) => {
      await client.mailboxOpen(folder);
      
      const msg = await client.fetchOne(uid.toString(), { source: true, bodyStructure: true }, { uid: true });
      if (!msg) {
        throw new Error('Email message not found.');
      }
 
      // Mark email as read in background
      await client.messageFlagsAdd(uid.toString(), ['\\Seen'], { uid: true }).catch((err) => {
        Logger.warn('Failed to mark email seen in background', { uid, error: err.message });
      });
 
      const parsed = await simpleParser(msg.source);
      
      let htmlBody = parsed.html || `<div style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;font-size:14px;color:#1E293B;white-space:pre-wrap;">${parsed.text || ''}</div>`;
      
      const attachments = [];
      if (parsed.attachments && Array.isArray(parsed.attachments)) {
        parsed.attachments.forEach((att, idx) => {
          const partId = idx.toString();
          attachments.push({
            partId,
            filename: att.filename || `attachment-${partId}`,
            mimeType: att.contentType,
            size: att.size,
            cid: att.cid,
            content: att.content // Buffer content
          });

          // Replace inline images cids with base64 URIs
          if (att.cid && htmlBody) {
            const base64Data = att.content.toString('base64');
            const dataUrl = `data:${att.contentType};base64,${base64Data}`;
            const escapedCid = att.cid.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
            const cidRegex = new RegExp(`cid:${escapedCid}`, 'g');
            htmlBody = htmlBody.replace(cidRegex, dataUrl);
          }
        });
      }

      return {
        uid: uid,
        subject: parsed.subject || '(No Subject)',
        from: parsed.from ? parsed.from.text : '',
        fromAddress: parsed.from && parsed.from.value[0] ? parsed.from.value[0].address : '',
        fromName: parsed.from && parsed.from.value[0] ? parsed.from.value[0].name : '',
        to: parsed.to ? parsed.to.text : '',
        cc: parsed.cc ? parsed.cc.text : '',
        bcc: parsed.bcc ? parsed.bcc.text : '',
        replyTo: parsed.replyTo ? parsed.replyTo.text : '',
        date: parsed.date || new Date(),
        html: htmlBody,
        text: parsed.text || '',
        attachments: attachments
      };
    });

    // Cache the message detail object
    messageDetailsCache.set(cacheKey, messageData);
    return messageData;
  },

  // Retrieve an attachment by UID and partId
  async getAttachment(folder, uid, partId) {
    const cacheKey = `${folder}_${uid}`;
    let messageData = messageDetailsCache.get(cacheKey);
    if (!messageData) {
      Logger.info('Attachment message details not in cache, fetching message first', { cacheKey });
      messageData = await this.fetchMessage(folder, uid);
    }
    
    if (messageData && messageData.attachments) {
      const att = messageData.attachments.find(a => a.partId === partId);
      if (att) {
        return {
          filename: att.filename,
          mimeType: att.mimeType,
          content: att.content
        };
      }
    }

    // Fallback: fetch directly from IMAP
    Logger.warn('Attachment not found in cached attachments list, falling back to IMAP bodyPart fetch', { folder, uid, partId });
    const fallbackData = await ConnectionManager.withImapClient(async (client) => {
      await client.mailboxOpen(folder);
      const msg = await client.fetchOne(uid.toString(), { bodyParts: [partId] }, { uid: true });
      if (!msg || !msg.bodyParts || !msg.bodyParts.has(partId)) {
        throw new Error('Attachment part not found.');
      }
      return {
        filename: `attachment-${partId}`,
        mimeType: 'application/octet-stream',
        content: msg.bodyParts.get(partId)
      };
    });

    return fallbackData;
  }
};
