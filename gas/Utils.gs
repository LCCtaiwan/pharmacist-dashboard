function getSpreadsheet_() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  if (spreadsheet) {
    PropertiesService.getScriptProperties().setProperty('spreadsheetId', spreadsheet.getId());
    return spreadsheet;
  }
  const spreadsheetId = PropertiesService.getScriptProperties().getProperty('spreadsheetId');
  if (spreadsheetId) return SpreadsheetApp.openById(spreadsheetId);
  throw new Error('請先在綁定的 Google Sheet 中手動執行 setupProject_()，以保存資料庫位置。');
}

function now_() {
  return new Date();
}

function iso_(value) {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (isNaN(date.getTime())) return String(value);
  return Utilities.formatDate(date, TZ, "yyyy-MM-dd'T'HH:mm:ssXXX");
}

function toDate_(value) {
  if (!value) return null;
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
  const parsed = new Date(value);
  return isNaN(parsed.getTime()) ? null : parsed;
}

function bool_(value) {
  return String(value).toUpperCase() === 'TRUE' || value === true || value === 1;
}

function number_(value, fallback) {
  if (value === '' || value == null || (typeof value === 'string' && value.trim() === '')) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function safeJson_(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

function hash_(text) {
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(text), Utilities.Charset.UTF_8);
  return digest.map(function(byte) {
    const normalized = byte < 0 ? byte + 256 : byte;
    return ('0' + normalized.toString(16)).slice(-2);
  }).join('').slice(0, 24);
}

function htmlToText_(html) {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?\s*>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function headerMap_(headers) {
  return headers.reduce(function(map, header, index) {
    map[header] = index;
    return map;
  }, {});
}

function getRowsAsObjects_(sheet) {
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  const headers = values[0].map(String);
  return values.slice(1).filter(function(row) {
    return row.some(function(value) { return value !== ''; });
  }).map(function(row, rowIndex) {
    const object = { _row: rowIndex + 2 };
    headers.forEach(function(header, index) { object[header] = row[index]; });
    return object;
  });
}

function settings_() {
  const sheet = getSpreadsheet_().getSheetByName(SHEETS.SETTINGS);
  if (!sheet) return {};
  return getRowsAsObjects_(sheet).reduce(function(map, row) {
    map[String(row.key)] = row.value;
    return map;
  }, {});
}

function setSourceHealth_(sourceId, success, errorMessage) {
  const sheet = getSpreadsheet_().getSheetByName(SHEETS.SOURCES);
  const values = sheet.getDataRange().getValues();
  const map = headerMap_(values[0]);
  for (let index = 1; index < values.length; index += 1) {
    if (String(values[index][map.sourceId]) !== String(sourceId)) continue;
    const row = index + 1;
    sheet.getRange(row, map.lastAttemptAt + 1).setValue(now_());
    if (success) {
      sheet.getRange(row, map.lastSuccessAt + 1).setValue(now_());
      sheet.getRange(row, map.lastError + 1).setValue('');
    } else {
      sheet.getRange(row, map.lastError + 1).setValue(String(errorMessage || '未知錯誤').slice(0, 500));
    }
    return;
  }
}

function parseDateText_(text) {
  const input = String(text || '').replace(/民國/g, '').replace(/年/g, '/').replace(/月/g, '/').replace(/日/g, ' ');
  const roc = input.match(/(?:^|\D)(1\d{2})[\/.-](\d{1,2})[\/.-](\d{1,2})(?:\s+(\d{1,2}):(\d{2}))?/);
  if (roc) return localDate_(Number(roc[1]) + 1911, Number(roc[2]), Number(roc[3]), Number(roc[4] || 0), Number(roc[5] || 0));
  const western = input.match(/(?:^|\D)(20\d{2})[\/.-](\d{1,2})[\/.-](\d{1,2})(?:\s+(\d{1,2}):(\d{2}))?/);
  if (western) return localDate_(Number(western[1]), Number(western[2]), Number(western[3]), Number(western[4] || 0), Number(western[5] || 0));
  return null;
}

function localDate_(year, month, day, hour, minute) {
  const date = new Date(year, month - 1, day, hour || 0, minute || 0, 0);
  return isNaN(date.getTime()) ? null : date;
}

function dateRangeFromText_(text) {
  const normalized = String(text || '').replace(/民國/g, '').replace(/年/g, '/').replace(/月/g, '/').replace(/日/g, ' ');
  const parts = normalized.split(/\s*[~～至]\s*/);
  const start = parseDateText_(parts[0]);
  let end = parts.length > 1 ? parseDateText_(parts[1]) : null;
  if (!end && start && parts.length > 1) {
    const timeOnly = parts[1].match(/(\d{1,2}):(\d{2})/);
    if (timeOnly) end = localDate_(start.getFullYear(), start.getMonth() + 1, start.getDate(), Number(timeOnly[1]), Number(timeOnly[2]));
  }
  return { startAt: start, endAt: end };
}
