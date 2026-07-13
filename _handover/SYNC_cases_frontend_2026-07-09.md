# SYNC_cases_frontend_2026-07-09

## Branch
- `feat-cases-frontend-v1`

## 實際改動檔案
- `api/cases.js`
  - 改造既有 Cases API 為白名單回傳。
  - Airtable Table ID: `tblgkjVcaohcQntzV`
  - 分頁讀取保留 `pageSize=100` + `offset` while loop。
- `public/strategy-guide.html`
  - 新增「案例知識庫」入口、錨點、篩選器與卡片列表。
  - 由 `/api/cases` 載入資料。
  - 支援 `case_type`、`industry_category`、`pain_point_domain` 三維篩選。
  - 新增「實績」「預期成效」「AI模擬示範」標章。
  - 預期成效於成效區塊顯示說明文字。
- `public/manufacturing.html`
  - 新增 `normalizeReferenceCase()`，讓既有製造業案例頁相容新的白名單 API 欄位。
  - 不改推薦排序、官方欄篩選、案例 CTA 或淡出遮罩邏輯。

## strategy-guide.html 現行案例資料來源盤點
- 修改前：`strategy-guide.html` 沒有案例清單或案例資料來源；頁面主要資料為硬編碼分類、`/api/stats`、`/api/companies`。
- 修改後：新增案例區塊，資料來源改為 `/api/cases`。

## API 白名單欄位
`api/cases.js` 的 `CASE_FIELD_WHITELIST`：

```js
const CASE_FIELD_WHITELIST = [
  'case_id',
  'case_name',
  'industry',
  'industry_category',
  'company_size',
  'company_display_name',
  'pain_points',
  'diagnosis',
  'resistance',
  'resolution',
  'outcome',
  'replicable_condition',
  'case_type',
  'outcome_status',
  'pain_point_domain',
  'key_technology',
  'ai_maturity_stage',
  'difficulty_level',
  'is_real',
];
```

明確排除欄位：
- `company_real_name`
- `confirmed_by`
- `confirmed_at`
- `source_doc`
- `data_batch`
- `case_code`
- `linked_company`

confidentiality 過濾採白名單式：

```js
const ALLOWED_CONFIDENTIALITY = new Set(['內部可看', '公開']);

const converted = records
  .filter(rec => {
    const confidentiality = String(rec.fields?.confidentiality || '').trim();
    return ALLOWED_CONFIDENTIALITY.has(confidentiality);
  })
  .map(rec => {
    const fields = rec.fields || {};
    return CASE_FIELD_WHITELIST.reduce((safeFields, fieldName) => {
      if (EXCLUDED_FIELDS.has(fieldName)) return safeFields;
      safeFields[fieldName] = fields[fieldName] ?? '';
      return safeFields;
    }, {});
  });
```

其他 confidentiality 值一律不回傳。

## 標章 fallback 邏輯
`public/strategy-guide.html` 的 `outcomeBadge(item)`：

1. `outcome_status === '預期成效'` → 顯示「預期成效」
2. `outcome_status === '實際成效'` → 顯示「實績」
3. `case_type === 'AI模擬示範'` → 顯示「AI模擬示範」
4. 舊資料 fallback：`case_type` 空白、`outcome_status` 空白且 `is_real !== true` → 顯示「AI模擬示範」
5. `outcome_status === '模擬數據'` 本身不產生標章；若同筆 `case_type === 'AI模擬示範'`，標章來自 `case_type`，不是來自 `outcome_status`。

## 驗證資料
- 來源：`Cases-Grid view (4).csv`
- 日期：2026-07-09 匯出
- 總筆數：59
- `case_type` 分布：
  - 空白：35
  - 實績案例：9
  - 輔導規劃：15
- `outcome_status` 分布：
  - 空白：35
  - 實際成效：9
  - 預期成效：15
- CSV 現況差異：`confidentiality` 為 `內部可看` 39 筆、`公開` 20 筆；規格文字寫「目前全部皆為內部可看」與 CSV 不一致。為維持前端 59 筆驗收，本次 API 顯示白名單允許 `內部可看` 與 `公開`，但不回傳 `confidentiality` 本身，也不回傳任何排除欄位。

