# 操作與維護手冊

## 一、建立 GAS 後端

1. 建立一份新的 Google Sheet，例如「藥師稀有學分資料庫」。
2. 在試算表選「擴充功能 → Apps Script」。
3. 將 `gas/` 內的 `.gs` 檔案加入專案；如需使用專案資訊清單，再開啟「顯示 appsscript.json」並貼上 `gas/appsscript.json`。
4. 回到試算表重新整理，等待「稀有學分儀表板」選單出現；若尚未出現，再重新整理一次。
5. 從該選單執行「初始化／修復工作表」並完成 Google 授權。系統會建立：`Courses`、`Sources`、`Settings`，並保存此試算表位置供背景排程與 Web App 使用。

系統只蒐集與顯示課程，不會寄送 Email。

## 二、啟用持續更新

1. 從試算表選單執行「立即更新公開來源」，確認 `Courses` 與 `Sources` 有更新。
2. 執行「安裝自動更新排程」。預設每 6 小時更新一次；重複執行會先移除舊排程，再建立一個新排程。
3. 日後仍可隨時使用「立即更新公開來源」手動更新。

## 三、部署 GAS Web App

1. Apps Script 右上角選「部署 → 新部署 → 網頁應用程式」。
2. 執行身分選「我」。
3. 首次驗收可先選「只有我自己」；確認資料與畫面正常後，若要讓外部訪客使用，再建立新版本並將存取權限改為「任何人」。若組織政策禁止匿名存取，儀表板將只允許組織內或已登入的使用者開啟。
4. 部署後複製以 `/exec` 結尾的網址。
5. 瀏覽該網址，確認可看到儀表板、課程表格與來源狀態。
6. 在網址後加上 `?format=json`，確認可看到含 `schemaVersion`、`courses`、`sources` 的 JSON；加上 `?format=rss` 可檢查 RSS 2.0。RSS 部署需選「所有人」，否則外部 RSS 閱讀器無法讀取。

GAS 儀表板透過 `google.script.run` 讀取資料；API 仍支援 JSON、JSONP 與 RSS，供外部唯讀整合使用。RSS 是從 `Courses` 工作表目前已收集的課程產生，不代表已能自動抓到台灣藥學會全部新課程。

## 四、同步儀表板並保存至 GitHub

1. 若有修改 `web/index.html`、`web/styles.css` 或 `web/app.js`，先執行 `node scripts/sync-gas-dashboard.mjs`。
2. 將更新後的 `gas/Dashboard.html`、`gas/Styles.html`、`gas/Client.html` 貼回 Apps Script 專案並建立新部署版本。
3. 確認 GAS `/exec` 畫面與資料更新正常。
4. 建立 GitHub 儲存庫並將整個專案推送到 `main`，保存原始碼與版本紀錄。

`web/` 保留為畫面開發來源與本機預覽；未連接 GAS 時會讀取 `demo-data.json`，但正式服務只使用 GAS Web App。

## 五、自動彙整與分類

- 課程每次匯入都會依課名與內容關鍵字自動標示「稀有學分」或「一般課程」。
- 來源未提供的積分、費用、名額與截止日會顯示為「未提供」，不填入推測值。
- 這裡沒有人工審核或核准步驟；`sourceUrl` 仍保留原公告連結，使用者可直接點回來源確認報名資訊與正式採認條件。
- 「稀有學分」是搜尋優先標籤，不等同於中央主管機關的正式採認結果。

### GitHub Actions 自動更新

1. 將專案放入 GitHub 後，在 Actions 執行 `Collect pharmacist courses`，可用 `Run workflow` 立即更新。
2. 工作流預設每 6 小時執行，先測試採集器，再抓公開頁面／RSS。
3. 結果寫入 `web/data/courses.json` 與 `web/data/feed.xml`，並由 GitHub Actions bot 自動提交。
4. GitHub Pages 前端讀取 `data/courses.json`；若尚未有檔案，會退回範例資料，之後下一次工作流自動換成真實資料。
5. `Deploy pharmacist dashboard` 會把 `web/` 發布到 GitHub Pages；第一次啟用時，在儲存庫 Settings → Pages 將來源交給 GitHub Actions。

## 六、來源故障與復原

- `Sources.lastError` 有內容：代表最近一次自動擷取失敗。
- 擷取失敗不會刪除 `Courses` 舊資料。
- 如果「台灣藥學會」顯示「未解析到課程列」，通常是網頁版型改變，需更新 `fetchTaiwanPharmacySociety_()`。
- GitHub Actions 對台灣藥學會先用一般請求，403 或空頁時自動啟動 Playwright Chromium；若仍被網站拒絕，該來源記錄錯誤並保留上一版資料，不會阻塞其他來源。
- GAS 仍會對需要登入或未提供可公開介面的來源顯示「未自動匯入」；這表示來源不可由公開工作流取得，不是要求使用者做審核。
- 修正解析器或來源網址後，可在 GitHub Actions 以 `Run workflow` 立即重試。

## 七、資料安全

- 公開 API 不回傳 `Settings`。
- 名稱以 `_` 結尾的初始化、更新與排程管理函式不會暴露給 `google.script.run`；公開 client 只可取得唯讀課程 payload。
- 不要把 Google Sheet ID、登入資訊或 API 金鑰放入 `web/`、`gas/` 或 GitHub。
- GAS Web App 的公開頁面與 JSON API 都應視為公開資料。

## 八、本機驗證

在專案根目錄執行下列命令，不需 Google 帳號或網路連線：

```bash
node scripts/sync-gas-dashboard.mjs
node tests/validate.mjs
node tests/gas-behavior.mjs
```

第一個命令把 `web/` 畫面同步到 GAS。驗證會確認兩份畫面程式一致；行為測試使用記憶體 mock 驗證工作表初始化與綁定、GAS 儀表板路由、JSON／JSONP、自動分類、定時更新函式，以及抓取失敗不刪除既有課程。GitHub Actions 採集器可另執行 `node tests/collector.mjs`。
