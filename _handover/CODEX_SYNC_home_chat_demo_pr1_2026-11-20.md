# 首頁對話示範 PR-1｜驗收結果

- 更新：2026-11-23，Asia/Taipei。
- Repo：Pcc329/solution-finder。
- 分支：codex/home-chat-demo-pr1-2026-11-20。
- 基底：b6f2c1455f9036c2cbdc6f44d19ed9a8a662ab14。11/23 開工前確認 HEAD、本機 origin/main、遠端 main 相同且工作區乾淨。
- **瀏覽器驗收與 3×4 高度矩陣全部通過。**全部單元測試 Node 回報 417 項，412 通過、5 項「既有失敗、與本 PR 無關」。
- **未 commit、push、開 PR 或 merge**。依使用者指示，等確認後才進行。

## 決策、範圍與例外

- 第 0 節四項決策維持：淺色主視覺、原有標題文字及三段 inline-block 斷行、導覽另案、「1 點（示意）」露出。
- 品牌名稱、上方小字、主標文字不改；搜尋分頁、表單、AI 搜尋與載入提示結構及行為保留。
- 搜尋卡片新增 border-slate-200 細框，移除 shadow-lg，讓淺色背景上的卡片邊界清楚且減少陰影重量。
- 不改 API、導覽列及其他頁面、熱門篩選、主題區導覽。不製作第二個輸入框、DATA SOURCES 或介紹影片。
- **錯誤頁維持現狀、載入失敗欄位不適用**：依使用者 11/20 決定，保留基底 public/index.html:1418–1425 的整頁錯誤處理（本次檔案為 :1412–1419）。載入失敗時仍顯示整頁錯誤畫面，因此規格第 3 節「載入失敗」整欄視為不適用，沒有為示範區塊改寫錯誤頁。

## 修改清單

行號對應本次工作區檔案；明示「基底」者對應 b6f2c14。

| 檔案／行號 | 修改 |
|---|---|
| public/home-demo.js:1–44 | 新增 classic script / IIFE，暴露 globalThis.HomeDemo；選題、結果筆數與來源統計 |
| public/index.html:14 | 載入 home-demo.js |
| public/index.html:142–151 | 首頁對話樣式及高度占位 |
| public/index.html:597–598 | 計算 demoCombo、demoSources；移除 initialExamples、quickSearchExamples |
| public/index.html:1431–1439 | 示範問句與找公司切換、捲動及焦點 |
| public/index.html:1441–1548 | 淺色主視覺、膠囊、三輪對話；移除舊 chips |
| public/theme.css:10–14 | 淺色 hero 與問句 token，移除 chip token |
| tests/home-demo.test.mjs:1–85 | 新增 7 項選題、計數、排序、來源統計測試 |
| tests/example-combos.test.mjs:17–18 | PR #314 既有測試兩處 cat 假資料改為字串，保留筆數及斷言 |
| tests/example-combos.test.mjs:66–94 | 將第 5、6 項舊 chips 測試及專用 helper 改為對話示範測試 |
| tests/theme-tokens.test.mjs:8–26 | 更新 token 清單 |
| 本 SYNC 與 evidence/home-chat-demo-pr1-2026-11-20/ | 交接、完整單元測試輸出、量測與截圖 |

exampleCombos、placeholderCombos、handleQuickSearch、public/example-combos.js 及輪播保留。selectDistinctExampleCombos 不再由首頁呼叫，依規格仍保留該函式及既有測試；formatCategoryExample 仍由輪播使用。

## 篩選邏輯與選題

- resultCount 照搬基底 public/index.html:1164、1170 的判斷；本次結果頁同一段位於 :1158、1164，完整 filteredResults 起於 :1155。HomeDemo 判斷位於 public/home-demo.js:13–17。
- 地區：filters.region.length > 0 時要求 filters.region.includes(item.r)。
- 類別：filters.category.length > 0 時要求 item.cat 且 filters.category.some(c => item.cat.includes(c))。
- handleQuickSearch 清除其餘條件，因此兩個判斷即可對應點擊示範後的結果。N 從全部 allData 計數，不限正常狀態。
- 合格門檻由 ExampleCombos 計算，僅 rs === '正常' 且至少 10 筆。優先依 filterRegion === '中部'、category === '生產物流' 配對；不使用組合的「中彰投」顯示別名配對。
- 其餘依最大區域組合、最大全台灣組合、null 退回。正常範例依 id 升冪取前兩筆，再省略缺名稱者；source 為首筆範例資料的來源。
- 三種視窗實測卡片 N=13、結果頁 filteredResults.length=13；其中只有 10 筆正常，另 3 筆非正常，證明兩份計數邏輯與正常門檻分開。

## Token 新舊對照與文字對比

