// admin-panel/services/email/Logger.js
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const logDir = path.join(__dirname, '..', '..', 'logs');

// Ensure logs directory exists
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

const logFile = path.join(logDir, 'email.log');

function writeLog(level, message, meta = '') {
  const timestamp = new Date().toISOString();
  const metaStr = meta ? ` | Meta: ${JSON.stringify(meta)}` : '';
  const logLine = `[${timestamp}] [${level}] ${message}${metaStr}\n`;
  
  // Output to standard console streams
  if (level === 'ERROR') {
    console.error(logLine.trim());
  } else if (level === 'WARN') {
    console.warn(logLine.trim());
  } else {
    console.log(logLine.trim());
  }

  // Append to local log file
  fs.appendFile(logFile, logLine, (err) => {
    if (err) console.error('Failed to write to email log file:', err);
  });
}

export const Logger = {
  info(msg, meta) {
    writeLog('INFO', msg, meta);
  },
  warn(msg, meta) {
    writeLog('WARN', msg, meta);
  },
  error(msg, meta) {
    writeLog('ERROR', msg, meta);
  }
};
