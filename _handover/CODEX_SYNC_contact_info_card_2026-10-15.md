# 聯絡資訊 B 版實作交接 — 2026-10-15

## 目前狀態

程式已實作並建立一般 PR。已以即時 API 與實際 UI 完成資料、延遲載入、快取、429 重試、空值、鍵盤、響應式及登出後 401 畫面驗證。最後一項使用原頁從未展開過的 Shopass 公司，實際發出一筆 GET 401，並顯示登入已過期，沒有命中成功快取。沒有以 mock 或歷史快取替代線上驗收。**證據界線：HTTP 次數與狀態來自 Vercel Request Logs，未直接擷取 Chrome DevTools Network 面板。**

## Git 與部署

- Repository：Pcc329/solution-finder
- 實際最新 main 基準：`fd4e6d4549d74d2afb957583a8bbd48f31150b26`（與規格基準一致）
- 獨立 branch：`feat/contact-info-card`
- 實作 commit：`5194147bb4f87907a6f1cf2054f16f4349dd80ba`
- 一般 PR：https://github.com/Pcc329/solution-finder/pull/257 （非 Draft，base 為 main）
- Preview：https://solution-finder-ekwzinkq6-patrick0814-6136s-projects.vercel.app/
- Vercel deployment：https://vercel.com/patrick0814-6136s-projects/solution-finder/7wKccz9fauDjzKJSMoRC25iv4y8g
- Vercel 狀態：Ready，Source commit 為 `5194147`。
- 線上驗證時間：2026-10-15 12:12–12:13（未登入／限流）、12:44–12:54（登入後資料與 UI）、13:06:25.340（登出後首次展開 GET 401），Asia/Taipei（UTC+08:00）。
- PR #256 已合併在 main 的既有歷史中；本次從 main 獨立開分支，未修改該 PR 的分支。

## 改動檔案與實作位置

產品程式碼僅修改下列兩個檔案；本交接文件為使用者另行指定的交付物。

| 檔案／行號 | 函式或項目 | 內容 |
|---|---|---|
| `api/company-detail.js:5` | `rateLimitMap`、限流常數 | in-memory 固定視窗，60 × 1000 ms，每 IP 上限 30 次 |
| `api/company-detail.js:9` | `checkRateLimit(ip)` | 同一視窗第 31 次起拒絕；新視窗清除過期 IP 記錄 |
| `api/company-detail.js:43` | `handler(req, res)` | OPTIONS → method → 限流 → requireAuth → 參數檢查；IP 來源沿用 feedback 的 forwarded-for 第一段／socket／unknown |
| `api/company-detail.js:108` | `fetchSupabase('contacts', ...)` | select 為 `contact_name,title,office_phone,email,mobile` |
| `api/company-detail.js:123` | contacts 映射 | `email`、`mobile` 均經既有 `textOrBlank()`，其他回傳欄位與 awards 映射不變 |
| `public/index.html:207` | `contactTelHref(value)` | `#` 轉 `,`，僅保留數字、`+`、`,`；至少一個數字才建立 tel 連結 |
| `public/index.html:212` | `contactEmailHref(value)` | trim 後檢查基本 mailbox@domain 格式及網域分隔點，拒絕空白、額外 @、角括號；地址以 encodeURIComponent 編碼後建立 mailto |
| `public/index.html:218` | `ContactInfoRow` | JSX 自動跳脫；空值灰字；sm 以下上下排列、桌機標籤 84px；值可 anywhere 斷行 |
| `public/index.html:230` | `ContactInfoCard` | B 版卡片、狀態顯示、重試、聯絡人四欄與共享稅籍主業 |
| `public/index.html:231` | `contactOpen` state | 預設 false；以方案 ID 作 component key，切換方案重設收合 |
| `public/index.html:232` | `contactEntry` state | idle／loading／ready／auth／limited／error |
| `public/index.html:233` | `contactRetry` state | 點重試觸發新的請求；錯誤不寫入成功快取 |
| `public/index.html:236` | 延遲載入 effect | 僅展開且 cid 有值才抓；cleanup 防止舊請求更新離開的方案 |
| `public/index.html:348` | `companyDetailCache` ref | Map，以公司 ID 保存成功結果，生命週期為 App／當前頁面 |
| `public/index.html:349` | `companyDetailPending` ref | Map，共用進行中的 Promise，快速收合重開也不重複請求；完成後移除 |
| `public/index.html:1748` | `renderDetail()` | Header card 後、Price card 前插入 `ContactInfoCard` |

