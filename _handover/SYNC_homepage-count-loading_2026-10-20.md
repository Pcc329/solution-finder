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

## Preview 截圖狀態

- Vercel check：success。
- 部署完成：2026-10-20 17:02（Asia/Taipei），對應程式碼提交 4fc55a3。
- 部署紀錄：https://vercel.com/patrick0814-6136s-projects/solution-finder/3j4VCvksdzwnEbBsLZzTuZ1EB6Rn
- 固定 Preview：https://solution-finder-ik11zeo55-patrick0814-6136s-projects.vercel.app/
- 分支 Preview：https://solution-finder-git-fix-homep-c26b62-patrick0814-6136s-projects.vercel.app/
- 實際開啟分支 Preview 後，頁面要求共用密碼登入；尚未登入的方案 API 回傳 401。
- 已請使用者手動登入並保留 Chrome 分頁。載入中與載入完成的實際 Preview 截圖仍待擷取，尚未完成這項驗收。
- 未略過登入、未用模擬資料或修改頁面文字冒充 Preview 截圖。
