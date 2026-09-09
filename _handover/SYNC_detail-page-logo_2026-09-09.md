# SYNC：詳情頁公司 Logo 顯示

日期：2026-09-09

## 改動檔案

- `api/company-detail.js`
  - Supabase `companies` SELECT 新增 `logo_url`。
  - API 回傳物件新增 `logo_url: textOrBlank(company.logo_url)`，空值正規化為空字串。
- `public/index.html`
  - 僅於 `renderDetail()` 的方案詳情 header 加入共用 `window.renderCompanyAvatar(item.c, item.logo)`。
  - 以 48px 外框加上 1.2 倍等比呈現既有 40px avatar，保留共用 helper 不變。
- `public/manufacturing.html`
  - `getCompanyDetailTabHtml()` 改用 `window.renderCompanyAvatar(companyName, company.logo_url)`。
  - 移除舊有 `getCompanyAvatarColor()`、其六組 hard-coded hex 色票與未再使用的 `.company-profile-avatar` CSS。

沒有修改 `api/solutions.js`、`public/company-avatar.js` 或 `public/diagnosis.html`。

## 一致性設計

三個畫面都交由 PR #148 的單一 `renderCompanyAvatar(companyName, logoUrl)` 實作：
1. 搜尋結果卡片（PR #148）。
2. 首頁方案詳情 header（本 PR）。
3. 製造業方案探索的公司介紹分頁（本 PR）。

無 logo 時，名稱首字與色票皆由同一 helper 依公司名稱穩定計算；有有效 HTTP/HTTPS logo URL 時則使用同一個圓形圖片與 `onerror` fallback。

## 驗證

- `api/company-detail.js`：移除既有 ESM import/export 包裝後，以 Node `new Function` 解析，通過。
- `getCompanyDetailTabHtml()`：擷取完整函式後以 Node `new Function` 解析，通過。
- `company-avatar.js` VM 測試通過：
  - 同一公司無 logo 連續兩次輸出完全一致。
  - 無 logo 時輸出首字 avatar。
  - 有 `https://` logo URL 時輸出 `img`。
- 全分支靜態搜尋：對本 branch 的 21 個 `api/`、`public/` HTML/JS 檔搜尋 `getCompanyAvatarColor`，結果為 `[]`，無殘留定義或呼叫。
- Vercel Preview：Ready
  https://solution-finder-jj66ip9js-patrick0814-6136s-projects.vercel.app/

### 真實畫面驗證狀態

Preview 已實際開啟，但停在既有「內部系統登入」密碼頁。為遵守 API authentication Phase 1，未讀取、推測或繞過共用密碼、session 或資料庫內容。因此以下需要真實資料的驗收，待具備既有授權的使用者登入 Preview 後完成：

- [ ] 有 logo 公司：首頁詳情 header 圖片。
- [ ] 無 logo 公司：首頁詳情 header 首字 fallback。
- [ ] 製造業「公司介紹」的 logo／首字 fallback。
- [ ] 同一無 logo 公司在搜尋卡片、首頁詳情、公司介紹三處的三張並列截圖。

## 驗收清單

- [x] `/api/company-detail` 回傳 `logo_url`，缺值回傳空字串。
- [x] `renderDetail()` 使用 `item.logo` 顯示共用 avatar，視覺容器為 48px。
- [x] 製造業公司介紹使用 `company.logo_url` 與共用 avatar。
- [x] 舊 hex 色票 helper、其 CSS 和所有全站呼叫已移除。
- [x] 只修改規格指定的三個功能檔；交接紀錄為額外文件。
- [ ] 需授權登入 Preview 後的三處真實資料截圖驗收。

## Git

- 相依基底：`feat/company-logo-display-2026-09-09`（PR #148，尚未合併，提供共用 avatar helper 與 Solutions API `logo` 欄位）。
- Branch：`feat/detail-page-logo-2026-09-09`
- 實作 commit：`cbfe2957ff199530c357cfcd0ba4e5a54174eee3`
- PR： https://github.com/Pcc329/solution-finder/pull/149

本 PR 為一般 PR（非 Draft），並刻意以 PR #148 的 branch 為 base，避免重複引入共享 helper。PR #148 合併後，可將本 PR retarget 至 `main`。
