# CODEX SYNC — 首頁雙入口、公司查詢與資料結構圖（PR 3／3）

## Git 與交付範圍

- 一般 [PR #261](https://github.com/Pcc329/solution-finder/pull/261)，base 為 `feat/company-search-api`；open、非 Draft、不 merge、不啟用 auto-merge。
- 已 fetch／pull 基準分支；實際基準 `771a24b32421640bfce28c336d3c3ce58341fe97`，與指定基準相同。
- Branch：`feat/company-frontend`。初版 UI commit `6d6167d96618d56abd1db00c8638e822dbd14e92`；最終 UI／歷史快照修正 commit `5fc00e813bd93e3d9a9e6af7e3fa2625cbf1c4d0`。後續提交僅更新核准的測試基準與本文件。
- 實際共六檔：原指定的 `public/index.html`、`public/sources.html`、`api/companies.js`、本 SYNC；另經 PPC 明確核准，更新 `tests/company-search.test.mjs`、`tests/supabase-read-equivalence.test.mjs` 的公司圖譜快取預期及對應測試名稱。
- 未修改其他程式、設定、查詢 helper、前端頁面或資料庫；無新增套件、CDN、外部字型或插圖資產。
- 首頁採 B1；未實作批次比對、自動判斷單框、分享網址、跨頁的資料結構圖引導。
- 維持疊在 #260 的 PR；由 PPC 向組長報告後，由人類決定是否依序處理 #260 → #261。

## 實作位置

| 檔案／名稱 | 行號 | 用途 |
|---|---|---|
| `index.html` companyQuery／companyResult／companyLoading／companyError／showDelisted | 325–329 | 獨立公司查詢輸入、資料、載入、錯誤與下架切換 |
| companyRequest／companyRequestPending | 330–331 | 過期結果及重複送出保護 |
| 首次載入 hash 清除 | 388 | 新增 company-search／company；不提供分享網址 |
| handlePopState 新分支 | 392–414 | 取消過期請求，還原公司／候選頁、公司導覽的詳情快照；沒有可還原資料時回首頁 |
| handleCompanySearch | 436 | 最小輸入檢查、API 呼叫、錯誤對應、獨立導覽及歷史快照 |
| 詳情快照與 pushHistoryView | 463–473 | 先保存原詳情資料，再進公司頁；同頁重查更新當前快照 |
| renderCompanyError | 487 | 400／401／429／其他錯誤訊息與必要時的重試 |
| renderCompanySearchForm | 495 | label、48px 查詢按鈕、原生 form Enter、獨立載入狀態 |
| renderHome | 1160 | B1 等大卡片、兩份內嵌 SVG、沿用原找方案綁定與下方快速開始 |
| renderCompanyCandidates | 1817 | partial／none、候選確認、near 與再次查詢、aria-live |
| openCompanySolution | 1864 | 使用 allData 中相同 id 的原方案進入既有詳情頁 |
| renderCompany | 1870 | 頭像、標籤、四格統計、依未下架數排序分組、狀態、下架切換、獎項、聯絡卡 |
| renderDetail 公司名稱 | 2010 | 有統編時為查公司按鈕；其餘詳情內容原文保留 |
| main 新分支 | 2139–2141 | company-search／company 與詳情查公司錯誤提示 |
| `sources.html` structure section | 611 | 三層架構之後的資料結構圖與五題 FAQ |
| initDataStructure | 953 | 10 個實體、9 條關係、說明與鍵盤互動 |
| 結構圖初始化 try/catch | 1021 | 故障隔離，不阻擋既有來源資訊與筆數同步 |
| `api/companies.js` | 8 | 唯一一行改為 private, no-store |

公司頁直接使用既有 ContactInfoCard，key 為統編，傳入公司識別與稅籍主業，共用原 companyDetailCache／companyDetailPending。不得點擊的方案為純文字並顯示「無詳細頁」。

## 防呆與本機驗證

- `node --test tests/*.test.mjs`：140/140 PASS。
- `node --test tests/sf-mcp/sf-mcp-v1-2.test.mjs`：33/33 PASS；正式 repo 測試總計 173/173。
- 19 項原測試一度因固定期待舊快取而失敗；PPC 核准後只更新兩個測試檔的公司圖譜基準標頭。所有 JSON、讀取、認證、錯誤與其餘標頭仍完整比對，未略過或移除案例。
- repo 外補充驗證：16/16 PASS。包括空白、400／401／429／500／網路錯誤、三種成功結果、重複送出、過期回應、歷史快照、空選配資料、下架不可點擊、來源排序、詳情往返、ROI 原公式、結構圖初始化失敗不影響原筆數同步。此為暫存檢查，未新增測試檔到 PR。
- JSX 使用頁面原有版本 Babel 在 repo 外解析；sources JavaScript 語法、`git diff --check` PASS。
- AST 定位函式後，以正規化換行的函式原文與基準比對；下列受保護函式全部相同。下表為程式 SHA-256 前 8 碼，前後一致：

| 函式 | 基準與本分支 |
|---|---|
| handleSearch | 65c804d3 |
| handleQuickSearch | 5d0c6592 |
| handlePopularFilter | 5c2426ac |
| openThemeDetail | d420510e |
| ContactInfoCard | fb2b4c29 |
| renderList | e064e2ea |
| renderThemeDetail | 62ec11fa |
| ROIModal | f6587f56 |

- openROIModal、closeROIModal、startRoiEstimate 亦比對相同。
- renderDetail 唯一差異是公司名稱元素；還原該元素後，整個函式與基準相同。
- 兩頁所有 script／link 標籤與 Babel script 屬性皆相同。快速範例、熱門篩選與八個主題區的事件綁定保留。
- API 檔只還原快取字串即與基準全文相同；search action 分派完全保留。函式數仍為 12。

### 核准的兩個測試檔差異與測試數量

PPC 核准範圍僅為 Cache-Control 預期值及對應測試名稱。以下為相對基準 `771a24b` 的完整變更行；沒有新增、刪除、跳過測試，也沒有修改其他斷言。基準 handler 仍透過原 git revision 載入，只將公司圖譜的舊快取字串換成新規格，再執行原本完整的回應比較；其他 API 的基準不變。

`tests/company-search.test.mjs`：

```diff
-test('14. companies without search action preserves the actual main graph response and reads', async () => {
+test('14. companies without search action preserves main graph response and reads with private cache policy', async () => {
@@
-  const resolved = source.replace("'../_lib/auth.js'", JSON.stringify(new URL('../_lib/auth.js', import.meta.url).href));
+  // PR 3 intentionally changes only the graph Cache-Control policy from the pinned main baseline.
+  const resolved = source.replace("'s-maxage=300'", "'private, no-store'")
+    .replace("'../_lib/auth.js'", JSON.stringify(new URL('../_lib/auth.js', import.meta.url).href));
```

`tests/supabase-read-equivalence.test.mjs`：

```diff
-  const imported = source.replace("'../_lib/auth.js'", JSON.stringify(authUrl));
+  // PR 3 changes only companies' cache policy; all bodies, requests and other headers retain parity.
+  const imported = (api === 'companies' ? source.replace("'s-maxage=300'", "'private, no-store'") : source)
+    .replace("'../_lib/auth.js'", JSON.stringify(authUrl));
```

「修改前」指本 PR 已套用新 API 快取規則、尚未調整測試預期的狀態；「修改後」為核准調整後的執行結果。測試數按 Node runner 實際展開的案例計算，包含迴圈產生的案例。

| 測試範圍 | 修改前數量 | 修改前通過／失敗 | 修改後數量 | 修改後通過／失敗 |
|---|---:|---:|---:|---:|
| company-search.test.mjs | 15 | 14／1 | 15 | 15／0 |
| supabase-read-equivalence.test.mjs | 54 | 36／18 | 54 | 54／0 |
| 上述兩檔合計 | 69 | 50／19 | 69 | 69／0 |
| 根測試 tests/*.test.mjs（含上述兩檔） | 140 | 121／19 | 140 | 140／0 |
| sf-mcp/sf-mcp-v1-2.test.mjs | 33 | 33／0 | 33 | 33／0 |
| 正式 repo 測試總計 | 173 | 154／19 | 173 | 173／0 |

- 前後根測試及 MCP 執行皆為 skipped=0。原執行紀錄保存在 repo 外 `_company_frontend_validation/root-tests.txt`、`root-final.txt`、`mcp-tests.txt`、`mcp-final.txt`；未將原始執行輸出納入 PR。
- 另以唯讀比對將上述核准行還原，兩檔全文皆與 `git show 771a24b:<path>` 相同（僅正規化換行）。含 `assert.*` 的程式行分別為 96 行、30 行，逐行相同；所有其他測試內容、斷言、條件與測試資料均保留。
- 本次補充提交只修改本 SYNC；兩個測試檔維持已核准的差異，未再調整任何程式或斷言。

## 三、真實 Preview 驗收

- 分支 Preview：https://solution-finder-git-feat-comp-9792c6-patrick0814-6136s-projects.vercel.app/
- 初版 [Ready 部署](https://vercel.com/patrick0814-6136s-projects/solution-finder/9gYuaKBQWejWAVCEJPaiFbTyeVHN)；導覽修正後的 [Ready 部署](https://vercel.com/patrick0814-6136s-projects/solution-finder/74tcaKoocpMKeVH6vDbhQTJcqf7X)，UI commit `5fc00e8`。
- 驗證日期／時間：2026-10-19 17:08–17:33（Asia/Taipei）。PPC 自行登入；375px 裝置模式由 PPC 設定後，由 Codex 讀取實際尺寸及操作驗證。
- 資料來源：Preview 線上即時 API；首頁可搜尋方案 2,268 筆。未用歷史 CSV 或離線資料替代真實驗收。

### 首頁與既有找方案

| 驗收項目 | 真實結果 |
|---|---|
| 桌機 B1 雙入口 | 1920px 下左右兩卡各寬 502px、高 324.75px；同一列，查公司在左；兩個按鈕均 48px |
| 375px 首頁 | 實際 innerWidth=375、page scrollWidth=375；兩卡寬 343px、x=16，依序上下排列，無水平溢出；輸入皆有 label |
| 找方案卡片 | 「餐廳想要掃碼點餐」經原 AI 搜尋流程顯示 78 筆；原分類、關鍵字及產業篩選照常呈現，受保護函式與基準完全一致 |
| 三個快速範例 | 逐一點擊後回到正常列表，實測分別為 3、25、0 筆；查無的範例亦正常顯示提示，沒有頁面錯誤 |
| 三個熱門篩選 | 新創嚴選 144、官方認證供應商 302、提供試用 53 筆；每項均測進入及返回 |
| 八個主題區 | 銷售管理、行銷推廣、生產物流、協作辦公、人力資源、資安合規、研發創新、醫療照護逐一進入、標題正確並返回 |
| 篩選、排序、分頁 | 掃碼點餐 78 筆 → 北部 48 筆；價格低至高可選；第 2 頁顯示 21–40／78 |
| 比較 | 選兩筆方案進入 compare.html，正常顯示兩欄公司、費用、來源與功能摘要 |
| 詢問 AI | 對 48 筆結果提問後，正常顯示「AI 分析」答案 |
| ROI | 基準本來以 .roi-entry 隱藏所有入口；此設定與元件、公式均保留。本機驗證 1.2%／6.0%／10.0% 與未提供月費情境通過；未宣稱在 Preview 操作過被隱藏的 ROI 彈窗 |

### 查公司與導覽

| 查詢／操作 | 真實結果 |
|---|---|
| 空白送出 | 不送查詢，輸入下方顯示「請輸入統編或公司名稱」 |
| 1234567 | 輸入下方顯示「統編須為 8 碼數字」 |
| 24542716 | 精誠科技整合公司頁；收錄 1、正常 0、疑似 1、平台 1；可點入 SOL-0976 的原方案詳情 |
| 國興資訊 | 直接進國興資訊公司頁；收錄 16、正常 9、疑似 7、平台 3；預設隱藏 1 筆已下架；分組數 7／6／3 |
| 愛吠的狗 | 候選列 15 筆／仍在架 15；「是這家」進公司；依未下架數分組 13／1／1；上一頁還原候選及原查詢 |
| 方鼎資訊股份有限公司 | 顯示「SF 未收錄」及完整限制說明；near 為空時無空白候選清單 |
| 90867101 | 智雲聯網；四格均 0，顯示全部已下架提示；預設無方案列；勾選後顯示 Bitrix24-標準版，為純文字、灰徽章及「無詳細頁」 |
| 公司 → 方案 → 兩次上一頁 | 精誠 → 金屬製造業方案 → 公司頁 → 首頁，逐步還原正確 |
| QbiAI 方案 → 公司 | 點公司名稱進人工智能公司頁；收錄 6、正常 5、疑似 1、平台 2，有獲獎標籤 |
| 原列表詳情 → 公司 → 上一頁 | 修正後由人工智能公司返回 QbiAI 詳情，再上一頁返回列表，快照正確 |
| 無統編方案 | Vector AI MES/CRM/ERP 系統的公司元素仍為純文字，沒有「查看公司資料」按鈕 |
| 詳情頁原聯絡卡 | QbiAI 詳情展開後 busy=false、5 個欄位標籤、無重試按鈕；只記錄載入狀態，未複製內容 |
| 新 hash 首次載入 | company-search 與 company 均清除至首頁網址，不作分享頁面 |

### 聯絡卡紀錄（SQL）

在公司頁展開精誠聯絡卡一次，正常載入後收合。唯讀 SQL：

```sql
select now() as verified_at, count(*) as access_count,
       count(*) filter (where company_id = '24542716') as target_count
from public.contact_access_logs;
```

| 時間（UTC） | access_count | target_count |
|---|---|---|
| 2026-10-19 09:11:09.478217+00（展開前） | 5 | 0 |
| 2026-10-19 09:13:38.4222+00（完成後） | 6 | 1 |

恰新增 1 筆。後續另測 QbiAI 詳情聯絡卡屬獨立回歸操作，不混入此驗收區間。[已保存的唯讀 SQL](https://supabase.com/dashboard/project/apdbvjruevjprslhhvlx/sql/fc88416b-e7c5-443a-a659-6fd934186761) 需專案權限。

### 資料結構、快取與公司圖譜

- 「資料怎麼連在一起」緊接「三層架構」之後；10 個實體、9 條關係均已生成。
- 點方案後正確高亮 3 條關係；Enter 選公司，Tab 聚焦下一個聯絡人，Space 選取成功，aria-pressed 與說明同步；五題 FAQ 均可展開。
- 375px 下圖框 clientWidth=307、scrollWidth=900；方向鍵實測 scrollLeft 0 → 40，而頁面仍 375px，只有框內水平捲動。
- 圖例、實體說明、更新日期與內部資料不列入註記齊全；原來源卡與筆數同步正常。
- PPC 在同一 Preview Console 提供兩筆真實標頭結果：

| 請求 | HTTP | Cache-Control | x-vercel-cache |
|---|---|---|---|
| 1 | 200 | private, no-store | MISS |
| 2 | 200 | private, no-store | MISS |

- 儀表板公司圖譜顯示全部 200 家、新創 64 家，切回全部仍 200 家，氣泡正常。

### 截圖與畫面描述

本回合已擷取桌機首頁、桌機精誠公司頁、375px 首頁／公司頁與資料結構圖畫面。四份已保存的截圖位於 repo 外 `_company_frontend_validation/screenshots/`（home-desktop、home-375、company-desktop、structure-desktop，皆為 jpg），不增加 PR 檔案；375px 公司頁另於本回合畫面輸出留存。公司頁截圖皆維持聯絡卡收合，沒有聯絡內容可辨識；未把展開內容加入 PR 或本文件。

- 桌機首頁：靛藍大樓放大鏡與綠色拼塊星星並排；說明及輸入對齊，快速開始位於兩卡下方。
- 375px 首頁：標題與副標自然換行，查公司在上、找方案在下，左右留白各 16px；完整頁面無橫向捲動。
- 桌機公司頁：頭像與標籤置於標題卡，四格統計一列，來源及方案清單在下。
- 375px 公司頁：標題卡寬 343px，長公司名換行，統計為兩欄四格；方案與價格自然換行，無水平溢出。
- 結構圖：桌機可見完整關係；375px 圖框出現內部捲軸，說明與 FAQ 保持頁面寬度。

## 四之二：優雅降級

- 公司 API 的 400／401／429／500、網路失敗均在獨立新增流程處理，16 項暫存測試確認不切換到其他頁或破壞找方案入口。
- 空獎項、空稅籍、空識別圖示資料皆可呈現；智雲公司真實頁也確認空稅籍與空獎項不產生空白標籤；頭像使用既有 fallback。
- 人為讓結構圖初始化拋錯的本機測試仍完成原來源筆數更新為 2,268；既有頁面段落不受影響。未在正式資料庫製造任何失敗。

## 五之二：未新增後端欄位

- [x] 已確認未新增任何後端查詢欄位。API diff 全部內容如下，還原這一行後與基準完全相同：

```diff
-  res.setHeader('Cache-Control', 's-maxage=300');
+  res.setHeader('Cache-Control', 'private, no-store');
```

前端只使用 #260 已驗證的公司 API 與既有方案欄位；未執行 migration 或更動資料庫結構／權限。

## 五之三：驗證方式

- [x] 已在真實 Preview 環境驗證，證據見第三段；ROI 入口原本隱藏的限制已明列。
- [ ] 僅完成 mock／本機驗證，尚未真實環境驗證。

## PPC 後續調整：公司頁的疑似下架呈現

- 本次程式差異只在 `public/index.html` 的 `renderCompany`，其他頁面、函式與元件均不變；另外更新本 SYNC。未修改 API、資料庫或任何測試檔。
- 以 `status === 'suspected'` 且 `status_label` 包含「平台停止服務」判斷，沒有依平台名稱或 program_type 寫死。每個符合條件的分組標題下僅顯示一次 slate 灰色 info 說明；該類方案列不顯示狀態標籤。
- 其他 suspected 顯示灰色小字「未確認」，title 保留原 status_label；正常綠徽章、已下架灰徽章維持原樣。統計改名「未逐筆確認」，仍使用 summary.suspected，維持中性灰色；頁尾換成 PPC 指定文字。
- 本機檢查通過：整份 index.html 移除 renderCompany 後與調整前 `2a1b8df` 全文一致；JSX 語法、受保護函式、script 標籤及既有公司頁補充測試 16/16 通過。repo 外暫時資料確認任意平台名稱、同組多筆僅一則說明、非停止服務原因的未確認 title／樣式、null 原因、正常／下架徽章、統計與頁尾。
- 程式提交 `0b63f55`；[Vercel Ready 部署](https://vercel.com/patrick0814-6136s-projects/solution-finder/6wji9PUGEBHcwNnnFHmf1W2V55L5)。於 2026-10-19 17:58–18:01（Asia/Taipei）使用原分支 Preview 真實資料驗收，沿用已登入狀態。

| Preview 樣本 | 實際結果 |
|---|---|
| 精誠 24542716／臺灣雲市集 | 組標題下 1 則指定說明與 info 圖示；1 筆方案列沒有狀態標籤；未逐筆確認統計為 1 |
| 順立 54688786／臺灣雲市集 | 6 筆方案共用 1 則指定說明，各列均沒有狀態標籤；未逐筆確認統計為 6，沒有逐列重複原因 |
| 永訊智庫 82800698／新創嚴選網 SOL-0146 | 真實原因為「疑似已下架_新創嚴選網方案未持續上架未逐筆驗證」；顯示灰色小字「未確認」，title 完整保留原因；該組沒有平台停止服務說明 |
| 永訊智庫同頁的混合狀態 | 新創嚴選網 SOL-0732 保持正常綠徽章；臺灣雲市集 SOL-0144 顯示組層級說明、列無狀態標籤；未逐筆確認統計為 2 |

- DOM 計算樣式：說明及「未確認」皆為 slate 灰色 `rgb(100, 116, 139)`；「未確認」12px、透明背景、圓角 0px，class 僅 `text-xs text-slate-500`。正常徽章仍為 `rounded-full px-2 py-1 text-xs font-bold bg-emerald-50 text-emerald-800`。已下架徽章與原字串、class 相同，另以本機暫時資料確認。
- 非平台原因的真實樣本由 [SQL Editor 唯讀 SELECT](https://supabase.com/dashboard/project/apdbvjruevjprslhhvlx/sql/a8a55941-5477-427a-b463-6ed2a1033568) 找到：僅查 solution_id、company_id、company_name、record_status，篩選 `record_status like '疑似%'` 且不含「平台停止服務」，limit 5；再回 Preview 查公司驗證。未執行任何資料或結構修改。
- 截圖保存在 repo 外 `_company_frontend_validation/screenshots/company-status-24542716.png`、`company-status-54688786.png`、`company-status-82800698.png`，皆未展開聯絡卡，不含實際聯絡資訊；未將截圖加入 PR。
- 本次僅重跑相關的 16 項公司流程／既有功能補充檢查及狀態呈現暫時資料驗證，均通過；未修改或增刪 repo 的正式測試，前述正式測試總數維持 173。