| Token | 舊值 | 新值 |
|---|---|---|
| --sf-hero-bg | #0B3B3A | #F4F7F7 |
| --sf-hero-kicker | #6FDCD8 | #085F5C |
| --sf-hero-title | 無（原為 text-white） | #0B2B2A |
| --sf-hero-lead | #D5E4E4 | #4B5563 |
| --sf-chat-user-bg | 無 | #0B3C3B |
| --sf-hero-chip-border | #2A7B78 | 刪除 |
| --sf-hero-chip-text | #BFEDEB | 刪除 |

以下依 sRGB 相對亮度公式計算，新增及變更區塊文字色彩均 ≥4.5:1；沒有變更原搜尋框 placeholder、其他既有區塊的文字色彩。

| 用途 | 前景／背景 | 對比值 |
|---|---|---:|
| Hero 小字 | #085F5C / #F4F7F7 | 6.96:1 |
| Hero 主標 | #0B2B2A / #F4F7F7 | 13.99:1 |
| Hero 副標、解析文字 | #4B5563 / #F4F7F7 | 7.02:1 |
| 使用者問句 | #FFFFFF / #0B3C3B | 12.18:1 |
| 膠囊、類別 chip | #085F5C / #E1F7F6 | 6.72:1 |
| 區域 chip | #5B21B6 / #F5F3FF | 8.19:1 |
| 回答本文 | #1E293B / #FFFFFF | 14.63:1 |
| 來源／回答小字 | #475569 / #FFFFFF | 7.58:1 |
| 結尾小字 | #475569 / #F4F7F7 | 7.03:1 |
| 來源卡片數字 | #0F172A / #FFFFFF | 17.85:1 |
| 示範按鈕 | #085F5C / #FFFFFF | 7.50:1 |

## 規格第 3 節顯示狀態逐格對照

| 欄位 | 載入中 | 載入失敗 | 欄位缺失 null | 真的是 0 | 正常 |
|---|---|---|---|---|---|
| 膠囊兩個數字 | —／— | 不適用，整頁錯誤 | companyTotal null 顯示 — | [] 與 companyTotal=0 顯示 0／0 | 千分位；固定資料顯示 37／1,103 |
| 第1輪 N、方案名 | N=—、範例=—、按鈕停用 | 不適用，整頁錯誤 | 只列有名稱者；都缺失省略「例如…」 | 無合格組合整輪 visibility:hidden，保留高度 | N=13；正常範例依 id 前兩筆；點擊結果13筆 |
| 第2輪來源卡片 | 七個槽位數字皆 — | 不適用，整頁錯誤 | 空來源不計；空槽位 visibility:hidden | 顯示問句與「目前沒有可顯示的來源」，grid 隱藏占位 | top7 依筆數降冪、同數依名稱；第8格來源連結 |

## 假資料型別與 API 契約

正式程式按字串契約使用 cat：migrations/20261014_sf_mcp_v1_2.sql:127 為 industry_category text；api/solutions.js:296 使用 cat: row.industry_category || ''，:331 直接回傳 converted；index.html:783–786 直接設定 allData，沒有陣列轉換；結果卡片 :2085 使用 item.cat.split(',')。

原假資料混用陣列/null，能通過 includes 卻不符合結果卡片契約。經使用者核准：

| 位置 | 修正 | 未改動 |
|---|---|---|
| tests/home-demo.test.mjs 第4項 :47、48 | 兩處 ['生產物流'] → '生產物流' | 正常門檻10、結果13、未達門檻null等原斷言 |
| 同檔 :49 | cat null → '' | :48 的 rs null 仍保留 |
| tests/example-combos.test.mjs :17、18，PR #314 既有第1項 | 兩處 cat 陣列 → 字串 | 筆數、地區映射、全部斷言 |
| 驗收腳本 :16 | cat 陣列 → 字串 | 固定資料筆數、狀態、預期N |

資料庫層 null 保留：tests/fixtures/supabase-read.fixture.mjs:8 是 API 轉換前的 industry_category null；tests/sf-mcp/sf_search_parity_gen_test.js:45 是原始類別 null，:84 以 r[6] || '' 轉成前端空字串。這些測試驗證資料庫缺值轉換，不應改成 API 輸出假資料。public/home-demo.js 未因這次假資料修正而改動。

## 測試紅燈、綠燈及既有失敗

紅燈：複製新測試後，先確認 home-demo.js 不存在，再執行 node --test tests/home-demo.test.mjs。

```text
False
Error: ENOENT: no such file or directory, open 'C:\Users\S25036\Documents\Codex\repos\solution-finder\public\home-demo.js'
    at readFileSync (node:fs:440:20)
    at file:///C:/Users/S25036/Documents/Codex/repos/solution-finder/tests/home-demo.test.mjs:8:20
Node.js v24.14.1
✖ tests\home-demo.test.mjs (134.4566ms)
ℹ tests 1
ℹ pass 0
ℹ fail 1
```

