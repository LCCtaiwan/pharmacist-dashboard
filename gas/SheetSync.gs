const ACTIONS_SYNC_SHEETS = {
  ALL: 'Courses_All',
  SOURCES: 'Sources_Actions',
  RUNS: 'RunHistory'
};

const ACTIONS_COURSE_HEADERS = [
  'courseId', 'sourceId', 'title', 'category', 'topicTag', 'creditPoints', 'creditStatus',
  'deliveryMode', 'region', 'venue', 'startAt', 'endAt', 'registrationDeadline', 'fee',
  'seatsTotal', 'seatsRemaining', 'registrationStatus', 'creditApprovalStatus', 'rareStatus',
  'rareReason', 'organizer', 'sourceName', 'sourceUrl', 'firstSeenAt', 'lastUpdatedAt',
  'notes', 'monthKey', 'dateBasis'
];

const ACTIONS_SOURCE_HEADERS = [
  'sourceId', 'name', 'url', 'updateMode', 'status', 'lastAttemptAt', 'lastSuccessAt', 'lastError', 'notes'
];

const ACTIONS_RUN_HEADERS = [
  'runId', 'generatedAt', 'receivedAt', 'courseCount', 'rareCount', 'sourceCount', 'sourceErrors', 'status'
];

function doPost(event) {
  try {
    const request = JSON.parse(String(event && event.postData && event.postData.contents || '{}'));
    const expected = PropertiesService.getScriptProperties().getProperty('SHEET_SYNC_TOKEN');
    if (!expected || String(request.syncToken || '') !== String(expected)) {
      return syncJsonResponse_({ ok: false, error: '未授權的同步請求。' });
    }
    const result = syncActionsPayload_(request);
    return syncJsonResponse_(result);
  } catch (error) {
    return syncJsonResponse_({ ok: false, error: String(error && error.message || error) });
  }
}

function syncJsonResponse_(value) {
  return ContentService.createTextOutput(JSON.stringify(value))
    .setMimeType(ContentService.MimeType.JSON);
}

function setupSheetSyncToken_() {
  const properties = PropertiesService.getScriptProperties();
  let token = properties.getProperty('SHEET_SYNC_TOKEN');
  if (!token) {
    token = Utilities.getUuid().replace(/-/g, '');
    properties.setProperty('SHEET_SYNC_TOKEN', token);
  }
  const endpoint = ScriptApp.getService().getUrl() || '部署後取得 /exec 網址';
  SpreadsheetApp.getUi().alert('GitHub Sheet 同步設定\n\nURL：' + endpoint + '\nToken：' + token + '\n\n請將兩者分別存成 GitHub Secrets：GAS_SYNC_URL、GAS_SYNC_TOKEN。');
  return { ok: true, endpoint: endpoint, token: token };
}

function syncActionsPayload_(payload) {
  if (!payload || payload.schemaVersion !== 1 || !Array.isArray(payload.courses)) {
    throw new Error('同步資料格式不相容。');
  }
  const spreadsheet = getSpreadsheet_();
  spreadsheet.setSpreadsheetTimeZone(TZ);
  const courses = payload.courses.map(function(course) {
    const monthKey = monthKeyForCourse_(course, payload.generatedAt);
    return ACTIONS_COURSE_HEADERS.map(function(header) {
      if (header === 'monthKey') return monthKey;
      if (header === 'dateBasis') return course.startAt ? '上課日期' : '公告／更新日期';
      return course[header] === null || course[header] === undefined ? '' : course[header];
    });
  });
  const allSheet = ensureSyncSheet_(spreadsheet, ACTIONS_SYNC_SHEETS.ALL, ACTIONS_COURSE_HEADERS);
  replaceSyncRows_(allSheet, ACTIONS_COURSE_HEADERS, courses);

  const byMonth = {};
  courses.forEach(function(row) {
    const monthKey = row[ACTIONS_COURSE_HEADERS.indexOf('monthKey')];
    if (!byMonth[monthKey]) byMonth[monthKey] = [];
    byMonth[monthKey].push(row);
  });
  Object.keys(byMonth).sort().forEach(function(monthKey) {
    const monthSheet = ensureSyncSheet_(spreadsheet, monthKey, ACTIONS_COURSE_HEADERS);
    replaceSyncRows_(monthSheet, ACTIONS_COURSE_HEADERS, byMonth[monthKey]);
  });

  const sourceRows = (payload.sources || []).map(function(source) {
    return ACTIONS_SOURCE_HEADERS.map(function(header) {
      return source[header] === null || source[header] === undefined ? '' : source[header];
    });
  });
  replaceSyncRows_(ensureSyncSheet_(spreadsheet, ACTIONS_SYNC_SHEETS.SOURCES, ACTIONS_SOURCE_HEADERS), ACTIONS_SOURCE_HEADERS, sourceRows);

  const rareCount = payload.courses.filter(function(course) { return course.rareStatus === '稀有學分'; }).length;
  const errorCount = (payload.sources || []).filter(function(source) { return source.status === 'error'; }).length;
  const runSheet = ensureSyncSheet_(spreadsheet, ACTIONS_SYNC_SHEETS.RUNS, ACTIONS_RUN_HEADERS);
  runSheet.appendRow([
    Utilities.getUuid(), payload.generatedAt || '', new Date(), payload.courses.length, rareCount,
    (payload.sources || []).length, errorCount, errorCount ? '部分來源異常' : '成功'
  ]);
  SpreadsheetApp.flush();
  return { ok: true, courseCount: payload.courses.length, rareCount: rareCount, monthKeys: Object.keys(byMonth).sort(), sourceErrors: errorCount };
}

function monthKeyForCourse_(course, fallback) {
  const value = String(course && (course.startAt || fallback) || '');
  const match = value.match(/^(\d{4})-(\d{2})/);
  if (match) return match[1] + '-' + match[2];
  return Utilities.formatDate(new Date(fallback || new Date()), TZ, 'yyyy-MM');
}

function ensureSyncSheet_(spreadsheet, name, headers) {
  let sheet = spreadsheet.getSheetByName(name);
  if (!sheet) sheet = spreadsheet.insertSheet(name);
  if (!sheet.getLastRow()) sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, headers.length).setBackground('#12372A').setFontColor('#FFFFFF').setFontWeight('bold');
  return sheet;
}

function replaceSyncRows_(sheet, headers, rows) {
  const lastRow = sheet.getLastRow();
  const lastColumn = Math.max(sheet.getLastColumn(), headers.length);
  if (lastRow > 1) sheet.getRange(2, 1, lastRow - 1, lastColumn).clearContent();
  if (rows.length) sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  sheet.autoResizeColumns(1, headers.length);
}
