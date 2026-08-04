import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const root = path.resolve(import.meta.dirname, '..');
const gasFiles = ['Config.gs', 'Utils.gs', 'Courses.gs', 'Setup.gs', 'Sources.gs', 'Api.gs', 'SheetSync.gs'];

class FakeRange {
  constructor(sheet, row, column, rows = 1, columns = 1) {
    this.sheet = sheet;
    this.row = row;
    this.column = column;
    this.rows = rows;
    this.columns = columns;
  }

  getValues() {
    return Array.from({ length: this.rows }, (_, rowOffset) => Array.from({ length: this.columns }, (_, columnOffset) =>
      this.sheet.valueAt(this.row + rowOffset, this.column + columnOffset)
    ));
  }

  setValues(values) {
    values.forEach((row, rowOffset) => row.forEach((value, columnOffset) => {
      this.sheet.setValueAt(this.row + rowOffset, this.column + columnOffset, value);
    }));
    return this;
  }

  setValue(value) { return this.setValues([[value]]); }
  clearContent() { this.sheet.values = this.sheet.values.slice(0, this.row - 1); return this; }
  setBackground() { return this; }
  setFontColor() { return this; }
  setFontWeight() { return this; }
  setNumberFormat() { return this; }
}

class FakeSheet {
  constructor(name) {
    this.name = name;
    this.values = [];
  }

  getLastRow() { return this.values.length; }
  getLastColumn() { return this.values.reduce((max, row) => Math.max(max, row.length), 0); }
  getDataRange() { return new FakeRange(this, 1, 1, Math.max(1, this.getLastRow()), Math.max(1, this.getLastColumn())); }
  getRange(row, column, rows, columns) {
    if (typeof row === 'string') return new FakeRange(this, 1, 1);
    return new FakeRange(this, row, column, rows || 1, columns || 1);
  }
  setFrozenRows() {}
  autoResizeColumns() {}
  appendRow(row) { this.values.push(row); return this; }
  valueAt(row, column) { return (this.values[row - 1] || [])[column - 1] ?? ''; }
  setValueAt(row, column, value) {
    while (this.values.length < row) this.values.push([]);
    while (this.values[row - 1].length < column) this.values[row - 1].push('');
    this.values[row - 1][column - 1] = value;
  }
}

class FakeSpreadsheet {
  constructor() { this.sheets = new Map(); }
  getSheetByName(name) { return this.sheets.get(name) || null; }
  insertSheet(name) { const sheet = new FakeSheet(name); this.sheets.set(name, sheet); return sheet; }
  setSpreadsheetTimeZone() {}
  getId() { return 'fake-sheet'; }
  getUrl() { return 'https://docs.google.com/spreadsheets/d/fake-sheet'; }
}

function createRuntime() {
  const spreadsheet = new FakeSpreadsheet();
  const properties = new Map();
  let activeSpreadsheet = spreadsheet;
  const context = {
    console,
    SpreadsheetApp: {
      getActiveSpreadsheet: () => activeSpreadsheet,
      openById: (id) => {
        assert.equal(id, 'fake-sheet');
        return spreadsheet;
      },
      flush: () => {}
    },
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (key) => properties.get(key) || null,
        setProperty: (key, value) => properties.set(key, value)
      })
    },
    Utilities: {
      formatDate: (date) => new Date(date).toISOString(),
      getUuid: () => 'uuid-test',
      computeDigest: () => Array(32).fill(1),
      DigestAlgorithm: { SHA_256: 'sha256' },
      Charset: { UTF_8: 'utf8' }
    },
    ContentService: {
      MimeType: { JSON: 'application/json', JAVASCRIPT: 'application/javascript', XML: 'application/xml' },
      createTextOutput: (text) => ({ text, mimeType: '', setMimeType(mimeType) { this.mimeType = mimeType; return this; } })
    },
    ScriptApp: { getService: () => ({ getUrl: () => 'https://script.google.com/macros/s/fake/exec' }) },
    HtmlService: {
      createTemplateFromFile: (filename) => ({
        evaluate: () => ({
          kind: 'html', filename, title: '', meta: {},
          setTitle(title) { this.title = title; return this; },
          addMetaTag(name, value) { this.meta[name] = value; return this; }
        })
      }),
      createHtmlOutputFromFile: (filename) => ({ getContent: () => `included:${filename}` })
    },
    LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock: () => {} }) },
    UrlFetchApp: { fetch: () => { throw new Error('網路呼叫不應出現在 mock 測試'); } },
    XmlService: { parse: () => { throw new Error('XML 解析不應出現在 mock 測試'); } }
  };
  vm.createContext(context);
  vm.runInContext(gasFiles.map((file) => fs.readFileSync(path.join(root, 'gas', file), 'utf8')).join('\n'), context, { filename: 'gas-bundle.gs' });
  return {
    context,
    spreadsheet,
    properties,
    setActiveSpreadsheet: (value) => { activeSpreadsheet = value; }
  };
}

