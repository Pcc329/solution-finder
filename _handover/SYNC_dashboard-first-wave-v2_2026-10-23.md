# SYNC：儀表板首波／候補與資料說明 v2（2026-10-23）

## 分支、commit 與 PR

- 規格：使用者附件 `SPEC_儀表板首波候補與資料說明_v2_2026-10-23.md`，以及本次明確的七項執行要求。
- 基底：建立分支前已 `git fetch --no-tags origin main`，取當時最新 main：`01c93ba55ba47fa27bb435816ad0cca95672490c`（PR #295）。沒有切換、提交或推送 main。
- 分支：`feat/dashboard-first-wave-v2`。
- 實作與六張截圖 commit：`85d058df30a2d4211293fbfb2257de33fe5aeccf`。
- commit 訊息：`feat: split dashboard first-wave and candidate vendors`。
- 本文件另外提交，實作 commit 的 SHA 不因補交接文件而改變；分支最終 commit 另於對話回報。
- 實作分支已推送。PR 未建立：`gh pr create --base main --head feat/dashboard-first-wave-v2 ...` 回覆 `Post "https://api.github.com/graphql": Forbidden`（exit 1）。依使用者第 6 點，保留分支與 commit 即可，不等待解除限制。沒有 merge。
- 可手動開啟建立 PR 的比較頁：https://github.com/Pcc329/solution-finder/compare/main...feat/dashboard-first-wave-v2?expand=1 （這不是已建立的 PR）。

## 開始實作前的檢查與回報

已先讀取 `AGENTS.md`、兩個 `public/platform-overview*.mjs`、`public/platform-overview.html`、`docs/platform-overview.md` 與完整 `tests/platform-overview.test.mjs`，在對話回報後才開始修改程式。

以下行號為基底 main 的原始行號，非改動後行號：

| B 節條目 | 原有文字位置與處理 |
|---|---|
| 1：在架＝正常＋疑似下架 | `public/platform-overview.mjs:71`；只在原處補上「首波名單只計正常方案」，底部不重複另寫。 |
| 2：逐筆複核／原始標記 | `public/platform-overview.mjs:71`；平台動態標記在 `public/platform-overview-render.mjs:66`，依 `ai_label_method` 顯示。原處補充跨平台比較須留意定義差異。 |
| 3：缺統編、家數為下限 | `public/platform-overview-render.mjs:55`，由 `public/platform-overview.mjs:70` 插入；保留動態 `no_id_solutions`，只列非零平台。 |
| 7：資料時間 | `public/platform-overview.mjs:68` 與 `77–79`；原已使用 Asia/Taipei，本次固定為 `YYYY-MM-DD HH:mm` 並補充數字可能隨查證變動。 |

`public/platform-overview.html` 是登入及儀表板容器，沒有上述說明文字，無需修改。

平台全名的實際欄位是 `platform_name`，原始引用點包含 render 模組的第 37、55、64 行；`platform_key` 用於欄位連動，`shortNames` 只作縮寫顯示。遷移檔 `migrations/20261023_dash_vendor_first_wave.sql:44–47` 的來源條件與 repo 契約使用 `SME AI平台`、`雲市集工業館`、`商業服務業專區`，與規格三個字串相符。未讀取受密碼保護的正式 API，因此這是 repo 與 mock 資料的比對證據，不宣稱已驗證線上回應。執行時以 `platform_name` 完全比對，不 trim、不轉全形、不套別名；缺少名稱會列出 `console.warn`。

## 修改檔案與函式

| 檔案 | 修改內容 |
|---|---|
| `public/platform-overview-render.mjs` | 新增 `normalFields`、`hasNormalCounts`、`hasNormalData`；改寫 `isFirstWave`，新增 `isCandidate`；更新 `summarize`、`renderKPIs`、`renderTakeaway`、`selectVendors`、`renderVendors`。新增集中清單 `SURVEY_PLATFORMS`、`warnMissingSurveyPlatforms`、`renderPlatformName`、`renderVersionWarning`、`formatDataTime`、`renderDataNotes`；更新 `renderAI`、`renderCoverage`、`renderOverlap`、`renderProfiles` 的來源標籤。 |
| `public/platform-overview.mjs` | `render` 放入版本提示、候補控制與底部資料說明，載入時檢查平台名稱；`drawSelection` 支援候補與來源標籤；資料時間使用 `formatDataTime`。排序、搜尋、分頁與熱圖事件沿用既有流程。 |
| `public/platform-overview.css` | 候補琥珀色標籤、藍／綠來源標籤、平台名稱不斷行、表格保留容器內捲動；640px 以下的 AI 長條改成單欄，避免名稱被數字擠壓。 |
| `docs/platform-overview.md` | 更新正常方案三欄契約、首波／候補定義、版本保護、來源標籤與更名提醒，記錄本次瀏覽器驗證。#294 的「維運注意事項」區段逐字保持不變。 |
| `tests/platform-overview.test.mjs` | 合成 fixture 補正常方案欄位與七個平台名稱；原 21 項測試保留並配合新定義更新，新增 11 項驗收測試，共 32 項。 |
| `_handover/evidence/dashboard-first-wave-v2-20261023/*.png` | 桌機及 375px 各三張 mock 截圖：全部、候補、缺欄位／名稱情境。 |
| 本 SYNC | 逐項驗收、完整輸出、截圖、差異與分支紀錄。 |

沒有修改 `public/platform-overview.html`、其他頁面、`supabase/functions/`、資料庫、任何 migration、套件宣告或 lockfile。沒有部署或呼叫正式資料服務。

