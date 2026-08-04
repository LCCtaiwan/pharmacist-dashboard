# PROGRESS

- Change ID: C-010
- Date: 2026-08-04
- Scope: GitHub Actions 自動採集與 GitHub Pages 部署
- Status: 已建立每 6 小時／手動執行的採集工作流與 Pages 部署工作流；C-010 已推送到 `LCCtaiwan/pharmacist-dashboard` 的 `main`
- Verification: `node scripts/sync-gas-dashboard.mjs`、`node tests/validate.mjs`、`node tests/gas-behavior.mjs`、`node tests/collector.mjs`、`git diff --check` 全部通過。

## In Progress

- GitHub Actions 首次資料產生尚待確認；目前 `web/data/courses.json` 尚未出現在遠端，可能需要在 Actions 頁面手動執行或啟用 Actions。
- GitHub Pages 需要在 Settings → Pages 選擇 GitHub Actions；部署 workflow 已隨 C-010 推送。

## Next Step

- 執行一次 `Collect pharmacist courses`；再以 GitHub Pages 檢查真實 JSON 是否成功載入。

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