function sheetSyncTest() {
  const runtime = createRuntime();
  runtime.properties.set('SHEET_SYNC_TOKEN', 'secret');
  const unauthorized = runtime.context.doPost({ postData: { contents: JSON.stringify({ syncToken: 'wrong' }) } });
  assert.equal(JSON.parse(unauthorized.text).ok, false);
  const payload = {
    schemaVersion: 1,
    generatedAt: '2026-08-04T03:00:00.000Z',
    courses: [
      { courseId: 'a', title: '倫理課程', category: '專業倫理', rareStatus: '稀有學分', startAt: '2026-08-09T01:00:00.000Z', sourceId: 'source-a' },
      { courseId: 'b', title: '一般課程', rareStatus: '一般課程', startAt: '2027-01-10T01:00:00.000Z', sourceId: 'source-a' }
    ],
    sources: [{ sourceId: 'source-a', status: 'ok' }],
    syncToken: 'secret'
  };
  const response = runtime.context.doPost({ postData: { contents: JSON.stringify(payload) } });
  const result = JSON.parse(response.text);
  assert.equal(result.ok, true);
  assert.deepEqual(result.monthKeys, ['2026-08', '2027-01']);
  assert.equal(runtime.spreadsheet.getSheetByName('Courses_All').getLastRow(), 3);
  assert.equal(runtime.spreadsheet.getSheetByName('2026-08').getLastRow(), 2);
  assert.equal(runtime.spreadsheet.getSheetByName('2027-01').getLastRow(), 2);
}

function objectFromRow(headers, row) {
  return Object.fromEntries(headers.map((header, index) => [header, row[index]]));
}

function replaceSheetRows(sheet, headers, rows) {
  sheet.values = [headers, ...rows.map((row) => headers.map((header) => row[header] ?? ''))];
}

function course(overrides = {}) {
  return {
    courseId: 'course-1', title: '原始課名', category: '自動分類', topicTag: '自動標籤', creditPoints: 1,
    creditStatus: '待確認', deliveryMode: '線上', region: '全台', venue: '',
    startAt: new Date('2030-01-10T09:00:00+08:00'), endAt: '', registrationDeadline: '', fee: '', seatsTotal: '', seatsRemaining: '',
    registrationStatus: '開放報名', creditApprovalStatus: '待確認', rareStatus: '候選', rareReason: '關鍵字推定',
    organizer: '主辦單位', sourceName: '自動來源', sourceUrl: 'https://example.test/course',
    firstSeenAt: new Date('2030-01-01T00:00:00+08:00'), lastSeenAt: new Date('2030-01-01T00:00:00+08:00'),
    lastUpdatedAt: new Date('2030-01-01T00:00:00+08:00'), notes: '自動備註', ...overrides
  };
}

function initializeAndBindTest() {
  const runtime = createRuntime();
  const result = runtime.context.setupProject_();
  assert.equal(result.ok, true);
  assert.deepEqual([...runtime.spreadsheet.sheets.keys()].sort(), ['Courses', 'Settings', 'Sources']);
  assert.equal(runtime.properties.get('spreadsheetId'), 'fake-sheet');
  runtime.setActiveSpreadsheet(null);
  assert.equal(runtime.context.getSpreadsheet_(), runtime.spreadsheet);
}

function upsertAutoClassificationTest() {
  const runtime = createRuntime();
  runtime.context.setupProject_();
  const coursesSheet = runtime.spreadsheet.getSheetByName('Courses');
  const headers = coursesSheet.values[0];
  const existing = course({
    courseId: 'existing', title: '感染管制藥事實務', category: '舊分類', topicTag: '舊標籤',
    rareStatus: '已確認', rareReason: '舊判讀', notes: '舊備註'
  });
  replaceSheetRows(coursesSheet, headers, [existing]);
  const source = { sourceId: 'test-source', name: '測試來源', url: 'https://example.test/source' };
  runtime.context.upsertCourses_([
    runtime.context.normalizeCourse_({ courseId: 'existing', title: '感染管制藥事實務' }, source),
    runtime.context.normalizeCourse_({ courseId: 'new-general', title: '藥事人員繼續教育' }, source)
  ]);
  const existingAfter = objectFromRow(headers, coursesSheet.values[1]);
  const newGeneralAfter = objectFromRow(headers, coursesSheet.values[2]);
  assert.equal(existingAfter.rareStatus, '稀有學分');
  assert.equal(existingAfter.category, '感染管制');
  assert.equal(existingAfter.rareReason, '自動關鍵字分類：感染管制');
  assert.equal(newGeneralAfter.rareStatus, '一般課程');
}

