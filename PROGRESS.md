# PROGRESS

- Change ID: C-013
- Date: 2026-08-04
- Scope: GitHub Actions、GAS 儀表板與 Google Sheet 月份同步
- Status: GAS Web App 第 19 版已修正為回傳並預設顯示全部同步課程；「只顯示尚未結束」改為可選篩選，Google Sheet 設定同步為 0（不截斷歷史課程）；GitHub Actions 自動來源擴充至 8 個公開頁面／RSS。
- Verification: GAS 實機顯示 15 堂課、預設未勾選結束篩選；本機 `node tests/gas-behavior.mjs`、`node tests/validate.mjs`、`node tests/collector.mjs`、`git diff --check` 全部通過。

## In Progress

- 無阻塞項目。台灣藥學會仍可能因網站拒絕自動請求而顯示來源錯誤；其他公開 RSS 來源照常更新。

## Next Step

- 日常可查看 GitHub Pages 或 GAS 儀表板；若要確認月份資料，可開啟正式試算表的 `Courses_All` 或 `YYYY-MM` 分頁。

## Notes

- 依使用者要求，不含個人學分、缺口與換照倒數。
- 共享 handover 資料庫目前因無法開啟而未採用。
- GitHub Actions 不設人工審核步驟；每次以關鍵字重新分類，缺少欄位顯示「未提供」。
- GAS 對需要登入或未提供公開介面的來源仍顯示「未自動匯入」，避免把未取得資料誤報為正常。
- Sol high 複驗：桌面 1440×1000、手機 390×844、全篩選組合與 console 檢查均通過。
- `/exec` 現在直接顯示 GAS 儀表板；JSON API 改由 `/exec?format=json` 提供。
- GAS 管理與寫入函式均以底線結尾，HTML client 只能呼叫唯讀資料函式。
- Sol high 安全複驗結果 `pass`；正式部署必須建立新版本，避免舊部署保留修正前函式面。
- 正式 Sheet 已透過自訂選單完成初始化與首次公開來源更新；課程清單取得 1 堂桃園市藥師公會課程。
- Email 通知功能已自產品與 GAS 程式移除。
- 正式 Web App 第 5 版修正待覆核摘要；實機確認「待覆核候選 1」與「課程清單 1 堂」一致。
- C-006 正式 Web App 第 8 版只保留課程摘要、篩選、課程清單與來源狀態；定時更新排程已安裝。
- C-006 Sol 最終驗收結果 `pass`。
- C-007 正式驗收結果 `revise`：解析與分頁邏輯通過，但網站拒絕 GAS 網路來源。
- C-008 Sol 建議已採納：台灣藥學會暫列人工覆核，避免排程持續重試已知 403；20 頁上限改為明確錯誤。
- C-009 公開驗收：GAS 第 15 版改用 `ContentService.MimeType.XML`，部署存取設為「所有人」；公開 URL 實測回傳 `application/xml` RSS 2.0，RSS 內容含目前 Courses 課程。
- C-010 本機驗收：GitHub Actions 採集器通過稀有關鍵字分類、RSS 解析、台灣藥學會表格解析與 RSS 輸出測試；前端已改讀 `data/courses.json`，缺檔時退回範例資料。
- C-010 遠端推送：`LCCtaiwan/pharmacist-dashboard` 的 `main` 已包含完整專案、兩個 workflow 與最新進度文件。
- C-010 修正驗收：`page.content()` 改為 await 後，最新 Actions 採集成功；台灣藥學會標記 error 並保留空資料，其他兩個 RSS 正常。
- C-011 正式驗收：GAS 第 16 版部署同步橋接；GitHub Secrets `GAS_SYNC_URL`／`GAS_SYNC_TOKEN` 已設定；Actions Run 6 成功寫入 15 堂課、2026-01～2026-08 月份分頁、`Sources_Actions` 與 `RunHistory`。
- C-012 正式驗收：GAS 第 17 版儀表板優先讀取 `Courses_All`／`Sources_Actions`；同一個 `/exec` 顯示 GAS 即時資料與 Actions 來源狀態。
- C-013 正式驗收：GAS 第 19 版移除 API 的 14 天歷史課程截斷，前端預設顯示全部課程；正式 `/exec` 實測 15 堂課，仍可勾選「只顯示尚未結束」篩選；GitHub Pages 已切換為 GitHub Actions 來源並實測 15 堂課。
- C-013 Sheet 設定：`Settings!B7` 改為 0，`Settings!C7` 註明保留全部歷史課程；GitHub Pages 前端同步改為相同預設行為。
- C-014 來源擴充：新增台灣藥學會消息、臺中／高雄／臺南南瀛藥師公會與臺北榮總公開 HTML 來源；新增通用公開課程連結解析器，自動抽取日期、學分、上課方式與來源連結。
- C-015 日期修正：四位數西元日期優先解析，歷史封存日期不再建立異常年份分頁；最新 Actions Run 11 成功同步 32 堂課、8 個來源。
