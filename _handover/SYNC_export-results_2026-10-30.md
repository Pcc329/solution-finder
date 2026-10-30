# 查詢結果輸出開發交接

- 日期：2026-10-30
- 分支：codex/export-results
- 基準：origin/main（87062e3，關卡 1 已確認）
- 目前階段：PPC 已完成 Preview 驗收並決定上線；本次更新驗收交接文件，等待核准 push 與建立 PR，尚未 merge。
- Preview：已建置（網址於對話回報，不寫入 repo）
- 真實驗證方式：Preview 需登入，依 PPC 決定不由代理工具開啟，改由 PPC 親自驗證；以下結果依 PPC 對話回報記錄。
- 完整本機測試：10 個測試檔、273 項通過、0 項失敗；排除 tests/sf-mcp/。
- 驗證證據：PPC 已驗證，證據另行回報；本檔不記錄 Preview 網址、真實筆數、方案名稱或公司名稱。

## 授權與變更範圍

AGENTS.md 禁止修改 api/solutions.js。本次經 repo 擁有者核准例外，僅新增選用欄位讀取；等價測試證明既有回應、請求與日誌除新增欄位外完全不變。此例外不延伸為日後授權。

PPC 另核准第七個等價測試與第八個計畫徽章測試檔案；第八檔精確 diff 已先確認，僅替換原有兩行，其餘內容不變。
未修改資料庫、fixtures、vercel.json、package.json、聯絡資訊相關程式或搜尋核心，未安裝套件。

| 檔案 | 改動／函式 |
|---|---|
| api/solutions.js | 新增選用狀態查詢、recordStatusBySolutionId、statusLoaded、sid、rs；沿用 fetchOptionalSupabaseColumn |
| public/index.html | 僅新增搜尋結果筆數旁的輸出按鈕與 module script |
| public/export-results-core.mjs | statusLabel、normName、mergeProducts、sameCompanyCount、buildCSV、describeQuery |
| public/export-results-panel.mjs | 面板、合併、欄位排序、預覽、按需載入與三種格式；拖曳結束後延後重畫、拖曳中保留節點、CDN anonymous CORS |
| tests/export-results.test.mjs | 核心、公式防護、欄位白名單、格式上限、PDF 流程、拖曳與 CORS 回歸測試 |
| tests/supabase-read-equivalence.test.mjs | solutions 新欄位移除後比較歷史回應、逐頁核對狀態請求及完整字串日誌 |
| tests/program-badge-allowlist.test.mjs | 僅原兩行替換：既有七個請求加恰好一個狀態選用查詢，不修改 mock 或其他斷言 |
| _handover/SYNC_export-results_2026-10-30.md | 實作、驗收結果與後續改進交接 |

## 合併規則與筆數上限

- mergeProducts：依公司編號及 NFKC／去空白／小寫名稱分組；公司編號或正規化名稱為空時各自保留。
- 保留組別首次出現順序；平台去重保序；上架平台數計組內紀錄數；狀態依標籤計數；價格取相同值或範圍；編號全串接；簡述取最長；其他取第一筆。
- sameCompanyCount：以實際輸出列計算同公司方案數，缺公司編號留白，不修改傳入資料。
- exportLimitMessage：PDF／Word 實際輸出最多 500 項；CSV 不限；開關合併後重新計算。
- 合併與正常上架篩選僅作用於輸出，不改首頁 filteredResults、排序、分頁與筆數。

## 上架狀態與優雅降級

- record_status 使用既有 fetchOptionalSupabaseColumn 獨立讀取，不加入 stable select，既有下架篩選不變。
- 選用查詢取得資料時空值轉「正常」；無法取得時 rs 為空字串，不影響其他欄位。
- statusLabel 將空字串／null／undefined 留白，疑似狀態統一顯示「疑似下架」。
- 輸出來源 rs 全空白時，正常上架選項停用並顯示「上架狀態暫時無法讀取」。
- 真實環境反向測試未執行，原因：避免推送暫時性破壞 commit；已由等價測試的 HTTP 與網路失敗情境涵蓋。

## 輸出與互動

