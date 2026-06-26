# CODEX SYNC：/api/solutions.js 加入 ds 欄位

日期：2026-06-26
Branch：`feature/inline-expand-multiple-solutions`
PR：https://github.com/Pcc329/solution-finder/pull/81

## 任務

依 `spec_solutions_ds_field_20260626.md`，在 `/api/solutions.js` 回傳格式中加入 `ds` 欄位，對應 Airtable `description_short`。

## 修改檔案

- `api/solutions.js`

## 修改前片段

```javascript
        r: co.region || '',
        st: co.is_startup || false,
        city: co.city || '',
        desc: f['description'] || '',
        feat: f['features_list'] || '',
        tags: co.tech_tags || '',
```

## 修改後片段

```javascript
        r: co.region || '',
        st: co.is_startup || false,
        city: co.city || '',
        ds: f['description_short'] || '',
        desc: f['description'] || '',
        feat: f['features_list'] || '',
        tags: co.tech_tags || '',
```

## 確認

- 只在 `/api/solutions.js` 新增一行：
  - `ds: f['description_short'] || '',`
- 未修改其他欄位
- 未修改 `public/manufacturing.html`
- 未修改 `scoreSolution`
- 未修改 `getRecommendations`
- 未修改 `officialPrograms`
- 未修改 `<script>` 標籤

## 驗證

- `git diff -- api/solutions.js`：確認只有一行新增
- `git diff --check -- api/solutions.js`：通過
- `node --check api/solutions.js`：通過

