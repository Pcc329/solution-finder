# SYNC: cases API Supabase feature flag

日期：2026-07-23
分支：`feat/cases-api-supabase`
基準：`origin/main` `55c50f8`

## 實際改動

- `api/cases.js`
  - `getCasesSource()`：讀取 `DB_SOURCE_CASES`，預設為 `airtable`；僅接受 `airtable` 或 `supabase`。
  - `fetchAllAirtable()`：保留原有 Airtable 分頁、429 retry/backoff 與錯誤記錄邏輯。
  - `fetchAllSupabase()`：新增 Supabase REST `cases` 查詢。
  - `projectCases()`：兩個資料來源共用 confidentiality 白名單與固定欄位投影，確保前端 JSON 合約一致。

## Feature flag 與金鑰

| 環境變數 | 用途 | 預設／規則 |
|---|---|---|
| `DB_SOURCE_CASES` | 選擇資料來源 | 未設定時為 `airtable` |
| `AIRTABLE_TOKEN` | Airtable 模式讀取 | 僅在 `airtable` 模式要求 |
| `SUPABASE_URL` | Supabase REST 位址 | 僅在 `supabase` 模式要求 |
| `SUPABASE_ANON_KEY` | Supabase anon/RLS 身分 | 僅在 `supabase` 模式要求 |

`SUPABASE_SERVICE_KEY` 未被讀取、未被使用。這支 API 使用 `SUPABASE_ANON_KEY`，讓 Supabase RLS 與資料遮罩持續生效。

## 資料合約與排序

- 兩個來源均經過 `projectCases()`：只回傳既有 `CASE_FIELD_WHITELIST` 欄位，`confidentiality` 僅允許「內部可看」與「公開」。
- 空值維持既有 API 行為，轉為空字串；`is_real` 等原始型別保留。
- Airtable 既有 API 沒有明確排序參數。線上 Airtable 模式實測首筆 `case_id` 為 `52`，不是 `case_id.asc`；因此 Supabase 路徑沒有擅自加入 `case_id.asc`，避免切換後改變目前排序語意。

## 驗證結果

### 已完成

1. `node --check api/cases.js`：通過。
2. `git diff --check`：通過。
3. 離線契約測試：以同一組來源資料分別模擬 Airtable records 與 Supabase rows；公開案例 `case_id=52` 的回傳 JSON 完全一致，`confidentiality=機密` 的 `case_id=53` 在兩種模式都被排除。
4. 線上 Airtable 模式唯讀驗證：`https://solution-finder-gray.vercel.app/api/cases` 於 2026-07-23 回傳 29 筆；前 3 個 `case_id` 為 `52`、`41`、`38`。

### Vercel Preview 設定與即時驗收

2026-07-23 已在 Vercel 將 `DB_SOURCE_CASES=supabase` 設為 **Preview 專用**（未套用 Production），並重新部署 `feat/cases-api-supabase`。本次 Preview：

- https://solution-finder-git-feat-case-28415f-patrick0814-6136s-projects.vercel.app
- 部署狀態：Ready
- 部署來源：`29acbc0 docs: add cases Supabase PR link`

Codex 工作環境的網路沙箱禁止讀取 Vercel API，受控瀏覽器也對 `/api/*` 回傳 `ERR_BLOCKED_BY_CLIENT`。因此本次無法從此環境取得 Supabase API 的實際 JSON；下列命令需在可連線至 Vercel 的本機 PowerShell 執行，才能誠實完成「29 筆逐筆、欄位、值、順序」驗收：

```powershell
$preview = 'https://solution-finder-git-feat-case-28415f-patrick0814-6136s-projects.vercel.app/api/cases'
$airtable = 'https://solution-finder-gray.vercel.app/api/cases'

$supabaseRows = Invoke-RestMethod -Uri $preview
$airtableRows = Invoke-RestMethod -Uri $airtable

$differences = for ($i = 0; $i -lt [Math]::Max(@($supabaseRows).Count, @($airtableRows).Count); $i++) {
  $supabaseJson = if ($i -lt @($supabaseRows).Count) { $supabaseRows[$i] | ConvertTo-Json -Depth 10 -Compress } else { '<missing>' }
  $airtableJson = if ($i -lt @($airtableRows).Count) { $airtableRows[$i] | ConvertTo-Json -Depth 10 -Compress } else { '<missing>' }
  if ($supabaseJson -ne $airtableJson) {
    [pscustomobject]@{ index = $i; supabase = $supabaseJson; airtable = $airtableJson }
  }
}

[pscustomobject]@{
  supabaseCount = @($supabaseRows).Count
  airtableCount = @($airtableRows).Count
  first3Supabase = @($supabaseRows | Select-Object -First 3 | ForEach-Object case_id)
  first3Airtable = @($airtableRows | Select-Object -First 3 | ForEach-Object case_id)
  differences = @($differences).Count
}
$differences | Format-List
```

通過條件：兩邊皆為 29 筆、前 3 筆皆為 `52`、`41`、`38`，且 `differences = 0`。Production 未設定 feature flag 時會維持 Airtable 預設模式，因此可作為目前 Preview Supabase 模式的對照來源。

## Git

- 已建立本任務 commit；完整 hash 以最終 Git log 為準。
- PR：https://github.com/Pcc329/solution-finder/pull/115
- Supabase 即時對照會在 Vercel 完成 `SUPABASE_URL`、`SUPABASE_ANON_KEY` 設定後補做。
