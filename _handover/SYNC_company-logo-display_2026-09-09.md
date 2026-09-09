# SYNC: 公司 Logo 顯示

日期：2026-09-09

## 改動檔案

- `api/solutions.js`
  - Supabase companies SELECT 加入 `logo_url`。
  - Supabase 與 Airtable 的 company lookup 都保存 `logo_url: ... || ''`。
  - 兩條 Solutions 回傳路徑都新增精簡欄位 `logo: co.logo_url || ''`。
- `public/company-avatar.js`（新增）
  - 唯一的 `renderCompanyAvatar(companyName, logoUrl)` 實作。
- `public/index.html`
  - 載入共用 helper，並於結果卡片公司區加入 40px avatar。
- `public/manufacturing.html`
  - 載入共用 helper，並於結果卡片公司區加入 40px avatar。

`public/diagnosis.html` 未修改；本次沒有寫入 Supabase 或 Airtable。

## Avatar 邏輯

- 有有效的 HTTP/HTTPS `logo_url` 時輸出 40px 圓形 `img`。
- 空值或非 HTTP/HTTPS URL 時直接輸出公司名稱第一個字元，不嘗試圖片載入。
- 色彩由公司名稱每個字元的 `charCodeAt` 加總後取六組固定 Tailwind 色票的模數，故同一名稱的顏色穩定。
- 圖片 `onerror` 呼叫 `replaceCompanyAvatar`，以同一個首字 avatar 取代破圖，不顯示替代圖提示。

## 驗證

- 遠端 diff 僅含四個功能檔：`api/solutions.js`、`public/company-avatar.js`、`public/index.html`、`public/manufacturing.html`。
- 靜態檢查：
  - `api/solutions.js`：以遠端分支原始碼剔除 ESM import/export 後交由 Node parser 驗證，通過。
  - `company-avatar.js`：Node VM 測試通過：
    - 無 logo：紅樹智慧平台股份有限公司輸出首字「紅」。
    - 同公司兩次輸出：背景色 class 一致。
    - 有 logo：奕奇數位科技股份有限公司輸出 `img` 與 `onerror`。
    - 模擬圖片載入錯誤：會輸出圓形首字 avatar。
- Vercel Preview：Ready
  - https://solution-finder-git-feat-comp-6b8802-patrick0814-6136s-projects.vercel.app
- 真實方案卡片的有-logo／無-logo截圖與 API JSON 抽查待 PPC 以既有內部共用密碼登入 Preview 後執行。這是為遵守 API authentication Phase 1 的存取限制；本次未讀取、未寫入或繞過 `SITE_PASSWORD`、session、Supabase 或 Airtable 資料。

## 驗收狀態

- [x] API 的 Airtable 與 Supabase 路徑均新增 `logo`，空值正規化為空字串。
- [x] 共用 avatar helper，不在兩頁複製邏輯。
- [x] 40px 圓形 logo／首字 fallback、穩定色彩、圖片錯誤 fallback。
- [x] `diagnosis.html` 未觸碰；資料庫未寫入。
- [ ] 需登入 Preview 後的真實資料畫面驗證與截圖。

## Git

- Branch：`feat/company-logo-display-2026-09-09`
- 實作 commit：`8c78d3068f26faa894072ead209b12be79e2b2db feat: display company logos on solution cards`
- PR：https://github.com/Pcc329/solution-finder/pull/148
