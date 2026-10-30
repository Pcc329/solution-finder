# 查詢結果輸出開發交接

- 日期：2026-10-30
- 分支：codex/export-results
- 基準：origin/main（87062e3，關卡 1 已確認）
- 目前階段：關卡 3；本機測試通過，本機提交與 push 前稽核結果見關卡 3 對話回報；尚未推送或建立 PR。
- 驗證方式：僅 mock／靜態驗證，尚未真實環境驗證。
- 完整本機測試：10 個測試檔、267 項通過、0 項失敗；排除 tests/sf-mcp/。

## 授權與變更範圍

PPC 明確核准本次 api/solutions.js 禁令例外，以及第七個等價測試與第八個計畫徽章測試檔案。第八檔精確 diff 已先回報並確認；僅替換原有兩行，其餘內容不變。此例外不作為日後授權。
未修改資料庫、fixtures、vercel.json、package.json、聯絡資訊相關程式或搜尋核心，未安裝套件。

| 檔案 | 改動／函式 |
|---|---|
| api/solutions.js | 新增選用狀態查詢、recordStatusBySolutionId、statusLoaded、sid、rs；沿用 fetchOptionalSupabaseColumn |
| public/index.html | 僅新增搜尋結果筆數旁的輸出按鈕與 module script |
| public/export-results-core.mjs | statusLabel、normName、mergeProducts、sameCompanyCount、buildCSV、describeQuery |
| public/export-results-panel.mjs | open、getExportRows、exportLimitMessage、previewSummary、queryMeta、fileName、buildDOCX、buildPDF、checkCanvas、syncTriggerButtons |
| tests/export-results.test.mjs | 核心、公式防護、欄位白名單、輸出限制、PDF 逐頁及失敗終止等測試 |
| tests/supabase-read-equivalence.test.mjs | 僅 solutions 分支移除新增欄位後比較歷史回應、核對完整狀態分頁及精確新增日誌 |
| tests/program-badge-allowlist.test.mjs | 僅原兩行替換：既有七個請求加恰好一個狀態選用查詢，不修改 mock 或其他斷言 |
| _handover/SYNC_export-results_2026-10-30.md | 本交接文件 |

## 合併規則與筆數上限

- mergeProducts：依公司編號及 NFKC／去空白／小寫名稱分組；公司編號或正規化名稱為空時各自保留。
- 保留組別首次出現順序；平台去重保序；平台數計組內紀錄數；狀態依標籤計數；價格取相同值或範圍；編號全串接；簡述取最長；其他取第一筆。
- sameCompanyCount：以實際輸出列計算同公司方案數，缺公司編號留白，不修改傳入資料。
- exportLimitMessage：PDF／Word 實際輸出最多 500 項；CSV 不限；開關合併後重新計算。
- 合併與正常上架篩選僅作用於輸出，不改首頁 filteredResults、排序、分頁與筆數。

## 上架狀態與優雅降級

- record_status 使用既有 fetchOptionalSupabaseColumn 獨立讀取，不加入 stable select，既有下架篩選不變。
- 選用查詢取得資料時空值轉「正常」；無法取得時 rs 為空字串，不影響其他欄位。
- statusLabel 將空字串／null／undefined 留白，疑似狀態統一顯示「疑似下架」。
- 輸出來源 rs 全空白時，正常上架選項停用並顯示「上架狀態暫時無法讀取」。
- mock HTTP／網路失敗情境已納入等價測試；真實 Preview 不存在欄位反向測試留待關卡 4，未聲稱完成。

## 輸出與互動

- CSV：UTF-8 BOM、CRLF；公式開頭 =、+、-、@、Tab、CR 加單引號後，再執行 CSV 跳脫。
- Word：A4 橫式、Microsoft JhengHei、綠色表頭與重複表頭。
- PDF：每頁最多 20 列、逐頁轉圖；檢查寬高、圖片資料與非全白像素；每頁等比例縮放、不截斷，查詢說明只在首頁。
- 任一頁失敗即終止，不回傳完整輸出 blob、不觸發下載；進度顯示頁碼並停用下載。
- 關閉面板取消尚在進行的產生流程並還原焦點。
- 僅提供規格指定的欄位白名單，名稱缺漏沿用既有 displaySolutionName。
- SortableJS 開啟面板時載入；Word／PDF 套件按下載時載入；使用規格固定版本網址。
- 按鈕同步不呼叫 React state setter。MutationObserver 只處理含入口的新元素，忽略文字節點；屬性與文字更新先比較，避免循環。
- 上下按鈕可在拖曳套件載入失敗時使用；下載失敗在面板顯示訊息。

