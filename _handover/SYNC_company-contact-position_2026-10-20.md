# SYNC — 公司頁聯絡資訊位置與方案來源排序

- 日期：2026-10-20（Asia/Taipei）
- 分支：`feat/company-contact-position`
- 基準：最新 `origin/main`，`666b9bd3ea6972ca3c43dc6b4c956bc3e3739c9b`
- 程式提交：`50f6051595c39c25051936d9d3ae60d3e04334ac`
- PR：https://github.com/Pcc329/solution-finder/pull/264 （base: main；保持 OPEN，未 merge）

## 變更範圍

本 PR 的產品程式只調整 `public/index.html` 的 `renderCompany`：任務一將聯絡卡搬到公司檔案後方，任務二調整來源群組與組內方案排序。下列先記錄任務一，任務二與最新驗收結果見文末。

指定區塊依序為：

1. 公司檔案（標題、標籤、四個統計卡片）。
2. 聯絡資訊卡片，維持預設收合。
3. 此公司收錄的方案皆已下架提示，原判斷 `solutions.length > 0 && listedTotal === 0` 完全不變。
4. 方案與來源，含原本的「顯示已下架方案」勾選。
5. 頁尾說明文字。

既有獲獎紀錄的位置與顯示邏輯維持原樣。公司查詢錯誤訊息仍在原本的全下架提示之前。

`ContactInfoCard` 本體、傳入的 key／item／cache／pending、`renderDetail` 與所有 API 均未變動。首次展開才呼叫 `/api/company-detail`，成功快取與 pending 去重沿用原行為；展開後的存取紀錄寫入也沿用 API 既有邏輯，未增加任何呼叫。

除了本 SYNC，不更動其他頁面、API、設定或依賴檔案。

## Mock 與程式範圍驗證

使用實際 `renderCompany` JSX 經既有 Babel 測試工具轉譯，以合成資料執行，不連線真實資料庫：

- 全下架、正常、空方案 × `showDelisted` false／true，共 6 個情境通過。
- 全下架情境確認五個指定區塊順序；其他情境確認提示不出現，聯絡卡仍在公司檔案與方案清單之間。
- 四個統計卡、下架勾選及方案顯示、唯一一個聯絡元件與原 props 參照均通過。
- 執行原 `ContactInfoCard` 與合成 React hooks：預設 `aria-expanded=false`；展開前 API 0 次；首次展開 API 1 次；收合未增加請求。
- 與基準逐一比較所有具名函式，除 `renderCompany` 之外均保持相同；`App` 扣除該函式後也相同，包含 `ContactInfoCard` 及 `renderDetail`。
- 完整 JSX 語法檢查、script／link 標籤不變、`git diff --check` 通過。
- 本機驗證腳本：repo 外 `../_company_contact_position_validation/mock-check.cjs`。

## 既有測試（任務一）

| 指令 | 結果 |
| --- | --- |
| `node --test tests/*.test.mjs` | 175/175 PASS |
| `node --test tests/sf-mcp/sf-mcp-v1-2.test.mjs` | 66/66 PASS |
| 合計 | 241/241 PASS，0 fail、0 skipped |

包含 `contact-access-log.test.mjs` 對成功回應只寫入一筆 `contact_access_logs` 等既有行為的驗證。沒有測試因區塊順序而失敗，因此不需要更新既有測試。

## Preview 驗收（任務一）

- [Vercel 部署](https://vercel.com/patrick0814-6136s-projects/solution-finder/3JN44nHGM6FUaMt41UrpkGMAjBnz)：Ready；Source `50f6051`，分支 `feat/company-contact-position`。
- [Preview](https://solution-finder-r5p12dw80-patrick0814-6136s-projects.vercel.app/)
- [分支 Preview](https://solution-finder-git-feat-comp-3739ce-patrick0814-6136s-projects.vercel.app/)
- 驗收日期：2026-10-20（Asia/Taipei）。使用者自行登入新 Preview 後，以頁面「查公司」輸入 `96979933`，實際即時查詢得到「中華電信股份有限公司」。未以 mock 替代 Preview。
- 四個統計值為：收錄方案 26、正常 5、未逐筆確認 21、來源平台數 3。
- 桌機 viewport 1920 × 855、手機 viewport 375 × 855，兩者均確認公司檔案（含四個統計卡）→聯絡資訊卡片→方案與來源，沒有水平溢出。此公司沒有全下架，提示未顯示，符合原條件。
- 桌機：公司檔案 bottom 423、聯絡卡 top 443／bottom 511、方案區 top 531；兩段卡片間距皆為 20px。
- 375px：公司檔案 bottom 596.5、聯絡卡 top 616.5／bottom 700.5、方案區 top 720.5；兩段卡片間距皆為 20px。
- 擷取前確認 `aria-expanded="false"` 與聯絡內容 `hidden=true`；全程未展開聯絡卡，截圖不包含真實聯絡資料。
- 兩張截圖保存於 repo 外 `../_company_contact_position_validation/`，避免將額外圖檔納入程式變更：
  - `company-96979933-desktop.jpg`：桌機。
  - `company-96979933-375.jpg`：375px 寬。
- 截圖已隨最終回覆交付；驗收後已重設瀏覽器 viewport。

## 任務二 — 方案與來源排序（同一 PR）

### 行為

- 來源群組：`normal` 數量降冪 → `suspected` 數量降冪 → 首次出現順序。移除原本依「非已下架總數」及來源名稱排序的規則。
- 群組內：`normal` → `suspected` → `delisted`，同狀態再由 `isMissingSolutionName` 將名稱缺漏移到該狀態末尾，同條件保留原順序。使用標準穩定 `Array.sort`，篩選後排序不改動 API 原陣列。
- 保留 `activeCount` 的原計算，來源平台數仍包含正常／疑似下架的來源。其他三個統計值、`visible.length` 群組筆數、顯示已下架的預設 false、篩選與切換處理均未修改。
- 聯絡卡位置與原本收合／API／快取／存取記錄行為不變；方案詳情頁及所有 API 不變。

### 單元測試與回歸

新增 `tests/company-sorting.test.mjs`，直接執行 `renderCompany` 的實際分組程式與實際 `visible` 運算式，沒有複製排序實作：

1. 兩個來源、三種狀態、正常數與總數相反的 mock；每種狀態都有具名及多筆缺漏名稱，驗證群組順序、組內狀態優先、缺漏置後與同條件穩定順序。
2. 正常數相同時比較疑似下架數，已下架數不影響排序。
3. 正常與疑似下架數都相同，來源依首次出現順序，無字母排序。
4. 純疑似及純已下架來源位於有正常方案的來源之後。
5. 驗證統計、群組篩選筆數、下架開關、原始資料不變。

既有 `tests/solution-name.test.mjs` 取得 `visible` 運算式後，新增載入同一實作的 `statusOrder`，以補齊新增的局部依賴；既有期望值全部保留，並未放寬斷言。

| 指令 | 最新結果 |
| --- | --- |
| `node --test tests/*.test.mjs` | 180/180 PASS |
| `node --test tests/sf-mcp/sf-mcp-v1-2.test.mjs` | 66/66 PASS |
| 合計 | 246/246 PASS，0 fail、0 skipped |

另重跑任務一 JSX mock、收合／首次展開 API 行為及基準範圍檢查，全部通過。

### 最新 Preview 驗收

待本次程式提交部署後，以 96979933（中華電信）查詢確認來源順序，完成後補入實際結果。
