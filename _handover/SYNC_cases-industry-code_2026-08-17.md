# SYNC：Cases API industry_category → industry_code

日期：2026-08-17  
Branch：`fix/cases-industry-code-2026-08-17`  
PR：[fix(cases): expose industry_code consistently](https://github.com/Pcc329/solution-finder/pull/125)  
Commits：`10fcea9`（API）、`84b149d`（Dashboard）、`3cbe1fb`（Manufacturing）

## 實際改動檔案與函式

- `api/cases.js`
  - `CASE_FIELD_WHITELIST`
  - `normalizeSupabaseCase(fields)`
  - 新增 `normalizeAirtableCase(fields)`
  - Airtable 呼叫點
- `public/dashboard.html`
  - `caseFilters`、`renderCases()`、`setupCaseLazyLoad()` 的案例產業篩選與案例卡片 badge
- `public/manufacturing.html`
  - `normalizeReferenceCase(item)`
  - `matchesReferenceCaseIndustry(item, subIndustry)`

未修改：`api/solutions.js`、`api/claude.js`、`api/stats.js`、`index.html`、儀表板 Solutions 交叉分析的 `industry_category`、Cases 其他白名單欄位、`EXCLUDED_FIELDS`、`ALLOWED_CONFIDENTIALITY`。

## API 改名前後

Supabase 改前會跳過原始欄位，另行輸出不同語意的 key：

```js
if (fieldName !== 'industry_code') {
  normalized[fieldName] = value ?? '';
}
normalized.industry_category = fields?.industry_code ?? '';
```

改後直接保留資料庫實際欄位：

```js
for (const [fieldName, value] of Object.entries(fields || {})) {
  normalized[fieldName] = value ?? '';
}
```

`CASE_FIELD_WHITELIST` 已由 `industry_category` 改為 `industry_code`，因此 `projectCases()` 對外只輸出 `industry_code`，不再輸出 `industry_category`。

## Airtable 欄位對應

現有程式在改動前的 Airtable 路徑直接傳入 `rec.fields`，且白名單使用 `industry_category`；這是 repo 內原本的 Airtable 欄位名稱對應。

Production / Preview 的 `DB_SOURCE_CASES` 目前走 Supabase，公開 `/api/cases` 沒有來源切換參數，因此本次不能在不改部署環境變數的前提下對 Airtable 進行即時 API 呼叫。

已加入向後相容的 Airtable 正規化：

```js
normalized.industry_code =
  fields?.industry_code ?? fields?.industry_category ?? '';
```

這會優先支援 Airtable 未來若已有 `industry_code`，否則將既有 `industry_category` 值轉為對外 `industry_code`；白名單會排除原始 `industry_category`，不會洩漏到 API JSON。

離線 mock 驗證 Airtable 原始欄位 `industry_category: 'C29 機械設備製造業'` 時，回傳：

```json
{ "industry_code": "C29 機械設備製造業" }
```

且不含 `industry_category` key。

## 線上驗證

資料來源：Vercel Preview 的 `/api/cases`，透過 Dashboard 的「案例知識庫」實際載入。  
Preview：https://solution-finder-git-fix-cases-6862eb-patrick0814-6136s-projects.vercel.app/dashboard.html

- Preview 實際顯示：45 筆公開／內部可看案例，分頁每頁 9 筆。
- 規格書要求的「29 筆真實案例」與本次 API 實際總數 45 不一致；本 PR 不改資料及 `is_real` 過濾規則，故如實回報為資料現況。
- Preview 與 main 的前三筆案例卡片行業碼一致，且 Preview Console 無 error。

| 案例 | main 改名前顯示 | Preview 改後顯示 |
| --- | --- | --- |
| 華巨科技智慧營運轉型 | C24 基本金屬 | C24 基本金屬 |
| 老師傅的 AI 數位大腦 | C29 機械設備製造業 | C29 機械設備製造業 |
| 金益笙智慧接單與數位流程優化 | C32 家具製造業 | C32 家具製造業 |

另以 Supabase mock 呼叫 handler 驗證三筆輸出：`C24`、`C29`、`C32` 均由 `industry_code` 回傳，且三筆均不含 `industry_category` key。

## 前端讀取點

Cases API 的前端讀取點僅有：

- `public/dashboard.html`：案例篩選 options、篩選 state、卡片的行業別 badge、filter event key，均改讀 `industry_code`。
- `public/manufacturing.html`：案例正規化與製造子產業 bridge 比對，均改讀 `industry_code`。

Dashboard 的 Solutions 交叉分析仍保留原本的 `industry_category`（功能分類），未被改動。

## 驗收結論

- [x] Cases 白名單輸出欄位為 `industry_code`。
- [x] Supabase 不再把 `industry_code` 改名為 `industry_category`。
- [x] Airtable 有安全的 `industry_category → industry_code` 相容轉換。
- [x] Cases 前端所有讀取點已改用 `industry_code`。
- [x] Cases API 投影後不會輸出 `industry_category`。
- [x] 三筆線上案例行業碼改名前後畫面顯示一致。
- [x] Cases 其他白名單欄位與機密資料過濾未修改。
- [x] `api/cases.js` ESM syntax parse 通過。
- [x] Preview Ready、案例區載入成功、Console 無 error。
