'use strict';
// Lưu phòng/ván để không mất khi server ngủ hoặc khởi động lại.
// - Có UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN  -> lưu lên Upstash Redis (miễn phí, dùng được trên Render free).
// - Không có -> lưu file data/rooms.json (chạy ở máy mình).
const fs = require('fs');
const path = require('path');

const URL_ = process.env.UPSTASH_REDIS_REST_URL, TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const KEY = 'splendor:rooms';
const DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const FILE = path.join(DIR, 'rooms.json');

async function redis(cmd) {
  const r = await fetch(URL_, { method: 'POST', headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' }, body: JSON.stringify(cmd) });
  if (!r.ok) throw new Error('Upstash ' + r.status);
  return (await r.json()).result;
}

const mode = URL_ && TOKEN ? 'upstash' : 'file';

async function load() {
  try {
    if (mode === 'upstash') { const s = await redis(['GET', KEY]); return s ? JSON.parse(s) : null; }
    return JSON.parse(fs.readFileSync(FILE, 'utf8'));
  } catch (e) { if (e.code !== 'ENOENT') console.error('Không đọc được dữ liệu đã lưu:', e.message); return null; }
}
async function save(text) {
  try {
    if (mode === 'upstash') return await redis(['SET', KEY, text, 'EX', 7 * 86400]);
    fs.mkdirSync(DIR, { recursive: true });
    fs.writeFileSync(FILE + '.tmp', text); fs.renameSync(FILE + '.tmp', FILE);
  } catch (e) { console.error('Không lưu được dữ liệu:', e.message); }
}

module.exports = { load, save, mode };
