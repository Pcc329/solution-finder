# 首頁方案數載入狀態修正

- PR：https://github.com/Pcc329/solution-finder/pull/292
- 分支：`fix/homepage-count-loading`；新建 PR，未合併，未啟用自動合併。
- 分支起點：於 2026-10-20 重新 fetch 的最新 `origin/main`，`f868c046391b8e4a1614d1cde478b659ab15c64a`。
- 初版程式碼提交：`4fc55a3ec02e97a2a934608a9ffb7137cb093cad`；本次審查修正沿用同一分支與 PR。

## 修正

- 檔案：`public/index.html` 第 1183 行。
- 首頁標題區原先直接顯示 `allData.length.toLocaleString()`，初始空陣列會造成載入完成前顯示 0。
- 依審查意見改為 `loading || error ? "—" : allData.length.toLocaleString()`，使用頁面既有 `loading` 與 `error` 狀態。載入中或載入失敗皆視為未知，只有成功載入後顯示筆數。
- 不用 `allData.length === 0` 判斷載入狀態；載入完成後真實零筆仍顯示 0。
- 保留業者數的既有行為、文字、樣式、版面與 API。首頁程式碼只修改此一運算式，未新增狀態。

## 驗證

| 狀態 | allData.length | 方案數顯示 | 結果 |
| --- | --- | --- | --- |
| loading=true | 0 | — | 通過 |
| loading=true | 42 | — | 通過，確認不依賴長度判斷 |
| loading=false | 0 | 0 | 通過 |
| loading=false | 2268 | 2,268 | 通過，保留千分位 |

- 從實際標題 JSX 擷取運算式執行上述檢查。
- 完整首頁 JSX 以 Babel classic React preset 編譯成功。
- 與分支起點比對，確認 public/index.html 僅有指定一行的運算式差異；既有 script 標籤與樣式不變。
- `git diff --check` 通過。

## 初版 Preview 截圖驗收（載入中與成功；審查前紀錄）

- Vercel 程式碼部署 check：success，2026-10-20 17:02（Asia/Taipei），對應程式碼提交 `4fc55a3`。
- 後續提交 `a263fe2f1a68defff7db765abb99a5d1a8027070` 僅新增 SYNC，首頁程式碼相同；本次從分支 Preview 實際驗收。
- 部署紀錄：https://vercel.com/patrick0814-6136s-projects/solution-finder/3j4VCvksdzwnEbBsLZzTuZ1EB6Rn
- 程式碼固定 Preview：https://solution-finder-ik11zeo55-patrick0814-6136s-projects.vercel.app/
- 實際驗收的分支 Preview：https://solution-finder-git-fix-homep-c26b62-patrick0814-6136s-projects.vercel.app/
- 使用者手動登入後重新載入頁面，直接擷取真實資料請求期間的畫面及資料載入完成畫面。
- 載入中：首頁標題區顯示「收錄 — 筆數位轉型方案與 — 家資服業者」；同次重新載入的 accessibility tree 顯示「資料載入中...」按鈕停用及「正在讀取方案資料...」。
- 載入完成：首頁標題區顯示「收錄 2,268 筆數位轉型方案與 1,102 家資服業者」。實際數量隨資料庫更新而變化。
- 兩張截圖均為瀏覽器原始 viewport JPEG，1265 × 490；頁面 clientWidth 與 scrollWidth 皆 1265，無水平溢位。
- 沒有模擬 API 回覆、修改 DOM／React 狀態、略過登入或後製截圖。載入狀態透過正常重新載入捕捉。
- 本次最後提交僅補 SYNC 與兩張截圖，不再修改首頁程式碼。

### 載入中

![Preview：方案資料載入中，方案數顯示破折號](evidence/homepage-count-loading-20261020/loading.jpg)

### 載入完成

![Preview：方案載入完成後顯示 2,268 筆](evidence/homepage-count-loading-20261020/loaded.jpg)

## 審查修正：載入失敗顯示未知筆數

- 本次修改 `public/index.html` 第 1183 行，計數改用 `loading || error`；其餘首頁程式碼不變。
- 新增可重跑的回歸測試：`tests/homepage-count-loading.test.cjs`。
- 測試從實際 index.html 擷取 `fetchAll` 函式與標題區計數運算式，在 Node VM 中執行；mock fetch 對 `/api/solutions` 回傳 HTTP 500，沒有呼叫正式 API。
- HTTP 500 實際執行既有 catch 後，驗證 `loading === false`、`error === "API error: 500"`、`allData.length === 0`，計數運算式結果為「—」。
- 另驗證網路拒絕回應顯示「—」、載入中即使已有資料仍顯示「—」、成功空陣列顯示 0、成功 2268 筆顯示 2,268。
- 驗證指令：`node --test tests/homepage-count-loading.test.cjs`，5 項全部通過。
- 完整首頁 JSX classic React 編譯及 `git diff --check` 通過。

### 既有錯誤頁與驗證範圍

頁面已有 `if (error) return (...)`（第 1161 行），方案 API 失敗時會以「載入失敗」畫面取代首頁，標題區本身不會顯示。本次依要求僅加入計數的 error 判斷，沒有移除錯誤頁、改變版面，或聲稱在錯誤頁看見標題區的「—」。mock 驗證涵蓋真實 fetchAll 的錯誤狀態轉換與真實標題計數運算式；上方截圖是先前載入中／成功的實際 Preview 證據，不是此次 mock 失敗狀態的截圖。
