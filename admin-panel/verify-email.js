// admin-panel/verify-email.js
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { ConnectionManager } from './services/email/ConnectionManager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env variables
dotenv.config({ path: path.join(__dirname, '.env') });

console.log('====================================================');
console.log('       Email Connectivity Diagnostics Utility      ');
console.log('====================================================');
console.log(`IMAP Host:  ${process.env.IMAP_HOST || '127.0.0.1'}:${process.env.IMAP_PORT || 993}`);
console.log(`SMTP Host:  ${process.env.SMTP_HOST || '127.0.0.1'}:${process.env.SMTP_PORT || 587}`);
console.log(`Email User: ${process.env.EMAIL_USER}`);
console.log('----------------------------------------------------');

async function runDiagnostics() {
  try {
    const diagnostics = await ConnectionManager.verifyConnections();
    
    console.log('\nDIAGNOSTICS RESULTS:');
    
    console.log('\n1. IMAP SERVER CONNECTION:');
    if (diagnostics.imap.status === 'OK') {
      console.log('   Status:   SUCCESS [OK]');
      console.log(`   Security: ${diagnostics.imap.tls}`);
      console.log(`   Details:  ${diagnostics.imap.details}`);
    } else {
      console.log('   Status:   FAILED');
      console.log(`   Error:    ${diagnostics.imap.details}`);
    }
    
    console.log('\n2. SMTP SERVER CONNECTION:');
    if (diagnostics.smtp.status === 'OK') {
      console.log('   Status:   SUCCESS [OK]');
      console.log(`   Security: ${diagnostics.smtp.tls}`);
      console.log(`   Details:  ${diagnostics.smtp.details}`);
    } else {
      console.log('   Status:   FAILED');
      console.log(`   Error:    ${diagnostics.smtp.details}`);
    }
    
    console.log('\n====================================================');
    if (diagnostics.imap.status === 'OK' && diagnostics.smtp.status === 'OK') {
      console.log(' RESULT: Verification PASSED. Mailbox is ready.');
      process.exit(0);
    } else {
      console.log(' RESULT: Verification FAILED. Check configurations.');
      process.exit(1);
    }
  } catch (err) {
    console.error('\nFatal diagnostics error:', err);
    process.exit(1);
  }
}

runDiagnostics();
