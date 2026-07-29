// src/lib/cws-users.js
import fs from 'fs';
import path from 'path';

const CACHE_FILE = path.join(process.cwd(), 'data', 'cws-cache.json');
const CWS_URL = 'https://chromewebstore.google.com/detail/ronox-flow-%E2%80%94-batch-image/ffhlnhemdffmmhpaaaidgfnclcjdjoob';
const REFRESH_INTERVAL = 3 * 24 * 60 * 60 * 1000; // 3 days in milliseconds
const DEFAULT_COUNT = 32; // Fallback starting user count

export async function getChromeExtensionUsers() {
  let cache = { count: DEFAULT_COUNT, lastUpdated: 0 };
  
  // Try reading cache file
  try {
    if (fs.existsSync(CACHE_FILE)) {
      const data = fs.readFileSync(CACHE_FILE, 'utf8');
      cache = JSON.parse(data);
    }
  } catch (err) {
    console.error('Error reading CWS user count cache:', err);
  }

  const now = Date.now();
  const isExpired = now - cache.lastUpdated > REFRESH_INTERVAL;

  if (isExpired || (cache.count === DEFAULT_COUNT && cache.lastUpdated === 0)) {
    try {
      console.log('Fetching live CWS user count...');
      const res = await fetch(CWS_URL, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, date) Chrome/120.0.0.0 Safari/537.36'
        }
      });
      
      if (res.ok) {
        const html = await res.text();
        const match = html.match(/<\/a>([0-9,]+)\+?\s*users?<\/div>/i);
        if (match) {
          const freshCount = parseInt(match[1].replace(/,/g, ''), 10);
          if (!isNaN(freshCount)) {
            cache.count = freshCount;
            cache.lastUpdated = now;
            
            // Ensure data directory exists
            const dir = path.dirname(CACHE_FILE);
            if (!fs.existsSync(dir)) {
              fs.mkdirSync(dir, { recursive: true });
            }
            
            fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2), 'utf8');
            console.log(`CWS User count cache successfully updated to: ${freshCount}`);
          }
        }
      }
    } catch (err) {
      console.error('Failed to update CWS user count cache:', err);
    }
  }

  return cache.count;
}
