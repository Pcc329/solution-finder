# CODEX SYNC：manufacturing.html 參考案例 Phase 1

日期：2026-06-26
Branch：`feature/inline-expand-multiple-solutions`
PR：https://github.com/Pcc329/solution-finder/pull/81

## 任務

依 `spec_reference_cases_phase1_20260626.md`，在 `public/manufacturing.html` 的推薦結果區加入 Phase 1 參考案例區塊。

Phase 1 採 hardcode 測試資料，不串 Airtable、不新增 API。

## 修改檔案

- `public/manufacturing.html`

## referenceCases 資料

新增 `referenceCases` 陣列，共 3 筆測試案例：

- 製造業：中型金屬加工廠導入 AI 排程與報工
- 零售：連鎖零售業導入 CRM 與會員分眾
- 餐飲：小型餐飲業導入 POS 與庫存管理

欄位對應：

- `title`
- `industry`
- `size`
- `solutionType`
- `pain`
- `result`
- `visibility`

## UI 與渲染

新增隱藏區塊：

```html
<section class="card p-5" id="referenceCasesCard" style="display:none">
```

位置：分類篩選區塊下方、推薦方案清單上方。

新增 refs：

```javascript
referenceCasesCard
referenceCaseFilters
referenceCaseList
referenceCaseCount
```

新增函式：

```javascript
hideReferenceCases()
renderReferenceCases()
```

`renderReferenceCases()` 負責：

- 顯示參考案例卡片
- 渲染產業篩選 chip：全部 / 製造業 / 零售 / 餐飲
- 顯示案例數量
- 渲染每張案例卡：
  - 標題
  - 產業 chip
  - 解決方案類型 chip
  - 公司規模 chip
  - 可見性 badge
  - 導入痛點
  - 導入成果

## 顯示 / 隱藏邏輯

- `renderResult()` 內呼叫 `renderReferenceCases()`，推薦完成後顯示案例區塊。
- `resetAgent()` 內呼叫 `hideReferenceCases()`，重新開始時隱藏案例區塊。
- `clearAllFiles()` 內呼叫 `hideReferenceCases()`，清除檔案時隱藏案例區塊。

## 未修改

- 未修改 `/api/`
- 未修改 `scoreSolution`
- 未修改 `getRecommendations`
- 未修改 `officialPrograms`
- 未修改分類篩選邏輯
- 未修改複數行內展開邏輯
- 未修改 `description_short / ds` 讀取邏輯
- 未修改 `<script>` 標籤設定

## 驗證

- `git diff --name-only`：只有 `public/manufacturing.html`
- `git diff --check -- public/manufacturing.html`：通過
- `public/manufacturing.html` inline script `new Function()` 語法檢查：通過
- `node --check api/manufacturing-recommend.js`：通過

