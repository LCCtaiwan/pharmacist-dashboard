import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = path.resolve(import.meta.dirname, '..');
const DATA_DIR = path.join(ROOT, 'web', 'data');
const JSON_PATH = path.join(DATA_DIR, 'courses.json');
const RSS_PATH = path.join(DATA_DIR, 'feed.xml');
const USER_AGENT = 'taiwan-pharmacist-rare-credit-dashboard/0.1 (+GitHub Actions)';

export const RARE_RULES = [
  { category: '感染管制', words: ['感染管制', '感管', '抗藥性', '抗生素管理', '傳染病防治', '愛滋', 'hiv'] },
  { category: '性別議題', words: ['性別', '性平', '多元性別', '性少數', 'lgbt'] },
  { category: '專業倫理', words: ['專業倫理', '醫療倫理', '藥事倫理', '倫理'] },
  { category: '專業相關法規', words: ['專業法規', '相關法規', '藥事法', '管制藥品', '法律', '法規', '法令', '違規'] },
  { category: '專業品質', words: ['專業品質', '醫療品質', '病人安全', '用藥安全', '藥害救濟', '品質管理'] }
];

export const SOURCES = [
  {
    sourceId: 'taiwan-pharmacy-society',
    name: '台灣藥學會－繼續教育申請',
    kind: 'taiwan_pharmacy_society',
    url: 'https://www.pharm.org.tw/score/applyList.asp',
    browserFallback: true
  },
  {
    sourceId: 'taiwan-pharmacy-news',
    name: '台灣藥學會－繼續教育消息',
    kind: 'html',
    url: 'https://www.pharm.org.tw/news/index.asp?Type=14'
  },
  {
    sourceId: 'taoyuan-pharmacists',
    name: '桃園市藥師公會持續教育',
    kind: 'rss',
    url: 'https://www.pharmacist.org.tw/category/%E2%9E%AA%E6%8C%81%E7%BA%8C%E6%95%99%E8%82%B2%E5%B0%88%E5%8D%80/%E4%B8%8A%E8%AA%B2%E8%B3%87%E8%A8%8A/%E5%85%AC%E6%9C%83%E6%8C%81%E7%BA%8C%E6%95%99%E8%82%B2/feed/'
  },
  {
    sourceId: 'tccpa-pharmacists',
    name: '臺中市藥師公會公開課程',
    kind: 'html',
    url: 'https://www.tccpa.org.tw/web/index.html'
  },
  {
    sourceId: 'kpa-pharmacists',
    name: '高雄市藥師公會公開活動',
    kind: 'html',
    url: 'https://www.kpa.org.tw/'
  },
  {
    sourceId: 'tainan-nanying-pharmacists',
    name: '臺南市南瀛藥師公會公告',
    kind: 'html',
    url: 'https://www.tainan-pharmacist.org.tw/bulletin.php'
  },
  {
    sourceId: 'vghtpe-pharmacy',
    name: '臺北榮總藥學部繼續教育',
    kind: 'html',
    url: 'https://www.vghtpe.gov.tw/pharm/images/sg/Fpage.action?fid=19142&muid=21303'
  },
  {
    sourceId: 'young-pharmacists',
    name: '台灣年輕藥師協會',
    kind: 'rss',
    url: 'https://typg.org.tw/feed/'
  }
];

export function classifyRare(title, description = '') {
  const text = `${title} ${description}`.toLowerCase();
  const matches = RARE_RULES.filter((rule) => rule.words.some((word) => text.includes(word.toLowerCase())))
    .map((rule) => rule.category);
  return {
    rareStatus: matches.length ? '稀有學分' : '一般課程',
    category: matches.length ? matches.join('／') : '其他課程',
    topicTag: matches.join('／'),
    rareReason: matches.length ? `自動關鍵字分類：${matches.join('、')}` : '未命中稀有學分關鍵字'
  };
}

