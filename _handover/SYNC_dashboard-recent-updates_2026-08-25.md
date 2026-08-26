# SYNC — dashboard 近期更新分層改版

- 日期：2026-08-25
- 分支：`feat/dashboard-recent-updates-2026-08-25`
- PR：<https://github.com/Pcc329/solution-finder/pull/132>
- Preview：<https://solution-finder-git-feat-dash-053d2d-patrick0814-6136s-projects.vercel.app>
- 基底：`main` @ `cb2ab988878101c487b36a52bb9406efcfad2f15`

## 修改檔案

1. `api/stats.js`
2. `public/dashboard.html`

沒有修改 `api/solutions.js`、`api/companies.js`、`api/cases.js`，也沒有改動案例知識庫的篩選或卡片邏輯。

## 資料查詢與過濾

Cases 由 `api/stats.js` 直接讀取 Supabase `cases` 表，使用的 PostgREST 查詢等效於：

```sql
SELECT case_id, case_name, created_at, is_real
FROM cases
WHERE is_real = true
ORDER BY created_at DESC;
```

實作位置：

```js
fetchAllSupabasePaged(
  supabaseUrl,
  supabaseAnonKey,
  CASES_TABLE,
  'case_id,case_name,created_at,is_real',
  'created_at.desc',
  { is_real: 'eq.true' }
)
```

因此 `is_real=false` 的 30 筆 AI 模擬示範資料不會進入案例總數、本週新增或近期清單。方案仍沿用既有 `newThisWeek`／`total` 統計；公司本週新增則以 Companies 記錄的 `created_at` 計算，並未把 Solutions 的 `company_id` 關聯修正當成公司異動。

## 前端呈現

舊版只有兩個方案統計：

```html
<span id="newThisWeek">--</span>
<span id="newThisMonth">--</span>
```

新版採三層資訊：

```html
<article class="recent-case-hero">
  <span id="newCasesThisWeek">--</span>
  <span id="caseTotal">--</span>
</article>
<div class="recent-secondary-grid">
  <!-- 方案：本週新增 + 累計總數 -->
  <!-- 公司：本週新增 + 累計總數 -->
</div>
```

- 案例卡片為單獨整行，以既有 teal 色與卡片系統突顯。
- 方案與公司維持兩張並排次要卡片。
- `recentItems` 將最新案例與方案依 `createdTime` 排序後取前 5 筆；每筆使用「案例」或「方案」badge 區分來源。
- `@media (max-width: 900px)` 將 `.recent-secondary-grid` 改為單欄，案例卡片與兩張次要卡片會依序排列。

## 真實 Preview 驗證

驗證時間：2026-08-25，資料來源為 Preview 的 `GET /api/stats`。

```json
{
  "total": 2487,
  "companyTotal": 929,
  "caseTotal": 69,
  "newThisWeek": 0,
  "newCompaniesThisWeek": 23,
  "newCasesThisWeek": 24
}
```

`recentItems` 回傳前 5 筆均為 `type: "case"`，例如：

1. 能火動畫－3D AI虛擬人零售/展會應用
2. 杉恆壹樹農創－AIoT智慧灌溉
3. 快組隊－AI面試大腦

這證實案例清單已優先混入近期活動，且累計數為 **69**，不是將 30 筆模擬資料一併計入的 99。

## 驗證結果

- JavaScript 語法：`api/stats.js` 與 `dashboard.html` 所有 inline scripts 皆通過 parser 驗證。
- Vercel：commit `82cfc62001abfb1e7dd03147912847f427f02f97` 部署成功。
- Preview API：`/api/stats` HTTP 200。
- 初版曾因 Promise 解構遺漏 `caseRecords` 而回傳 HTTP 500；已在 `82cfc62` 修正，並以 Preview 實測通過。
- 視覺截圖：本 Codex 環境的 headless Edge 啟動受到執行政策阻擋，且本回合沒有可用 Browser tool，故無法在此產出真實 Preview 截圖。PR 維持 Draft，待可用瀏覽器環境補做 1280px 與手機寬度截圖驗收。

## Git 資訊

- `5d051ab0c619ed7b0338da832d731321ca216764` — stats 加入真實案例統計
- `e8c51a051a7119d5087566b8d52b98ddeaacbdc5` — dashboard 分層 UI 與混合清單
- `82cfc62001abfb1e7dd03147912847f427f02f97` — 修正 caseRecords 解構
