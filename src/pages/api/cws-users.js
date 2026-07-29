// src/pages/api/cws-users.js
import { getChromeExtensionUsers } from '../../lib/cws-users.js';

export const prerender = false; // This must be a dynamic hybrid endpoint

export async function GET() {
  try {
    const count = await getChromeExtensionUsers();
    return new Response(JSON.stringify({ success: true, count }), {
      status: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=3600' // Cache in client browser for 1 hour
      }
    });
  } catch (err) {
    console.error('Error in GET /api/cws-users:', err);
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