function decodeEntities(value) {
  return String(value || '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, '$1')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)));
}

function stripHtml(value) {
  return decodeEntities(value).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function tagText(block, tag) {
  const match = String(block).match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  return stripHtml(match ? match[1] : '');
}

export function parseDate(value) {
  const text = String(value || '').trim();
  // Match four-digit Gregorian years first. Otherwise a date such as
  // 2026/08/20 can be mistaken for ROC 026/08/20 and become year 1937.
  const gregorian = text.match(/(\d{4})[./-](\d{1,2})[./-](\d{1,2})/);
  const parts = gregorian || text.match(/(?:民國\s*)?(\d{2,3})[./年-](\d{1,2})[./月-](\d{1,2})\s*日?/);
  if (parts) {
    const year = gregorian ? Number(parts[1]) : Number(parts[1]) + 1911;
    const iso = `${String(year).padStart(4, '0')}-${String(parts[2]).padStart(2, '0')}-${String(parts[3]).padStart(2, '0')}T00:00:00+08:00`;
    const date = new Date(iso);
    if (!Number.isNaN(date.getTime())) return date.toISOString();
  }
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
}

function hashId(parts) {
  return crypto.createHash('sha256').update(parts.join('|')).digest('hex').slice(0, 24);
}

function normalizeCourse(raw, source) {
  const title = stripHtml(raw.title);
  const description = stripHtml(raw.description);
  const classification = classifyRare(title, `${description} ${raw.category || ''}`);
  const startAt = parseDate(raw.startAt);
  const endAt = parseDate(raw.endAt);
  return {
    courseId: raw.courseId || hashId([source.sourceId, title, startAt]),
    sourceId: source.sourceId,
    title,
    category: raw.category || classification.category,
    topicTag: raw.topicTag || classification.topicTag,
    creditPoints: raw.creditPoints ?? null,
    creditStatus: raw.creditStatus || '未提供',
    deliveryMode: raw.deliveryMode || '未提供',
    region: raw.region || '未提供',
    venue: raw.venue || '',
    startAt,
    endAt,
    registrationDeadline: parseDate(raw.registrationDeadline),
    fee: raw.fee ?? null,
    seatsTotal: raw.seatsTotal ?? null,
    seatsRemaining: raw.seatsRemaining ?? null,
    registrationStatus: raw.registrationStatus || '未提供',
    creditApprovalStatus: raw.creditApprovalStatus || '未提供',
    rareStatus: classification.rareStatus,
    rareReason: classification.rareReason,
    organizer: raw.organizer || source.name,
    sourceName: source.name,
    sourceUrl: raw.sourceUrl || source.url,
    firstSeenAt: raw.firstSeenAt || new Date().toISOString(),
    lastUpdatedAt: new Date().toISOString(),
    notes: raw.notes || description
  };
}

export function parseRss(xml, source) {
  const items = [...String(xml).matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)];
  return items.map((match) => {
    const block = match[1];
    const title = tagText(block, 'title');
    const description = tagText(block, 'description');
    return normalizeCourse({
      title,
      description,
      organizer: source.name,
      startAt: tagText(block, 'pubDate'),
      sourceUrl: tagText(block, 'link') || source.url
    }, source);
  }).filter((course) => course.title);
}

export function parseTaiwanPharmacyHtml(html, source) {
  const rows = [];
  for (const rowMatch of String(html).matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...rowMatch[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map((match) => stripHtml(match[1]));
    if (cells.length < 3 || !/\d{2,3}[./-]\d{1,2}[./-]\d{1,2}/.test(cells[0])) continue;
    const range = cells[0].split(/\s*[~～至]\s*/);
    rows.push(normalizeCourse({
      title: cells[2], organizer: cells[1], startAt: range[0], endAt: range[1] || range[0],
      creditApprovalStatus: cells[3] || '未提供', sourceUrl: source.url
    }, source));
  }
  return rows;
}

function absoluteUrl(href, baseUrl) {
  try {
    const url = new URL(String(href || ''), baseUrl);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
  } catch (_) {
    return '';
  }
}

function extractDateRange(text) {
  const matches = [...String(text || '').matchAll(/(?:民國\s*)?(\d{2,4})\s*[./年-]\s*(\d{1,2})\s*[./月-]\s*(\d{1,2})\s*日?/g)];
  if (!matches.length) return { startAt: '', endAt: '' };
  const toIso = (match) => parseDate(`${match[1]}/${match[2]}/${match[3]}`);
  return { startAt: toIso(matches[0]), endAt: toIso(matches[1] || matches[0]) };
}

export function parsePublicCourseHtml(html, source) {
  const rows = [];
  const anchors = /<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  const courseWords = /課程|課|研習|教育|學分|藥事|藥師|講座|學術|培訓|訓練|研討|webinar|seminar/i;
  for (const match of String(html).matchAll(anchors)) {
    const title = stripHtml(match[2]);
    if (!title || title.length < 4 || !courseWords.test(title)) continue;
    const start = Math.max(0, match.index - 500);
    const end = Math.min(String(html).length, match.index + match[0].length + 500);
    const context = stripHtml(String(html).slice(start, end));
    const dates = extractDateRange(context);
    const credit = context.match(/(\d+(?:\.\d+)?)\s*(?:點|積分|學分)/);
    const deliveryMode = /線上|視訊|直播|遠距|webinar/i.test(context) ? '線上' : /實體|現場/i.test(context) ? '實體' : '未提供';
    rows.push(normalizeCourse({
      title,
      description: context,
      startAt: dates.startAt,
      endAt: dates.endAt,
      creditPoints: credit ? Number(credit[1]) : null,
      deliveryMode,
      sourceUrl: absoluteUrl(match[1], source.url)
    }, source));
  }
  const unique = new Map();
  for (const row of rows) unique.set(row.courseId, row);
  return [...unique.values()];
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: { 'user-agent': USER_AGENT, accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8' },
    redirect: 'follow'
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.text();
}

async function fetchBrowserText(url) {
  let playwright;
  try { playwright = await import('playwright'); }
  catch (_) { throw new Error('HTTP 403；Playwright 尚未安裝'); }
  const browser = await playwright.chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ userAgent: USER_AGENT });
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    return await page.content();
  } finally {
    await browser.close();
  }
}

