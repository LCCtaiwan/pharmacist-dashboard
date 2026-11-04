import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { load } from 'cheerio';

const ROOT = path.resolve(import.meta.dirname, '..');
const USER_AGENT = 'taiwan-pharmacist-course-index/0.2 (+https://github.com/LCCtaiwan/pharmacist-dashboard)';
const MAX_BYTES = 3 * 1024 * 1024;
const MAX_DETAILS = 30;
export const RARE_RULES = [
  { category: '感染管制', words: ['感染管制', '感管', '抗藥性', '抗生素管理', '傳染病防治', '愛滋', 'hiv'] },
  { category: '性別議題', words: ['性別', '性平', '多元性別', '性少數', 'lgbt'] },
  { category: '專業倫理', words: ['專業倫理', '醫療倫理', '藥事倫理', '倫理'] },
  { category: '專業相關法規', words: ['專業法規', '相關法規', '藥事法', '管制藥品', '法律', '法規', '法令', '違規'] },
  { category: '專業品質', words: ['專業品質', '醫療品質', '病人安全', '用藥安全', '藥害救濟', '品質管理'] }
];

export const SOURCES = [
  { sourceId: 'tshp-continuing-education', name: '臺灣臨床藥學會－藥師執照繼續教育', kind: 'tshp', url: 'https://www.tshp.org.tw/ehc-tshp/s/w/edu/teachMst/teachMstB1', maxPages: 4, maxDetails: 15 },
  { sourceId: 'gtpa-pharmacists', name: '臺中市大臺中藥師公會', kind: 'html', url: 'https://www.gtpa.org.tw/' },
  {
    sourceId: 'taiwan-pharmacy-society',
    name: '台灣藥學會－繼續教育申請',
    kind: 'taiwan_pharmacy_society',
    url: 'https://www.pharm.org.tw/score/applyList.asp',
    coverage: '審查清單；不是報名清單'
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


// Topics are search hints, never proof of an accredited credit category.
export function classifyRare(title, description = '') {
  const text = `${title} ${description}`.toLowerCase();
  const tags = RARE_RULES.filter(rule => rule.words.some(word => text.includes(word.toLowerCase()))).map(rule => rule.category);
  return { rareStatus: tags.length ? '稀有學分' : '一般課程', category: '未確認', topicTag: tags.join('／'),
    rareReason: tags.length ? `議題關鍵字：${tags.join('、')}；不代表核定積分` : '未命中議題關鍵字' };
}
const clean = value => String(value || '').replace(/\s+/g, ' ').trim();
const textOf = html => { const $=load(String(html||'')); $('br').replaceWith('\n'); $('p,li,div').append('\n'); return $.text().replace(/[ \t]+/g,' '); };
const hash = parts => crypto.createHash('sha256').update(parts.join('|')).digest('hex').slice(0, 24);
function safeUrl(value, base) {
  try { const url = new URL(value, base); return /^https?:$/.test(url.protocol) ? url.href : ''; } catch { return ''; }
}

// Dates must be explicit. Reject ambiguous short years, impossible dates and Date's rollover.
export function parseDate(value) {
  const text = clean(value);
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(text)) {
    const y=Number(text.slice(0,4));
    if(y<2000 || y>new Date().getUTCFullYear()+3 || Number(text.slice(11,13))>23 || Number(text.slice(14,16))>59) return '';
    const parts = text.slice(0,10).split('-').map(Number);
    const check = new Date(Date.UTC(parts[0],parts[1]-1,parts[2]));
    if (check.getUTCFullYear() !== parts[0] || check.getUTCMonth() !== parts[1]-1 || check.getUTCDate() !== parts[2]) return '';
    const d = new Date(text); return Number.isNaN(d.getTime()) ? '' : d.toISOString();
  }
  const match = text.match(/(?<!\d)(\d{3}|\d{4})\s*[年/.-]\s*(\d{1,2})\s*[月/.-]\s*(\d{1,2})日?(?:\s+(\d{1,2}):(\d{2}))?(?!\d)/);
  if (!match) return '';
  const y = Number(match[1]) + (match[1].length === 3 ? 1911 : 0);
  const m = Number(match[2]), d = Number(match[3]), hh = Number(match[4] || 0), mm = Number(match[5] || 0);
  if (y < 2000 || y > new Date().getUTCFullYear() + 3 || m < 1 || m > 12 || d < 1 || hh > 23 || mm > 59) return '';
  const date = new Date(Date.UTC(y, m - 1, d, hh - 8, mm));
  const local = new Date(date.getTime() + 8 * 3600000);
  if (local.getUTCFullYear() !== y || local.getUTCMonth() !== m - 1 || local.getUTCDate() !== d) return '';
  return date.toISOString();
}
function dateTokens(text) {
  return [...String(text).matchAll(/(?<!\d)(?:\d{3}|\d{4})\s*[年/.-]\s*\d{1,2}\s*[月/.-]\s*\d{1,2}日?(?:\s+\d{1,2}:\d{2})?(?!\d)/g)].map(m => m[0]);
}
function eventDates(text, title = '') {
  const labelled = text.match(/(?:上課|活動|課程|研習)(?:日期|時間)\s*[：:]\s*([^\n]{1,120})/);
  const evidence = labelled && dateTokens(labelled[1]).length ? labelled[1] : (dateTokens(title).length ? title : '');
  const bounded = evidence.split(/報名|截止|發布|公告日期/)[0];
  const tokens = dateTokens(bounded);
  const startAt = parseDate(tokens[0]);
  const between = tokens.length > 1 ? bounded.slice(bounded.indexOf(tokens[0])+tokens[0].length,bounded.indexOf(tokens[1])) : '';
  const endAt = /[~～至]/.test(between) ? parseDate(tokens[1]) : '';
  return { startAt, endAt, evidence: bounded.slice(0,180) };
}
export function extractCreditEvidence(text) {
  let credits = [];
  const pattern = /(專業品質|專業倫理|專業相關法規|專業法規|專業課程|專業)\s*(?:課程)?\s*[:：]?\s*(\d+(?:\.\d+)?)\s*(?:學分|積分|點)/g;
  for (const m of text.matchAll(pattern)) {
    const prefix = text.slice(Math.max(0,m.index-25),m.index);
    if (/(?:護理師|醫師|營養師|治療師)[^。\n]{0,20}$/.test(prefix) && !/藥師[^。\n]{0,15}$/.test(prefix)) continue;
    const category = m[1] === '專業法規' ? '專業相關法規' : m[1] === '專業' ? '專業課程' : m[1];
    credits.push({ category, points: Number(m[2]), evidence: m[0] });
  }
  credits = [...new Map(credits.map(c=>[`${c.category}|${c.points}`,c])).values()];
  const conflicting = new Set(credits.map(c=>c.category)).size !== credits.length;
  // Require an explicit pharmacist context for unlabeled total credits.
  const total = text.match(/藥師(?:繼續|持續)?教育?[^。；;\n]{0,30}?(\d+(?:\.\d+)?)\s*(?:學分|積分|點)/);
  const pending = /(?:積分|學分)[^。\n]{0,12}(?:申請中|審查中|依.*認定)|(?:申請中|審查中)[^。\n]{0,12}(?:積分|學分)/.test(text);
  return { creditPoints: conflicting ? null : credits.length ? credits.reduce((n,c)=>n+c.points,0) : total ? Number(total[1]) : null,
    creditCategories: credits, category: credits.map(c=>c.category).join('／') || '未確認',
    creditStatus: conflicting ? '同類積分數字不一致，待確認' : pending ? '申請／審查中' : credits.length || total ? '主辦公告，採認條件請見原文' : '未提供',
    evidence: credits.map(c=>c.evidence).join('；') || total?.[0] || '' };
}
export function normalizeCourse(raw, source, now = new Date().toISOString()) {
  const classification = classifyRare(raw.title, raw.description);
  const startAt = parseDate(raw.startAt);
  let endAt = parseDate(raw.endAt);
  const issues = [...(raw.dataQuality?.issues || [])];
  if (startAt && endAt && endAt < startAt) { endAt = ''; issues.push('結束日期早於開始日期，已移除'); }
  if (!startAt) issues.push('上課日期尚未確認');
  if (raw.creditPoints == null || !raw.evidence?.credits) issues.push('積分數與分類尚未確認');
  if (!raw.category || raw.category === '未確認') issues.push('積分類別尚未確認');
  if (!raw.evidence?.approval || !/^(通過|已核准|已核定)$/.test(raw.creditApprovalStatus || '')) issues.push('藥師積分核定狀態尚未確認');
  const url = safeUrl(raw.sourceUrl || source.url, source.url);
  return {
    courseId: raw.courseId || hash([source.sourceId, raw.sourceRecordId || url, ...(raw.sourceRecordId ? [] : [clean(raw.title), raw.organizer || source.name])]),
    sourceId: source.sourceId, sourceRecordId: raw.sourceRecordId || '', title: clean(raw.title),
    category: raw.category || '未確認', topicTag: classification.topicTag,
    creditPoints: raw.creditPoints ?? null, creditCategories: raw.creditCategories || [], creditStatus: raw.creditStatus || '未提供',
    creditApprovalStatus: raw.creditApprovalStatus || '未提供',
    deliveryMode: raw.deliveryMode || '未提供', region: raw.region || '未提供', venue: raw.venue || '',
    startAt, endAt, datePrecision: raw.datePrecision || (startAt ? 'date' : 'unknown'), publishedAt: raw.publishedAt || '',
    registrationDeadline: raw.registrationDeadline || '', registrationUrl: safeUrl(raw.registrationUrl || '', url) === url ? '' : safeUrl(raw.registrationUrl || '', url),
    registrationStatus: raw.registrationStatus || '未提供', fee: raw.fee ?? null, seatsTotal: raw.seatsTotal ?? null, seatsRemaining: raw.seatsRemaining ?? null,
    rareStatus: classification.rareStatus, rareReason: classification.rareReason,
    organizer: raw.organizer || source.name, sourceName: source.name, sourceUrl: url,
    firstSeenAt: raw.firstSeenAt || now, lastUpdatedAt: now, notes: raw.notes || '',
    evidence: raw.evidence || {}, dataQuality: { status: issues.length ? 'needs_review' : 'verified', issues: [...new Set(issues)] }
  };
}

export function parseRss(xml, source) {
  const $ = load(xml, { xmlMode: true });
  return $('item').toArray().map(item => {
    const el = $(item), title = clean(el.find('title').text());
    const body = textOf(el.find('description').text());
    const dates = eventDates(body, title);
    const pub = new Date(el.find('pubDate').text());
    return normalizeCourse({ title, description: body, startAt: dates.startAt, endAt: dates.endAt,
      datePrecision: dates.startAt && /\d{1,2}:\d{2}/.test(dates.evidence) ? 'time' : 'date',
      sourceUrl: el.find('link').text(), publishedAt: Number.isNaN(pub.getTime()) ? '' : pub.toISOString(),
      evidence: dates.startAt ? { dates: dates.evidence } : {} }, source);
  }).filter(c => isCourseTitle(c.title));
}
export function parseTaiwanPharmacyHtml(html, source) {
  const $ = load(html), rows = [];
  $('tr').each((_, tr) => {
    const cells = $(tr).children('td');
    if (cells.length < 4) return;
    const dateText = clean(cells.eq(0).text()), dates = dateTokens(dateText);
    if (!dates.length) return;
    const title = clean(cells.eq(2).text()), approval = clean(cells.eq(3).text());
    if (!title) return;
    const sourceRecordId = $(tr).find('input[name="ED_SID"]').attr('value') || '';
    rows.push(normalizeCourse({ title, sourceRecordId, organizer: clean(cells.eq(1).text()), startAt: parseDate(dates[0]), endAt: parseDate(dates[1]),
      creditApprovalStatus: approval || '未提供', datePrecision: /\d:\d{2}/.test(dateText) ? 'time' : 'date',
      evidence: { dates: dateText, approval: approval }, notes: '審查進度清單；通過不代表開放報名，點數與參加資格請查主辦公告。' }, source));
  });
  return rows;
}
function isCourseTitle(title) {
  return title.length >= 5 && /課程|研習|繼續教育|持續教育|講座|培訓|訓練|研討|學術演講|webinar|seminar/i.test(title)
    && !/^(?:課程|持續教育|繼續教育)(?:專區|資訊|消息|公告)?$|委員會$|^(?:研習議程|線上報名|藥師專區)$/.test(title);
}
export function parsePublicCourseHtml(html, source) {
  const $ = load(html), rows = [];
  $('nav,header,footer,script,style,#footer,#menu,.navigation,.breadcrumb').remove();
  const selectors = {
    'tainan-nanying-pharmacists': 'a[href*="bulletin_index.php?id="]',
    'tccpa-pharmacists': 'main a[href], article a[href], .news a[href], .news-list a[href], .news-content a[href]',
    'gtpa-pharmacists': 'a[href*="task=pageinfo"]'
  };
  $(selectors[source.sourceId] || 'article a[href], main a[href], .entry-content a[href], .news-list a[href]').each((_, a) => {
    const title = clean($(a).text());
    if (!isCourseTitle(title)) return;
    const url = safeUrl($(a).attr('href'), source.url);
    if (!url || /\.(pdf|jpe?g|png|docx?|xlsx?)(?:\?|$)/i.test(url)) return;
    // Never use neighboring table rows or arbitrary character windows as evidence.
    rows.push(normalizeCourse({ title, sourceUrl: url, notes: '課程候選；待原公告內容確認。' }, source));
  });
  return [...new Map(rows.map(c=>[c.sourceUrl,c])).values()];
}
export function parseCourseDetail(html, course, source) {
  const $ = load(html);
  $('script,style,nav,header,footer,#footer,.breadcrumb,.related-posts').remove();
  const selector = source.sourceId === 'gtpa-pharmacists' ? '.postinfo' : source.sourceId === 'taoyuan-pharmacists' || source.kind === 'rss' ? '.entry-content' : 'article, main, .news-content, .postinfo';
  const body = $(selector).first();
  if (!body.length) return { ...course, dataQuality: { status:'needs_review', issues:[...course.dataQuality.issues, '未確認詳情頁內容區塊'] } };
  body.find('br').replaceWith('\n'); body.find('p,li,dd').append('\n');
  const text = body.text().replace(/[ \t]+/g,' ');
  const dates = eventDates(text, course.title);
  const credits = extractCreditEvidence(text);
  const venue = clean(text.match(/(?:上課|活動|課程)地點\s*[：:]\s*([^\n]+)/)?.[1]);
  let registrationUrl = '';
  body.find('a[href]').each((_,a)=>{if(!registrationUrl && /報名/.test($(a).text())) registrationUrl = safeUrl($(a).attr('href'), course.sourceUrl);});
  return normalizeCourse({ ...course, description: text, ...credits, evidence: { ...course.evidence, ...(dates.startAt ? { dates: dates.evidence } : {}), ...(credits.evidence ? { credits: credits.evidence } : {}) },
    startAt: dates.startAt || course.startAt, endAt: dates.endAt || course.endAt, datePrecision: dates.startAt ? (/\d{1,2}:\d{2}/.test(dates.evidence) ? 'time' : 'date') : course.datePrecision, venue, registrationUrl,
    deliveryMode: /線上|視訊|直播|遠距/.test(text) ? '線上' : /實體/.test(text) ? '實體' : '未提供',
    notes: '摘要欄位依主辦公告擷取；報名資格及正式採認請查原文。', dataQuality: { issues: [] } }, source);
}

// Only permitted public HTML/RSS, bounded requests, no login, CAPTCHA or 403 bypass.
let lastRequestAt = 0;
export async function fetchText(url, options = {}) {
  const wait = Math.max(0, 350 - (Date.now() - lastRequestAt));
  if(wait) await new Promise(resolve=>setTimeout(resolve,wait));
  lastRequestAt = Date.now();
  const response = await fetch(url, { ...options, headers: { 'user-agent': USER_AGENT, accept: 'text/html,application/xml,text/xml' }, signal: AbortSignal.timeout(30000), redirect:'follow' });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const reader = response.body.getReader(); const chunks=[]; let length=0;
  while(true) { const {done,value}=await reader.read(); if(done) break; length+=value.length; if(length>MAX_BYTES){await reader.cancel(); throw new Error('來源回應超過安全大小');} chunks.push(value); }
  const bytes = Buffer.concat(chunks);
  const charset = response.headers.get('content-type')?.match(/charset=([^;\s]+)/i)?.[1] || 'utf-8';
  return new TextDecoder(charset).decode(bytes);
}
export function parseTshpList(html, source) {
  const $=load(html), courses=[];
  $('tr').each((_,tr)=>{
    const row=$(tr), cell=name=>clean(row.find(`td[data-th="${name}"]`).text());
    if(cell('積分用途')!=='藥師執照繼續教育') return;
    const id=row.attr('onclick')?.match(/selectEduCourse\(['"]([a-f0-9]{32})['"]\)/i)?.[1];
    const title=cell('課程主題'), tokens=dateTokens(cell('課程期間'));
    if(!id || !title || !tokens.length) return;
    const pointText=cell('積分'), points=/^\d+(\.\d+)?$/.test(pointText)?Number(pointText):null;
    courses.push(normalizeCourse({title,sourceRecordId:id,organizer:cell('申請單位'),startAt:parseDate(tokens[0]),endAt:parseDate(tokens[1]),
      sourceUrl:new URL(`/ehc-tshp/s/w/edu/scheduleInfo1/schedule/${id}`,source.url).href,
      creditPoints:points,creditStatus:points==null?'未提供':'臨床藥學會公開清單所列積分',
      evidence:{dates:cell('課程期間'),credits:points==null?'':`藥師執照繼續教育：${pointText} 積分`},
      notes:'清單積分為活動總數；多節課請查原公告，不代表全部節次均可報名。'},source));
  });
  return courses;
}
export function parseTshpDetail(html, course, source) {
  const $=load(html), actual=$('input#id').attr('value');
  if(actual!==course.sourceRecordId) throw new Error('詳情課程ID不符，拒絕套用');
  const fields={}; $('.articleCon > .form-group').each((_,el)=>{const row=$(el);fields[clean(row.children('label').text())]=clean(row.children('div').text());});
  if(!fields['標題'] || clean(fields['標題'])!==clean(course.title)) throw new Error('詳情課程名稱不符，拒絕套用');
  const sessions=[];
  $('table.rwd-table tr').each((_,tr)=>{const row=$(tr),cell=n=>clean(row.find(`td[data-th="${n}"]`).text());
    if(!cell('課程題目')) return;
    const times=cell('起訖時間').split(/[~～至]/), date=cell('上課日期'), point=cell('學員積分');
    sessions.push({title:cell('課程題目'),startAt:parseDate(`${date} ${times[0]||''}`),endAt:parseDate(`${date} ${times[1]||''}`),category:cell('課程類型'),topicTag:cell('課程性質(單選)'),creditPoints:/^\d+(\.\d+)?$/.test(point)?Number(point):null});
  });
  const categories=new Map();for(const session of sessions){if(session.category && session.creditPoints!=null) categories.set(session.category,(categories.get(session.category)||0)+session.creditPoints);}
  const creditCategories=[...categories].map(([category,points])=>({category,points:Math.round(points*100)/100,evidence:'公開課程表逐節學員積分'}));
  const sum=creditCategories.reduce((s,c)=>s+c.points,0), issues=[];
  if(course.creditPoints!=null && sessions.length && Math.abs(sum-course.creditPoints)>0.01) issues.push('課程表積分合計與清單不一致，請查原公告');
  const certification=fields['認證字號']||'';
  const approval=/臨藥\s*繼\s*字第/.test(certification)?'已核定':'未提供';
  const registration=fields['報名資訊']||'';
  const status=/不開放報名/.test(registration)?'不開放報名':/額滿/.test(registration)?'已額滿':/開放報名/.test(registration)?'公告開放報名，請查資格':'未提供';
  return {...normalizeCourse({...course,description:sessions.map(s=>[s.title,s.category,s.topicTag].join(' ')).join('；'),category:creditCategories.map(c=>c.category).join('／')||'未確認',creditCategories,
    creditApprovalStatus:approval,venue:fields['上課地點']||'',registrationStatus:status,
    deliveryMode:/實體地點/.test(fields['上課地點']||'')?'實體':/線上/.test(fields['上課地點']||'')?'線上':'未提供',
    evidence:{...course.evidence,...(approval!=='未提供'?{approval:certification}:{}),registration:registration.slice(0,180)},dataQuality:{issues},
    notes:'積分為整個活動合計；各節課時間與積分請見原公告。'+(status==='不開放報名'?' 本活動不開放對外報名。':'')},source),sessions};
}
async function fetchTshp(source, fetcher) {
  const first=await fetcher(source.url), courses=parseTshpList(first,source), warnings=[];
  if(!courses.length) throw new Error('臨床藥學會 B1 清單未解析到課程');
  const total=Number(first.match(/var\s+totalNum\s*=\s*(\d+)/)?.[1]||courses.length);
  const pageSize=Number(first.match(/var\s+pageSize\s*=\s*(\d+)/)?.[1]||15);
  const maxPages=source.maxPages||4, pages=Math.min(maxPages,Math.ceil(total/pageSize));
  const ids=new Set(courses.map(c=>c.sourceRecordId));
  for(let page=2;page<=pages;page++){
    const endpoint=new URL('/ehc-tshp/s/w/edu/teachMstSearch',source.url).href;
    try {
      const html=await fetcher(endpoint,{method:'POST',body:new URLSearchParams({pageNo:String(page),columnCode:'teachMstB1',courseType:'0',courseScoreUse:'A'})});
      const actual=Number(html.match(/var\s+currentPageNum\s*=\s*(\d+)/)?.[1]);
      if(actual!==page) throw new Error('回應頁碼不符');
      const rows=parseTshpList(html,source); if(!rows.length || rows.every(c=>ids.has(c.sourceRecordId))) throw new Error('分頁為空或重複');
      for(const row of rows)if(!ids.has(row.sourceRecordId)){ids.add(row.sourceRecordId);courses.push(row);}
    }catch(error){warnings.push(`第 ${page} 頁取得失敗：${error.message}`);break;}
  }
  if(total>courses.length) warnings.push(`分頁上限 ${maxPages} 頁；取得 ${courses.length} / 來源約 ${total} 筆，非完整歷史清單`);
  const limit=source.maxDetails??15;
  for(let i=0;i<Math.min(courses.length,limit);i++){
    try{courses[i]=parseTshpDetail(await fetcher(courses[i].sourceUrl),courses[i],source);}
    catch(error){courses[i].dataQuality.issues.push(`詳情擷取失敗：${error.message}`);warnings.push('部分詳情未取得或身分不符，未套用');}
  }
  for(let i=limit;i<courses.length;i++) courses[i].dataQuality.issues.push('本次未擷取詳情，仍需確認分類與報名');
  if(courses.length>limit)warnings.push(`本次確認前 ${limit} 筆詳情；其餘積分採清單值，分類／核定／報名待確認`);
  return {courses,warnings:[...new Set(warnings)]};
}

export async function fetchSource(source, fetcher = fetchText) {
  if(source.kind==='tshp') return fetchTshp(source,fetcher);
  const html = await fetcher(source.url);
  let courses = source.kind === 'rss' ? parseRss(html,source) : source.kind === 'taiwan_pharmacy_society' ? parseTaiwanPharmacyHtml(html,source) : parsePublicCourseHtml(html,source);
  if (!courses.length) throw new Error('未解析到課程；保留上次資料，需檢查來源版型');
  const warnings = [];
  if (source.kind === 'taiwan_pharmacy_society') {
    const $=load(html); const pages=$('select[name="sub"] option').length;
    if(pages>1) warnings.push(`來源有 ${pages} 頁，目前僅取得首頁；不可視為完整清單`);
  } else {
    for(let i=0;i<Math.min(courses.length,MAX_DETAILS);i++) {
      const c=courses[i];
      if(new URL(c.sourceUrl).hostname !== new URL(source.url).hostname) continue;
      try { courses[i]=parseCourseDetail(await fetcher(c.sourceUrl),c,source); }
      catch(error) { courses[i]={...c,dataQuality:{status:'needs_review',issues:[...c.dataQuality.issues,`詳情擷取失敗：${error.message}`]}}; warnings.push('部分詳情頁擷取失敗'); }
    }
    for(let i=MAX_DETAILS;i<courses.length;i++) courses[i].dataQuality.issues.push('本次未擷取詳情，仍需確認分類與報名');
    if(courses.length>MAX_DETAILS) warnings.push(`本次詳情擷取上限 ${MAX_DETAILS} 筆，其餘待確認`);
  }
  return { courses, warnings:[...new Set(warnings)] };
}
export function mergeSourceResult(previous, source, result, error, now) {
  const old = previous.courses.filter(c=>c.sourceId===source.sourceId);
  const oldSource=previous.sources.find(s=>s.sourceId===source.sourceId);
  if (!error && old.length >= 10 && result.courses.length < old.length * 0.4) error=new Error('課程筆數異常下降，保留前次資料待檢查');
  if(error) return { courses: old.map(c=>({...c,dataQuality:{status:'needs_review',issues:[...new Set([...(c.dataQuality?.issues||[]),'來源更新失敗，保留歷史資料'])]}})),
    source:{...source,updateMode:source.kind,status:'error',lastAttemptAt:now,lastSuccessAt:oldSource?.lastSuccessAt||'',lastError:String(error.message),courseCount:old.length,notes:'來源失敗；保留上次資料，不代表已重新確認'} };
  const oldById=new Map(old.map(c=>[c.courseId,c]));
  return { courses:result.courses.map(c=>{
    const prior=oldById.get(c.courseId) || old.find(p=>p.sourceUrl===c.sourceUrl && p.title===c.title);
    const failedDetail = c.dataQuality?.issues.some(issue=>/詳情.*失敗|未確認詳情|本次未擷取詳情/.test(issue));
    if (failedDetail && prior?.evidence && Object.keys(prior.evidence).length) {
      return {...prior, courseId:c.courseId, dataQuality:{status:'needs_review',issues:[...new Set([...(prior.dataQuality?.issues||[]),...c.dataQuality.issues,'本次詳情未更新，保留上次已擷取欄位'])]}};
    }
    return {...c,firstSeenAt:prior?.firstSeenAt||c.firstSeenAt};
  }),
    source:{...source,updateMode:source.kind,status:result.warnings.length?'partial':'ok',lastAttemptAt:now,lastSuccessAt:now,lastError:'',courseCount:result.courses.length,notes:result.warnings.join('；')||'公開來源已擷取；積分與報名狀態依各筆證據'} };
}
function xmlEscape(value) { return String(value??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;'); }
export function buildFeed(payload) {
  const items=payload.courses.map(c=>`<item><title>${xmlEscape(c.title)}</title><link>${xmlEscape(c.sourceUrl)}</link><guid isPermaLink="false">${xmlEscape(c.courseId)}</guid><pubDate>${new Date(c.lastUpdatedAt||payload.generatedAt).toUTCString()}</pubDate><description>${xmlEscape(`${c.creditStatus}；核定狀態：${c.creditApprovalStatus}；議題：${c.topicTag||'未分類'}；請至原公告確認`)}</description></item>`).join('');
  return `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>${xmlEscape(payload.title)}</title><link>https://github.com/LCCtaiwan/pharmacist-dashboard</link><description>藥師持續教育課程索引，請依原公告確認積分與報名。</description>${items}</channel></rss>`;
}
async function main() {
  const arg=process.argv.indexOf('--output-dir');
  const output=arg>=0 ? path.resolve(process.argv[arg+1]) : path.join(ROOT,'web/data');
  let previous; try{previous=JSON.parse(await fs.readFile(path.join(ROOT,'web/data/courses.json'),'utf8'));}catch{previous={courses:[],sources:[]};}
  const generatedAt=new Date().toISOString(), courses=[], sources=[];
  for(const source of SOURCES){ let result,error; try{result=await fetchSource(source);}catch(e){error=e;}
    const merged=mergeSourceResult(previous,source,result,error,generatedAt); courses.push(...merged.courses); sources.push(merged.source); }
  const payload={schemaVersion:1,appVersion:'github-actions-0.2.0',generatedAt,title:'台灣藥師持續教育課程索引',rareDefinition:'關鍵字議題提示，不代表正式採認積分',courses,sources};
  await fs.mkdir(output,{recursive:true});
  const temp=path.join(output,'courses.json.tmp'); await fs.writeFile(temp,JSON.stringify(payload,null,2)+'\n'); await fs.rename(temp,path.join(output,'courses.json'));
  await fs.writeFile(path.join(output,'feed.xml'),buildFeed(payload)+'\n');
  console.log(`collector: ${courses.length} records; ${sources.filter(s=>s.status==='error').length} source errors; ${output}`);
}
if(process.argv[1] && import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href) await main();
