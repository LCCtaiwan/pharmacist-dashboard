# 台灣藥師稀有學分課程儀表板

以 GitHub Actions 定時蒐集公開課程來源，並由 GitHub Pages 提供行動裝置友善的查詢儀表板。Actions 產生 JSON／RSS，Pages 直接讀取；GAS 只作為可選的 Google Sheet 同步橋接，不負責抓網站。

## 專案範圍

- 追蹤專業品質、專業倫理、專業相關法規，以及感染管制、性別議題等稀有學分課程。
- 顯示課程類別、積分、上課方式、地區、日期時間、報名截止、費用、名額、來源與最後更新時間。
- 預設每 6 小時更新可自動擷取的公開來源，所有來源與課程都集中顯示在同一份清單。
- GitHub Actions 會輸出 `web/data/courses.json` 與 `web/data/feed.xml`；來源抓取失敗時保留上一版課程，不需要人工審核流程才能更新儀表板。
- 不追蹤個人目前學分、類別缺口、換照期限或倒數。

「稀有學分」是本工具的自動分類標籤，不是法規用語；系統依課名與內容關鍵字彙整相關課程。

## 重要路徑

- `gas/`：Sheet 同步橋接與舊版 GAS 備份；不負責目前的網站採集。
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

1. 在 GitHub Actions 執行 `Collect pharmacist courses`。
2. 在 GitHub Settings → Pages 選擇 GitHub Actions。
3. 開啟 GitHub Pages 網址；工作流會更新 `web/data/`，頁面自動顯示最新資料。

若要記錄到 Google Sheet：在 GAS 專案執行「設定 GitHub Sheet 同步」，將顯示的 URL／Token 存成 GitHub Secrets `GAS_SYNC_URL`、`GAS_SYNC_TOKEN`。之後 Actions 會自動寫入 `Courses_All`、年月分頁、`Sources_Actions` 與 `RunHistory`。

完整步驟見 `docs/OPERATIONS.md`。