實作後相關測試綠燈：

```text
node --test tests/home-demo.test.mjs tests/example-combos.test.mjs tests/theme-tokens.test.mjs tests/homepage-count-loading.test.cjs tests/public-brand-copy.test.mjs
ℹ tests 30
ℹ suites 0
ℹ pass 30
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 283.7105
```

假資料修正後執行 tests/ 下全部 *.test.mjs、*.test.cjs，排除 node_modules，含 SF MCP 的四個標準測試檔。sf_search_parity_gen_test.js 是產生 SQL/JSON 的腳本，沒有當作單元測試執行。

```text
ℹ tests 417
ℹ suites 0
ℹ pass 412
ℹ fail 5
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 7380.7754
```

home-demo 7/7、example-combos 7/7 通過。完整原始輸出在 evidence/home-chat-demo-pr1-2026-11-20/all-unit-tests-2026-11-23.log。

五項均標示 **「既有失敗、與本 PR 無關」**，與 PR #314 的 _handover/CODEX_SYNC_rename_and_polish_2026-11-18.md:80–83 一致。經使用者確認，保持不修改：

| 測試位置 | 失敗原因 |
|---|---|
| company-search.test.mjs:334 | git show d392cbc1702e23536227df453ffda22980e4479a:api/companies.js 找不到歷史檔案 |
| contact-access-log.test.mjs:9 | git show 4d47b89:api/company-detail.js，invalid object name |
| supabase-read-equivalence.test.mjs:14 | git show a64548bf28fc445211834d970ad119903a8b8df0:api/solutions.js 找不到歷史檔案 |
| sf-mcp/sf-mcp-v1-2.test.mjs:309 | git show a91e900893fbb68bb0b574c488f38bf9afbe2b9e:supabase/functions/sf-mcp/index.ts 找不到歷史檔案 |
| 同檔 :336 | 同上 |

既有測試刪改清單：example-combos 第5、6項改測對話示範，因首頁 chips 被移除；替換專用 helper 與假資料。第1項僅依核准調整兩處 cat 型別。第2–4、7項及 example-combos.js 所有函式保留。theme-tokens 更新 token 清單，其他檢查不變。home-demo 新增7項，後續僅修正第4項三處 cat。沒有刪除測試，也沒有修改其餘既有測試。

## 44→48px 的診斷、核准與複驗

第一次完整互動驗收通過，但空資料手機 hero 由1563.75變1559.75，依規格停下。後續唯讀診斷掃描78個元素，沒有增刪DOM或margin變化：來源摘要由載入文案兩行48px，變為零來源短句受 min-height 限制的44px；來源grid與第1輪 visibility占位高度均未改變。

使用者只核准 public/index.html:146：.home-demo-source-summary 的 min-height 44px→48px。**最小高度應為行高的整數倍；48px＝2×24px**，以涵蓋手機兩行摘要並維持空資料占位。沒有改文案、行高或其他產品程式。

## 3×4 高度矩陣

每格為「來源摘要高度／hero高度」，單位px。四種狀態在各視窗內完全一致。

| 視窗 | 載入中 | 正常37筆 | 空資料[] | 無合格組合9筆 |
|---|---|---|---|---|
| 1280×800 | 48 / 1305 | 48 / 1305 | 48 / 1305 | 48 / 1305 |
| 768×1024 | 48 / 1305 | 48 / 1305 | 48 / 1305 | 48 / 1305 |
| 375×844 | 48 / 1563.75 | 48 / 1563.75 | 48 / 1563.75 | 48 / 1563.75 |

摘要實際行數：桌機、平板四種狀態各1行；手機依序2、2、1、2行，沒有3行。行高皆24px。

無合格組合測項為9筆正常方案、9個來源；與空陣列的零來源狀態分開驗證。第1輪隱藏後高度桌機／平板仍268px、手機仍292px。零來源grid隱藏後高度桌機／平板仍216px、手機仍440px。

## Playwright 完整驗收結果

執行本機Chrome headless，使用真實首頁檔案與固定API假資料。共37筆，中部生產物流正常10筆、非正常3筆；另24筆北部行銷方案。第一筆來源新創嚴選網，範例名稱為製程參數監控物聯網平台、智慧叫貨雲管家 ProcuraWise。

本機CDN快取 React / React DOM 18.3.1，符合 index.html @18 且互相同版；Babel standalone 7.23.10，與引用完全相同。網站CDN引用未變。

