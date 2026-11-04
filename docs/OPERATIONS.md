# 操作與維護

正式架構為 GitHub Actions 採集公開課程 → JSON/RSS → GitHub Pages；GAS Web App與Google Sheet共用同一份採集結果，GAS不是另一套正式爬蟲。

## 開發與驗證

1. Node.js 22或以上，執行 `npm ci --ignore-scripts --no-audit --no-fund`。
2. 修改 `web/` 後執行 `node scripts/sync-gas-dashboard.mjs`，更新GAS鏡像。
3. 執行 `npm test` 與 `git diff --check`。
4. 若要預覽實際資料，執行 `node scripts/collect-public-courses.mjs --output-dir outputs/preview-data`。此命令不會呼叫Sheet同步或部署。

## 發布與維護

- `.github/workflows/collect-courses.yml`：每6小時或手動採集、跑測試、同步Sheet並提交JSON/RSS。排程可能延遲，不保證準點。
- `.github/workflows/deploy-pages.yml`：發布 `web/`，跟隨採集成功或相關前端push。Settings → Pages的來源應為GitHub Actions。
- 可選Sheet同步使用既有Secrets `GAS_SYNC_URL`、`GAS_SYNC_TOKEN`。缺少Secrets會略過，不應把Token寫入repo。
- GAS變更需另更新專案檔案與部署版本，不能只改Pages就宣稱GAS已上線。
- GAS更新前備份既有版本；保留現有設定與權限。不要為方便而擴大權限。
- Source狀態 `ok`＝該次限定範圍取得，`partial`＝只取得部分列表／詳情，`error`＝失敗且保留前次資料。不是所有課程都經核定或正在報名。
- 部分來源可能需要新adapter；403、登入、CAPTCHA不會繞過。失敗時以原站查詢，不把來源缺漏當作零課程。

## 資料與歷史

`Courses_All` 是目前快照；月份分頁保留歷史，不自動刪除舊月或異常分頁。請勿把歷史月份表視為即時完整資料。清理歷史資料前應確認範圍並備份。

新欄位與驗證限制、來源涵蓋範圍、TSHP分頁上限、驗收清單見 [QUALITY-UPDATE.md](QUALITY-UPDATE.md)。

公開網站與API只顯示課程資訊，不儲存個人學分或換照期限，也不代報名。請只發布必要結構化資訊與原始公告連結，不鏡像課件或會員內容。