欄位使用規格已確認的 `contacts.email`、`contacts.mobile`，未另查 schema，未新增或更名欄位。卡片內值皆由 JSX 輸出，未新增 dangerouslySetInnerHTML。原 Babel script tag 屬性未改。

## 真實 Preview API 驗證記錄

驗證對象為上述 Preview 的 `/api/company-detail?company_id=54688786`，不帶 cookie 或 API key。2026-10-15 12:12:06.903 至 12:12:20.337，同一 IP 順序送出 31 次 GET：

- 第 1–30 次：HTTP 401。
- 第 31 次：HTTP 429，body 為 `{"error":"查詢過於頻繁，請稍後再試"}`。
- OPTIONS：HTTP 204。
- POST：HTTP 405，body 為 `{"error":"Method not allowed"}`。

登入後先於 12:44:37 取得順立真實 contacts，再接續其他資料與 UI 驗證。以下為該回應的 contacts 部分（email 已遮罩，mobile 原值為空）：

```json
[
  {
    "contact_name": "江欣倫",
    "title": "業務助理",
    "office_phone": "02-xxxx-xxxx #109",
    "email": "s***@cyberbiz.io",
    "mobile": ""
  }
]
```

逐一比對此回應與同日改動前線上 API 的公司資料及 awards，除 contacts 新增欄位外完全一致。

## 五組資料驗證

| 組別 | 目標 | 目前結果 |
|---|---|---|
| 順立智慧 | 規格 SOL-0852／54688786；Cyberbiz 電商一站式開店系統｜專業版，前端 ID `recSJDpPgvmokqngm` | 江欣倫（業務助理）、02-xxxx-xxxx #109；email `s***@cyberbiz.io`；手機為「暫無資訊」；公司電話 href `tel:02xxxxxxxx,109` |
| 鉅碼科技 | 規格 SOL-0936／66258228；Hahago Ads商家行銷導客雲端數位行銷入門方案，前端 ID `recHxpd47ZmyTvDsj` | 李慈晏（業務總監）、03-xxxxxxx#68；公司電話 href `tel:03xxxxxxx,68` |
| email 與手機皆有值 | 鉅碼科技／66258228（同一公司兼作第三組驗證） | email `n***@gimmatek.com`、手機 `09xx-xxx-000`；讀取真實 DOM 比對 mailto 解碼後等於顯示地址，兩個 tel href 等於各自電話套用規格轉換後的結果，均通過；未實際撥號或寄信 |
| contacts 空陣列 | 燦亞智能／95459961；ERP管理系統，前端 ID `rec3N0ZCfP4kR3tsI` | API contacts 長度 0；四欄皆「暫無資訊」，稅籍主業「未分類其他資訊服務」，卡片無連結、無錯誤 |
| item.cid 為空 | 療管家CRM系統，前端 ID `recfdEOjgLm6I9WcV`；Preview solutions 中 cid、company、tax 均為空 | 展開立即顯示四欄空值，稅籍主業也正確顯示「暫無資訊」；沒有 spinner 或連結；該操作區間無 company-detail 請求 |

後續新增驗證紀錄時，任何 email、手機均須遮罩，且不得將含完整值的截圖或測試資料提交至公開 repository。

## 驗收逐項結果