| 檢查 | 預期 | 實際 | 結果 |
|---|---|---|---|
| 1280×800 首屏 | 搜尋框及回答卡片底部≤800 | 輸入 y363,h48,bottom411；回答 y603,h172,bottom775 | 通過 |
| 768×1024 首屏 | 兩元素底部≤1024 | 輸入 y363,h48,bottom411；回答 y603,h172,bottom775 | 通過 |
| 375×844 首屏 | 兩元素底部≤844 | 輸入 y365.75,h48,bottom413.75；回答 y609.75,h172,bottom781.75 | 通過 |
| 3×4 摘要及hero高度 | 各視窗內四種狀態一致 | 如上表 | 通過 |
| 載入中 N／按鈕 | —／停用 | 三種視窗均符合 | 通過 |
| 載入中膠囊兩數字 | —／— | 三種視窗均符合 | 通過 |
| 主標三段文字 | 維持原文 | 三種視窗一致 | 通過 |
| 來源grid | 桌機4、平板4、手機2欄 | 4／4／2 | 通過 |
| N＝結果頁filteredResults.length | 13＝13 | 三種視窗均13＝13 | 通過 |
| 示範搜尋AI呼叫 | 0次 | 三種視窗各0次 | 通過 |
| 手動搜尋AI呼叫 | 1次 | 三種視窗各1次 | 通過 |
| 找公司分頁 | company選中 | 三種視窗均符合 | 通過 |
| 找公司捲動及焦點 | scrollY=0，公司輸入框focus | 三種視窗均符合 | 通過 |
| 正常互動JS錯誤 | 0 | 三種視窗各0 | 通過 |
| 空資料 | 第1輪隱藏占位，膠囊0／0 | 符合；手機hero1563.75前後相同 | 通過 |
| 缺名稱、缺來源、companyTotal null | 省略例如、無來源提示、膠囊廠商— | 10筆有合格組合、兩範例名null及來源null，符合；hero1563.75前後相同 | 通過 |
| 零來源 | 問句與目前沒有可顯示的來源，grid隱藏占位 | 空資料及有方案但p全null兩種測項均符合 | 通過 |
| 無合格組合但有資料 | 第1輪隱藏占位、來源仍可見 | 9筆正常未達10，三視窗均符合 | 通過 |
| 全台灣 | 問句全台灣、無區域chip、回答省略公司地區 | 符合；N及結果12筆、AI0次、hero1563.75前後相同 | 通過 |

```text
PASS: 3 viewports x 4 states; summary and hero heights equal; empty and no-eligible placeholders retained
PASS: browser acceptance, three viewports, result parity, AI counts, focus, loading and empty/null/nationwide states
```

git diff --check 通過。已檢視桌機及手機首屏截圖，搜尋框與完整回答卡片均在指定首屏內。

## 規格外情況與處理紀錄

- 整頁錯誤處理與規格第3節失敗欄位衝突：先回報，使用者決定維持現狀，失敗欄位不適用。
- 驗收腳本CDN相對路徑、cat假資料與筆數locator問題：均停下回報，經確認才修正；未改產品結果頁以配合錯誤假資料。
- PR #314 既有測試兩處cat型別：先搜尋、列出位置，經使用者核准才更正；資料庫層null保留。
- 五項舊commit測試失敗：先回報，依使用者決定保留並標示既有失敗。
- 空資料4px跳動：先量測及唯讀診斷，經使用者核准只改44→48後，三視窗四狀態複驗通過。
- 沒有將其他產品程式修改包進驗證或commit步驟；本輪沒有commit步驟。

## 證據與重現

證據目錄：_handover/evidence/home-chat-demo-pr1-2026-11-20/。

- acceptance.json：完整互動、首屏、AI次數、筆數、各狀態高度，passed=true。
- height-matrix.json：3×4 高度、摘要行數與占位可見性，passed=true。
- home-{1280,768,375}.png、first-screen-{1280,768,375}.png、results-{1280,768,375}.png：三種視窗各三張。
- height-{loading,normal,empty,no-eligible-combo}-{1280,768,375}.png：12張狀態截圖。
- empty-375.png、missing-source-and-names-375.png、nationwide-375.png：剩餘狀態驗收截圖。nationwide截圖為點擊後結果頁。
- all-unit-tests-2026-11-23.log：全部單元測試完整輸出。
- example-combos.test.diff、home-demo.test.new-file.diff：完整測試diff。home-demo尚未追蹤，因此以NUL為基準顯示整個新檔。

本工作區驗收腳本位於 C:/Users/S25036/OneDrive - 易勝資訊股份有限公司/文件/ChatGPT/產業資料庫/_home_chat_pr1_build/：先執行 node height-matrix.cjs，通過後執行 node browser-acceptance.cjs；腳本使用既有CDN快取，不需修改產品程式或連線正式資料庫。
