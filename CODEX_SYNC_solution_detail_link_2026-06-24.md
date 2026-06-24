# CODEX SYNC：製造業方案卡片詳細頁

日期：2026-06-24  
分支：`feat-diagnosis-agent-v1`  
功能 Commit：`5332429` (`Add manufacturing solution detail view`)

## 修改檔案

- `public/manufacturing.html`

未修改 API、推薦排序、分類篩選函式與方案卡片版面結構。

## 修改函式與狀態

### 新增狀態

- `currentView`
  - `result`：顯示分析結果、分類篩選與方案清單。
  - `detail`：顯示選中方案的詳細內容。
- `selectedSolution`
  - 保存目前選中的原始 `/api/solutions` 方案物件。

### 新增函式

- `updateView()`
  - 依 `currentView` 切換 `#resultView` 與 `#detailView`。
- `solutionField(item, shortName, fullName)`
  - 同時兼容 `/api/solutions` 縮寫欄位與規格中的完整欄位名。
- `openDetail(item)`
  - 保存方案、切換為 `detail`、渲染詳情並捲到頁首。
- `renderDetail()`
  - 產生 Header、費用、方案介紹、功能清單與方案屬性。
  - 空欄位不產生對應區塊。
  - 所有資料文字使用 `escapeHtml()`。
- `backToResult()`
  - 清除 `selectedSolution`、切回 `result` 並捲到頁首。

### 修改函式

- `renderList()`
  - 官方推薦與其他方案共用此函式。
  - 卡片點擊事件由原本另開策略智庫改為 `openDetail(item)`。
- `resetAgent()` / `clearAllFiles()`
  - 重設時一併回到結果 view，避免停留在已失效的詳細頁。

## renderDetail() 欄位對照

詳細頁優先讀取 `/api/solutions` 的縮寫欄位，完整欄位名作為兼容 fallback：

| 畫面 | 縮寫欄位 | 完整欄位 fallback |
|---|---|---|
| 方案名稱 | `s` | `name` |
| 公司名稱 | `c` | `vendor` |
| 來源 | `p` | `program_type` |
| 類別 | `cat` | `category` |
| 總費用 | `pr` | `price` |
| 月費 | `mo` | `monthly_price` |
| 介紹 | `desc` | `description` |
| 功能 | `feat` | `features` |
| 適用產業 | `d` | `target_industry` |
| 規模 | `scale` | `scale` |
| 地區 | `r` | `region` |
| 城市 | `city` | `city` |
| AI | `ai` | `is_ai` |

功能清單使用換行、全形分號或半形分號拆分為 `<li>`。

## View 切換與篩選狀態

`openDetail()` 只隱藏 `#resultView`，不清除或重建推薦資料。  
`backToResult()` 重新顯示原本 DOM，因此 `selectedCategories` 與分類 tag 的 active 狀態會保留。

## 驗證情境

1. 產生官方推薦及其他候選方案。
2. 選取一個或多個分類 tag。
3. 點擊官方方案卡片，頁面切換至詳細內容並捲到頂端。
4. 確認方案名稱、業者、來源、費用、介紹及功能清單依資料顯示。
5. 點擊「返回分析結果」。
6. 原推薦清單及分類 tag 選取狀態仍維持。
7. 其他候選方案卡片使用相同流程。

## 驗證結果

- `git diff --check HEAD^ HEAD -- public/manufacturing.html`：通過
- `public/manufacturing.html` inline script `new Function()` 語法檢查：通過
- `node --check api/manufacturing-recommend.js`：通過
- `node --check api/manufacturing-analyze.js`：通過

## Git

- Branch：`feat-diagnosis-agent-v1`
- 功能 Commit：`5332429`
- Remote：`origin/feat-diagnosis-agent-v1`
- PR：https://github.com/Pcc329/solution-finder/pull/new/feat-diagnosis-agent-v1

