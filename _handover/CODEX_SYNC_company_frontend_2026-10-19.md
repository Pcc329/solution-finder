# CODEX SYNC — 首頁雙入口、公司查詢與資料結構圖（PR 3／3）

## Git 與範圍

- Base 分支：`feat/company-search-api`；已 fetch／pull，實際基準 `771a24b32421640bfce28c336d3c3ce58341fe97`，與指定基準相同。
- Branch：`feat/company-frontend`；一般 PR 的 base 使用 `feat/company-search-api`，不 merge、不啟用 auto-merge。
- 僅修改 `public/index.html`、`public/sources.html`、`api/companies.js` 與本 SYNC。未修改其他程式、測試、設定或資料庫。
- 首頁採 B1，插圖內嵌 SVG；未實作批次比對、自動判斷單框、分享網址或資料結構圖的跨頁引導。
- 依附件及 v2.1 範本，使用線上 Preview 即時資料驗收；本文件後續補上真實證據。

## 實作

- `index.html` 新增 companyQuery、companyResult、companyLoading、companyError、showDelisted，並有請求編號與重複送出保護。
- `handleCompanySearch` 獨立處理查詢、API 錯誤與導覽，不修改既有找方案函式；空白不送出，失敗提供對應訊息及必要時的重試。
- `renderCompanySearchForm`／`renderCompanyCandidates`／`renderCompany`：雙入口、候選／查無、公司檔案、來源分組、狀態、已下架切換與既有詳情頁導覽。
- `openCompanySolution` 進入既有詳情頁；公司名稱按鈕可回查公司。
- history state 保存查詢與結果；popstate 還原公司頁／候選頁，也可還原從公司頁進入的方案詳情；載入時清除兩個新 hash。
- 公司頁直接重用既有 ContactInfoCard，統編為 key，兩個既有 cache／pending Map 共用。
- `sources.html` 在三層架構後新增 10 實體、9 關係圖、說明、鍵盤互動與 5 題 FAQ；`initDataStructure` 初始化以 try/catch 隔離。
- `api/companies.js` 僅將 Cache-Control 從 `s-maxage=300` 改為 `private, no-store`。

## 防呆與本機檢查

- JSX 與 sources JavaScript 語法檢查 PASS，沿用頁面原有 Babel 版本於 repo 外暫存檢查，無新增套件或 CDN。
- 與基準 AST 所定位的函式原文比對（僅正規化換行）：handleSearch、handleQuickSearch、handlePopularFilter、openThemeDetail、ContactInfoCard、renderList、renderThemeDetail 全部相同。
- renderDetail 唯一差異為公司名稱連結；其餘原文相同。所有 script／link 標籤及 Babel script 屬性相同。
- API 檔以還原快取字串後與基準全文比對，完全相同。
- 原始根測試：121/140 PASS，19 項固定期待舊快取標頭而失敗；不掩蓋此結果，尚未修改測試檔。
- 其他本機測試與逐項 Preview 結果待補。

## 三、真實 Preview 驗收

待部署、登入後依規格逐項驗證；此時尚未聲稱真實驗收完成。

## 五之二：欄位存在性

- [x] 未新增任何後端查詢欄位。後端 diff 只有上述 Cache-Control 一行；前端僅使用 #260 與既有 solutions 的回傳欄位。

## 五之三：驗證方式

- [ ] 已在真實 Preview 環境驗證。
- [x] 僅完成本機／靜態驗證，尚未真實環境驗證。
