import fs from 'node:fs/promises';

const endpoint = process.env.GAS_SYNC_URL;
const token = process.env.GAS_SYNC_TOKEN;
if (!endpoint || !token) {
  console.log('sheet sync: skipped (GAS_SYNC_URL or GAS_SYNC_TOKEN is not configured)');
  process.exit(0);
}

const payload = JSON.parse(await fs.readFile('web/data/courses.json', 'utf8'));
payload.syncToken = token;
const response = await fetch(endpoint, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(payload)
});
const text = await response.text();
if (!response.ok) throw new Error(`Sheet sync HTTP ${response.status}: ${text}`);
const result = JSON.parse(text);
if (!result.ok) throw new Error(`Sheet sync rejected: ${result.error || 'unknown error'}`);
console.log(`sheet sync: ok (${result.courseCount} courses, ${result.monthKeys.join(', ')})`);
