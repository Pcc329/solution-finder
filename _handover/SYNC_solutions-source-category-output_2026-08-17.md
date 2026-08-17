# SYNC — Solutions API source/category output fix

- 日期：2026-08-17
- Branch：`fix/solutions-source-category-output-2026-08-17`
- PR：[PR #126](https://github.com/Pcc329/solution-finder/pull/126)
- Preview：[Vercel Preview](https://solution-finder-git-fix-solut-f34a02-patrick0814-6136s-projects.vercel.app)
- 狀態：程式實作與雙資料路徑模擬驗證完成；線上資料與 Airtable 原始資料驗證受目前執行環境網路攔截，見「待可連線環境確認」。

## 實際改動

### `api/solutions.js`

1. Supabase `solutions` select 新增 `solution_category`。
2. Supabase 轉換輸出新增：
   ```js
   src: row.data_source || '',
   sc: row.solution_category || '',
   ```
3. Airtable 轉換輸出新增：
   ```js
   src: f['data_source'] || '',
   sc: f['solution_category'] || '',
   ```

欄位縮寫選擇：

| API key | 原始欄位 | 命名理由 |
| --- | --- | --- |
| `src` | `data_source` | source 的清楚縮寫，且不與既有 `ds`（`description_short`）衝突。 |
| `sc` | `solution_category` | solution category 的清楚縮寫，且不與 `cat`（`industry_category`）衝突。 |

Airtable 的 `ACTIVE_SOLUTIONS_FILTER`、Supabase 的 `record_status` 排除條件、416 分頁防護，以及既有欄位皆未變更。

### `public/manufacturing.html`

修改顯示層兩處：

- `getInlineDetailHtml(item, shouldAnimate)` 的「服務類別」：優先讀 `sc/solution_category`，空值才回退 `cat/category`。
- `renderDetail()`：
  - 來源 badge 優先讀 `src/data_source`，空值才回退 `p/program_type`。
  - 「服務類別」同樣優先 `sc/solution_category`，再回退 `cat/category`。

`scoreSolution`、`getRecommendations`、`officialPrograms`、案例資料與 script 標籤均未修改。

## 驗證

### 離線 API 路徑測試

以單筆「農業部／智慧種植」資料模擬兩條資料來源，解析 `api/solutions.js` 後實際呼叫 handler：

| 路徑 | HTTP | `src` | `sc` |
| --- | --- | --- | --- |
| Supabase | 200 | 農業部 | 智慧種植 |
| Airtable | 200 | 農業部 | 智慧種植 |

其他檢查：

- `api/solutions.js` 以 Node ESM `SourceTextModule` 解析通過。
- `manufacturing.html` 的 inline JavaScript 以 `new Function(...)` 語法解析通過。
- 靜態檢查確認：
  - Supabase select 含 `solution_category`。
  - Airtable 與 Supabase 均輸出 `src`、`sc`。
  - 來源 fallback 為 `dataSource || programType`。
  - 兩個方案分類顯示點均為 `solutionCategory || cat`。

### FarmiSpace 排查

- 前端檔案中沒有 `FarmiSpace` 特例。
- `getRecommendations()` 對官方／其他推薦的排除採 `id` 建立 `Set`，沒有用 `solution_name` 模糊比對；已展開卡片也用 `item.id` 管理。因此本次看到 `640500 / 新創嚴選 / 生產物流`，不是由這支前端程式「以名稱抓錯另一筆」造成。
- API 先前未輸出來源和方案分類，確實會使 UI 以 `program_type`、`industry_category` 顯示替代值；本 PR 修正後可顯示實際 `data_source`、`solution_category`。

### 待可連線環境確認

本次環境嘗試存取 Preview 的 `/api/solutions` 時，內建瀏覽器回報 `net::ERR_BLOCKED_BY_CLIENT`；`manufacturing.html` 也因此顯示「方案資料載入失敗」。無 Airtable connector/token 可查原始表，故未捏造 3 筆農業部方案或 FarmiSpace 清單。

請在有 Vercel/Airtable 存取的環境執行：

1. 呼叫 PR Preview `/api/solutions`，篩 `src === '農業部'`，驗證至少 3 筆的 `src`／`sc`。
2. 在 Airtable Solutions 表用方案名稱包含 `FarmiSpace` 篩選，列出每筆 `solution_id`、`price`、`data_source`、`solution_category`。
3. 以 API 的 `id` 對照該清單，判定 `640500` 是另一筆同名紀錄或資料本身誤植。

## Git 與範圍

| Commit | 說明 |
| --- | --- |
| `60c58acd9d68b70cc6b9d75f45d47a372f5318b5` | API 輸出 `src/sc` |
| `4a2327b3c31125e396a35d0f5f2924c1d60db92c` | 製造業頁顯示與 fallback |

PR 建立時的比較結果僅包含：

- `api/solutions.js`
- `public/manufacturing.html`

