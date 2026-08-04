import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const root = path.resolve(import.meta.dirname, '..');
const failures = [];
const assert = (condition, message) => { if (!condition) failures.push(message); };

const demo = JSON.parse(fs.readFileSync(path.join(root, 'web/demo-data.json'), 'utf8'));
assert(demo.schemaVersion === 1, 'demo schemaVersion 必須為 1');
assert(Array.isArray(demo.courses) && demo.courses.length > 0, 'demo 必須含課程');
assert(Array.isArray(demo.sources) && demo.sources.length > 0, 'demo 必須含來源');

const requiredCourseFields = [
  'courseId', 'title', 'category', 'deliveryMode', 'region', 'startAt',
  'rareStatus', 'rareReason', 'organizer', 'sourceName', 'sourceUrl', 'lastUpdatedAt'
];
const ids = new Set();
for (const [index, course] of demo.courses.entries()) {
  for (const field of requiredCourseFields) assert(Object.hasOwn(course, field), `course[${index}] 缺少 ${field}`);
  assert(!ids.has(course.courseId), `courseId 重複：${course.courseId}`);
  ids.add(course.courseId);
  assert(['稀有學分', '一般課程'].includes(course.rareStatus), `不支援的 rareStatus：${course.rareStatus}`);
  assert(!Number.isNaN(Date.parse(course.startAt)), `無效 startAt：${course.startAt}`);
  assert(/^https:\/\//.test(course.sourceUrl), `sourceUrl 必須是 HTTPS：${course.sourceUrl}`);
}

for (const source of demo.sources) {
  assert(['ok', 'error', 'not_checked'].includes(source.status), `不支援的來源狀態：${source.status}`);
  assert(['manual', 'taiwan_pharmacy_society', 'wordpress_rss'].includes(source.updateMode), `不支援的更新方式：${source.updateMode}`);
  assert(/^https:\/\//.test(source.url), `來源 URL 必須是 HTTPS：${source.url}`);
}

const gasFiles = fs.readdirSync(path.join(root, 'gas')).filter((name) => name.endsWith('.gs'));
const publicServerFunctions = [];
for (const file of gasFiles) {
  const code = fs.readFileSync(path.join(root, 'gas', file), 'utf8');
  try { new vm.Script(`(function(){${code}\n})`, { filename: file }); }
  catch (error) { failures.push(`${file} 語法錯誤：${error.message}`); }
  for (const match of code.matchAll(/^function\s+([A-Za-z_$][\w$]*)\s*\(/gm)) {
    if (!match[1].endsWith('_')) publicServerFunctions.push(match[1]);
  }
}
assert(
  JSON.stringify(publicServerFunctions.sort()) === JSON.stringify(['doGet', 'doPost', 'getDashboardData', 'onOpen']),
  `GAS 公開函式超出唯讀允許清單：${publicServerFunctions.join(', ')}`
);

const html = fs.readFileSync(path.join(root, 'web/index.html'), 'utf8');
for (const id of ['course-grid', 'source-rows', 'rare-filter', 'category-filter', 'mode-filter', 'region-filter']) {
  assert(html.includes(`id="${id}"`), `index.html 缺少 #${id}`);
}
assert(html.includes('href="favicon.svg"'), 'index.html 必須引用 favicon.svg');
assert(fs.existsSync(path.join(root, 'web/favicon.svg')), 'web/favicon.svg 不存在');

const app = fs.readFileSync(path.join(root, 'web/app.js'), 'utf8');
try { new vm.Script(app, { filename: 'app.js' }); }
catch (error) { failures.push(`app.js 語法錯誤：${error.message}`); }
assert(app.includes('elements.metricConfirmed.textContent = active.filter(isRareCourse).length;'), '摘要必須統計稀有學分課程');
assert(app.includes("elements.metricCandidate.textContent = state.courses.filter((course) => {"), '摘要必須統計已彙整課程');

const gasDashboard = fs.readFileSync(path.join(root, 'gas/Dashboard.html'), 'utf8');
const gasStyles = fs.readFileSync(path.join(root, 'gas/Styles.html'), 'utf8');
const gasClient = fs.readFileSync(path.join(root, 'gas/Client.html'), 'utf8');
assert(gasDashboard.includes("include_('Styles')"), 'GAS Dashboard 必須載入 Styles');
assert(gasDashboard.includes("dataMode: 'gas'"), 'GAS Dashboard 必須使用 GAS 資料模式');
assert(gasDashboard.includes("include_('Client')"), 'GAS Dashboard 必須載入 Client');
assert(gasStyles === `<style>\n${fs.readFileSync(path.join(root, 'web/styles.css'), 'utf8')}</style>\n`, 'gas/Styles.html 未與 web/styles.css 同步');
assert(gasClient === `<script>\n${app}</script>\n`, 'gas/Client.html 未與 web/app.js 同步');

if (failures.length) {
  console.error(failures.map((failure) => `- ${failure}`).join('\n'));
  process.exit(1);
}

console.log(`validation: ok (${demo.courses.length} courses, ${demo.sources.length} sources)`);
