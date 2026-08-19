# SYNC — Solutions API graceful degradation

- 日期：2026-08-18
- Branch：`feat/solutions-graceful-degradation-2026-08-18`
- Draft PR：[PR #128](https://github.com/Pcc329/solution-finder/pull/128)
- PR base：`fix/remove-solution-category-hotfix-2026-08-18`（相依 PR #127；不可在 #127 merge 前改以 `main` 驗收）
- Preview：[Vercel Preview](https://solution-finder-git-feat-solu-e6e3e4-patrick0814-6136s-projects.vercel.app)
- 狀態：實作與 mock／靜態驗證完成；真實 Preview / Supabase 驗證未完成，PR 維持 Draft 且不得 merge。

## 實際修改

檔案：`api/solutions.js`

新增：

```js
async function fetchOptionalSupabaseColumn(url, anonKey, table, keyColumn, optionalColumn, orderBy, filters = {}) {
  try {
    const rows = await fetchAllSupabasePaged(
      url,
      anonKey,
      table,
      `${keyColumn},${optionalColumn}`,
      orderBy,
      filters
    );
    return new Map(rows.map(row => [String(row[keyColumn] || ''), row[optionalColumn] || '']));
  } catch (error) {
    console.warn(
      `[Supabase Optional Column] table=${table} column=${optionalColumn} time=${new Date().toISOString()} message=${error.message}`
    );
    return new Map();
  }
}
```

Supabase 主查詢不再帶入 `data_source`；另以 `solution_id,data_source` 單欄補查：

```js
fetchOptionalSupabaseColumn(
  supabaseUrl,
  supabaseAnonKey,
  'solutions',
  'solution_id',
  'data_source',
  'solution_id.asc',
  solutionFilters
)
```

輸出映射改為：

```js
src: dataSourceBySolutionId.get(String(row.solution_id || '')) || '',
```

補查失敗時會寫 server warning，並讓 `src` 變空字串，不會讓核心方案清單失敗。

## 欄位分組

### 核心穩定欄位（主查詢）

`solution_id`、`airtable_rec_id`、`company_id`、`solution_name`、`description`、`description_short`、`slogan`、`has_ai`、`program_type`、`industry_category`、`price`、`price_tier`、`service_region`、`target_industry`、`target_scale`、`has_award`、`has_certification`、`website_url`、`score_overall`、`monthly_price`、`monthly_price_tier`、`subscription_months`、`features_list`。

### 易變／個別容錯欄位

- `data_source`：獨立補查；失敗時 `src: ''`。
- `function_category`：原本不參與 API 回傳或其他邏輯，已從主 select 移除，避免未使用欄位造成整支 API 失敗。

Airtable 路徑、`record_status` 過濾條件、416 分頁防護、評分與推薦邏輯未修改。

## 開發驗證（不是線上驗收）

以 handler 的 Supabase mock 模擬：

| 情境 | HTTP | `src` | 核心名稱／價格 | Warning |
| --- | --- | --- | --- | --- |
| `data_source` 存在 | 200 | 農業部 | 測試方案 / 60000 | 0 |
| 強制令補查回 400（模擬欄位不存在） | 200 | 空字串 | 測試方案 / 60000 | 1 |

另以 Node ESM `SourceTextModule` 解析 `api/solutions.js` 通過。

## 五之二：Supabase 欄位存在性驗證

- [ ] 尚未執行。此執行環境沒有 Supabase SQL Editor / DB 連線權限，未能取得真實 `information_schema.columns` 輸出。
- 待在 Supabase SQL Editor 執行：

```sql
select column_name, data_type
from information_schema.columns
where table_name = 'solutions'
order by ordinal_position;
```

## 五之三：驗證方式聲明

- [ ] 已在真實 Preview 環境驗證，含正常情況與反向測試。
- [x] 僅完成 mock／靜態驗證，**尚未真實環境驗證**。

**依規格書：本任務未完成，不能建議 merge。**

## 真實驗收阻塞紀錄

Vercel 已回報 Preview Ready，但在本機直接開：

```
https://solution-finder-git-feat-solu-e6e3e4-patrick0814-6136s-projects.vercel.app/api/solutions
```

Chrome Browser 回報 `net::ERR_BLOCKED_BY_CLIENT`。本機環境無法連 Vercel API endpoint，故沒有可附的真實 Response，且未用 mock 冒充。

## 待人工驗收步驟

在可連線的 Vercel / Supabase 環境：

1. 先將 PR #127 merge 到 `main`，再將 PR #128 的 base 改為 `main` 或 rebase。
2. 呼叫上述 Preview `/api/solutions`，確認 HTTP 200、筆數與既有基準一致、`src` 值正常。
3. 暫時將 `fetchOptionalSupabaseColumn(..., 'data_source', ...)` 的欄位字串改成不存在欄位（僅 Preview 分支測試），重新部署後確認 HTTP 200、核心欄位仍在、`src` 為空且 Vercel log 有 warning；測完立刻改回 `data_source`。
4. 執行上方 `information_schema.columns` SQL，將結果附回 PR/SYNC。


## 2026-08-19：五之三反向測試部署紀錄

本輪嚴格依反向測試規格，只替換
`fetchOptionalSupabaseColumn(..., optionalColumn, ...)` 呼叫傳入的欄位名稱；函式本體、核心查詢與輸出映射均未修改。

| 階段 | Commit | Vercel 部署（UTC） | Preview |
| --- | --- | --- | --- |
| 故意失敗 | `2486e5bd04013caa99f13d32fc0c98d49cd1c3a6` | 2026-08-19 04:24 Ready | https://solution-finder-git-feat-solu-e6e3e4-patrick0814-6136s-projects.vercel.app |
| 改回正常 | `35f38d0c13f07f1f3b585c3b392d7ced9185b1d0` | 2026-08-19 04:27 Ready | https://solution-finder-git-feat-solu-e6e3e4-patrick0814-6136s-projects.vercel.app |

故意失敗階段的唯一程式差異：

```js
-  'data_source',
+  'data_source_typo_test',
```

還原 commit 已將該參數精確改回 `'data_source'`；目前分支沒有保留刻意錯誤的欄位名稱。

### 實體 Endpoint / Function Log 結果

- [ ] 故意壞欄位時 HTTP 200、`src: ''`、核心欄位正常：**未能取得**
- [ ] Function Logs 的 warning：**未能取得**
- [ ] 改回後 HTTP 200 與真實 `src`：**未能重新取得**

本執行環境嘗試讀取 Preview API 時受到平台限制：
- Web 讀取回報 Preview URL 不屬於可安全開啟的 URL。
- 瀏覽器控制連線被本機 trusted-code-path 限制拒絕。
- 因此沒有用 mock 或部署 Ready 狀態冒充 HTTP 回應／Function Log 結果。

**結論：反向測試的兩次部署與完整還原已完成，但實體 API 與 Vercel Function Log 的三項證據仍未完成。PR #128 必須維持 Draft，不可因本節而解除 merge gate。**

在具備 Vercel endpoint / Function Logs 存取權的環境，可從上述 commit 的部署紀錄補驗：
1. 故意失敗版本：呼叫 `/api/solutions`，預期 HTTP 200、`src: ''`、核心欄位仍存在，並在 log 搜尋 `[Supabase Optional Column]`。
2. 已還原版本：呼叫同一 endpoint，預期 HTTP 200 且 `src` 恢復真實資料來源。
