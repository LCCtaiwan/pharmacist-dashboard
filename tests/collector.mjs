import assert from 'node:assert/strict';
import { buildFeed, classifyRare, parseRss, parseTaiwanPharmacyHtml } from '../scripts/collect-public-courses.mjs';

const source = { sourceId: 'test', name: '測試來源', url: 'https://example.test/feed' };
assert.equal(classifyRare('感染管制藥事實務').rareStatus, '稀有學分');
assert.equal(classifyRare('藥事人員繼續教育').rareStatus, '一般課程');

const rss = parseRss('<rss><channel><item><title>醫療倫理與法規</title><link>https://example.test/course</link><pubDate>Tue, 04 Aug 2026 00:00:00 GMT</pubDate><description>繼續教育</description></item></channel></rss>', source);
assert.equal(rss.length, 1);
assert.equal(rss[0].rareStatus, '稀有學分');

const html = parseTaiwanPharmacyHtml('<table><tr><td>115/08/09 10:00 ~115/08/09 12:00</td><td>測試公會</td><td>感染管制藥事實務</td><td>通過</td></tr></table>', { sourceId: 'taiwan', name: '台灣藥學會', url: 'https://www.pharm.org.tw/score/applyList.asp' });
assert.equal(html.length, 1);
assert.equal(html[0].rareStatus, '稀有學分');

const feed = buildFeed({ title: '測試', generatedAt: '2026-08-04T00:00:00.000Z', courses: rss });
assert.match(feed, /^<\?xml version="1\.0" encoding="UTF-8"\?><rss version="2\.0">/);
assert.match(feed, /<item>/);
console.log('collector: ok (classification, RSS, HTML, feed)');
