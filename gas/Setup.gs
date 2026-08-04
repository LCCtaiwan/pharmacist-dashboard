function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('稀有學分儀表板')
    .addItem('初始化／修復工作表', 'setupProject_')
    .addItem('立即更新公開來源', 'refreshAllSources_')
    .addItem('安裝自動更新排程', 'installRefreshTrigger_')
    .addItem('設定 GitHub Sheet 同步', 'setupSheetSyncToken_')
    .addToUi();
}

function setupProject_() {
  const spreadsheet = getSpreadsheet_();
  spreadsheet.setSpreadsheetTimeZone(TZ);
  ensureSheet_(spreadsheet, SHEETS.COURSES, COURSE_HEADERS, []);
  ensureSheet_(spreadsheet, SHEETS.SOURCES, SOURCE_HEADERS, DEFAULT_SOURCES);
  ensureSheet_(spreadsheet, SHEETS.SETTINGS, SETTING_HEADERS, DEFAULT_SETTINGS);
  formatSheets_();
  SpreadsheetApp.flush();
  return { ok: true, version: APP_VERSION, spreadsheetUrl: spreadsheet.getUrl() };
}

function ensureSheet_(spreadsheet, name, headers, seedRows) {
  let sheet = spreadsheet.getSheetByName(name);
  if (!sheet) sheet = spreadsheet.insertSheet(name);
  const currentHeaders = sheet.getLastRow() ? sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), headers.length)).getValues()[0] : [];
  const isEmpty = currentHeaders.every(function(value) { return value === ''; });
  if (isEmpty) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  } else {
    const missing = headers.filter(function(header) { return currentHeaders.indexOf(header) === -1; });
    if (missing.length) throw new Error(name + ' 缺少欄位：' + missing.join('、') + '。為避免覆寫資料，請先人工修正標題列。');
  }
  if (sheet.getLastRow() === 1 && seedRows.length) {
    sheet.getRange(2, 1, seedRows.length, headers.length).setValues(seedRows);
  }
  return sheet;
}

function formatSheets_() {
  const spreadsheet = getSpreadsheet_();
  Object.keys(SHEETS).forEach(function(key) {
    const sheet = spreadsheet.getSheetByName(SHEETS[key]);
    if (!sheet) return;
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, sheet.getLastColumn())
      .setBackground('#12372A')
      .setFontColor('#FFFFFF')
      .setFontWeight('bold');
    sheet.autoResizeColumns(1, sheet.getLastColumn());
  });
  const courses = spreadsheet.getSheetByName(SHEETS.COURSES);
  ['J:K', 'L:L', 'W:Y'].forEach(function(range) { courses.getRange(range).setNumberFormat('yyyy-mm-dd hh:mm'); });
  courses.getRange('E:E').setNumberFormat('0.0');
  courses.getRange('N:O').setNumberFormat('0');
  const sources = spreadsheet.getSheetByName(SHEETS.SOURCES);
  sources.getRange('H:I').setNumberFormat('yyyy-mm-dd hh:mm');
}

function installRefreshTrigger_() {
  const hours = Math.max(1, Math.min(24, number_(settings_().triggerHours, 6)));
  ScriptApp.getProjectTriggers().forEach(function(trigger) {
    if (trigger.getHandlerFunction() === 'refreshAllSources_') ScriptApp.deleteTrigger(trigger);
  });
  ScriptApp.newTrigger('refreshAllSources_').timeBased().everyHours(hours).create();
  return { ok: true, everyHours: hours };
}
