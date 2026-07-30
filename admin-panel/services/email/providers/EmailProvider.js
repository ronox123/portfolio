// admin-panel/services/email/providers/EmailProvider.js

/**
 * Abstract Base Class defining the contract for Email Providers.
 * All concrete providers (e.g. StalwartProvider) must implement these methods.
 */
export class EmailProvider {
  async testConnections() {
    throw new Error('Method "testConnections()" must be implemented by the provider.');
  }

  async getFolders() {
    throw new Error('Method "getFolders()" must be implemented by the provider.');
  }

  async listEmails(folder, page, limit, search) {
    throw new Error('Method "listEmails()" must be implemented by the provider.');
  }

  async getEmail(folder, uid) {
    throw new Error('Method "getEmail()" must be implemented by the provider.');
  }

  async getAttachmentStream(folder, uid, partId) {
    throw new Error('Method "getAttachmentStream()" must be implemented by the provider.');
  }

  async sendEmail(options) {
    throw new Error('Method "sendEmail()" must be implemented by the provider.');
  }

  async bulkAction(folder, uids, action) {
    throw new Error('Method "bulkAction()" must be implemented by the provider.');
  }
}
