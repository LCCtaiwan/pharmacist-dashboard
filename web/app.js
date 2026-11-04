(function () {
  'use strict';

  const config = window.APP_CONFIG || {};
  const state = { payload: null, courses: [], demo: false };
  const elements = {};

  document.addEventListener('DOMContentLoaded', init);

  async function init() {
    cacheElements();
    bindEvents();
    try {
      const payload = await loadPayload();
      validatePayload(payload);
      state.payload = payload;
      state.courses = Array.isArray(payload.courses) ? payload.courses.map(normalizeCourseForDisplay) : [];
      renderHeader();
      populateFilters();
      renderMetrics();
      renderCourses();
      renderSources();
    } catch (error) {
      elements.dataStatus.textContent = '載入失敗';
      elements.lastUpdated.textContent = error.message || String(error);
      elements.emptyState.hidden = false;
      elements.emptyState.querySelector('strong').textContent = '資料暫時無法載入';
    }
  }

  function cacheElements() {
    [
      'page-title', 'data-status', 'last-updated', 'rare-definition', 'data-warning',
      'metric-confirmed', 'metric-candidate', 'metric-deadline', 'metric-limited',
      'search-input', 'rare-filter', 'category-filter', 'mode-filter', 'region-filter',
      'upcoming-only', 'reset-filters', 'course-grid', 'empty-state', 'result-count', 'source-rows'
    ].forEach((id) => { elements[toCamel(id)] = document.getElementById(id); });
  }

  function bindEvents() {
    ['searchInput', 'rareFilter', 'categoryFilter', 'modeFilter', 'regionFilter', 'upcomingOnly']
      .forEach((key) => elements[key].addEventListener(key === 'searchInput' ? 'input' : 'change', renderCourses));
    elements.resetFilters.addEventListener('click', () => {
      elements.searchInput.value = '';
      elements.rareFilter.value = config.defaultRareStatus || '';
      elements.categoryFilter.value = '';
      elements.modeFilter.value = '';
      elements.regionFilter.value = '';
      elements.upcomingOnly.checked = false;
      renderCourses();
    });
  }

  async function loadPayload() {
    if (config.dataMode === 'gas' && window.google && window.google.script && window.google.script.run) {
      return loadFromGas();
    }
    if (!config.apiUrl) return loadDemo();
    try {
      const separator = config.apiUrl.includes('?') ? '&' : '?';
      return await fetchJson(config.apiUrl + separator + '_=' + Date.now());
    } catch (fetchError) {
      if (!/^https?:\/\//i.test(config.apiUrl)) {
        return loadDemo();
      }
      try {
        return await loadJsonp(config.apiUrl);
      } catch (_) {
        return loadDemo();
      }
    }
  }

  function loadDemo() {
    state.demo = true;
    return fetchJson(config.demoDataUrl || 'demo-data.json');
  }

  function loadFromGas() {
    return new Promise((resolve, reject) => {
      window.google.script.run
        .withSuccessHandler(resolve)
        .withFailureHandler((error) => reject(new Error(error && error.message ? error.message : String(error))))
        .getDashboardData();
    });
  }

  async function fetchJson(url) {
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) throw new Error('HTTP ' + response.status);
    return response.json();
  }

  function loadJsonp(url) {
    return new Promise((resolve, reject) => {
      const callback = '__pharmacistCreditCallback' + Date.now();
      const script = document.createElement('script');
      const separator = url.includes('?') ? '&' : '?';
      const timer = setTimeout(() => cleanup(new Error('GAS API 回應逾時')), 12000);
      window[callback] = (data) => cleanup(null, data);
      script.onerror = () => cleanup(new Error('GAS API 無法載入'));
      script.src = url + separator + 'callback=' + callback + '&_=' + Date.now();
      document.head.appendChild(script);
      function cleanup(error, data) {
        clearTimeout(timer);
        delete window[callback];
        script.remove();
        error ? reject(error) : resolve(data);
      }
    });
  }

  function validatePayload(payload) {
    if (!payload || payload.schemaVersion !== 1 || !Array.isArray(payload.courses)) {
      throw new Error('資料格式不相容');
    }
  }

  function renderHeader() {
    document.title = state.payload.title || document.title;
    elements.pageTitle.textContent = state.payload.title || '稀有學分課程儀表板';
    elements.rareDefinition.textContent = state.payload.rareDefinition || '專業品質、專業倫理、專業相關法規、感染管制、性別議題';
    elements.dataStatus.textContent = state.demo ? '範例資料（非實際課程）' : '公開資料快照';
    const generated = parseDate(state.payload.generatedAt);
    const stale = !generated || Date.now() - generated.getTime() > 48 * 3600000;
    const legacy = state.courses.some((course) => !course.dataQuality);
    elements.dataWarning.hidden = !state.demo && !stale && !legacy;
    elements.dataWarning.textContent = state.demo ? '正式資料未載入，目前顯示範例，請勿據此報名。' : [stale ? '資料已超過 48 小時未更新或更新時間未知。' : '', legacy ? '部分舊資料尚未經新版欄位檢查，日期與積分請查原始公告。' : ''].filter(Boolean).join(' ');
    elements.lastUpdated.textContent = '更新於 ' + formatDateTime(state.payload.generatedAt);
  }

  function populateFilters() {
    fillSelect(elements.rareFilter, unique(state.courses.map((course) => course.rareStatus)));
    fillSelect(elements.categoryFilter, unique(state.courses.map((course) => course.category)));
    fillSelect(elements.modeFilter, unique(state.courses.map((course) => course.deliveryMode)));
    fillSelect(elements.regionFilter, unique(state.courses.map((course) => course.region)));
    elements.rareFilter.value = config.defaultRareStatus || '';
  }

  function fillSelect(select, values) {
    values.filter(Boolean).forEach((value) => {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = value;
      select.appendChild(option);
    });
  }

  function renderMetrics() {
    const now = new Date();
    const active = state.courses.filter((course) => {
      const end = courseEnd(course);
      return end && end >= now;
    });
    elements.metricConfirmed.textContent = active.filter(isRareCourse).length;
    elements.metricCandidate.textContent = state.courses.filter((course) => {
      const end = courseEnd(course);
      return !end || end >= now;
    }).length;
    elements.metricDeadline.textContent = active.filter(isClosingSoon).length;
    elements.metricLimited.textContent = active.filter(isLimited).length;
  }

  function renderCourses() {
    if (!state.payload) return;
    const query = elements.searchInput.value.trim().toLowerCase();
    const now = new Date();
    const filtered = state.courses.filter((course) => {
      const haystack = [course.title, course.organizer, course.region, course.category, course.topicTag].join(' ').toLowerCase();
      if (query && !haystack.includes(query)) return false;
      if (elements.rareFilter.value && course.rareStatus !== elements.rareFilter.value) return false;
      if (elements.categoryFilter.value && course.category !== elements.categoryFilter.value) return false;
      if (elements.modeFilter.value && course.deliveryMode !== elements.modeFilter.value) return false;
      if (elements.regionFilter.value && course.region !== elements.regionFilter.value) return false;
      const end = courseEnd(course);
      if (elements.upcomingOnly.checked && (!end || end < now)) return false;
      return true;
    }).sort((a, b) => sortDate(courseStart(a)) - sortDate(courseStart(b)));
    elements.courseGrid.innerHTML = filtered.map(courseCard).join('');
    elements.resultCount.textContent = filtered.length + ' 堂';
    elements.emptyState.hidden = filtered.length !== 0;
  }

  function courseCard(course) {
    const start = courseStart(course);
    const end = courseEnd(course);
    const ended = Boolean(end && end < new Date());
    const statusBadge = isRareCourse(course)
      ? '<span class="badge">稀有議題標籤</span>'
      : '<span class="badge">一般課程</span>';
    const urgent = isClosingSoon(course) ? '<span class="badge badge--urgent">即將截止</span>' : '';
    const endedBadge = ended ? '<span class="badge badge--ended">已結束</span>' : '';
    const credit = course.creditPoints == null || course.creditPoints === '' || !Number.isFinite(Number(course.creditPoints)) ? '未確認' : formatNumber(course.creditPoints) + ' 點';
    const deadline = course.registrationDeadline ? formatDateTime(course.registrationDeadline) : '未公告';
    const seats = formatSeats(course);
    const approval = course.creditApprovalStatus || '未確認';
    const quality = course.dataQuality;
    const review = !quality || quality.status !== 'verified';
    const reviewBadge = review ? '<span class="badge badge--candidate">欄位待確認</span>' : '';
    const registrationUrl = safeUrl(course.registrationUrl);
    const registrationAction = registrationUrl ? '<a class="source-link registration-link" href="' + escapeHtml(registrationUrl) + '" target="_blank" rel="noopener noreferrer">前往報名頁</a>' : '';
    const issues = quality && Array.isArray(quality.issues) ? quality.issues : [];
    const qualityNote = issues.length ? '<p class="quality-note">待確認：' + escapeHtml(issues.join('；')) + '</p>' : '';
    const fee = course.fee == null || course.fee === '' ? '未公告' : (Number(course.fee) === 0 ? '免費' : 'NT$ ' + formatNumber(course.fee));
    const url = safeUrl(course.sourceUrl);
    const sourceAction = url
      ? '<a class="source-link" href="' + escapeHtml(url) + '" target="_blank" rel="noopener noreferrer">查看來源</a>'
      : '<span class="source-link source-link--disabled">來源未提供</span>';
    return '<article class="course-card">' +
      '<div class="course-date"><strong>' + escapeHtml(formatFullDate(start)) + '</strong><span>' + escapeHtml(formatWeekday(start)) + '<br>' + escapeHtml(formatTimeRange(course)) + '</span></div>' +
      '<div class="course-main"><div class="badge-row">' + statusBadge + urgent + endedBadge + reviewBadge + '</div><h3>' + escapeHtml(course.title) + '</h3>' +
      '<div class="course-meta"><span>' + escapeHtml('積分類別：' + (course.category || '未確認')) + '</span><span>' + escapeHtml(course.deliveryMode || '未提供') + '</span><span>' + escapeHtml(course.region || '未提供') + '</span></div></div>' +
      '<div class="course-facts"><span>認證狀態 <strong>' + escapeHtml(approval) + '</strong></span><span>積分 <strong>' + escapeHtml(credit) + '</strong></span><span>截止 <strong>' + escapeHtml(deadline) + '</strong></span><span>名額 <strong>' + escapeHtml(seats) + '</strong></span><span>費用 <strong>' + escapeHtml(fee) + '</strong></span><span>地點 <strong>' + escapeHtml(course.venue || '未公告') + '</strong></span><span>報名 <strong>' + escapeHtml(registrationLabel(course)) + '</strong></span></div>' +
      '<div class="course-action">' + registrationAction + sourceAction + '</div>' + qualityNote +
      '<p class="course-note">' + escapeHtml((course.organizer || '主辦單位未提供') + '｜' + (course.sourceName || '來源未提供') + '｜自動彙整｜最後更新 ' + formatDateTime(course.lastUpdatedAt)) + '</p>' + (course.topicTag ? '<p class="course-note">議題標籤（非認證分類）：' + escapeHtml(course.topicTag) + '</p>' : '') + '</article>';
  }

  function renderSources() {
    const sources = Array.isArray(state.payload.sources) ? state.payload.sources : [];
    elements.sourceRows.innerHTML = sources.slice().sort((a, b) => (a.priority || 99) - (b.priority || 99)).map((source) => {
      const label = source.status === 'ok' ? '正常' : source.status === 'partial' ? '部分取得' : source.status === 'error' ? '抓取異常' : source.updateMode === 'manual' ? '未自動匯入' : '等待更新';
      const note = String(source.lastError || source.notes || '—');
      const url = safeUrl(source.url);
      const name = url ? '<a href="' + escapeHtml(url) + '" target="_blank" rel="noopener noreferrer">' + escapeHtml(source.name) + '</a>' : escapeHtml(source.name);
      return '<tr><td data-label="來源">' + name + '</td>' +
        '<td data-label="狀態"><span class="health health--' + escapeHtml(source.status) + '">' + label + '</span></td><td data-label="最近成功">' + escapeHtml(formatDateTime(source.lastSuccessAt)) + '</td><td data-label="備註">' + escapeHtml(note) + (Number.isFinite(source.courseCount) ? '（本次 ' + source.courseCount + ' 筆）' : '') + '</td></tr>';
    }).join('') || '<tr><td colspan="4">尚無來源健康紀錄，不能判定更新是否正常。</td></tr>';
  }

  function normalizeCourseForDisplay(course) {
    return Object.assign({}, course, { rareStatus: isRareCourse(course) ? '稀有學分' : '一般課程' });
  }

  function isRareCourse(course) {
    return ['稀有學分', '已確認', '候選'].includes(String(course && course.rareStatus || ''));
  }

  function isClosingSoon(course) {
    if (!course.registrationDeadline) return false;
    if (!isRegistrationOpen(course)) return false;
    const deadline = parseDate(course.registrationDeadline);
    if (!deadline) return false;
    const diff = deadline.getTime() - Date.now();
    return diff >= 0 && diff <= (Number(config.deadlineDays) || 7) * 86400000;
  }

  function isLimited(course) {
    return isRegistrationOpen(course) && Number.isFinite(Number(course.seatsRemaining)) && Number(course.seatsRemaining) > 0 && Number(course.seatsRemaining) <= (Number(config.limitedSeatsThreshold) || 20);
  }

  function isRegistrationOpen(course) {
    const deadline = parseDate(course.registrationDeadline);
    const end = courseEnd(course);
    if ((deadline && deadline < new Date()) || (end && end < new Date())) return false;
    return /^(開放報名|報名中|開放中|可報名)$/.test(String(course.registrationStatus || ''));
  }
  function registrationLabel(course) {
    const deadline = parseDate(course.registrationDeadline);
    if (deadline && deadline < new Date()) return '已過報名截止日';
    return course.registrationStatus || '未確認，請查來源';
  }
  function parseDate(value) { const date = new Date(value || ''); return isNaN(date.getTime()) ? null : date; }
  function courseStart(course) { return parseDate(course.startAt); }
  function courseEnd(course) {
    const end = parseDate(course.endAt) || courseStart(course);
    if (!end || course.datePrecision !== 'date') return end;
    // Filtering boundary only: a date-only course remains visible throughout its
    // Taiwan calendar day. This is not a claimed session end time.
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(end);
    const part = (type) => parts.find((entry) => entry.type === type).value;
    return parseDate(part('year') + '-' + part('month') + '-' + part('day') + 'T23:59:59.999+08:00');
  }
  function sortDate(date) { return date ? date.getTime() : Number.MAX_SAFE_INTEGER; }
  function formatDateTime(value) { const date = parseDate(value); return date ? new Intl.DateTimeFormat('zh-TW', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Taipei' }).format(date) : '—'; }
  function formatFullDate(date) { return date ? new Intl.DateTimeFormat('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'Asia/Taipei' }).format(date) : '日期待定'; }
  function formatWeekday(date) { return date ? new Intl.DateTimeFormat('zh-TW', { weekday: 'short', timeZone: 'Asia/Taipei' }).format(date) : ''; }
  function formatTimeRange(course) { const start = courseStart(course); const end = courseEnd(course); if (!start) return '時間待定'; if (course.datePrecision === 'date' || course.datePrecision === 'unknown') return (course.endAt && end && formatFullDate(start) !== formatFullDate(end) ? '至 ' + formatFullDate(end) + '｜' : '') + '時間未提供'; const time = (date) => new Intl.DateTimeFormat('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Taipei' }).format(date); return time(start) + (course.endAt && end ? '–' + (formatFullDate(start) !== formatFullDate(end) ? formatFullDate(end) + ' ' : '') + time(end) : ''); }
  function formatSeats(course) { const remaining = course.seatsRemaining; const total = course.seatsTotal; if (remaining == null && total == null) return '未公告'; if (remaining == null) return '總計 ' + total + ' 名'; if (total == null) return '剩 ' + remaining + ' 名'; return remaining + '／' + total + ' 名'; }
  function formatNumber(value) { return new Intl.NumberFormat('zh-TW', { maximumFractionDigits: 1 }).format(Number(value)); }
  function unique(values) { return [...new Set(values)].sort((a, b) => String(a).localeCompare(String(b), 'zh-Hant')); }
  function escapeHtml(value) { return String(value == null ? '' : value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;'); }
  function safeUrl(value) { try { const url = new URL(String(value)); return ['http:', 'https:'].includes(url.protocol) ? url.href : ''; } catch (_) { return ''; } }
  function toCamel(value) { return value.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase()); }
})();
