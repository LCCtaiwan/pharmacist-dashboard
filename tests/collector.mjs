import assert from 'node:assert/strict';
import { buildFeed, classifyRare, parseDate, parsePublicCourseHtml, parseRss, parseTaiwanPharmacyHtml } from '../scripts/collect-public-courses.mjs';

const source = { sourceId: 'test', name: '測試來源', url: 'https://example.test/feed' };
assert.equal(classifyRare('感染管制藥事實務').rareStatus, '稀有學分');
assert.equal(classifyRare('藥事人員繼續教育').rareStatus, '一般課程');
assert.match(parseDate('2026/08/20'), /^2026-08-19T16:00:00/);
assert.match(parseDate('115/08/20'), /^2026-08-19T16:00:00/);

const rss = parseRss('<rss><channel><item><title>醫療倫理與法規</title><link>https://example.test/course</link><pubDate>Tue, 04 Aug 2026 00:00:00 GMT</pubDate><description>繼續教育</description></item></channel></rss>', source);
assert.equal(rss.length, 1);
assert.equal(rss[0].rareStatus, '稀有學分');

const html = parseTaiwanPharmacyHtml('<table><tr><td>115/08/09 10:00 ~115/08/09 12:00</td><td>測試公會</td><td>感染管制藥事實務</td><td>通過</td></tr></table>', { sourceId: 'taiwan', name: '台灣藥學會', url: 'https://www.pharm.org.tw/score/applyList.asp' });
assert.equal(html.length, 1);
assert.equal(html[0].rareStatus, '稀有學分');

const publicHtml = parsePublicCourseHtml('<article><p>115/08/20 10:00 實體課程 4學分</p><a href="/course/1">藥師感染管制研習課程</a></article>', { sourceId: 'public', name: '公開公會', url: 'https://example.test/index.html' });
assert.equal(publicHtml.length, 1);
assert.equal(publicHtml[0].sourceUrl, 'https://example.test/course/1');
assert.equal(publicHtml[0].creditPoints, 4);
assert.equal(publicHtml[0].deliveryMode, '實體');

const feed = buildFeed({ title: '測試', generatedAt: '2026-08-04T00:00:00.000Z', courses: rss });
assert.match(feed, /^<\?xml version="1\.0" encoding="UTF-8"\?><rss version="2\.0">/);
assert.match(feed, /<item>/);
console.log('collector: ok (classification, RSS, HTML, feed)');