## 驗收標準逐項結果

| 規格驗收項目 | 結果與證據 |
|---|---|
| 首波／候補四類情境 | 通過。包含正常達標、疑似才達標（AI 或平台數不足）、皆未達標、平台數足但 AI 不足；分組互斥。 |
| 任一廠商缺三個正常欄位之一 | 通過。逐欄測試 undefined、null、空字串、非數字、Infinity、負數；兩張 KPI 均為「—」，提示在 KPI 上方，沒有以 0 代替。 |
| 動態 AI 判定與缺統編 | 通過。mock 的 `ai_label_method` 控制複核／原始標記文字，`no_id_solutions` 只有非零平台列出，含 HTML escaping。 |
| 32 家總門檻／21 家正常門檻 | 通過。KPI 首波 21、候補 11；結論總數 32、跨平台 32（100%，為下限）、首波 21、候補 11；點陣標籤各 21／11。數字取自 mock，不寫死於產品程式。 |
| 所有既有測試 | 通過。最終整合執行 283/283；儀表板單獨執行 32/32。全部 fail、cancelled、skipped、todo 為 0。 |
| 七平台標籤 3／4 與完全比對 | 通過。長條列、熱圖欄位標題、點陣與總表均使用同一 renderer；`SME AI 平台`、前後空白、全形 SME 不會被錯歸為補助平台盤點。 |
| 缺少清單名稱時 warn | 通過。單元及瀏覽器 mock 測試均驗證列出缺少名稱，靜態範圍說明照常顯示。 |
| B.1／2／3／7 不重複；B.8 明列臺灣雲市集 | 通過。Node VM 驗證各定義／說明只出現一次；新增資料說明包含臺灣雲市集已停止服務、未納入統計，以及四個另外收錄來源與非平台來源。 |
| 新增公開文字檢查 | 通過。檢查新增資料說明、來源標籤、版本提示、KPI／結論，無人名、職稱、委託方、專案正式名稱或資料表／View 識別字。既有總表查證欄位附註保留。 |

### 舊首波定義測試的調整

- `sample()` 的既有首波廠商補上正常方案平台數 2、AI 數 5、方案數 7，繼續驗證首波標籤。
- `real booleans drive heatmap, dot matrix and first-wave selection` 的摘要預期增加 `candidate: 0`。
- `reference view switches, pair filters, search and sortable columns compose` 的 Beta mock：總平台 2、總 AI 7，但正常平台 1、正常 AI 4，依新定義移到候補；首波預期由 2 家改成 1 家，新增候補為 Beta 的斷言。熱圖布林值、搜尋與排序斷言均保留。
- 新增 mock32 測試，明確覆蓋首波 21／候補 11；不使用線上的 21／10 作為驗收常數。

## 瀏覽器驗證與截圖

使用環境既有的 Chromium 154.0.8037.57 與 Python Playwright，沒有安裝瀏覽器。HTTP server 僅提供本機靜態檔；Playwright 攔截資料 endpoint 並回覆合成 JSON，所有其他外部請求均攔阻。沒有正式 token、密碼或線上資料；測試 token 只供前端 mock 使用，沒有用它存取正式 API。

- 桌機 viewport：1440 × 1000；手機：375 × 900，皆 light mode、device scale 1。
- 本機登入後的 DOM 流程、KPI 21／11、首波／候補篩選、搜尋、熱圖與清除 chip、來源標籤 3／4、資料說明均通過。
- 兩種尺寸的頁面 scrollWidth 均等於 viewport 寬度；七個長條列平台名稱的高度皆為單行，沒有斷字。寬表格在自身容器捲動。
- 缺正常欄位情境：KPI 兩個「—」、提示位於 KPI 上方，分組標籤不顯示；缺 `SME AI平台` 情境：console.warn 含該名稱，資料說明仍顯示。
- 正常資料的瀏覽器 JavaScript errors、warnings 與未預期外連皆為 0；缺名稱情境的 warning 為預期行為。
- 已檢視桌機候補與 375px 全頁截圖。這些是本機 mock 證據，不是 Preview 或正式網站驗收。

| 截圖 | 內容 |
|---|---|
| [桌機：全部](evidence/dashboard-first-wave-v2-20261023/desktop-all.png) | KPI、結論、首波標籤、來源與資料說明 |
| [桌機：候補](evidence/dashboard-first-wave-v2-20261023/desktop-candidate.png) | 候補 11 家、候補標籤 |
| [桌機：缺欄位／名稱](evidence/dashboard-first-wave-v2-20261023/desktop-stale.png) | 「—」、版本提示與靜態說明 |
| [375px：全部](evidence/dashboard-first-wave-v2-20261023/mobile-375-all.png) | 手機排版、首波、來源與資料說明 |
| [375px：候補](evidence/dashboard-first-wave-v2-20261023/mobile-375-candidate.png) | 手機候補篩選與標籤 |
| [375px：缺欄位／名稱](evidence/dashboard-first-wave-v2-20261023/mobile-375-stale.png) | 手機版本提示 |

## 與規格不同之處、實作選擇與限制

