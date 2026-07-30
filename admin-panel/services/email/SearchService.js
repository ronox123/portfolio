// admin-panel/services/email/SearchService.js
import { Logger } from './Logger.js';

export const SearchService = {
  // Clean and prepare query inputs
  sanitizeQuery(searchQuery) {
    if (!searchQuery) return '';
    const clean = searchQuery.trim();
    Logger.info('Sanitized search query keywords', { query: clean });
    return clean;
  }
};