## 本機驗收與限制

- 測試範圍：tests/ 下全部測試檔案，排除 tests/sf-mcp/；267 項通過、0 項失敗。其中輸出測試 43 項、等價測試 57 項。
- sf-mcp 測試因本機缺依賴未執行，本次未修改 supabase/functions/sf-mcp。
- 測試資料皆為測試檔內虛構資料，未讀取或提交真實資料。
- 核心函式、合併計數、公式防護、輸出欄位白名單與上限：本機測試通過。
- 預覽：未合併用「筆」、合併用「項」；僅有實際合併數時顯示重複紀錄提示。狀態不可讀時查詢說明明確標示。對應三項測試通過。
- 先前計畫徽章測試因固定請求總數失敗；核准的精確請求分類斷言套用後十項皆通過。
- 狀態選用查詢：已建立精確 URL／select／filter／order／Range／請求數驗證，以及完整字串日誌順序比對。
- PDF 最大允許量的分頁、頁碼、首頁說明、失敗停止與中止清理：使用 rasterizer／PDF library doubles 測試控制流程。
- Word 紙張與表頭樣式：使用 library doubles 測試建構參數。
- doubles 不代表真實 html2canvas、jsPDF 或 docx 套件已在瀏覽器成功產檔。
- 下列真實瀏覽器、Office、Preview 與 CSP 驗收均尚未執行。

## 真實 Preview 驗證（關卡 4）

- [ ] 取得 Preview 網址。
- [ ] /api/solutions HTTP 狀態與 sid、rs 欄位確認。
- [ ] 不存在選用欄位的反向測試：API 仍回成功、首頁與輸出可用、狀態留白，並確認改回。
- [ ] 一般查詢：比較未合併與合併後數量。
- [ ] 疑似下架查詢：比較正常上架篩選開關。
- [ ] 超過上限的查詢：PDF／Word 顯示提示、不產檔。
- [ ] 相同查詢前後三組：搜尋筆數、排序、分頁一致。
- [ ] 實際下載三種檔案，驗證欄位與順序等於預覽。
- [ ] 欄位勾選、左側拖曳、表頭拖曳及上下按鈕同步。
- [ ] PDF 任一頁轉圖失敗時明確報頁碼，且不下載。
- [ ] Console 無新增錯誤，CSP 無新增違規。

真實筆數及前幾筆 sid／rs 僅於對話回報；驗證完成後此處記錄「已驗證，證據另行回報」。

## 待 PPC 人工驗收

- [ ] Preview 與正式站同一查詢的筆數與前幾筆順序一致。
- [ ] CSV 以 Excel 開啟中文正常，輸出與合併計數一致。
- [ ] Word／PDF 可開啟，欄位順序與預覽一致。
- [ ] 表頭拖曳後下載順序跟隨。
- [ ] 正常上架篩選結果無疑似下架。
- [ ] 超過上限不產生 PDF／Word。
- [ ] 桌機 Chrome 最大允許量 PDF 每頁有內容、頁碼連續。
- [ ] iPhone Safari 同份 PDF 成功，或明確失敗且不下載空白檔。
- [ ] 手機面板單欄、上下按鈕可用。
- [ ] merge 後正式站重做搜尋比較及檔案開啟驗收。

## 已知限制與提交

- PDF 為畫面轉圖，文字無法選取。
- 僅合併同公司同名；不同名透過同公司方案數提示人工判斷。缺公司編號或空名稱不合併。
- PDF／Word 上限 500 項，CSV 不限。
- 未記錄輸出行為。
- 本機 commit：識別與 push 前稽核見關卡 3 對話回報；Preview／PR 尚無。push 與建立 PR 均等待 PPC 後續核准，不得 merge。