## 驗證結果
- API 回傳筆數：59
- API 回傳欄位與白名單一致：
  - `ai_maturity_stage`
  - `case_id`
  - `case_name`
  - `case_type`
  - `company_display_name`
  - `company_size`
  - `diagnosis`
  - `difficulty_level`
  - `industry`
  - `industry_category`
  - `is_real`
  - `key_technology`
  - `outcome`
  - `outcome_status`
  - `pain_point_domain`
  - `pain_points`
  - `replicable_condition`
  - `resistance`
  - `resolution`
- 真名掃描結果：
  - `華巨`: 0
  - `健益`: 0
  - `日盛`: 0
  - `永芳`: 0
- strategy-guide DOM:
  - 全量顯示：`顯示 59 / 共 59 筆`
  - `輔導規劃` 篩選：`顯示 15 / 共 59 筆`
  - `實績案例` 篩選：`顯示 9 / 共 59 筆`
  - 預期成效標章：15
  - 實績標章：9
  - AI模擬示範標章：35
- 預期成效說明文字：存在

## 線上即時資料補驗（2026-07-09）
- 驗證 URL：`https://solution-finder-gray.vercel.app/api/cases`
- 結果：正式機目前仍回傳舊 API 格式。
- 筆數：59
- 第一筆欄位仍為舊 alias：`id, caseId, title, industry, size, solutionType, pain, result, diagnosis, resistance, resolution, replicable, isReal, order`
- 線上正式機 `case_type` 分布：空白 59
- 線上正式機 `outcome_status` 分布：空白 59
- 真名掃描：
  - `華巨`: 0
  - `健益`: 0
  - `日盛`: 0
  - `永芳`: 0
- 判斷：因 `feat-cases-frontend-v1` 尚未建立 PR / Preview，正式機尚未部署本分支新版 `api/cases.js`，所以目前無法用正式機驗證預期標章數 `實績 14 / 預期成效 15 / AI模擬示範 30`。此數字需在 PR Preview 建立後，以 Preview `/api/cases` 重新驗證。

## 驗收截圖
- 全量案例：`_handover/SYNC_cases_frontend_all_2026-07-09.png`
- 輔導規劃／預期成效：`_handover/SYNC_cases_frontend_expected_2026-07-09.png`
- 實績案例：`_handover/SYNC_cases_frontend_actual_2026-07-09.png`

## 檢查
- `node --check api/cases.js`: pass
- `public/strategy-guide.html` inline script syntax: pass
- `public/manufacturing.html` inline script syntax: pass
- 前端敏感欄位字串掃描：pass
- `git diff --check -- api/cases.js public/strategy-guide.html public/manufacturing.html`: pass（僅 Windows CRLF 提示）

## Git
- Branch: `feat-cases-frontend-v1`
- Commit: 本 SYNC 所在 commit（以 `git log -1 --oneline` 為準）
- PR 建立頁：`https://github.com/Pcc329/solution-finder/pull/new/feat-cases-frontend-v1`
- 備註：本機未安裝 `gh`，瀏覽器開啟 PR 建立頁時導向 GitHub 登入頁，因此尚未能直接建立 PR。

---

## v2 更新：案例前端移入 dashboard.html

### 本次需求
- 繼續使用分支：`feat-cases-frontend-v1`
- 將案例知識庫前端從 `public/strategy-guide.html` 移到 `public/dashboard.html`
- `public/strategy-guide.html` 恢復為 `origin/main` 版本
- `api/cases.js` confidentiality 白名單邏輯保持不變
- `public/manufacturing.html` 的 `normalizeReferenceCase` 相容層保持不變
- `public/sources.html` 新增「產業案例知識庫」靜態來源說明

