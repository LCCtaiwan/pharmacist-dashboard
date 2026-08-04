# Development Log

## Current Goal

完成由 GAS 與 GitHub Actions 執行定時資料更新、並由 GAS Web App／GitHub Pages 提供儀表板的台灣藥師稀有學分課程系統。

## Stack And Run Commands

- Backend: GitHub Actions Node.js 22 採集器；GAS V8 僅作為可選的 Google Sheet 同步橋接。
- Frontend: 原生 HTML、CSS、JavaScript；GAS HtmlService 或 GitHub Pages 靜態網站。
- Local preview: 在專案根目錄以靜態伺服器開啟 `web/`。
- Sync: `node scripts/sync-gas-dashboard.mjs`。
- Collector tests: `node tests/collector.mjs`。

## Brainstorming Summary

- 把 Google Sheet 當作可由非工程人員維護的資料庫。
- GAS 與 GitHub Actions 自動擷取可公開取得的來源；被登入或反爬限制的來源保留錯誤狀態與上一版資料。
- 關鍵字分類直接產生「稀有學分」或「一般課程」，不設人工審核步驟。
- `web/` 保留開發與範例資料預覽；GAS Web App 與 GitHub Pages 都可提供正式儀表板。
- 產品收斂為課程蒐集、來源健康狀態與可持續更新，不提供 Email 通知。

## SDD

### Components

1. `gas/Config.gs`：工作表欄位、預設設定、公開來源與關鍵字。
2. `gas/Setup.gs`：初始化工作表、選單與排程。
3. `gas/Sources.gs`：公開來源擷取、ROC 日期解析與來源健康紀錄。
4. `gas/Courses.gs`：正規化、分類、去重與 upsert。
5. `gas/Api.gs`：GAS HtmlService 儀表板入口、伺服器端資料函式與 JSON／JSONP／RSS 公開唯讀 API。
6. `gas/Dashboard.html`、`Styles.html`、`Client.html`：正式 GAS 儀表板。
7. `web/`：儀表板開發來源與離線範例預覽。
8. `scripts/sync-gas-dashboard.mjs`：同步正式 GAS 儀表板檔案。
9. `scripts/collect-public-courses.mjs`：GitHub Actions 公開來源採集、分類與 RSS 產生。
10. `.github/workflows/collect-courses.yml`：定時／手動資料更新。
11. `.github/workflows/deploy-pages.yml`：將 `web/` 發布到 GitHub Pages。

### Data Flow

GAS 排程或 GitHub Actions → 擷取來源 → 正規化／關鍵字分類 → 以 courseId 去重 → GAS 寫入 Courses 或 Actions 寫入 `web/data/courses.json`／`feed.xml` → 儀表板呈現。

### Safety Rules

- 擷取失敗不刪除既有資料。
- 缺少欄位保留「未提供」，不填入推測值。
- API 僅回傳白名單欄位，不回傳 Settings。

## Completed Work

- C-010：新增 GitHub Actions 採集器與 workflow，輸出 `web/data/courses.json`／`web/data/feed.xml`；台灣藥學會加入 Chromium fallback，來源失敗時保留上一版資料。
- C-010：前端改讀 GitHub Pages 靜態 JSON，缺檔時退回 demo；自動分類介面移除候選／人工審核語意。
- C-010：新增採集器測試；同步、GAS 行為、資料契約與 diff 檢查全部通過。

- C-011：新增 `gas/SheetSync.gs` 與 `scripts/sync-sheet.mjs`，以 GitHub Actions payload 單向同步至 `Courses_All`、來源／執行紀錄與 `YYYY-MM` 月份分頁。
- C-011：Apps Script 專案已部署第 16 版；以 GitHub Secrets 保存 Web App URL／同步 Token，Actions Run 6 實測 15 堂課同步成功並建立 2026-01～2026-08 分頁。

- C-009：新增 GAS `/exec?format=rss` 內部 RSS 輸出；以 XML escape 保護課程文字，並加入 RSS 行為測試。此輸出只反映目前 `Courses` 工作表，不繞過台灣藥學會 HTTP 403。
- C-009 驗證補記：本機 XML／MIME／escape 測試通過；GAS 第 15 版改用 `ContentService.MimeType.XML` 並設為「所有人」，公開 URL 實測回傳 RSS 2.0 XML，RSS reader 可讀取。

