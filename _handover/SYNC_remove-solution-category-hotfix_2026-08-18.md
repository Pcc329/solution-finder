# SYNC — remove unavailable solution_category hotfix

- 日期：2026-08-18
- Branch：`fix/remove-solution-category-hotfix-2026-08-18`
- PR：[PR #127](https://github.com/Pcc329/solution-finder/pull/127)
- Preview：[Vercel Preview](https://solution-finder-git-fix-remov-03aa05-patrick0814-6136s-projects.vercel.app)
- 狀態：程式修復與 Preview 部署完成；**真實 Preview API response 驗收被此執行環境阻擋，PR 不應在人工驗收完成前 merge。**

## 事故根因與修復

PR #126 的 Supabase `solutions` select 包含不存在的 `solution_category`，PostgREST 因此回 `42703 column does not exist`，使 `/api/solutions` 回 500。

本 PR 只移除該不存在欄位與其衍生輸出，保留已存在的 `data_source/src`。

### `api/solutions.js`

| 位置 | 改前 | 改後 |
| --- | --- | --- |
| Supabase select | `industry_category,data_source,solution_category,price` | `industry_category,data_source,price` |
| Supabase 輸出 | `sc: row.solution_category || ''` | 已移除 |
| Airtable 輸出 | `sc: f['solution_category'] || ''` | 已移除 |

兩條資料來源仍保留：

```js
src: row.data_source || ''
src: f['data_source'] || ''
```

### `public/manufacturing.html`

移除所有讀取 `item.sc` / `solution_category` 的分類顯示，回復為 `item.cat`（`industry_category`）：

- `getInlineDetailHtml()`：`category = solutionField(item, "cat", "category")`
- `renderDetail()`：同上
- 搜尋結果列表分類 badge：`item.cat`

來源 badge 保持修正後邏輯，未回退：

```js
item.src || item.p || "未標示來源"
```

## 靜態驗證

- `api/solutions.js` 以 Node ESM `SourceTextModule` 解析通過。
- Supabase select 不再含 `solution_category`。
- API 輸出不再含 `sc:`。
- `manufacturing.html` 不再含 `item.sc`、`solutionCategory` 或 `solution_category`。
- `data_source/src` 兩條輸出與列表來源 fallback 均保留。
- 未修改 `api/companies.js`、`api/cases.js`、`scoreSolution`、`getRecommendations`、`officialPrograms` 或任何資料庫 schema。

## 真實 Preview API 驗收：阻塞，未宣告通過

Preview 已由 Vercel bot 回報 **Ready**，但本環境無法完成 endpoint 驗收：

| 方法 | 結果 |
| --- | --- |
| In-app Browser 直接開 `/api/solutions` | `net::ERR_BLOCKED_BY_CLIENT` |
| Chrome 直接開 `/api/solutions` | `net::ERR_BLOCKED_BY_CLIENT` |
| `curl.exe` 連 Preview | 無法建立 443 連線 |

以上是本機瀏覽器／網路層攔截，並非 API 回傳的 HTTP 狀態，因此不能作為 200 的證據。本次**沒有使用 mock 作為線上驗收替代品**。

### Merge 前人工必做

請於可連 Vercel 的瀏覽器開啟：

```
https://solution-finder-git-fix-remov-03aa05-patrick0814-6136s-projects.vercel.app/api/solutions
```

應確認：

1. HTTP 200，回傳 JSON 陣列且有資料。
2. 前 3 筆可讀取 `id`、`s`、`src` 等正常欄位。
3. JSON 中沒有 `sc`。
4. 開啟 `/manufacturing.html`，資料狀態顯示成功載入而非「方案資料載入失敗」。

## Git

| Commit | 說明 |
| --- | --- |
| `03873c417f011ab6690e93a67d8078df1843701e` | 移除 API 的不存在欄位與 `sc` 輸出 |
| `a9906a4c2bf5727363ae3cc9eab61cf2c3018484` | 前端移除 `item.sc` 分類顯示 |

