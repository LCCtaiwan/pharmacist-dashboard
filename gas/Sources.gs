function fetchSource_(source) {
  switch (String(source.type)) {
    case 'taiwan_pharmacy_society': return fetchTaiwanPharmacySociety_(source);
    case 'wordpress_rss': return fetchWordpressRss_(source);
    case 'manual': return [];
    default: throw new Error('不支援的來源類型：' + source.type);
  }
}

function defaultFetchHeaders_() {
  return {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'zh-TW,zh;q=0.9,en;q=0.8'
  };
}

function fetchResponse_(url, extraHeaders) {
  if (!/^https:\/\//i.test(String(url || ''))) throw new Error('來源網址必須使用 HTTPS。');
  return UrlFetchApp.fetch(url, {
    muteHttpExceptions: true,
    followRedirects: true,
    headers: Object.assign(defaultFetchHeaders_(), extraHeaders || {})
  });
}

function fetchText_(url, extraHeaders) {
  const response = fetchResponse_(url, extraHeaders);
  const code = response.getResponseCode();
  if (code < 200 || code >= 400) throw new Error('HTTP ' + code + '：' + url);
  return response.getContentText('UTF-8');
}

function fetchTaiwanPharmacySociety_(source) {
  const rootUrl = 'https://www.pharm.org.tw/';
  const landing = fetchResponse_(rootUrl);
  const cookie = cookieHeader_(landing);
  const pageHeaders = { Referer: rootUrl };
  if (cookie) pageHeaders.Cookie = cookie;
  const sourceUrl = String(source.url);
  const baseUrl = /sub=\d+/i.test(sourceUrl)
    ? sourceUrl.replace(/sub=\d+/i, 'sub=')
    : sourceUrl + (sourceUrl.includes('?') ? '&' : '?') + 'Continue=Y&sub=';
  const rows = [];
  const seen = {};
  const maxPages = 20;
  for (let page = 1; page <= maxPages; page += 1) {
    const pageUrl = baseUrl + page;
    const response = fetchResponse_(pageUrl, pageHeaders);
    const code = response.getResponseCode();
    if (code === 403) throw new Error('台灣藥學會拒絕 GAS 請求：HTTP 403；請洽網站提供 RSS／API 或允許 Google UrlFetch IP。');
    if (code < 200 || code >= 400) throw new Error('HTTP ' + code + '：' + pageUrl);
    const pageRows = parseTaiwanPharmacyRows_(response.getContentText('UTF-8'), pageUrl);
    let added = 0;
    pageRows.forEach(function(row) {
      const key = [row.title, row.organizer, iso_(row.startAt)].join('|');
      if (seen[key]) return;
      seen[key] = true;
      rows.push(row);
      added += 1;
    });
    if (!pageRows.length || !added) break;
    if (page === maxPages) throw new Error('台灣藥學會頁數超過 ' + maxPages + ' 頁，可能只抓到部分資料。');
  }
  if (!rows.length) throw new Error('未解析到課程列，來源版型可能已變更。');
  return rows;
}

function cookieHeader_(response) {
  const headers = response.getAllHeaders ? response.getAllHeaders() : {};
  const values = headers['Set-Cookie'] || headers['set-cookie'] || [];
  return [].concat(values).map(function(value) { return String(value).split(';')[0]; }).join('; ');
}

function parseTaiwanPharmacyRows_(html, pageUrl) {
  const rows = [];
  const rowPattern = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch;
  while ((rowMatch = rowPattern.exec(html)) !== null) {
    const cells = [];
    const cellPattern = /<td\b[^>]*>([\s\S]*?)<\/td>/gi;
    let cellMatch;
    while ((cellMatch = cellPattern.exec(rowMatch[1])) !== null) cells.push(htmlToText_(cellMatch[1]));
    if (cells.length < 3 || !/1\d{2}[\/.-]\d{1,2}[\/.-]\d{1,2}/.test(cells[0])) continue;
    const range = dateRangeFromText_(cells[0]);
    if (!range.startAt) continue;
    rows.push({
      title: cells[2],
      organizer: cells[1],
      startAt: range.startAt,
      endAt: range.endAt,
      creditApprovalStatus: cells[3] || '未提供',
      registrationStatus: '未提供',
      sourceUrl: pageUrl,
      notes: '台灣藥學會公開審查列表；由儀表板自動彙整。'
    });
  }
  return rows;
}

function fetchWordpressRss_(source) {
  const xml = fetchText_(source.url);
  const document = XmlService.parse(xml);
  const root = document.getRootElement();
  const channel = root.getChild('channel');
  if (!channel) throw new Error('RSS 缺少 channel。');
  return channel.getChildren('item').slice(0, 30).map(function(item) {
    const title = childText_(item, 'title');
    const description = childText_(item, 'description');
    const link = childText_(item, 'link');
    const combined = title + ' ' + htmlToText_(description);
    const startAt = parseDateText_(combined);
    return {
      title: title,
      organizer: source.name,
      startAt: startAt || '',
      sourceUrl: link || source.url,
      registrationStatus: '未提供',
      notes: '由 RSS 公告自動匯入；未提供的欄位保留空白標示。'
    };
  }).filter(function(course) {
    return course.startAt && /(繼續教育|持續教育|學分|積分|課程|研討會)/.test(course.title);
  });
}

function childText_(element, name) {
  const child = element.getChild(name);
  return child ? child.getText() : '';
}