- CSV：UTF-8 BOM、CRLF；公式開頭 =、+、-、@、Tab、CR 加單引號後，再執行 CSV 跳脫。
- Word：A4 橫式、Microsoft JhengHei、綠色表頭與重複表頭。
- PDF：每頁最多 20 列、逐頁轉圖；檢查寬高、圖片資料與非全白像素；每頁等比例縮放、不截斷，查詢說明只在首個輸出頁面。
- 任一頁失敗即終止，不回傳完整輸出 blob、不觸發下載；進度顯示頁碼並停用下載。
- 關閉面板取消尚在進行的產生流程並還原焦點。
- 僅提供規格指定的欄位白名單，名稱缺漏沿用既有 displaySolutionName。
- SortableJS 開啟面板時載入；Word／PDF 套件按下載時載入；使用規格固定版本網址並設定 anonymous CORS。
- 按鈕同步不呼叫 React state setter；只處理含入口的新元素，更新屬性與文字前先比較，避免循環。
- 上下按鈕可在拖曳套件載入失敗時使用；下載失敗在面板顯示訊息。
- 觸控拖曳修正：兩個 Sortable 的 onEnd 更新欄位順序後以 setTimeout(render, 0) 重畫；拖曳中 render 不 destroy 或重建節點。

## 本機測試

- tests/ 下全部測試檔案，排除 tests/sf-mcp/：10 檔、273 項通過、0 項失敗。
- 其中輸出測試 49 項、等價測試 57 項；觸控拖曳修正新增六項回歸測試。
- sf-mcp 測試因本機缺依賴未執行，本次未修改 supabase/functions/sf-mcp。
- 測試資料皆為測試檔內虛構資料，未讀取或提交真實資料。
- 等價測試逐頁核對 URL／select／filter／order／Range／請求數，完整比對歷史與新增日誌。
- PDF 分頁、頁碼、說明位置、失敗終止與中止清理以 doubles 測試控制流程；Word 樣式以 doubles 測試建構參數。
- 假的 Sortable 驗證 onEnd 不同步 destroy、下一個 tick 才重畫、拖曳中保留節點，以及關閉後不執行待處理重畫。
- 真實下載與排版結果依下列 PPC 驗收回報記錄，不以 doubles 取代。

## PPC Preview 驗收結果

- [x] 搜尋筆數與前 5 筆：Preview 與正式站一致。
- [x] CSV：BOM／CRLF 正確；合併後各列上架平台數加總＝搜尋筆數；欄位拖曳後逐列比對內容不變。
- [x] 只輸出正常上架：狀態全為正常；正常紀錄數與完整輸出推算值一致。
- [x] Word：A4 橫式、重複表頭、欄位順序與預覽一致。
- [x] PDF：多頁頁碼連續、說明僅首頁、末頁少量列數正常；超過 500 項時阻擋（含 503 項固定邊界測試）。
- [x] 拖曳：觸控模擬與滑鼠皆正常（修正 068f9dc 後）。
- [x] 手機版面：Chrome 裝置模擬通過。
- [ ] 待驗證：iOS Safari 實機 PDF，上線後由 iPhone 同仁實測。

PPC 已決定上線；以下改進項目與上述實機追蹤不阻擋本次上線。

## 改進清單（不擋上線）

1. PDF 各頁縮放不一致（列高不同時整頁縮小），改為依內容高度決定每頁列數。
2. Word 表格寬度使用百分比，Google 文件開啟可能跑版，改為固定寬度。
3. 無關鍵字時檔名為「全部」，改用篩選條件組成檔名。
4. 來源平台會輸出內部來源標記，改為易懂說法或加註。
5. 拖曳時欄位文字被反白，加 user-select: none。
6. 輸出行為未記錄（待 Alex 決定）。

## 已知限制與提交

- PDF 為畫面轉圖，文字無法選取。
- 僅合併同公司同名；不同名透過同公司方案數提示人工判斷。缺公司編號或空名稱不合併。
- PDF／Word 上限 500 項，CSV 不限。
- 未記錄輸出行為。
- 已推送功能提交：c3d2d4d；已推送拖曳修正：068f9dc。
- 本次僅提交 SYNC 驗收交接文件，使用新 commit、不 amend；提交識別與六項檢查於對話回報，push 等待 PPC 核准。
- PR 說明全文先回報 PPC，確認後才建立 PR；目前未建立 PR，不得 merge。