1. **PR 尚未建立**：Git 推送成功，但 GitHub GraphQL API 被代理回覆 403。依本次使用者第 6 點，回報分支與 commit；未合併。這是唯一尚未完成的外部交付操作。
2. **版本保護擴及名單與標籤**：規格明定 KPI 保護；為避免 KPI 未知卻仍顯示部分首波／候補，本次任一廠商缺欄位時亦暫停兩組名單及徽章。全部／跨平台、搜尋、排序、熱圖仍可用。null、空值、非數字與負數亦視為不可計算，避免不完整回應被當作 0。
3. **沒有修改靜態 HTML**：儀表板內容原本由 `platform-overview.mjs` 動態產生；需求可在規格列出的兩個模組與 CSS 內完成，保留 HTML 容器及登入畫面。
4. **資料說明 B.6／B.8 合併，其他既有條目保留原位**：這是規格允許的寫法；底部不重複展開 AI 判定、缺統編與資料時間。
5. **表格最小寬度增加、手機長條改為單欄**：為使新增來源標籤不擠壓名稱，表格保留容器內捲動，長條在小尺寸改為名稱／條／數字分行；排序、分頁、搜尋及熱圖計算未改。
6. **平台名稱證據限 repo 與 mock**：未讀取正式受密碼保護 API，不將 SQL 的來源名稱比對等同正式 `platform_name` 回應驗證。實際回應若更名，既有名稱完全比對測試及新增警告會揭露差異。
7. **正式網站驗收仍待部署後執行**：按規格以本機 mock 為本 PR 驗收，不使用 Preview 截圖作依據。沒有宣稱驗證線上筆數或正式資料。

## 測試環境與重現方式

Node v24.19.0。根目錄測試無需安裝套件；MCP 測試依既有 lockfile 執行 `npm ci --ignore-scripts --no-audit --no-fund --cache /tmp/dashboard-v2-npm-cache`，不升級、不修改套件或 lockfile，保留 npm integrity 驗證。初次 npm 使用預設不可寫 cache 失敗，改用 /tmp cache 後成功安裝原鎖定的三個套件。

完整測試命令皆在 repo 根目錄執行：

```sh
node --test tests/platform-overview.test.mjs
node --test --test-reporter=spec tests/*.test.mjs tests/*.test.cjs tests/sf-mcp/*.test.mjs
```

另在 repo 外的暫存 QA 目錄執行 `node /workspace/solution-finder/tests/sf-mcp/sf_search_parity_gen_test.js`，28 案例產生器 exit 0。只產生 fixture.sql／cases.sql／expected.json，沒有執行 SQL；這是產生器 smoke check，不宣稱完成資料庫 parity。

`git diff --check` 與 `git diff --cached --check` 通過；另外逐字比較 docs「維運注意事項」區段與基底完全一致，並檢查 `supabase/functions/`、migration、套件檔案無 diff。

## 完整輸出：指定儀表板測試（exit 0）

```text
✔ seven-day HMAC tokens match the existing password gate format (21.689209ms)
✔ login rejects malformed payloads and wrong passwords without touching data (75.930641ms)
✔ missing, expired and tampered tokens return no data and never query Supabase (4.722762ms)
✔ service-role read pagination is complete, retains IDs and reflects updates (6.204673ms)
✔ upstream failure fails closed without leaking service credentials or partial data (3.400311ms)
✔ AI shares show reviewed pending ranges and handle missing/zero denominators (1.960516ms)
✔ real booleans drive heatmap, dot matrix and first-wave selection (41.945402ms)
✔ profiles produce two tables with eight platforms, nine dimensions, safe notes and dates (1.759184ms)
✔ CORS accepts only the exact production origin and rejects all preview origins (3.486924ms)
✔ CORS preflight allows only the endpoint method and explicit authentication/content headers (1.927486ms)
✔ all four negative-auth cases stay 401 without data for production and requests without Origin (7.724845ms)
✔ no token: no requests, no numbers or data in the dashboard DOM (5.077273ms)
✔ frontend login and data requests go directly to Edge with no cookies or API key (14.409092ms)
✔ expired or rejected token: return to password screen and erase localStorage (5.84754ms)
✔ authenticated data appears only after verification; expiry erases all rendered data (5.304368ms)
✔ logout while a data request is in flight cannot redisplay a stale response (4.161868ms)
✔ leaving the page clears data and cancels any in-flight rendering (3.516934ms)
✔ reference view switches, pair filters, search and sortable columns compose (2.548563ms)
✔ reference summary, warning, AI badges and static next steps retain their meaning (0.528507ms)
✔ heatmap cells expose keyboard buttons, symmetric selection and disabled empty intersections (0.974128ms)
✔ frontend heatmap, view, chip and column handlers update the vendor list (9.441975ms)
✔ first-wave and candidate predicates use normal counts and exclusive thresholds (1.122965ms)
✔ every missing or invalid normal field makes both KPIs unknown instead of zero (5.726753ms)
✔ 32 qualifying mock vendors render 21 first-wave and 11 candidates with correct takeaway (1.527647ms)
✔ candidate view preserves search, pair filtering, sorting and pagination (0.68508ms)
✔ seven platform source badges classify three survey and four database sources exactly (0.862656ms)
✔ missing survey names warn with exact missing names and leave static scope notes intact (1.020303ms)
✔ AI methods and nonzero missing-ID counts are generated dynamically without duplicated notes (0.422899ms)
✔ data response timestamps use fixed Taipei minute format including midnight and date rollover (0.583503ms)
✔ frontend candidate control, source badges and singular data explanations render together (34.450671ms)
✔ frontend puts version warning above KPI and preserves notes when a survey name is absent (11.008241ms)
✔ new public notes and labels contain no personal, client or database identifiers (1.11969ms)
ℹ tests 32
ℹ suites 0
ℹ pass 32
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 413.292757
```

