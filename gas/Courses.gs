function normalizeCourse_(raw, source) {
  const title = htmlToText_(raw.title);
  const organizer = htmlToText_(raw.organizer || '');
  const startAt = toDate_(raw.startAt);
  const endAt = toDate_(raw.endAt);
  const combined = [title, raw.category, raw.topicTag, raw.notes].join(' ');
  const inferred = inferRare_(combined);
  const rareStatus = inferred.matches.length ? '稀有學分' : '一般課程';
  const category = raw.category || (inferred.matches.length ? inferred.matches.join('／') : '其他課程');
  const courseId = raw.courseId || hash_([title, organizer, startAt ? iso_(startAt).slice(0, 10) : '', source.sourceId].join('|'));
  return {
    courseId: courseId,
    title: title,
    category: category,
    topicTag: raw.topicTag || inferred.matches.join('／'),
    creditPoints: raw.creditPoints === '' || raw.creditPoints == null ? '' : number_(raw.creditPoints, ''),
    creditStatus: raw.creditStatus || '未提供',
    deliveryMode: raw.deliveryMode || '未提供',
    region: raw.region || '未提供',
    venue: raw.venue || '',
    startAt: startAt || '',
    endAt: endAt || '',
    registrationDeadline: toDate_(raw.registrationDeadline) || '',
    fee: raw.fee === 0 ? 0 : (raw.fee || ''),
    seatsTotal: raw.seatsTotal === 0 ? 0 : (raw.seatsTotal || ''),
    seatsRemaining: raw.seatsRemaining === 0 ? 0 : (raw.seatsRemaining || ''),
    registrationStatus: raw.registrationStatus || '未提供',
    creditApprovalStatus: raw.creditApprovalStatus || '未提供',
    rareStatus: rareStatus,
    rareReason: inferred.matches.length ? '自動關鍵字分類：' + inferred.matches.join('、') : '未命中稀有學分關鍵字',
    organizer: organizer,
    sourceName: source.name,
    sourceUrl: raw.sourceUrl || source.url,
    firstSeenAt: raw.firstSeenAt || now_(),
    lastSeenAt: now_(),
    lastUpdatedAt: now_(),
    notes: raw.notes || ''
  };
}

function inferRare_(text) {
  const input = String(text || '').toLowerCase();
  const matches = RARE_RULES.filter(function(rule) {
    return rule.words.some(function(word) { return input.indexOf(String(word).toLowerCase()) !== -1; });
  }).map(function(rule) { return rule.category; });
  return { matches: matches };
}

function upsertCourses_(courses) {
  if (!courses.length) return { inserted: 0, updated: 0 };
  const sheet = getSpreadsheet_().getSheetByName(SHEETS.COURSES);
  const values = sheet.getDataRange().getValues();
  const headers = values[0].map(String);
  const indexById = {};
  for (let index = 1; index < values.length; index += 1) {
    if (values[index][0]) indexById[String(values[index][0])] = index + 1;
  }
  let inserted = 0;
  let updated = 0;
  const newRows = [];
  courses.forEach(function(course) {
    const existingRowNumber = indexById[course.courseId];
    if (!existingRowNumber) {
      newRows.push(headers.map(function(header) { return course[header] == null ? '' : course[header]; }));
      inserted += 1;
      return;
    }
    const existing = values[existingRowNumber - 1];
    const existingCourse = rowToCourse_(headers, existing);
    const merged = headers.map(function(header, columnIndex) {
      const current = existing[columnIndex];
      const incoming = course[header];
      if (shouldPreserveCourseValue_(existingCourse, header, current, incoming)) return current;
      if (header === 'lastSeenAt') return incoming || current;
      return incoming === '' || incoming == null ? current : incoming;
    });
    const changed = headers.some(function(header, columnIndex) {
      return ['firstSeenAt', 'lastSeenAt', 'lastUpdatedAt'].indexOf(header) === -1 && !sameSheetValue_(existing[columnIndex], merged[columnIndex]);
    });
    const updatedAtIndex = headers.indexOf('lastUpdatedAt');
    if (updatedAtIndex !== -1 && !changed) merged[updatedAtIndex] = existing[updatedAtIndex] || course.lastUpdatedAt;
    sheet.getRange(existingRowNumber, 1, 1, headers.length).setValues([merged]);
    updated += 1;
  });
  if (newRows.length) sheet.getRange(sheet.getLastRow() + 1, 1, newRows.length, headers.length).setValues(newRows);
  return { inserted: inserted, updated: updated };
}

function shouldPreserveCourseValue_(existingCourse, header, current, incoming) {
  if (current === '') return false;
  if (header === 'firstSeenAt') return true;
  return isPlaceholderCourseValue_(incoming);
}

function rowToCourse_(headers, row) {
  return headers.reduce(function(course, header, index) {
    course[header] = row[index];
    return course;
  }, {});
}

// 自動來源未提供欄位時，不覆寫既有資料。
function isPlaceholderCourseValue_(value) {
  const text = String(value == null ? '' : value).trim();
  return !text || text === '未提供' || text === '待確認' || text === '請查原公告' || text.indexOf('（推定）') !== -1 || text.indexOf('尚未取得') !== -1;
}

function sameSheetValue_(a, b) {
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  return String(a == null ? '' : a) === String(b == null ? '' : b);
}

function refreshAllSources_() {
  setupProject_();
  const spreadsheet = getSpreadsheet_();
  const sources = getRowsAsObjects_(spreadsheet.getSheetByName(SHEETS.SOURCES))
    .filter(function(source) { return bool_(source.enabled); })
    .sort(function(a, b) { return number_(a.priority, 99) - number_(b.priority, 99); });
  const summary = { startedAt: iso_(now_()), sources: [], inserted: 0, updated: 0, errors: 0 };
  sources.forEach(function(source) {
    if (String(source.type) === 'manual') {
      summary.sources.push({ sourceId: source.sourceId, ok: true, manual: true, fetched: 0 });
      return;
    }
    try {
      const rawCourses = fetchSource_(source);
      const courses = rawCourses.map(function(raw) { return normalizeCourse_(raw, source); });
      const result = upsertCourses_(courses);
      setSourceHealth_(source.sourceId, true, '');
      summary.inserted += result.inserted;
      summary.updated += result.updated;
      summary.sources.push({ sourceId: source.sourceId, ok: true, fetched: courses.length });
    } catch (error) {
      setSourceHealth_(source.sourceId, false, error && error.message ? error.message : error);
      summary.errors += 1;
      summary.sources.push({ sourceId: source.sourceId, ok: false, error: String(error && error.message ? error.message : error) });
    }
  });
  SpreadsheetApp.flush();
  summary.finishedAt = iso_(now_());
  return summary;
}
