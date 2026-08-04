# CHANGELOG

## v0.6.0 — 2026-08-04

### C-010 — 2026-08-04

- 新增 GitHub Actions 採集器，預設每 6 小時執行，也可從 Actions 手動啟動。
- 自動抓取台灣藥學會公開審查列表、桃園市藥師公會 RSS、台灣年輕藥師協會 RSS；台灣藥學會遇到 403／空頁時自動嘗試 Chromium。
- 依課名與內容關鍵字自動標示「稀有學分」或「一般課程」，不設人工審核流程；來源失敗時保留上一版資料並記錄錯誤。
- 產生 `web/data/courses.json` 與 `web/data/feed.xml`，GitHub Pages 直接讀 JSON；缺檔時退回範例資料。
- 新增採集器單元測試與 Actions workflow；本機驗證全部通過，並已推送到 `LCCtaiwan/pharmacist-dashboard` 的 `main`。
- 新增 Pages workflow，將 `web/` 發布為 GitHub Pages 儀表板。

## v0.5.0 — 2026-08-03

### C-009 — 2026-08-03

- 在 GAS Web App 新增 `/exec?format=rss`，由目前 `Courses` 工作表產生 RSS 2.0。
- RSS 包含課名、來源連結、課程類別、積分、上課方式、地區、主辦單位、稀有標籤、日期與報名截止等摘要。
- 明確保留台灣藥學會 403 限制：內部 RSS 只輸出已收集資料，不是新的外部抓取器。
- 以 `ContentService.MimeType.XML` 輸出，並將 GAS Web App 存取設為「所有人」，供 RSS 閱讀器訂閱。
- 驗證：`node tests/gas-behavior.mjs`、`node tests/validate.mjs`、`git diff --check`；公開 URL 實測 `application/xml`、RSS 2.0、課程 item 可讀。

## v0.4.1 — 2026-08-03

### C-008 — 2026-08-03

- 台灣藥學會暫列 `manual`，避免排程每 6 小時重試已知 HTTP 403。
- 保留 Session／Cookie／逐頁解析器，並在超過 20 頁時明確報錯，防止靜默截斷。
- 操作手冊補充 403 復原條件與人工覆核處理方式。

## v0.4.0 — 2026-08-03

### C-007 — 2026-08-03

- 台灣藥學會來源改為先建立 Session、帶 Cookie 與瀏覽器標頭，並從 `sub=1` 起逐頁抓取至無新資料。
- 新增跨頁去重與來源頁碼保存，並加入台灣藥學會分頁 mock 測試。
- 正式 GAS 第 10 版實測仍收到 HTTP 403；Google Sheet `IMPORTHTML` 亦回傳 `#REF!`，因此尚未將該來源標記為自動成功。

## v0.3.0 — 2026-08-03

### C-006 — 2026-08-03

- 依使用者決定將產品收斂為「課程蒐集＋稀有學分候選儀表板＋持續更新」。
- 移除 Email 通知、通知紀錄與前端通知規則區塊；公開來源更新不再執行通知流程。
- 保留手動更新與每 6 小時 GAS 定時更新，來源失敗仍保留既有課程並顯示健康狀態。
- 「待覆核候選」摘要與預設課程清單共用尚未結束條件，未知結束時間的課程仍保留。

## v0.2.1 — 2026-08-03

### C-005 — 2026-08-03

- 將 GAS 樣式與瀏覽器程式包成合法的 `<style>`／`<script>` HTML 片段，修正正式 HtmlService 部署的「HTML 內容格式錯誤」。
- 保留單一來源同步流程，並擴充一致性測試以驗證完整 HTML wrapper。
- 修正「待覆核候選」摘要漏算 `待確認` 或未提供完整結束時間的課程，讓摘要與待覆核資料一致。
- 完成私密 GAS Web App 與正式 Sheet 初始化、首次來源更新驗收；通知與自動排程維持關閉。

## v0.2.0 — 2026-08-03

### C-004 — 2026-08-03

- 將儀表板整合至 GAS HtmlService，Web App `/exec` 直接顯示課程畫面。
- 前端在 GAS 環境透過 `google.script.run` 讀取課程資料；`?format=json`／`?action=api` 保留公開唯讀 API。
- 新增同步工具，確保本機 `web/` 與 GAS 的 HTML、CSS、JavaScript 保持一致。
- 移除 GitHub Pages 發布流程；GitHub 改為原始碼與版本保存用途。
- 擴充驗證，涵蓋 GAS HTML 路由、伺服器函式資料讀取及同步檔案一致性。
- 將初始化、來源刷新、通知預覽與排程安裝改為 GAS 私有函式，阻止匿名 HTML client 呼叫管理操作；加入公開函式允許清單測試。

## v0.1.0 — 2026-08-03

### C-003 — 2026-08-03

- 建立可維護的人工覆核保護規則：既有 `rareReason`／`notes` 永遠不由自動來源覆寫；「已確認」與「非稀有」課程的採認欄位亦受保護。
- 補齊範例來源的 `updateMode`，使手動與各自動抓取方式符合公開 API 契約。
- 新增不依賴 Google 的 GAS 行為 mock 測試，涵蓋初始化、Sheet 綁定、upsert、JSON／JSONP、通知 dry-run／去重及抓取失敗資料保留。
- 加入 SVG favicon，避免 GitHub Pages 請求預設 favicon 時出現 404。
- 經 Sol high 複驗通過桌面／手機版面、所有篩選互動與零 console error／warning 驗收。

### C-002 — 2026-08-03

- 修正通知只針對「候選」或「已確認」稀有課程，並略過額滿、取消、截止或停止報名的課程。
- 以 Script Lock 避免重疊觸發造成重複寄信；通知紀錄僅以已成功寄送的項目去重。
- 跳過 `manual` 來源的自動擷取，保留未檢查狀態，避免誤導為抓取成功。
- 保護已人工覆核的欄位、避免無內容來源覆蓋，並只在課程內容改變時更新 `lastUpdatedAt`。
- 前端補足地點、名額總數／剩餘、報名狀態與來源名稱，且可安全處理未知日期與無效網址。
- 修正空白數值被當成 `0` 的問題，未知名額不再被誤判為額滿。
- 保存綁定試算表位置，讓 time-based trigger 與 Web App 的無前景執行環境可穩定讀取資料。
