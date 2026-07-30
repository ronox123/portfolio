// admin-panel/services/email/ConnectionManager.js
import { ImapFlow } from 'imapflow';
import nodemailer from 'nodemailer';
import { EmailConfig } from './EmailConfig.js';
import { Logger } from './Logger.js';
import { EmailEvents, EmailEventTypes } from './EmailEvents.js';

let activeImapClient = null;
let idleTimer = null;
let activeRequestsCount = 0;
let cachedSmtpTransporter = null;

export const ConnectionManager = {
  // Retrieve the singleton SMTP Transporter instance with built-in Nodemailer pooling
  getSmtpTransporter() {
    if (!cachedSmtpTransporter) {
      Logger.info('Initializing cached SMTP Transporter connection pool', { host: EmailConfig.smtp.host });
      cachedSmtpTransporter = nodemailer.createTransport({
        pool: true,
        maxConnections: 5,
        maxMessages: 100,
        idleTimeout: 30000, // Close idle SMTP connection after 30 seconds
        host: EmailConfig.smtp.host,
        port: EmailConfig.smtp.port,
        secure: EmailConfig.smtp.secure,
        auth: EmailConfig.smtp.auth,
        tls: EmailConfig.smtp.tls
      });
    }
    return cachedSmtpTransporter;
  },

  // Acquire a healthy, connected IMAP client (uses caching, auto-connect, and health-checks)
  async acquireImapClient() {
    if (idleTimer) {
      clearTimeout(idleTimer);
      idleTimer = null;
    }

    activeRequestsCount++;

    if (activeImapClient && activeImapClient.usable) {
      try {
        // Run health check command
        await activeImapClient.noop();
        Logger.info('Reusing active, healthy IMAP connection session');
        return activeImapClient;
      } catch (err) {
        Logger.warn('Cached IMAP socket failed health check. Discarding and creating a new one.', { error: err.message });
        await activeImapClient.logout().catch(() => {});
        activeImapClient = null;
      }
    }

    Logger.info('Establishing a new secure IMAP socket connection', { host: EmailConfig.imap.host });
    const client = new ImapFlow({
      host: EmailConfig.imap.host,
      port: EmailConfig.imap.port,
      secure: EmailConfig.imap.secure,
      auth: EmailConfig.imap.auth,
      logger: false,
      clientInfo: { name: 'PortfolioCMS-EMS' }
    });

    await client.connect();
    client.usable = true;
    EmailEvents.emit(EmailEventTypes.CONNECTION_OPENED, { host: EmailConfig.imap.host, protocol: 'IMAP' });

    // Connection lifecycle listeners
    client.on('error', (err) => {
      client.usable = false;
      Logger.error('IMAP socket connection encountered an error', { error: err.message });
      EmailEvents.emit(EmailEventTypes.CONNECTION_ERROR, { host: EmailConfig.imap.host, error: err.message });
    });

    client.on('close', () => {
      client.usable = false;
      Logger.info('IMAP socket connection has been closed');
      EmailEvents.emit(EmailEventTypes.CONNECTION_CLOSED, { host: EmailConfig.imap.host });
      if (activeImapClient === client) {
        activeImapClient = null;
      }
    });

    activeImapClient = client;
    return client;
  },

  // Release the IMAP client back to the pool, triggering an idle logout countdown
  releaseImapClient(client) {
    activeRequestsCount--;
    if (activeRequestsCount <= 0) {
      activeRequestsCount = 0;
      
      if (idleTimer) clearTimeout(idleTimer);
      
      // Delay logout by 15 seconds to allow immediate command reuses
      idleTimer = setTimeout(async () => {
        if (activeImapClient) {
          Logger.info('IMAP socket connection has been idle for 15s. Closing connection.');
          const clientToClose = activeImapClient;
          activeImapClient = null;
          await clientToClose.logout().catch((err) => {
            Logger.warn('IMAP Client idle logout cleanup warned', { message: err.message });
          });
        }
      }, 15000);
    }
  },

  // High-level connection wrapper coordinating acquire & release lifecycle safety
  async withImapClient(callback) {
    const client = await this.acquireImapClient();
    try {
      return await callback(client);
    } finally {
      this.releaseImapClient(client);
    }
  },

  // Connection Verification Diagnostic Utility
  async verifyConnections() {
    Logger.info('Running diagnostic mail connectivity verification checks');
    const diagnostics = {
      imap: { status: 'UNKNOWN', details: null, tls: null },
      smtp: { status: 'UNKNOWN', details: null, tls: null }
    };

    // 1. Diagnose IMAP
    try {
      const client = await this.acquireImapClient();
      diagnostics.imap.status = 'OK';
      diagnostics.imap.tls = EmailConfig.imap.secure ? 'Implicit TLS' : 'STARTTLS/None';
      
      const folders = await client.list();
      diagnostics.imap.details = `Successfully authenticated. Available folders: ${folders.map(f => f.name).join(', ')}`;
      this.releaseImapClient(client);
    } catch (err) {
      diagnostics.imap.status = 'FAILED';
      diagnostics.imap.details = err.message || 'Unknown IMAP connectivity error';
    }

    // 2. Diagnose SMTP
    try {
      const transporter = this.getSmtpTransporter();
      await transporter.verify();
      diagnostics.smtp.status = 'OK';
      diagnostics.smtp.tls = EmailConfig.smtp.secure ? 'Implicit TLS (Port 465)' : 'STARTTLS/None';
      diagnostics.smtp.details = 'SMTP server handshake and credentials verification succeeded.';
    } catch (err) {
      diagnostics.smtp.status = 'FAILED';
      diagnostics.smtp.details = err.message || 'Unknown SMTP connectivity error';
    }

    Logger.info('Diagnostic verification tests complete', diagnostics);
    return diagnostics;
  }
};