## 完整輸出：全部 Node 測試（exit 0）

```text
✔ ask: success preserves response and safe single-write behavior (6.082983ms)
✔ ask: 400 preserves response and safe single-write behavior (1.837651ms)
✔ ask: 500 preserves response and safe single-write behavior (0.871ms)
✔ ask: 429 preserves response and safe single-write behavior (1.560353ms)
✔ ask: network-error preserves response and safe single-write behavior (0.852352ms)
✔ ask: invalid-json preserves response and safe single-write behavior (0.509255ms)
✔ ask: unsafe-code preserves response and safe single-write behavior (0.574819ms)
✔ ask: missing-url preserves response and safe single-write behavior (0.422836ms)
✔ ask: missing-key preserves response and safe single-write behavior (1.143334ms)
✔ ask: requireAuth still blocks unauthenticated requests (1.43785ms)
✔ claude: success preserves response and safe single-write behavior (1.084152ms)
✔ claude: 400 preserves response and safe single-write behavior (1.269423ms)
✔ claude: 500 preserves response and safe single-write behavior (0.591213ms)
✔ claude: 429 preserves response and safe single-write behavior (0.495963ms)
✔ claude: network-error preserves response and safe single-write behavior (0.5125ms)
✔ claude: invalid-json preserves response and safe single-write behavior (0.846369ms)
✔ claude: unsafe-code preserves response and safe single-write behavior (0.448327ms)
✔ claude: missing-url preserves response and safe single-write behavior (0.454273ms)
✔ claude: missing-key preserves response and safe single-write behavior (0.914584ms)
✔ claude: requireAuth still blocks unauthenticated requests (0.168739ms)
✔ feedback: success preserves response and safe single-write behavior (0.720262ms)
✔ feedback: 400 preserves response and safe single-write behavior (0.529684ms)
✔ feedback: 500 preserves response and safe single-write behavior (0.374481ms)
✔ feedback: 429 preserves response and safe single-write behavior (0.660831ms)
✔ feedback: network-error preserves response and safe single-write behavior (0.407513ms)
✔ feedback: invalid-json preserves response and safe single-write behavior (1.150274ms)
✔ feedback: unsafe-code preserves response and safe single-write behavior (0.360063ms)
✔ feedback: missing-url preserves response and safe single-write behavior (0.321029ms)
✔ feedback: missing-key preserves response and safe single-write behavior (0.20522ms)
✔ feedback: requireAuth still blocks unauthenticated requests (0.129629ms)
✔ feedback: validated optional fields including zero remain intact (0.440892ms)
✔ feedback: rejects {"name":""} before writing (0.80306ms)
✔ feedback: rejects {"name":"xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"} before writing (0.210991ms)
✔ feedback: rejects {"department":"xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"} before writing (0.281779ms)
✔ feedback: rejects {"milestone":""} before writing (1.529365ms)
✔ feedback: rejects {"milestone":"xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"} before writing (0.248199ms)
✔ feedback: rejects {"milestone":"not-allowed"} before writing (0.154233ms)
✔ feedback: rejects {"detail":""} before writing (0.165502ms)
✔ feedback: rejects {"detail":"xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx before writing (0.152964ms)
✔ feedback: rejects {"score":0} before writing (0.582673ms)
✔ feedback: rejects {"score":6} before writing (0.177017ms)
✔ feedback: rejects {"score":1.5} before writing (0.14653ms)
✔ feedback: rejects {"relevant_count":-1} before writing (0.156259ms)
✔ feedback: rejects {"relevant_count":6} before writing (0.37043ms)
✔ feedback: rejects {"path_choice":"not-allowed"} before writing (0.146039ms)
✔ feedback: rejects {"path_choice":"xxxxxxxxxxxxxxxxxxxxx"} before writing (0.146128ms)
✔ feedback: rejects {"would_cite":"not-allowed"} before writing (0.141235ms)
✔ feedback: rejects {"would_cite":"xxxxxxxxxxx"} before writing (0.136633ms)
✔ feedback: malformed JSON still returns 400 (0.410742ms)
✔ feedback: same-IP fourth request is rate limited; another IP is allowed (0.513975ms)
✔ ask: OPTIONS stays available without auth (0.232878ms)
✔ claude: OPTIONS stays available without auth (0.153312ms)
✔ ask: absent search query remains an empty string in storage (1.073613ms)
✔ migration is byte-for-byte identical to the supplied SQL (1.018035ms)
✔ 1. tax ID exact match returns whitelisted company, all solutions and summary (93.016848ms)
✔ 2. statuses use prefixes, preserve labels and normalize nullable numeric values (4.175376ms)
✔ 3. full-width digits, letters and spaces normalize; separated tax IDs match (4.412087ms)
✔ 4. seven- or nine-digit numeric input is rejected before reads and writes (1.071078ms)
✔ 5. a single equal name core is exact with or without suffix; optional reads fail independently (33.386654ms)
✔ 6. partial matches return at most ten ordered candidates and count with one batched solutions query (2.753942ms)
✔ 7. no match returns zero results and at most five prefix hints; tax ID misses never query hints (2.119615ms)
✔ 8. user-supplied PostgREST metacharacters are removed from name and prefix filters (2.692759ms)
✔ 9. invalid lengths and short cores return exact validation messages without storage (3.996736ms)
✔ 10. every response path omits contact-related fields and never reads contacts (3.91508ms)
✔ 11. each 200 awaits one complete search log; storage errors preserve payload and non-200 never writes (11.524953ms)
✔ 12. every read uses anon credentials, including session-authenticated requests and optional tables (8.28804ms)
✔ 13. the sixty-first request is limited before auth; methods precede limiting and expired windows reset (7.616659ms)
✔ 14. companies without search action preserves main graph response and reads with private cache policy (54.441077ms)
✔ 15. companies search action dispatches q before graph headers and performs one search log write (3.905967ms)
✔ two mixed sources: normal count outranks total count; rows sort by status then missing name, stably (4.804979ms)
✔ equal normal counts use suspected count descending, ignoring delisted counts (2.221052ms)
✔ equal normal and suspected counts keep first-seen source order, not alphabetical order (1.384333ms)
✔ suspected-only and delisted-only sources follow sources with normal solutions (1.169458ms)
✔ sorting preserves statistics and filtered group counts when delisted rows are toggled (2.955216ms)
✔ 1. success awaits exactly one service-role POST with complete typed fields from filtered contacts (13.367518ms)
✔ 2. POST body and logs never contain raw IP, session, email or mobile (1.571935ms)
✔ 3. HMAC uses the first forwarded IP or socket fallback and changes with salt (4.652673ms)
✔ 4. missing or empty salt writes null hashes, emits one safe error and preserves 200 payload (2.882275ms)
✔ 5. POST 500, missing table or network failure preserves the entire baseline response (3.56866ms)
✔ 6. non-200 responses never POST; the thirty-first request retains the existing rate limit (30.57798ms)
✔ 7. API-key authentication has no session hash; a valid session takes precedence when both exist (1.961767ms)
✔ mock /api/solutions HTTP 500: catch clears loading, count stays unknown (6.859093ms)
✔ network rejection also leaves the count unknown (23.594091ms)
✔ pending request is unknown even with existing data (1.782321ms)
✔ successful empty response displays a genuine zero (31.817444ms)
✔ successful response displays the formatted length (2.306092ms)
✔ seven-day HMAC tokens match the existing password gate format (14.074618ms)
✔ login rejects malformed payloads and wrong passwords without touching data (42.073689ms)
✔ missing, expired and tampered tokens return no data and never query Supabase (2.677761ms)
✔ service-role read pagination is complete, retains IDs and reflects updates (16.311275ms)
✔ upstream failure fails closed without leaking service credentials or partial data (6.353933ms)
✔ AI shares show reviewed pending ranges and handle missing/zero denominators (15.300672ms)
✔ real booleans drive heatmap, dot matrix and first-wave selection (109.069217ms)
✔ profiles produce two tables with eight platforms, nine dimensions, safe notes and dates (5.644161ms)
✔ CORS accepts only the exact production origin and rejects all preview origins (9.973241ms)
✔ CORS preflight allows only the endpoint method and explicit authentication/content headers (13.288035ms)
✔ all four negative-auth cases stay 401 without data for production and requests without Origin (21.659747ms)
✔ no token: no requests, no numbers or data in the dashboard DOM (9.829881ms)
✔ frontend login and data requests go directly to Edge with no cookies or API key (10.26821ms)
✔ expired or rejected token: return to password screen and erase localStorage (3.424853ms)
✔ authenticated data appears only after verification; expiry erases all rendered data (15.490806ms)
✔ logout while a data request is in flight cannot redisplay a stale response (2.176006ms)
✔ leaving the page clears data and cancels any in-flight rendering (2.705208ms)
✔ reference view switches, pair filters, search and sortable columns compose (2.055393ms)
✔ reference summary, warning, AI badges and static next steps retain their meaning (0.413221ms)
✔ heatmap cells expose keyboard buttons, symmetric selection and disabled empty intersections (0.692886ms)
✔ frontend heatmap, view, chip and column handlers update the vendor list (5.850027ms)
✔ first-wave and candidate predicates use normal counts and exclusive thresholds (0.264533ms)
✔ every missing or invalid normal field makes both KPIs unknown instead of zero (6.557721ms)
✔ 32 qualifying mock vendors render 21 first-wave and 11 candidates with correct takeaway (0.942351ms)
✔ candidate view preserves search, pair filtering, sorting and pagination (0.391996ms)
✔ seven platform source badges classify three survey and four database sources exactly (1.273916ms)
✔ missing survey names warn with exact missing names and leave static scope notes intact (0.592086ms)
✔ AI methods and nonzero missing-ID counts are generated dynamically without duplicated notes (0.328583ms)
✔ data response timestamps use fixed Taipei minute format including midnight and date rollover (0.393173ms)
✔ frontend candidate control, source badges and singular data explanations render together (7.764647ms)
✔ frontend puts version warning above KPI and preserves notes when a survey name is absent (6.647905ms)
✔ new public notes and labels contain no personal, client or database identifiers (0.564077ms)
✔ cloud marketplace plus III survey counts only one evidenced program (9.348413ms)
✔ government platform listings and procurement qualification do not add programs (1.828343ms)
✔ two evidenced programs survive while SME platform is excluded (2.395404ms)
✔ all six allowed names count; all four excluded names and future names do not (5.580936ms)
✔ only excluded or unknown sources return zero and an empty detail list (1.746611ms)
✔ deduplicates trimmed names without normalizing 台 to 臺 (1.389026ms)
✔ existing query excludes confirmed retired prefixes but retains suspected retirement and NULL (1.420477ms)
✔ unlinked companies and empty sources cannot contribute to another company (1.016136ms)
✔ p labels and solution rows remain present even when sources do not count (1.187445ms)
✔ legacy Airtable source flag is ignored; the same Supabase program evidence is returned (1.060048ms)
(node:3101) ExperimentalWarning: stripTypeScriptTypes is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
✔ standalone Edge Function imports only npm/jsr packages, with no local or dynamic imports (2.588629ms)
✔ browser and inline MCP definitions independently load identical placeholder lists and behavior (3.05231ms)
✔ eight real SDK registrations advertise Chinese title and object output schemas (12.347719ms)
✔ real SDK HTTP tools/list and tools/call preserve structured/text responses (67.606868ms)
✔ describe_data: success validates against actual outputSchema; touch exactly once before queries (4.471676ms)
✔ search_solutions: success validates against actual outputSchema; touch exactly once before queries (6.94062ms)
✔ search_companies: success validates against actual outputSchema; touch exactly once before queries (6.598972ms)
✔ get_solution: success validates against actual outputSchema; touch exactly once before queries (4.84597ms)
✔ get_solutions: success validates against actual outputSchema; touch exactly once before queries (4.401511ms)
✔ data_status: success validates against actual outputSchema; touch exactly once before queries (3.990408ms)
✔ whoami: success validates against actual outputSchema; touch exactly once before queries (3.337121ms)
✔ count_solutions: success validates against actual outputSchema; touch exactly once before queries (2.978715ms)
✔ search_solutions: one search RPC with city=undefined, global totals and page-only enrichment (4.97297ms)
✔ search_solutions: one search RPC with city=["台北市"], global totals and page-only enrichment (2.999933ms)
✔ search_companies: one RPC, totals beyond former cap, sentinel excluded, per-company counts not five previews (3.261896ms)
✔ company count-only sentinel preserves totals, including empty out-of-range page (3.405473ms)
✔ normal_only wins, forwarded unchanged; notes retain city, conflict, partial failure and suspect instruction in <=3 entries (3.030033ms)
✔ include_delisted scope does not mislabel confirmed delisted as normal in summary (5.195687ms)
✔ no next page at final row; omit empty summary context and unknown clause (17.423324ms)
✔ zero result is not error and suggests next step: {"keyword":"入住自動化"} (4.553824ms)
✔ zero result is not error and suggests next step: {"city":["臺北市"]} (2.627676ms)
✔ zero result is not error and suggests next step: {"category":["資安"],"program":["來源"],"max_price":0,"is_ai":false,"is_gov":true,"is_startup":false} (3.437662ms)
✔ zero result is not error and suggests next step: {"normal_only":true} (2.553055ms)
✔ zero companies keeps city unknown count and suggests unknown records (4.452796ms)
✔ solution empty RPC page reports counting limitation without extra RPC (2.284311ms)
✔ handler error is sanitized Chinese JSON; actual SDK skips output validation for isError (3.721355ms)
✔ handler failure logs the actual error only to console, not to the user response (2.893183ms)
✔ non-Error handler failure is logged using String(err), while response remains sanitized (2.462549ms)
✔ touch fail-open / observe-only: {"touch":{"error":{"message":"private"},"data":null}} (2.739264ms)
✔ touch fail-open / observe-only: {"throwTouch":true} (4.84084ms)
✔ touch fail-open / observe-only: {"touch":{"data":[{"over_limit":true,"limit_per_minute":30}],"error":null}} (4.612056ms)
✔ injected enforce=true blocks before handler, with deterministic retry seconds (2.966377ms)
✔ describe topics index/default, all and every section preserve v1.1 except specified edits (44.434937ms)
✔ protected five handlers retain query/body logic except specified name display changes (8.683131ms)
✔ migration hash pinned, skill exact appendix hash, old scanning removed, no business writes/private RPC (1.263927ms)
✔ all four name outputs and actual schemas: null (13.653822ms)
✔ all four name outputs and actual schemas: undefined (13.311322ms)
✔ all four name outputs and actual schemas: "" (10.416267ms)
✔ all four name outputs and actual schemas: "  " (9.317614ms)
✔ all four name outputs and actual schemas: "缺" (12.279948ms)
✔ all four name outputs and actual schemas: " 缺 " (25.09001ms)
✔ all four name outputs and actual schemas: "缺漏" (27.266675ms)
✔ all four name outputs and actual schemas: "待補" (13.582279ms)
✔ all four name outputs and actual schemas: "無" (12.62192ms)
✔ all four name outputs and actual schemas: "-" (9.704446ms)
✔ all four name outputs and actual schemas: "—" (9.643744ms)
✔ all four name outputs and actual schemas: "N/A" (12.104888ms)
✔ all four name outputs and actual schemas: "NA" (9.160387ms)
✔ all four name outputs and actual schemas: "null" (8.994482ms)
✔ all four name outputs and actual schemas: "?" (8.35799ms)
✔ all four name outputs and actual schemas: "？" (11.068608ms)
✔ all four name outputs and actual schemas: "律果簽" (9.94515ms)
✔ all four name outputs and actual schemas: "HackMD" (13.723853ms)
✔ all four name outputs and actual schemas: "AI" (19.836596ms)
✔ all four name outputs and actual schemas: " AI " (14.252695ms)
✔ describe_data: 42501 denies access before any query or handler and logs server-side (4.686927ms)
✔ search_solutions: 42501 denies access before any query or handler and logs server-side (3.782437ms)
✔ search_companies: 42501 denies access before any query or handler and logs server-side (3.958874ms)
✔ get_solution: 42501 denies access before any query or handler and logs server-side (3.148425ms)
✔ get_solutions: 42501 denies access before any query or handler and logs server-side (3.026281ms)
✔ data_status: 42501 denies access before any query or handler and logs server-side (2.308476ms)
✔ whoami: 42501 denies access before any query or handler and logs server-side (2.060588ms)
✔ count_solutions: 42501 denies access before any query or handler and logs server-side (1.592283ms)
✔ summary city text uses official 臺 while RPC parameters and keyword stay unchanged (8.586615ms)
✔ describe_data index uses the first complete sentence, not a list heading fragment (3.180756ms)
✔ name display preserves RPC page order, scores, totals and request parameters (4.082923ms)
✔ missing name null uses the unified label (2.076859ms)
✔ missing name undefined uses the unified label (0.209179ms)
✔ missing name "" uses the unified label (0.092616ms)
✔ missing name "  " uses the unified label (0.08353ms)
✔ missing name "缺" uses the unified label (0.177969ms)
✔ missing name " 缺 " uses the unified label (0.131731ms)
✔ missing name "缺漏" uses the unified label (0.165823ms)
✔ missing name "待補" uses the unified label (0.269ms)
✔ missing name "無" uses the unified label (0.204214ms)
✔ missing name "-" uses the unified label (0.42664ms)
✔ missing name "—" uses the unified label (0.148874ms)
✔ missing name "N/A" uses the unified label (0.163626ms)
✔ missing name "NA" uses the unified label (0.106958ms)
✔ missing name "null" uses the unified label (0.121721ms)
✔ missing name "?" uses the unified label (0.123637ms)
✔ missing name "？" uses the unified label (0.27591ms)
✔ provided name "律果簽" is preserved exactly (0.150634ms)
✔ provided name "HackMD" is preserved exactly (0.082476ms)
✔ provided name "AI" is preserved exactly (0.072772ms)
✔ provided name " AI " is preserved exactly (0.072066ms)
✔ provided name "缺工管理" is preserved exactly (0.121949ms)
✔ provided name "NA 平台" is preserved exactly (0.140816ms)
✔ provided name "Null Analytics" is preserved exactly (0.043888ms)
✔ name A-Z keeps missing names last, stable, without sorting by the fallback label (12.50519ms)
✔ all pages rendering solution names load the same helper and stylesheet (4.959677ms)
✔ same-score groups put missing names last without changing relevance priority (1.459032ms)
✔ price and company groups put missing names last without reordering the groups (1.799127ms)
✔ openROIModal normalizes stored names and preserves the missing style flag (2.956667ms)
✔ company solution list button: null renders （名稱未提供） with correct missing style (0.42858ms)
✔ company solution list p: null renders （名稱未提供） with correct missing style (0.178648ms)
✔ company solution list button: "缺" renders （名稱未提供） with correct missing style (0.091027ms)
✔ company solution list p: "缺" renders （名稱未提供） with correct missing style (0.075565ms)
✔ company solution list button: "HackMD" renders HackMD with correct missing style (0.125603ms)
✔ company solution list p: "HackMD" renders HackMD with correct missing style (0.221018ms)
✔ company solution list keeps the delisted filter and stable missing-last order within each source (0.557069ms)
✔ solutions: same fixture produces deep-equal JSON, requests and logs (37.305493ms)
✔ solutions: missing SUPABASE_URL preserves 500 response (0.501104ms)
✔ solutions: missing SUPABASE_ANON_KEY preserves 500 response (0.486987ms)
✔ solutions: HTTP 500 preserves error handling (2.36736ms)
✔ solutions: network failure preserves error handling (1.603818ms)
✔ solutions: ignored legacy source flag airtable still reads Supabase (2.766485ms)
✔ solutions: ignored legacy source flag unset still reads Supabase (2.705068ms)
✔ solutions: ignored legacy source flag invalid-value still reads Supabase (2.281582ms)
✔ solutions: authentication behavior remains unchanged (0.586015ms)
✔ cases: same fixture produces deep-equal JSON, requests and logs (2.444987ms)
✔ cases: missing SUPABASE_URL preserves 500 response (0.561293ms)
✔ cases: missing SUPABASE_ANON_KEY preserves 500 response (0.260025ms)
✔ cases: HTTP 500 preserves error handling (0.461825ms)
✔ cases: network failure preserves error handling (0.46771ms)
✔ cases: ignored legacy source flag airtable still reads Supabase (1.58499ms)
✔ cases: ignored legacy source flag unset still reads Supabase (0.545526ms)
✔ cases: ignored legacy source flag invalid-value still reads Supabase (0.509434ms)
✔ cases: authentication behavior remains unchanged (0.60668ms)
✔ stats: same fixture produces deep-equal JSON, requests and logs (5.055199ms)
✔ stats: missing SUPABASE_URL preserves 500 response (0.33166ms)
✔ stats: missing SUPABASE_ANON_KEY preserves 500 response (0.254761ms)
✔ stats: HTTP 500 preserves error handling (0.629773ms)
✔ stats: network failure preserves error handling (1.019615ms)
✔ stats: ignored legacy source flag airtable still reads Supabase (3.289177ms)
✔ stats: ignored legacy source flag unset still reads Supabase (1.886396ms)
✔ stats: ignored legacy source flag invalid-value still reads Supabase (1.759975ms)
✔ stats: authentication behavior remains unchanged (1.855657ms)
✔ companies: same fixture produces deep-equal JSON, requests and logs (4.031275ms)
✔ companies: missing SUPABASE_URL preserves 500 response (0.169874ms)
✔ companies: missing SUPABASE_ANON_KEY preserves 500 response (0.164583ms)
✔ companies: HTTP 500 preserves error handling (0.533185ms)
✔ companies: network failure preserves error handling (0.346942ms)
✔ companies: ignored legacy source flag airtable still reads Supabase (1.460535ms)
✔ companies: ignored legacy source flag unset still reads Supabase (1.479857ms)
✔ companies: ignored legacy source flag invalid-value still reads Supabase (1.237715ms)
✔ companies: authentication behavior remains unchanged (0.203276ms)
✔ companies: filter=startup output remains identical (1.743643ms)
✔ companies: filter=award output remains identical (1.163117ms)
✔ companies: filter=large output remains identical (1.117347ms)
✔ companies: filter=ai output remains identical (2.42214ms)
✔ companies: filter=erp output remains identical (0.886945ms)
✔ companies: filter=sec output remains identical (0.799218ms)
✔ companies: filter=unknown output remains identical (0.604802ms)
✔ companies: default 200-item limit remains identical (3.911974ms)
✔ cases: non-GET still returns 405 (0.236632ms)
✔ cases: industry-code lookup failure retains raw codes (0.894416ms)
✔ stats: maintenance failure remains null without failing other statistics (8.418389ms)
✔ solutions: optional data_source failure remains graceful (2.244102ms)
✔ solutions: multi-page requests remain identical (57.774588ms)
✔ stats: multi-page requests remain identical (19.964483ms)
✔ companies: multi-page requests remain identical (12.179028ms)
✔ solutions: exact-page 416 handling remains identical (55.176312ms)
✔ stats: exact-page 416 handling remains identical (20.147796ms)
✔ four read APIs and public assets contain no live Airtable/source-switch references (47.032882ms)
ℹ tests 283
ℹ suites 0
ℹ pass 283
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 1535.403199
```

