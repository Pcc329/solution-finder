# 首頁方案數載入狀態修正

- PR：https://github.com/Pcc329/solution-finder/pull/292
- 分支：`fix/homepage-count-loading`；新建 PR，未合併，未啟用自動合併。
- 分支起點：於 2026-10-20 重新 fetch 的最新 `origin/main`，`f868c046391b8e4a1614d1cde478b659ab15c64a`。
- 程式碼提交：`4fc55a3ec02e97a2a934608a9ffb7137cb093cad`。

## 修正

- 檔案：`public/index.html` 第 1183 行。
- 首頁標題區原先直接顯示 `allData.length.toLocaleString()`，初始空陣列會造成載入完成前顯示 0。
- 改為 `loading ? "—" : allData.length.toLocaleString()`，使用頁面既有 `loading` 狀態。
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

## Preview 截圖驗收（完成）

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
