# SYNC — Patch 2: Cases API 白名單

日期：2026-09-03  
範圍：僅完成 Patch 2，不包含後續 company-detail API 或前端三分頁工作。

## 改動

實際程式改動只有 `api/cases.js`：

- 在 `CASE_FIELD_WHITELIST` 既有最後一項 `is_real` 之後新增：
  - `provider_linked_company_id`
  - `case_relationship_type`

未調整既有欄位順序、`EXCLUDED_FIELDS`、`ALLOWED_CONFIDENTIALITY`、`projectCases`、`normalizeSupabaseCase`、`normalizeAirtableCase` 或任何前端/API 檔案。

Airtable 路徑不需額外分支：既有 `projectCases` 以 `fields[fieldName] ?? ''` 投影白名單；Airtable 尚無欄位時自然回傳空字串，不會報錯。

## API 前後比對

驗證來源：
- 修改前 Production：`https://solution-finder-gray.vercel.app/api/cases`
- 修改後 Preview：`https://solution-finder-dmfxoaqof-patrick0814-6136s-projects.vercel.app/api/cases`

| 項目 | 修改前 | 修改後 |
| --- | ---: | ---: |
| Cases 筆數 | 85 | 85 |
| 非本次新增欄位的逐筆 JSON 差異 | — | 0 |
| `provider_linked_company_id` 欄位 | 未輸出 | 已輸出；25 筆有值 |
| `case_relationship_type` 欄位 | 未輸出 | 已輸出；85 筆有值 |

驗證方式：以 `case_id` 的既有 API 排序逐筆比對，排除兩個新欄位後，Production 與 Preview 的 85 筆 JSON 內容完全相同。

## 範例

Preview 的 `case_id: 428`：

```json
{
  "case_id": 428,
  "case_name": "新瀚克導入谷林運算股份有限公司方案案例",
  "provider_linked_company_id": "50849424",
  "case_relationship_type": "媒合案例"
}
```

## 保密與篩選確認

- `company_real_name`、`confirmed_by`、`confirmed_at`、`source_doc`、`data_batch`、`case_code`、`linked_company`：Preview 85 筆回傳中均未出現。
- `ALLOWED_CONFIDENTIALITY` 邏輯未變，回傳筆數維持 85。

## 驗收

- [x] 每筆 API 物件包含兩個新欄位；無值時沿用既有空字串處理。
- [x] 其他欄位與筆數保持不變。
- [x] 排除欄位不外洩。
- [x] Airtable 路徑保有空字串 fallback。
- [x] 本次未進行後續 Patch 3／Patch 4 的公司介紹或前端分頁工作。

## Git

- Branch：`feat/cases-provider-whitelist-2026-09-03`
- 功能 commit：`fadf9b7abbb4f68ee34909881dc3189d84e47306`
- PR：[PR #137](https://github.com/Pcc329/solution-finder/pull/137)
