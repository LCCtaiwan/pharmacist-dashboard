# SPEC

## Goal

建立可持續維護的台灣藥師稀有學分課程儀表板，由 GitHub Actions 執行定時資料更新，GitHub Pages 提供儀表板，GAS 僅作為可選的 Google Sheet 同步橋接。

## Inputs

- 公開課程頁面或 RSS。
- GitHub Actions 產生的 `web/data/courses.json` 與 `web/data/feed.xml`。
- Google Sheet 的 `Courses_All`、年月分頁、`Sources_Actions` 與 `RunHistory`（啟用同步橋接時）。

## Outputs

- GAS Web App 儀表板與公開唯讀 JSON／JSONP API，以及由已收集課程產生的 RSS。
- 可篩選、可排序、響應式課程儀表板。
- 來源健康狀態與最後更新時間。

## Functional Requirements

1. 課程資料欄位：課名、類別、主題、積分、積分狀態、線上／實體、地區、日期時間、報名截止、費用、總名額、剩餘名額、報名狀態、積分審查狀態、稀有狀態、主辦單位、來源、最後更新時間。
2. 稀有狀態分為：稀有學分、一般課程。
3. 稀有學分狀態由關鍵字自動分類，未提供的積分或課程欄位顯示為未提供。
4. GitHub Actions 可手動或每 6 小時執行公開來源採集，且不設人工審核門檻。
5. GitHub Pages 直接讀取版本化 JSON；Google Sheet 同步是單向 Actions → GAS → Sheet。
6. 抓取失敗不得刪除既有課程；應寫入來源健康狀態。

## Out Of Scope

- 個人學分、學分類別缺口、換照期限與倒數。
- 自動替使用者報名。
- Email、LINE 或其他訊息通知。
- 保證所有公開來源皆可穩定自動抓取。
- 以關鍵字推定取代官方積分採認。

## Acceptance Criteria

- GitHub Pages 可直接顯示儀表板；前端讀取版本化 JSON。
- 開發用前端在 Actions 尚未產生資料時以範例資料操作。
- `web/data/feed.xml` 回傳 RSS 2.0。
- GitHub Actions 可持續定時更新，且儀表板顯示最後更新時間。
- 自動抓取來源失敗時保留舊資料並顯示錯誤。
- GitHub Actions 產生的 JSON／RSS 可由 GitHub Pages 直接讀取。
- GitHub Pages workflow 可將 `web/` 發布為公開儀表板。
- 啟用同步橋接時，Sheet 自動建立 `YYYY-MM` 分頁並保留歷史年月。
- 文件涵蓋部署、來源更新與日常維護。
