# SYNC — 公司頁聯絡資訊位置調整

- 日期：2026-10-20（Asia/Taipei）
- 分支：`feat/company-contact-position`
- 基準：最新 `origin/main`，`666b9bd3ea6972ca3c43dc6b4c956bc3e3739c9b`
- 程式提交：`50f6051595c39c25051936d9d3ae60d3e04334ac`
- PR：https://github.com/Pcc329/solution-finder/pull/264 （base: main；保持 OPEN，未 merge）

## 變更範圍

只調整 `public/index.html` 的 `renderCompany`：將原本位於方案清單下方的 `ContactInfoCard` 搬到公司檔案（含標題、標籤、四個統計卡）後面，並以 `mb-5` 外框對齊公司頁區塊間距。

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

## 既有測試

| 指令 | 結果 |
| --- | --- |
| `node --test tests/*.test.mjs` | 175/175 PASS |
| `node --test tests/sf-mcp/sf-mcp-v1-2.test.mjs` | 66/66 PASS |
| 合計 | 241/241 PASS，0 fail、0 skipped |

包含 `contact-access-log.test.mjs` 對成功回應只寫入一筆 `contact_access_logs` 等既有行為的驗證。沒有測試因區塊順序而失敗，因此不需要更新既有測試。

## Preview 驗收

- [Vercel 部署](https://vercel.com/patrick0814-6136s-projects/solution-finder/3JN44nHGM6FUaMt41UrpkGMAjBnz)：Ready；Source `50f6051`，分支 `feat/company-contact-position`。
- [Preview](https://solution-finder-r5p12dw80-patrick0814-6136s-projects.vercel.app/)
- [分支 Preview](https://solution-finder-git-feat-comp-3739ce-patrick0814-6136s-projects.vercel.app/)
- 新 Preview 網域顯示內部系統登入，API 回傳 401；已請使用者在瀏覽器自行登入，未讀取或繞過密碼／session。
- 96979933（中華電信）桌機及 375px 截圖：待登入後接續驗收，尚未宣稱完成。
- 截圖時保持聯絡資訊卡片收合，避免保存真實聯絡資料。
