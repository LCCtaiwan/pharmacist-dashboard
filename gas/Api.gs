function doGet(event) {
  const parameters = requestParameters_(event);
  const callback = String(parameters.callback || '');
  const format = String(parameters.format || '').toLowerCase();
  const wantsRss = format === 'rss' || String(parameters.action || '').toLowerCase() === 'rss';
  const wantsApi = callback || format === 'json' || String(parameters.action || '').toLowerCase() === 'api';
  if (wantsRss) return rssResponse_(buildPublicPayload_());
  if (!wantsApi) {
    return HtmlService.createTemplateFromFile('Dashboard')
      .evaluate()
      .setTitle('台灣藥師稀有學分課程儀表板')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
  }
  const data = buildPublicPayload_();
  if (callback && /^[A-Za-z_$][0-9A-Za-z_$\.]*$/.test(callback)) {
    return ContentService.createTextOutput(callback + '(' + safeJson_(data) + ');')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(safeJson_(data))
      .setMimeType(ContentService.MimeType.JSON);
}

function requestParameters_(event) {
  const parameters = {};
  const queryString = String(event && event.queryString || '');
  queryString.split('&').forEach(function(part) {
    if (!part) return;
    const pieces = part.split('=');
    const key = decodeURIComponent(pieces.shift() || '').trim();
    if (!key) return;
    parameters[key] = decodeURIComponent(pieces.join('=').replace(/\+/g, ' ') || '');
  });
  Object.keys(event && event.parameter || {}).forEach(function(key) {
    parameters[key] = event.parameter[key];
  });
  return parameters;
}

function rssResponse_(data) {
  return ContentService.createTextOutput(buildRssFeed_(data))
    .setMimeType(ContentService.MimeType.XML);
}

function buildRssFeed_(data) {
  const items = (data.courses || []).map(function(course) {
    const guid = course.courseId || course.sourceUrl || (course.title + '|' + course.startAt);
    const details = [
      course.category && ('類別：' + course.category),
      course.creditPoints !== null && course.creditPoints !== undefined && ('積分：' + course.creditPoints),
      course.deliveryMode && ('方式：' + course.deliveryMode),
      course.region && ('地區：' + course.region),
      course.organizer && ('主辦：' + course.organizer),
      course.rareStatus && ('稀有學分標籤：' + course.rareStatus),
      course.startAt && ('開始：' + course.startAt),
      course.registrationDeadline && ('報名截止：' + course.registrationDeadline)
    ].filter(Boolean).join('；');
    return '<item>' +
      '<title>' + xmlEscape_(course.title) + '</title>' +
      '<link>' + xmlEscape_(course.sourceUrl || '') + '</link>' +
      '<guid isPermaLink="false">' + xmlEscape_(guid) + '</guid>' +
      '<pubDate>' + xmlEscape_(rssDate_(course.lastUpdatedAt || course.startAt || data.generatedAt)) + '</pubDate>' +
      '<description>' + xmlEscape_(details || course.notes || '') + '</description>' +
      '</item>';
  }).join('');
  return '<?xml version="1.0" encoding="UTF-8"?>' +
    '<rss version="2.0"><channel>' +
    '<title>' + xmlEscape_(data.title || '台灣藥師稀有學分課程') + '</title>' +
    '<link>https://www.pharm.org.tw/</link>' +
    '<description>由 GAS 儀表板自動彙整課程產生的 RSS；稀有學分標籤由關鍵字自動分類。</description>' +
    '<lastBuildDate>' + xmlEscape_(rssDate_(data.generatedAt)) + '</lastBuildDate>' +
    items +
    '</channel></rss>';
}

function rssDate_(value) {
  const date = value ? new Date(value) : new Date();
  return isNaN(date.getTime()) ? new Date().toUTCString() : date.toUTCString();
}

function xmlEscape_(value) {
  return String(value === null || value === undefined ? '' : value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function getDashboardData() {
  return buildPublicPayload_();
}

function include_(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function buildPublicPayload_() {
  const spreadsheet = getSpreadsheet_();
  const config = settings_();
  const actionsCourses = spreadsheet.getSheetByName('Courses_All');
  const courseSheet = actionsCourses && actionsCourses.getLastRow() > 1
    ? actionsCourses
    : spreadsheet.getSheetByName(SHEETS.COURSES);
  const actionsSources = spreadsheet.getSheetByName('Sources_Actions');
  const sourceSheet = actionsSources && actionsSources.getLastRow() > 1
    ? actionsSources
    : spreadsheet.getSheetByName(SHEETS.SOURCES);
  const courses = getRowsAsObjects_(courseSheet)
    .map(publicCourse_)
    .sort(function(a, b) { return String(a.startAt).localeCompare(String(b.startAt)); });
  const sources = getRowsAsObjects_(sourceSheet)
    .filter(function(source) { return source.enabled === undefined ? true : bool_(source.enabled); })
    .map(function(source) {
      return {
        sourceId: String(source.sourceId || ''), name: String(source.name || ''),
        url: String(source.url || ''), updateMode: String(source.type || source.updateMode || ''), priority: number_(source.priority, 99),
        lastAttemptAt: iso_(source.lastAttemptAt), lastSuccessAt: iso_(source.lastSuccessAt),
        status: String(source.status || '') || (source.lastError ? 'error' : (source.lastSuccessAt ? 'ok' : 'not_checked')),
        lastError: source.lastError ? String(source.lastError).slice(0, 160) : '', notes: String(source.notes || '')
      };
    });
  return {
    schemaVersion: 1,
    appVersion: APP_VERSION,
    generatedAt: iso_(now_()),
    title: '台灣藥師稀有學分課程儀表板',
    rareDefinition: String(config.rareDefinition || ''),
    courses: courses,
    sources: sources
  };
}

function publicCourse_(course) {
  return {
    courseId: String(course.courseId || ''), title: String(course.title || ''),
    category: String(course.category || ''), topicTag: String(course.topicTag || ''),
    creditPoints: course.creditPoints === '' ? null : number_(course.creditPoints, null),
    creditStatus: String(course.creditStatus || ''), deliveryMode: String(course.deliveryMode || ''),
    region: String(course.region || ''), venue: String(course.venue || ''),
    startAt: iso_(course.startAt), endAt: iso_(course.endAt),
    registrationDeadline: iso_(course.registrationDeadline), fee: course.fee === '' ? null : course.fee,
    seatsTotal: course.seatsTotal === '' ? null : number_(course.seatsTotal, null),
    seatsRemaining: course.seatsRemaining === '' ? null : number_(course.seatsRemaining, null),
    registrationStatus: String(course.registrationStatus || ''),
    creditApprovalStatus: String(course.creditApprovalStatus || ''),
    rareStatus: String(course.rareStatus || ''), rareReason: String(course.rareReason || ''),
    organizer: String(course.organizer || ''), sourceName: String(course.sourceName || ''),
    sourceUrl: String(course.sourceUrl || ''), firstSeenAt: iso_(course.firstSeenAt),
    lastUpdatedAt: iso_(course.lastUpdatedAt), notes: String(course.notes || '')
  };
}