- [x] 已登入順立 API：每位聯絡人具有 contact_name、title、office_phone、email、mobile 五個 key。
- [x] 未登入同一 API：401（真實 Preview）。
- [x] 同一 IP 一分鐘內第 31 次請求：429（真實 Preview，前 30 次皆 401，證明限流在認證之前）。
- [x] 公司資料、awards 與改動前同日線上回應一致。
- [x] 卡片位於 Header 與 Price 之間且預設收合，實際畫面已確認。
- [x] 未展開前無 company-detail 請求；以 Vercel Request Logs 核對實際 HTTP 請求，非攔截器或 mock。
- [x] 首次展開恰好一次請求；收合重開不增加。
- [x] 同公司另一方案不重抓；不同公司重抓一次。
- [x] SOL-0852 對應方案真實資料顯示符合規格。
- [x] SOL-0936 對應方案真實資料顯示符合規格。
- [x] 鉅碼 email 與 mobile 皆有值，mailto／tel 連結目標符合真實值與轉換規則，記錄已遮罩。
- [x] 燦亞 contacts 空陣列，顯示正確且不報錯。
- [x] 療管家 cid 為空，顯示正確、不報錯且不發請求。
- [x] 登出後，在未重新整理的原頁首次展開此前未快取的 Shopass 公司；一筆真實 GET 401，顯示「登入已過期，請重新整理頁面後再查看。」詳見下方請求 ID 與證據來源。
- [x] 真實 429 後前端顯示限流訊息與重試按鈕，視窗結束後重試成功恢復；錯誤未被快取。
- [x] 從返回按鈕按 Tab 聚焦收合按鈕，Enter 展開、Space 收合，aria-expanded 分別為 true／false。
- [x] 375px viewport 下鉅碼欄位上下排列；clientWidth 與 scrollWidth 同為 360（另 15px 為瀏覽器垂直捲軸），無水平捲動。另以 210px viewport／121px 值欄寬測試同一筆真實 email：自動分成兩行（2 個 client rect、高 39px）、右界 158px 小於 clientWidth 195px，確認較長於可用欄寬的地址能斷行；未注入假地址。
- [x] 實際檢視標題、費用、介紹與其他詳情區塊正常；差異也確認原區塊未改。

## 請求與錯誤狀態證據

瀏覽器工具沒有 Network 讀取 API，故以同一 Preview deployment 的 Vercel **Request Logs**（非僅 console Runtime Logs）確認實際 HTTP 流量：

- 12:44:37.05：先行擷取順立 API。
- 12:45:59.83：先行擷取鉅碼 API。
- 12:46:30.98：主頁首次展開順立，恰好一筆 GET 200；先前搜尋與進入詳情未觸發此請求。
- 收合重開及切換到順立「CYBERBIZ 智能POS系統」（`recVmMLR0RFnKaoyG`）後再展開，立即有資料、沒有 spinner，且沒有額外 HTTP 請求。
- 12:47:24.49：另行 API 查詢七法候選資料；12:47:41.63：另行 API 查詢燦亞空聯絡人資料。這兩筆與 UI 快取驗證分開辨認。
- 12:47:51.38：主頁第一次展開不同公司的鉅碼，新增一筆 GET 200。
- 12:48:52.76：主頁第一次展開燦亞，新增一筆 GET 200。
- 12:49:02.70：另開的手機驗證頁展開鉅碼，HTTP 304（瀏覽器條件請求，fetch 取得可用 JSON）。主頁與手機分頁各自有獨立頁面快取，符合頁面生命週期範圍。
- 隨後搜尋、展開缺 cid 的療管家，沒有新增 company-detail 請求，直接顯示空值。
- 12:50:38：同一 IP 的連續 31 次未登入請求再次確認前 30 次 401、第 31 次 429。隨後主頁第一次展開七法，實際取得 429，顯示「查詢過於頻繁，請稍後再試。」及「重試」。固定視窗結束後點重試，真實聯絡資料成功載入，證明錯誤未快取。

### 401 UI 前置登入狀態核對