### 實際改動檔案
- `public/dashboard.html`
  - 在 anchor nav 的「服務分類」後、「公司圖譜」前加入「案例知識庫」
  - 在服務分類區塊下方加入 `#cases` 區塊
  - 新增 3 個篩選器：`case_type`、`industry_category`、`pain_point_domain`
  - 新增 `loadCases()`、`renderCases()`、`getCaseBadge()`、`setupCaseLazyLoad()`
  - `/api/cases` 採 lazy-load：點擊 `#cases` 或滾動接近案例區塊才載入，不在 `loadDashboard()` 初始流程載入
- `public/sources.html`
  - 在「各來源詳細說明」的 detail grid 內新增「產業案例知識庫」卡片
  - 靜態顯示：59 筆、實績案例 14 筆／輔導規劃 15 筆／AI 模擬示範 30 筆
- `public/strategy-guide.html`
  - 已恢復為 `origin/main` 版本；`git diff origin/main -- public/strategy-guide.html` 無輸出

### badge / fallback 邏輯
`public/dashboard.html` 的 `getCaseBadge(item)`：

```js
if (item.outcome_status === '預期成效') {
  return '<span class="case-badge expected">預期成效</span>';
}
if (item.outcome_status === '實際成效') {
  return '<span class="case-badge actual">實績</span>';
}
if (item.case_type === 'AI模擬示範') {
  return '<span class="case-badge simulated">AI模擬示範</span>';
}
if (!item.case_type && !item.outcome_status && item.is_real !== true) {
  return '<span class="case-badge simulated">AI模擬示範</span>';
}
return '';
```

說明：
- `outcome_status = '模擬數據'` 不會直接產生 outcome badge
- 若同筆資料 `case_type = 'AI模擬示範'`，AI 模擬示範標章由 `case_type` 產生
- 舊資料 fallback：`case_type` 空、`outcome_status` 空、`is_real !== true` 時顯示 `AI模擬示範`

### confidentiality 白名單實作片段
`api/cases.js` 維持只回傳 `內部可看`、`公開`：

```js
const ALLOWED_CONFIDENTIALITY = new Set(['內部可看', '公開']);

const converted = records
  .filter(rec => {
    const confidentiality = String(rec.fields?.confidentiality || '').trim();
    return ALLOWED_CONFIDENTIALITY.has(confidentiality);
  })
  .map(rec => {
    const fields = rec.fields || {};
    return CASE_FIELD_WHITELIST.reduce((safeFields, fieldName) => {
      if (EXCLUDED_FIELDS.has(fieldName)) return safeFields;
      safeFields[fieldName] = fields[fieldName] ?? '';
      return safeFields;
    }, {});
  });
```

### 線上即時資料補驗
- 驗證 URL：`https://solution-finder-gray.vercel.app/api/cases`
- 驗證時間：2026-07-09
- 結果：正式站目前仍是舊 API 格式，尚未部署本分支新版欄位
- 正式站回傳筆數：59
- 正式站第一筆欄位：`caseId, diagnosis, id, industry, isReal, order, pain, replicable, resistance, resolution, result, size, solutionType, title`
- 正式站 `case_type`：0 筆
- 正式站 `outcome_status`：0 筆
- 正式站 fallback 計算：AI 模擬示範 59 筆（因為舊 API 無新欄位）
- 判斷：預期標章數 `實績 14 / 預期成效 15 / AI模擬示範 30` 需等 PR Preview 部署新版 `api/cases.js` 後再以 Preview `/api/cases` 重驗

### 檢查結果
- `node --check api/cases.js`: pass
- `public/dashboard.html` inline script syntax: pass
- `public/manufacturing.html` inline script syntax: pass
- `git diff --check -- api/cases.js public/dashboard.html public/sources.html public/strategy-guide.html public/manufacturing.html`: pass（僅 CRLF 提示）
- `git diff origin/main -- public/strategy-guide.html`: empty

### Git / PR
- Branch: `feat-cases-frontend-v1`
- PR 建立頁：`https://github.com/Pcc329/solution-finder/pull/new/feat-cases-frontend-v1`
- 本機未安裝 `gh`，需手動用上述 GitHub 連結建立 PR