async function fetchSource(source) {
  try {
    const text = await fetchText(source.url);
    const courses = source.kind === 'rss'
      ? parseRss(text, source)
      : source.kind === 'taiwan_pharmacy_society'
        ? parseTaiwanPharmacyHtml(text, source)
        : parsePublicCourseHtml(text, source);
    if (source.browserFallback && !courses.length) throw new Error('未解析到課程列');
    if (!courses.length) throw new Error('未解析到公開課程候選');
    return courses;
  } catch (error) {
    if (!source.browserFallback) throw error;
    const text = await fetchBrowserText(source.url);
    const courses = parseTaiwanPharmacyHtml(text, source);
    if (!courses.length) throw new Error('瀏覽器載入後仍未解析到課程列');
    return courses;
  }
}

async function readPrevious() {
  try { return JSON.parse(await fs.readFile(JSON_PATH, 'utf8')); }
  catch (_) { return { courses: [], sources: [] }; }
}

function xmlEscape(value) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

export function buildFeed(payload) {
  const items = payload.courses.map((course) => `<item><title>${xmlEscape(course.title)}</title><link>${xmlEscape(course.sourceUrl)}</link><guid isPermaLink="false">${xmlEscape(course.courseId)}</guid><pubDate>${new Date(course.lastUpdatedAt || payload.generatedAt).toUTCString()}</pubDate><description>${xmlEscape([course.category, course.creditPoints == null ? '' : `${course.creditPoints} 點`, course.deliveryMode, course.region, course.rareStatus].filter(Boolean).join('；'))}</description></item>`).join('');
  return `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>${xmlEscape(payload.title)}</title><link>https://www.pharm.org.tw/</link><description>自動彙整台灣藥師課程與稀有學分資訊。</description><lastBuildDate>${new Date(payload.generatedAt).toUTCString()}</lastBuildDate>${items}</channel></rss>`;
}

async function main() {
  const previous = await readPrevious();
  const generatedAt = new Date().toISOString();
  const courses = [];
  const sources = [];
  for (const source of SOURCES) {
    const previousSource = (previous.sources || []).find((item) => item.sourceId === source.sourceId);
    try {
      const fetched = await fetchSource(source);
      courses.push(...fetched);
      sources.push({ sourceId: source.sourceId, name: source.name, url: source.url, updateMode: source.kind, priority: source.sourceId === 'taiwan-pharmacy-society' ? 1 : 2, status: 'ok', lastAttemptAt: generatedAt, lastSuccessAt: generatedAt, lastError: '', notes: 'GitHub Actions 自動匯入' });
    } catch (error) {
      const preserved = (previous.courses || []).filter((course) => course.sourceId === source.sourceId);
      courses.push(...preserved);
      sources.push({ sourceId: source.sourceId, name: source.name, url: source.url, updateMode: source.kind, priority: source.sourceId === 'taiwan-pharmacy-society' ? 1 : 2, status: 'error', lastAttemptAt: generatedAt, lastSuccessAt: previousSource?.lastSuccessAt || '', lastError: String(error.message || error), notes: '抓取失敗時保留上次資料' });
    }
  }
  const unique = new Map();
  for (const course of courses) unique.set(course.courseId, course);
  const payload = { schemaVersion: 1, appVersion: 'github-actions-0.1.0', generatedAt, title: '台灣藥師稀有學分課程儀表板', rareDefinition: '專業品質、專業倫理、專業相關法規、感染管制、性別議題', courses: [...unique.values()].sort((a, b) => String(a.startAt).localeCompare(String(b.startAt))), sources };
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(JSON_PATH, `${JSON.stringify(payload, null, 2)}\n`);
  await fs.writeFile(RSS_PATH, `${buildFeed(payload)}\n`);
  console.log(`collector: ${payload.courses.length} courses, ${payload.sources.length} sources`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) await main();