- 使用者回覆已登出後，依要求保持原頁不重新整理，從精誠詳情經頁內返回搜尋，再搜尋並進入本頁此前從未展開的「一等一科技／U-Office Force 雲端辦公室軟體」。
- solution_id：`recg25O0Suilw67PH`；company_id：`28293999`。
- 初始 aria-expanded 為 false；首次展開確實發出一筆 GET。Vercel Request Logs 記錄時間 2026-10-15 12:59:48.33（Asia/Taipei），實際 HTTP **200**，畫面顯示聯絡資料，因此不計為 401 通過。
- 同網域 `/api/session-check` 以及附新 verification query 的即時檢查仍回應 `{"authenticated":true}`。因此尚未達成清除此 Preview 登入狀態的前提；沒有用成功快取冒充 401 測試。
- 已另開同網域登入狀態檢查分頁確認 false，原 App 未重新整理。最終改用此前從未在本頁展開的 Shopass 公司，避開一等一在上述核對中新增的成功快取。
- 瀏覽器工具沒有讀取 Chrome DevTools Network 面板的介面；既有 HTTP 狀態與次數使用 Vercel Request Logs 核對，未宣稱已直接讀取 Network 面板。

### 401 UI 最終驗證：真實請求與畫面通過

| 項目 | 實際證據 |
|---|---|
| 公司／方案 | 一個好朋友股份有限公司／Shopass數位共榮護照OMO電商會員系統 |
| solution_id | `recvOVaf88wEB4WHZ`（Preview solutions 回應及詳情頁尾識別碼一致） |
| company_id | `24948357` |
| 原頁與快取前提 | 從精誠經頁內導覽切換到一等一，再經頁內導覽切到 Shopass；原 App 全程未重新整理。此前沒有展開或查詢過 Shopass 聯絡資訊；只讀過方案列表中的公司 ID，未寫入公司詳情快取。 |
| 展開前 | 同網域登入狀態檢查為 `{"authenticated":false}`；Shopass 按鈕 aria-expanded=false，沒有聯絡資料。 |
| 操作 | 只點擊一次 Shopass 聯絡資訊收合按鈕，未重試、未收合重開。 |
| 實際 HTTP 請求 | `GET /api/company-detail?company_id=24948357` |
| 次數／狀態 | **恰好一筆，HTTP 401**；登出成功後到本次展開前沒有其他 company-detail 請求。 |
| 時間 | 2026-10-15 **13:06:25.340 +08:00**（UTC 05:06:25.340） |
| Request ID | `6nh8s-1792040785340-4e893e0c35dc` |
| Vercel 請求詳情 | Request Logs 明確列出 GET、401、Search Params `company_id 24948357`、正確 Preview host、branch `feat/contact-info-card`；Function Invocation 顯示 No outgoing requests。 |
| 畫面 | 「登入已過期，請重新整理頁面後再查看。」；沒有聯絡資料、沒有重試按鈕。 |
| 結論 | 這次由真實 401 走到 auth 狀態，並非成功快取直接顯示；功能項目通過。Chrome DevTools Network 面板的直接截圖／HAR 尚未取得，不能宣稱已交付該面板證據。 |

可查閱的原始請求紀錄：https://vercel.com/patrick0814-6136s-projects/solution-finder/7wKccz9fauDjzKJSMoRC25iv4y8g/logs?datasource=legacy-logs&selectedLogId=6nh8s-1792040785340-4e893e0c35dc

## 其他檢查與限制

- `node --check api/company-detail.js` 通過。
- `git diff --check` 通過；產品差異僅兩個指定檔案（137 行新增、1 行刪除）。
- 確認 `_lib/auth.js`、`api/auth.js`、`api/solutions.js`、`public/manufacturing.html` 無差異；未修改 sf-mcp、migration、資料結構、RLS 或欄位授權，未新增套件或 CDN。
- 執行既有 program-badge／airtable-write 回歸套件共 64 項通過；其中有替身測試，因此**不作為本次規格的驗收證據**。
- 登出前提及 401 UI 已完成；原始碼無需額外修改。使用者要求的 Chrome Network 面板直接證據仍受工具介面限制，實際 HTTP 請求證據已改以有 company_id 與 Request ID 的 Vercel Request Logs 保存，兩者不混稱。