- C-001：確認使用者最終範圍為 GAS 後端＋GitHub Pages 前端，排除個人學分與換照功能。
- C-001：完成法規核心分類查核與系統資料模型初稿。
- C-002：部署前審查並修正通知篩選、重複寄送競態、人工來源健康狀態、人工覆核欄位保護、無前景執行的試算表定位，以及前端日期／名額呈現。
- C-003：依 Sol revise 補強人工覆核資料所有權、範例來源更新方式、SVG favicon 與可離線執行的 GAS 行為 mock 測試。
- C-003：Sol high 複驗結果 `pass`；桌面 1440×1000、手機 390×844 無水平溢出，搜尋、稀有狀態、類別、方式、地區、已結束切換與清除篩選均通過。
- C-004：將 `/exec` 改為 GAS HtmlService 儀表板，以 `google.script.run` 讀取資料，另保留 `?format=json`／JSONP API。
- C-004：新增 `web/` → `gas/` 同步工具與一致性驗證，移除 GitHub Pages runtime，確立 GAS 執行、GitHub 保存原始碼的部署方式。
- C-004：依 Sol 安全驗收，將管理／寫入函式改為 GAS 私有命名，僅保留唯讀 client 資料函式，並新增公開函式允許清單測試。
- C-005：正式部署發現 `createHtmlOutputFromFile()` 不接受純 CSS／JavaScript 文字；同步工具改產生合法 `<style>`／`<script>` HTML 片段。
- C-005：私密 Web App 修正版載入成功，綁定 Sheet 完成初始化與首次來源更新；桃園 RSS 寫入 1 堂課，來源錯誤與人工覆核狀態皆保留。
- C-005：實機驗收發現上方摘要漏算 `待確認` 或缺少完整結束時間的課程；修正為全體「候選＋待確認」合計，避免清單已有課程但摘要為 0。
- C-006：依使用者最新決定，產品只保留課程蒐集、稀有學分候選儀表板、來源健康狀態與持續更新；移除 Email 通知流程與前端通知說明。
- C-006：定時更新後共取得 3 筆待覆核資料，其中 1 堂尚未結束；摘要改用與預設清單相同的日期條件，避免顯示 3 但清單只有 1。
- C-006：正式 Web App 第 8 版驗收通過；標題為「台灣藥師稀有學分課程儀表板」，通知規則區塊不存在，來源狀態正常載入。
- C-006：Apps Script 觸發條件頁確認存在 1 個 `refreshAllSources_` 根據時間觸發條件，持續更新已啟用。
- C-006：Sol 複驗結果 `pass`；程式、文件、公開函式允許清單與簡化產品範圍一致。
- C-007：台灣藥學會頁面可由一般公開網頁讀取，表格使用 `sub=1`、`sub=2` 分頁；GAS 改為 Session／Cookie／標頭／逐頁抓取，但正式第 10 版仍收到 HTTP 403。
- C-007：Google Sheet `IMPORTHTML` 原生替代方案測試回傳 `#REF!`，已清除測試公式，未污染部署說明資料。

## Verification Status

- 法規來源：全國法規資料庫，修正日期民國 111 年 8 月 26 日。
- 程式與 UI：2026-08-03 以 Node 語法檢查 `web/app.js` 與全部 GAS 檔案（以 JavaScript 輸入方式）通過；`web/demo-data.json` JSON 結構檢查通過。
- 行為測試：`node tests/gas-behavior.mjs` 通過初始化／Sheet 綁定、人工覆核欄位保護、JSON／JSONP callback、定時更新函式與抓取失敗保留舊課程。
- Sol UI 驗收：桌面與手機版均通過，console 0 errors／0 warnings。
- C-004 本機驗證：同步檔案一致，GAS HTML／JSON／JSONP 路由、`getDashboardData()`、初始化與來源錯誤保護均通過。
- C-004 Sol high 複驗：`pass`；公開函式僅 `doGet`、`getDashboardData`、`onOpen`，管理與寫入函式均不對 HTML client 暴露。
- C-005 正式部署：HtmlService 片段修正後的私密 Web App 可載入，`google.script.run` 顯示即時資料與 1 堂課；首次來源更新完成。台灣藥學會回傳 HTTP 403，桃園與青藥 RSS 正常，其餘手動來源維持人工覆核。
- C-005 正式摘要複驗：Web App 第 5 版顯示「待覆核候選 1」與「課程清單 1 堂」，修正版實機通過。
- C-005 API：本機行為測試覆蓋 JSON／JSONP；正式環境 `?format=json` 因瀏覽器端攔截未完成直接導覽驗收，不影響 GAS 儀表板即時資料載入。
- C-006 本機驗證：同步檔案一致，GAS 初始化、公開唯讀路由、scheduled refresh 與來源失敗資料保留測試通過。
- 尚待：Sol 最終驗收；確認 GitHub 儲存庫名稱與可見性後推送。
- C-007 尚待：網站端提供 RSS／API、允許 Google UrlFetch IP，或使用者核准外部抓取層；在此之前台灣藥學會維持人工覆核狀態。
- C-009 已完成：公開 RSS 可供訂閱；內容仍只反映 `Courses` 工作表已收集資料。
- C-010 已完成：採集器與兩個 workflow 已建立；本機驗證通過，並已推送至 `LCCtaiwan/pharmacist-dashboard` 的 `main`；遠端 Actions 首次資料產生尚待確認。
- C-010 handover：共享 handover SQLite 因資料庫路徑無法開啟，寫入失敗；本地 `PROGRESS.md`／`CHANGELOG.md`／本檔已保存 checkpoint。
- C-010 遠端驗證：修正 `await page.content()` 後，Actions 成功產生 15 堂課與 RSS；台灣藥學會仍回報未解析到課程列，桃園／青藥 RSS 正常。
- C-011：新增 Actions → GAS → Google Sheet 單向同步；依課程年月自動建立 `Courses_All` 與 `YYYY-MM` 分頁，並記錄來源狀態與每次執行歷史。
- C-011 遠端驗證：Run 6 workflow conclusion `success`；同步步驟輸出 `sheet sync: ok (15 courses, 2026-01, 2026-02, 2026-03, 2026-04, 2026-05, 2026-06, 2026-07, 2026-08)`。
- C-012：`Api.gs` 改為優先讀取 `Courses_All`／`Sources_Actions`，讓 GAS 儀表板與 Actions 採集結果共用同一份資料。
- C-012 驗證：GAS Web App 第 17 版實機顯示「GAS 即時資料」，來源狀態列出 Actions 的 3 個來源；本機行為測試新增 Actions 資料優先讀取案例並通過。