function apiJsonAndJsonpTest() {
  const runtime = createRuntime();
  runtime.context.setupProject_();
  const html = runtime.context.doGet({ parameter: {} });
  assert.equal(html.kind, 'html');
  assert.equal(html.filename, 'Dashboard');
  assert.equal(html.meta.viewport, 'width=device-width, initial-scale=1');
  const json = runtime.context.doGet({ parameter: { format: 'json' } });
  assert.equal(json.mimeType, 'application/json');
  assert.equal(JSON.parse(json.text).schemaVersion, 1);
  assert.equal(runtime.context.getDashboardData().schemaVersion, 1);
  assert.equal(runtime.context.include_('Styles'), 'included:Styles');
  const jsonp = runtime.context.doGet({ parameter: { callback: 'dashboard.callback' } });
  assert.equal(jsonp.mimeType, 'application/javascript');
  assert.match(jsonp.text, /^dashboard\.callback\(/);
  const invalidCallback = runtime.context.doGet({ parameter: { callback: 'bad-callback()' } });
  assert.doesNotMatch(invalidCallback.text, /^bad-callback/);
  assert.equal(JSON.parse(invalidCallback.text).schemaVersion, 1);
}

function actionsDataPreferredTest() {
  const runtime = createRuntime();
  runtime.context.setupProject_();
  const actionsCourses = runtime.spreadsheet.insertSheet('Courses_All');
  const actionsSources = runtime.spreadsheet.insertSheet('Sources_Actions');
  const courseHeaders = ['courseId', 'sourceId', 'title', 'category', 'topicTag', 'creditPoints', 'creditStatus', 'deliveryMode', 'region', 'venue', 'startAt', 'endAt', 'registrationDeadline', 'fee', 'seatsTotal', 'seatsRemaining', 'registrationStatus', 'creditApprovalStatus', 'rareStatus', 'rareReason', 'organizer', 'sourceName', 'sourceUrl', 'firstSeenAt', 'lastUpdatedAt', 'notes', 'monthKey', 'dateBasis'];
  const sourceHeaders = ['sourceId', 'name', 'url', 'updateMode', 'status', 'lastAttemptAt', 'lastSuccessAt', 'lastError', 'notes'];
  replaceSheetRows(actionsCourses, courseHeaders, [{ courseId: 'actions-1', sourceId: 'actions-source', title: 'Actions 感染管制課程', category: '感染管制', rareStatus: '稀有學分', startAt: new Date('2030-01-10T09:00:00+08:00'), sourceUrl: 'https://example.test/actions-1' }]);
  replaceSheetRows(actionsSources, sourceHeaders, [{ sourceId: 'actions-source', name: 'Actions RSS', url: 'https://example.test/actions', updateMode: 'rss', status: 'ok', lastSuccessAt: new Date('2030-01-01T00:00:00+08:00') }]);
  const payload = runtime.context.getDashboardData();
  assert.equal(payload.courses.length, 1);
  assert.equal(payload.courses[0].courseId, 'actions-1');
  assert.equal(payload.sources[0].updateMode, 'rss');
}

function apiRssTest() {
  const runtime = createRuntime();
  runtime.context.setupProject_();
  const coursesSheet = runtime.spreadsheet.getSheetByName('Courses');
  replaceSheetRows(coursesSheet, coursesSheet.values[0], [course({
    courseId: 'rss-1', title: '感染管制 <實務>', category: '感染管制',
    creditPoints: 2, sourceUrl: 'https://example.test/rss-1',
    startAt: new Date('2030-01-10T09:00:00+08:00'), lastUpdatedAt: new Date('2030-01-01T00:00:00+08:00')
  })]);
  const rss = runtime.context.doGet({ parameter: { format: 'rss' } });
  assert.equal(rss.mimeType, 'application/xml');
  assert.match(rss.text, /^<\?xml version="1\.0" encoding="UTF-8"\?><rss version="2\.0">/);
  assert.match(rss.text, /感染管制 &lt;實務&gt;/);
  assert.match(rss.text, /<guid isPermaLink="false">rss-1<\/guid>/);
  assert.doesNotMatch(rss.text, /<script/);
  const rssFromQueryString = runtime.context.doGet({ queryString: 'format=rss' });
  assert.equal(rssFromQueryString.mimeType, 'application/xml');
}

function taiwanPharmacyPaginationTest() {
  const runtime = createRuntime();
  const page = (title, date, status = '通過') => `<table><tr><td>${date}</td><td>臺北市藥師公會</td><td>${title}</td><td>${status}</td></tr></table>`;
  const calls = [];
  runtime.context.UrlFetchApp = {
    fetch: (url, options) => {
      calls.push({ url, options });
      if (url === 'https://www.pharm.org.tw/') return {
        getResponseCode: () => 200,
        getContentText: () => '',
        getAllHeaders: () => ({ 'Set-Cookie': ['ASPSESSIONID=abc; path=/'] })
      };
      const html = url.endsWith('sub=1')
        ? page('感染管制藥事實務', '115/08/09 10:00 ~115/08/09 12:00')
        : url.endsWith('sub=2')
          ? page('醫療法規更新', '115/08/16 10:00 ~115/08/16 12:00')
          : '';
      return { getResponseCode: () => 200, getContentText: () => html, getAllHeaders: () => ({}) };
    }
  };
  const rows = runtime.context.fetchTaiwanPharmacySociety_({
    url: 'https://www.pharm.org.tw/score/applyList.asp'
  });
  assert.equal(rows.length, 2);
  assert.equal(rows[0].title, '感染管制藥事實務');
  assert.equal(rows[1].sourceUrl.endsWith('sub=2'), true);
  assert.equal(calls.length, 4);
  assert.equal(calls[1].url.endsWith('sub=1'), true);
  assert.equal(calls[1].options.headers.Cookie, 'ASPSESSIONID=abc');
}

function taiwanPharmacy403Test() {
  const runtime = createRuntime();
  runtime.context.UrlFetchApp = {
    fetch: (url) => {
      if (url === 'https://www.pharm.org.tw/') return {
        getResponseCode: () => 200,
        getContentText: () => '',
        getAllHeaders: () => ({ 'Set-Cookie': ['ASPSESSIONID=blocked; path=/'] })
      };
      return { getResponseCode: () => 403, getContentText: () => '', getAllHeaders: () => ({}) };
    }
  };
  assert.throws(
    () => runtime.context.fetchTaiwanPharmacySociety_({ url: 'https://www.pharm.org.tw/score/applyList.asp' }),
    /HTTP 403/
  );
}

function failedFetchKeepsCoursesTest() {
  const runtime = createRuntime();
  runtime.context.setupProject_();
  const coursesSheet = runtime.spreadsheet.getSheetByName('Courses');
  const sourcesSheet = runtime.spreadsheet.getSheetByName('Sources');
  const courseHeaders = coursesSheet.values[0];
  const sourceHeaders = sourcesSheet.values[0];
  replaceSheetRows(coursesSheet, courseHeaders, [course({ courseId: 'existing-course' })]);
  replaceSheetRows(sourcesSheet, sourceHeaders, [{
    sourceId: 'broken-source', name: '故障來源', type: 'unsupported', url: 'https://example.test/broken', enabled: true,
    priority: 1, pollMinutes: 60, lastAttemptAt: '', lastSuccessAt: '', lastError: '', notes: ''
  }]);
  const summary = runtime.context.refreshAllSources_();
  assert.equal(summary.errors, 1);
  assert.equal(coursesSheet.getLastRow(), 2);
  assert.equal(objectFromRow(courseHeaders, coursesSheet.values[1]).courseId, 'existing-course');
  assert.match(String(objectFromRow(sourceHeaders, sourcesSheet.values[1]).lastError), /不支援/);
}

sheetSyncTest();
initializeAndBindTest();
upsertAutoClassificationTest();
apiJsonAndJsonpTest();
actionsDataPreferredTest();
apiRssTest();
taiwanPharmacyPaginationTest();
taiwanPharmacy403Test();
failedFetchKeepsCoursesTest();
console.log('gas behavior: ok (initialization, automatic rare classification, Sheet month sync, API, Taiwan Pharmacy pagination/403, scheduled refresh, failed fetch)');
