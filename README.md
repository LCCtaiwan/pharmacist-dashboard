# 台灣藥師稀有學分課程儀表板

以 Google Apps Script（GAS）與 GitHub Actions 定時蒐集公開課程來源，並提供行動裝置友善的查詢儀表板。GAS 版本維護 Google Sheet；GitHub Pages 版本直接讀取 Actions 產生的 JSON，兩者都使用相同的自動關鍵字分類。

## 專案範圍

- 追蹤專業品質、專業倫理、專業相關法規，以及感染管制、性別議題等稀有學分課程。
- 顯示課程類別、積分、上課方式、地區、日期時間、報名截止、費用、名額、來源與最後更新時間。
- 預設每 6 小時更新可自動擷取的公開來源，所有來源與課程都集中顯示在同一份清單。
- GitHub Actions 會輸出 `web/data/courses.json` 與 `web/data/feed.xml`；來源抓取失敗時保留上一版課程，不需要人工審核流程才能更新儀表板。
- 不追蹤個人目前學分、類別缺口、換照期限或倒數。

「稀有學分」是本工具的自動分類標籤，不是法規用語；系統依課名與內容關鍵字彙整相關課程。

## 重要路徑

- `gas/`：可直接部署的 Google Apps Script 工作流與儀表板。
- `web/`：儀表板的開發來源與本機範例預覽。
- `scripts/sync-gas-dashboard.mjs`：把 `web/` 的畫面同步進 `gas/`。
- `scripts/collect-public-courses.mjs`：GitHub Actions 的公開來源採集器與 RSS 產生器。
- `.github/workflows/collect-courses.yml`：每 6 小時或手動執行的自動更新工作流。
- `.github/workflows/deploy-pages.yml`：將 `web/` 自動發布到 GitHub Pages。
- `docs/OPERATIONS.md`：部署、日常維護與故障排除。
- `docs/SOURCES.md`：法規查核與公開來源清單。

## 本機預覽

在專案根目錄啟動任一靜態網站伺服器，瀏覽 `web/`。若 Actions 尚未產生 `web/data/courses.json`，會自動退回 `web/demo-data.json`。

## 上線摘要

1. 建立 Google Sheet，將 `gas/` 內檔案加入綁定的 Apps Script 專案。
2. 回到試算表重新整理，從「稀有學分儀表板」選單執行「初始化／修復工作表」及「安裝自動更新排程」，再部署為 Web App。
3. 開啟 Web App `/exec` 網址即可看到儀表板；`?format=json` 提供唯讀 JSON，`?format=rss` 提供由目前 Courses 工作表產生的 RSS。
4. 將專案放入 GitHub 後，啟用 Actions；工作流會更新 `web/data/`，GitHub Pages 便可直接顯示自動彙整結果。

完整步驟見 `docs/OPERATIONS.md`。
