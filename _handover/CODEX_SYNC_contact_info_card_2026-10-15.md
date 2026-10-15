# 聯絡資訊 B 版實作交接 — 2026-10-15

## 目前狀態

程式已實作並建立一般 PR；**驗收尚未完成，請勿將本文件視為完整驗收通過**。Vercel Preview 停在共用密碼登入頁，已請使用者於瀏覽器完成登入。沒有取得有效 Preview 登入狀態，因此沒有擷取受保護的聯絡資訊，也沒有以 mock 或歷史快取替代線上驗收。

## Git 與部署

- Repository：Pcc329/solution-finder
- 實際最新 main 基準：`fd4e6d4549d74d2afb957583a8bbd48f31150b26`（與規格基準一致）
- 獨立 branch：`feat/contact-info-card`
- 實作 commit：`5194147bb4f87907a6f1cf2054f16f4349dd80ba`
- 一般 PR：https://github.com/Pcc329/solution-finder/pull/257 （非 Draft，base 為 main）
- Preview：https://solution-finder-ekwzinkq6-patrick0814-6136s-projects.vercel.app/
- Vercel deployment：https://vercel.com/patrick0814-6136s-projects/solution-finder/7wKccz9fauDjzKJSMoRC25iv4y8g
- Vercel 狀態：Ready，Source commit 為 `5194147`。
- 已執行的線上 API 驗證時間：2026-10-15 12:12–12:13，Asia/Taipei（UTC+08:00）。
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

規格要求先擷取順立 contacts 後才進行聯絡資料／前端驗證；目前無有效 Preview session，尚未能取得該 contacts 回應。此處不填入推測值或其他環境的資料。完成登入後，應先擷取此 API 的真實 contacts、遮罩 email／mobile，再接續下表。

## 五組資料驗證

| 組別 | 目標 | 目前結果 |
|---|---|---|
| 順立智慧 | SOL-0852／54688786 | 待 Preview 登入；尚未驗證江欣倫（業務助理）、公司電話與實際 email／mobile |
| 鉅碼科技 | SOL-0936／66258228 | 待 Preview 登入；尚未驗證李慈晏（業務總監）與公司電話 |
| email 與手機皆有值 | 待從 Preview 即時資料選定 | 尚未選定，不以規格例子或歷史檔案冒充實際資料 |
| contacts 空陣列 | 待從 Preview 即時 API 選定 | 尚未選定；需驗證四欄暫無資訊、稅籍主業照常顯示 |
| item.cid 為空 | 待從 Preview solutions 即時資料選定 | 尚未選定；需驗證零 company-detail 請求及空值顯示 |

後續新增驗證紀錄時，任何 email、手機均須遮罩，且不得將含完整值的截圖或測試資料提交至公開 repository。

## 驗收逐項結果

- [ ] 已登入順立 API：每位聯絡人具有 contact_name、title、office_phone、email、mobile 五個 key。
- [x] 未登入同一 API：401（真實 Preview）。
- [x] 同一 IP 一分鐘內第 31 次請求：429（真實 Preview，前 30 次皆 401，證明限流在認證之前）。
- [ ] 公司資料、awards 與改動前線上回應一致；程式映射未改，但尚未完成 Preview 資料比對。
- [ ] 卡片位於 Header 與 Price 之間且預設收合；原始碼位置已核對，待瀏覽器操作驗收。
- [ ] 未展開前 Network 無 company-detail 請求。
- [ ] 首次展開恰好一次請求；收合重開不增加。
- [ ] 同公司另一方案不重抓；不同公司重抓一次。
- [ ] SOL-0852 真實資料顯示符合規格。
- [ ] SOL-0936 真實資料顯示符合規格。
- [ ] 至少一間 email 與 mobile 皆有值的公司，mailto／tel 連結可用，記錄已遮罩。
- [ ] contacts 空陣列的真實公司，顯示正確且不報錯。
- [ ] cid 為空的真實方案，顯示正確、不報錯且不發請求。
- [ ] 登出後展開顯示登入已過期。
- [ ] 觸發 429 後前端顯示限流訊息，且重試可恢復。
- [ ] Tab 聚焦、Enter／Space 切換與 aria-expanded 正確。
- [ ] 375px 欄位上下排列、長 email 斷行、無水平捲動。
- [ ] 其他詳情區塊外觀與行為不變。

## 其他檢查與限制

- `node --check api/company-detail.js` 通過。
- `git diff --check` 通過；產品差異僅兩個指定檔案（137 行新增、1 行刪除）。
- 確認 `_lib/auth.js`、`api/auth.js`、`api/solutions.js`、`public/manufacturing.html` 無差異；未修改 sf-mcp、migration、資料結構、RLS 或欄位授權，未新增套件或 CDN。
- 執行既有 program-badge／airtable-write 回歸套件共 64 項通過；其中有替身測試，因此**不作為本次規格的驗收證據**。
- 待接續：在保留的 Preview 分頁登入，先擷取並遮罩順立 contacts，再完成上列所有未勾選項目並更新本文件及 PR 描述。