## 完整輸出：既有 28 案例產生器（exit 0，未執行 SQL）

```text
案例數: 28 ｜fixture.sql 4978 bytes｜cases.sql 12539 bytes
範例（A1 預期）: S09,S10,S27,S16,S01,S03,S04,S05,S26,S06,S07,S22
```

## 完整輸出：瀏覽器 mock 檢查（exit 0）

```json
[
  {
    "viewport": "desktop",
    "result": "PASS",
    "dimensions": {
      "width": 1440,
      "documentWidth": 1440,
      "names": [
        {
          "name": "SME AI平台",
          "height": 19.796875,
          "lineHeight": 19.8,
          "right": 218.46875
        },
        {
          "name": "雲市集工業館",
          "height": 19.796875,
          "lineHeight": 19.8,
          "right": 229.015625
        },
        {
          "name": "新創嚴選網",
          "height": 19.796875,
          "lineHeight": 19.8,
          "right": 217.015625
        },
        {
          "name": "商業服務業專區",
          "height": 19.796875,
          "lineHeight": 19.8,
          "right": 241.015625
        },
        {
          "name": "政府軟體採購網",
          "height": 19.796875,
          "lineHeight": 19.8,
          "right": 241.015625
        },
        {
          "name": "農業雲市集-數位館",
          "height": 19.796875,
          "lineHeight": 19.8,
          "right": 257.171875
        },
        {
          "name": "新北產業AI化輔導計畫",
          "height": 19.796875,
          "lineHeight": 19.8,
          "right": 275.828125
        }
      ]
    },
    "errors": [],
    "unexpected_network": [],
    "checks": [
      "KPI 21/11",
      "candidate and first filters",
      "search",
      "heatmap and chip",
      "3/4 source badges",
      "static notes",
      "single-line platform names",
      "no horizontal page overflow"
    ]
  },
  {
    "viewport": "desktop",
    "scenario": "missing normal field and survey name",
    "result": "PASS"
  },
  {
    "viewport": "mobile-375",
    "result": "PASS",
    "dimensions": {
      "width": 375,
      "documentWidth": 375,
      "names": [
        {
          "name": "SME AI平台",
          "height": 19.796875,
          "lineHeight": 19.8,
          "right": 92.46875
        },
        {
          "name": "雲市集工業館",
          "height": 19.796875,
          "lineHeight": 19.8,
          "right": 103.015625
        },
        {
          "name": "新創嚴選網",
          "height": 19.796875,
          "lineHeight": 19.8,
          "right": 91.015625
        },
        {
          "name": "商業服務業專區",
          "height": 19.796875,
          "lineHeight": 19.8,
          "right": 115.015625
        },
        {
          "name": "政府軟體採購網",
          "height": 19.796875,
          "lineHeight": 19.8,
          "right": 115.015625
        },
        {
          "name": "農業雲市集-數位館",
          "height": 19.796875,
          "lineHeight": 19.8,
          "right": 131.171875
        },
        {
          "name": "新北產業AI化輔導計畫",
          "height": 19.796875,
          "lineHeight": 19.8,
          "right": 149.828125
        }
      ]
    },
    "errors": [],
    "unexpected_network": [],
    "checks": [
      "KPI 21/11",
      "candidate and first filters",
      "search",
      "heatmap and chip",
      "3/4 source badges",
      "static notes",
      "single-line platform names",
      "no horizontal page overflow"
    ]
  },
  {
    "viewport": "mobile-375",
    "scenario": "missing normal field and survey name",
    "result": "PASS"
  }
]
```
